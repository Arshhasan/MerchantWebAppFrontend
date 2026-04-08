import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument } from '../../firebase/firestore';
import BankAccountSetup from '../../components/PaymentSetup/BankAccountSetup';
import PayPalSetup from '../../components/PaymentSetup/PayPalSetup';
import StripeSetup from '../../components/PaymentSetup/StripeSetup';
import {
  getWithdrawMethodDocByUserId,
  removeBankWithdrawMethod,
  removePayPalWithdrawMethod,
  removeStripeWithdrawMethod,
} from '../../services/withdrawMethodService';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { getVendorOrdersOnce } from '../../services/orderQuery';
import { computeOrderPayableTotal, resolveOrderVendorId } from '../../services/orderSchema';
import { isOrderEligibleForPayout } from '../../services/payoutRequest';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import { publicUrl } from '../../utils/publicUrl';
import { useMerchantWalletSummary } from '../../hooks/useMerchantWalletSummary';
import './Wallet.css';

/** Last few chars for display (account / IBAN). */
function endingDigits(value) {
  const s = String(value || '').replace(/\s/g, '');
  if (s.length < 4) return s || '—';
  return s.slice(-4);
}

const Wallet = () => {
  const navigate = useNavigate();
  const { user, userProfile, vendorProfile, vendorLoading } = useAuth();
  const { showToast } = useToast();
  const [vendorId, setVendorId] = useState(null);
  const [resolvedVendorId, setResolvedVendorId] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [withdrawMethod, setWithdrawMethod] = useState(null);
  const [showPayPalSetup, setShowPayPalSetup] = useState(false);
  const [showStripeSetup, setShowStripeSetup] = useState(false);
  const [showBankSetup, setShowBankSetup] = useState(false);
  const { loading: walletSummaryLoading, walletBalance: walletBalanceFromFirestore } =
    useMerchantWalletSummary(resolvedVendorId, 0);

  const refreshWithdrawMethod = async (id) => {
    if (!id) return;
    const res = await getWithdrawMethodDocByUserId(id);
    if (res.success) setWithdrawMethod(res.data);
  };

  useEffect(() => {
    const loadVendorAndWithdrawMethod = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const userDoc = await getDocument('users', user.uid);
        const vId = userDoc.success ? userDoc.data?.vendorID : null;
        setVendorId(vId || null);
        if (vId) {
          await refreshWithdrawMethod(vId);
        }
      } catch (e) {
        console.error('Error loading wallet data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadVendorAndWithdrawMethod();
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setResolvedVendorId(null);
        return;
      }
      try {
        const resolved = await resolveMerchantVendorId(user.uid);
        if (!cancelled) setResolvedVendorId(resolved);
      } catch (e) {
        console.error('Wallet: resolveMerchantVendorId failed', e);
        if (!cancelled) setResolvedVendorId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAllOrders([]);
      setOrdersLoading(false);
      return;
    }
    const orderCandidates = [...new Set([userProfile?.vendorID, resolvedVendorId, user.uid].filter(Boolean))];
    if (orderCandidates.length === 0) {
      setAllOrders([]);
      setOrdersLoading(false);
      return;
    }
    let cancelled = false;
    setOrdersLoading(true);
    (async () => {
      try {
        const orders = await getVendorOrdersOnce(orderCandidates);
        if (!cancelled) setAllOrders(orders);
      } catch (e) {
        console.error('Wallet: orders load failed', e);
        if (!cancelled) setAllOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, userProfile?.vendorID, resolvedVendorId]);

  const orderDerivedUnsettled = useMemo(() => {
    const vendorCandidates = new Set([userProfile?.vendorID, resolvedVendorId, user?.uid].filter(Boolean));
    if (vendorCandidates.size === 0) return 0;
    const ordersForMerchant = allOrders.filter((o) => vendorCandidates.has(resolveOrderVendorId(o)));
    const eligible = ordersForMerchant.filter((o) => isOrderEligibleForPayout(o));
    return Math.round(eligible.reduce((sum, o) => sum + computeOrderPayableTotal(o), 0) * 100) / 100;
  }, [allOrders, userProfile?.vendorID, resolvedVendorId, user?.uid]);

  const displayWalletBalance =
    walletBalanceFromFirestore != null ? walletBalanceFromFirestore : orderDerivedUnsettled;

  const totalEarnings = Number(vendorProfile?.dashboardStats?.totalEarnings) || 0;

  const formatCurrency = (amount) => formatMerchantCurrency(amount, vendorProfile);

  const balanceStillLoading = walletSummaryLoading || ordersLoading;

  const paypalConnected = Boolean(withdrawMethod?.paypal?.email);
  const stripeConnected = Boolean(withdrawMethod?.stripe?.accountId);
  const bankConnected = Boolean(
    withdrawMethod?.bank &&
      (String(withdrawMethod.bank.accountNumber || '').trim() ||
        String(withdrawMethod.bank.iban || '').trim())
  );

  const handleSetup = (methodId) => {
    if (methodId === 'stripe') {
      if (!vendorId) {
        showToast('Please set up your store first.', 'warning');
        return;
      }
      setShowStripeSetup(true);
      return;
    }
    if (methodId === 'paypal') {
      if (!vendorId) {
        showToast('Please set up your store first.', 'warning');
        return;
      }
      setShowPayPalSetup(true);
      return;
    }
    if (methodId === 'bank') {
      if (!vendorId) {
        showToast('Please set up your store first.', 'warning');
        return;
      }
      setShowBankSetup(true);
      return;
    }
    showToast('Setup for this method will be added soon.', 'info');
  };

  const handleDisconnectPayPal = async () => {
    if (!vendorId) return;
    const res = await removePayPalWithdrawMethod({ userId: vendorId });
    if (res.success) {
      showToast('PayPal withdrawal method removed', 'success');
      await refreshWithdrawMethod(vendorId);
    } else {
      showToast(res.error || 'Failed to remove PayPal method', 'error');
    }
  };

  const handleDisconnectStripe = async () => {
    if (!vendorId) return;
    const res = await removeStripeWithdrawMethod({ userId: vendorId });
    if (res.success) {
      showToast('Stripe withdrawal method removed', 'success');
      await refreshWithdrawMethod(vendorId);
    } else {
      showToast(res.error || 'Failed to remove Stripe method', 'error');
    }
  };

  const handleDisconnectBank = async () => {
    if (!vendorId) return;
    const res = await removeBankWithdrawMethod({ userId: vendorId });
    if (res.success) {
      showToast('Bank account details removed', 'success');
      await refreshWithdrawMethod(vendorId);
    } else {
      showToast(res.error || 'Failed to remove bank details', 'error');
    }
  };

  const openEditForMethod = (methodId) => {
    if (methodId === 'stripe') setShowStripeSetup(true);
    else if (methodId === 'paypal') setShowPayPalSetup(true);
    else if (methodId === 'bank') setShowBankSetup(true);
  };

  const withdrawalMethods = useMemo(
    () => [
      { id: 'stripe', name: 'Stripe', iconSrc: 'stripe.png', iconAlt: 'Stripe' },
      { id: 'paypal', name: 'PayPal', iconSrc: 'paypal.png', iconAlt: 'PayPal' },
      { id: 'bank', name: 'Bank account', iconSrc: 'bank.png', iconAlt: 'Bank account' },
    ],
    []
  );

  return (
    <div className="wallet-page">
      <div className="wallet-header">
        <button className="back-button" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Wallet</h1>
      </div>
      <div className="wallet-content">
        <div className="wallet-kpi-row">
          <div className="wallet-kpi" aria-labelledby="wallet-kpi-earnings">
            <div id="wallet-kpi-earnings" className="wallet-kpi__label">
              Total earnings
            </div>
            <div className="wallet-kpi__value" aria-live="polite">
              {vendorLoading && !vendorProfile ? '…' : formatCurrency(totalEarnings)}
            </div>
          </div>
          <div className="wallet-kpi wallet-kpi--accent" aria-labelledby="wallet-kpi-wallet">
            <div id="wallet-kpi-wallet" className="wallet-kpi__label">
              Weekly Payout
            </div>
            <div className="wallet-kpi__value wallet-kpi__value--accent" aria-live="polite">
              {balanceStillLoading ? '…' : formatCurrency(displayWalletBalance)}
            </div>
          </div>
        </div>

        <p className="wallet-auto-note">
          Settlement requests are created automatically each Wednesday (UTC). Add Stripe, PayPal, or a bank
          account so we know where to send your funds.
        </p>

        <p className="wallet-payout-section-label">Payout methods</p>

        <div className="wallet-payout-card">
          {withdrawalMethods.map((method) => {
            const connected =
              method.id === 'stripe'
                ? stripeConnected
                : method.id === 'paypal'
                  ? paypalConnected
                  : method.id === 'bank'
                    ? bankConnected
                    : false;

            return (
              <div key={method.id} className="wallet-payout-row">
                <div className="wallet-payout-icon-wrap">
                  <img src={publicUrl(method.iconSrc)} alt={method.iconAlt} width={34} height={34} />
                </div>
                <div className="wallet-payout-row-text">
                  <span className="wallet-payout-name">{method.name}</span>
                  {method.id === 'bank' && bankConnected && withdrawMethod?.bank?.bankName ? (
                    <span className="wallet-payout-detail">
                      {withdrawMethod.bank.bankName}
                      {' · '}
                      {withdrawMethod.bank.iban
                        ? `IBAN ending ${endingDigits(withdrawMethod.bank.iban)}`
                        : `Account ending ${endingDigits(withdrawMethod.bank.accountNumber)}`}
                    </span>
                  ) : null}
                </div>
                {connected ? (
                  <div className="wallet-payout-row-trailing">
                    <span className="wallet-payout-linked" title="Linked">
                      <span className="wallet-payout-check" aria-hidden>
                        ✓
                      </span>
                    </span>
                    <button
                      type="button"
                      className="wallet-payout-text-btn"
                      onClick={() => openEditForMethod(method.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="wallet-payout-text-btn wallet-payout-text-btn--danger"
                      onClick={() => {
                        if (method.id === 'stripe') handleDisconnectStripe();
                        else if (method.id === 'paypal') handleDisconnectPayPal();
                        else if (method.id === 'bank') handleDisconnectBank();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="wallet-payout-add"
                    onClick={() => handleSetup(method.id)}
                    disabled={loading}
                    aria-label={`Add ${method.name}`}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showStripeSetup && (
        <StripeSetup
          onClose={() => setShowStripeSetup(false)}
          onSuccess={async () => {
            if (vendorId) await refreshWithdrawMethod(vendorId);
          }}
        />
      )}

      {showPayPalSetup && (
        <PayPalSetup
          onClose={() => setShowPayPalSetup(false)}
          onSuccess={async () => {
            if (vendorId) await refreshWithdrawMethod(vendorId);
          }}
        />
      )}

      {showBankSetup && (
        <BankAccountSetup
          initialBank={withdrawMethod?.bank || null}
          onClose={() => setShowBankSetup(false)}
          onSuccess={async () => {
            if (vendorId) await refreshWithdrawMethod(vendorId);
          }}
        />
      )}
    </div>
  );
};

export default Wallet;
