import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument } from '../../firebase/firestore';
import PayPalSetup from '../../components/PaymentSetup/PayPalSetup';
import StripeSetup from '../../components/PaymentSetup/StripeSetup';
import {
  getWithdrawMethodDocByUserId,
  removePayPalWithdrawMethod,
  removeStripeWithdrawMethod,
} from '../../services/withdrawMethodService';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { getVendorOrdersOnce } from '../../services/orderQuery';
import { computeOrderPayableTotal, resolveOrderVendorId } from '../../services/orderSchema';
import { isOrderEligibleForPayout } from '../../services/payoutRequest';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import { useMerchantWalletSummary } from '../../hooks/useMerchantWalletSummary';
import './Wallet.css';

const Wallet = () => {
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

  const withdrawalMethods = useMemo(
    () => [
      {
        id: 'stripe',
        name: 'Stripe',
        logo: (
          <div className="payment-logo stripe-logo">
            <span>stripe</span>
          </div>
        ),
      },
      {
        id: 'paypal',
        name: 'PayPal',
        logo: (
          <div className="payment-logo paypal-logo">
            <span>PayPal</span>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="wallet-page">
      <div className="wallet-header">
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
          Settlement requests are created automatically each Wednesday (UTC). Add PayPal or Stripe so we know
          where to send your funds.
        </p>

        <p className="wallet-subtitle">Withdrawal methods</p>

        <div className="withdrawal-methods-section">
          <h2 className="section-title">PayPal &amp; Stripe</h2>

          <div className="withdrawal-methods-list">
            {withdrawalMethods.map((method) => (
              <div key={method.id} className="withdrawal-method-item">
                <div className="method-info">
                  {method.logo}
                  <span className="method-name">{method.name}</span>
                </div>
                {method.id === 'stripe' && stripeConnected ? (
                  <div className="wallet-method-actions">
                    <span className="setup-badge">Setup done</span>
                    <button type="button" className="btn-setup btn-setup-secondary" onClick={() => setShowStripeSetup(true)}>
                      Edit
                    </button>
                    <button type="button" className="btn-setup" onClick={handleDisconnectStripe}>
                      Remove
                    </button>
                  </div>
                ) : null}
                {method.id === 'paypal' && paypalConnected ? (
                  <div className="wallet-method-actions">
                    <span className="setup-badge">Setup done</span>
                    <button type="button" className="btn-setup btn-setup-secondary" onClick={() => setShowPayPalSetup(true)}>
                      Edit
                    </button>
                    <button type="button" className="btn-setup" onClick={handleDisconnectPayPal}>
                      Remove
                    </button>
                  </div>
                ) : method.id === 'stripe' && stripeConnected ? null : (
                  <button
                    type="button"
                    className="btn-setup"
                    onClick={() => handleSetup(method.id)}
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Setup'}
                  </button>
                )}
              </div>
            ))}
          </div>
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
    </div>
  );
};

export default Wallet;
