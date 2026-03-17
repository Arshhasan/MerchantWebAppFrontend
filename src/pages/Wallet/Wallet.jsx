import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument } from '../../firebase/firestore';
import PayPalSetup from '../../components/PaymentSetup/PayPalSetup';
import StripeSetup from '../../components/PaymentSetup/StripeSetup';
import { getWithdrawMethodDocByUserId, removePayPalWithdrawMethod, removeStripeWithdrawMethod } from '../../services/withdrawMethodService';
import './Wallet.css';

const Wallet = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [vendorId, setVendorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [withdrawMethod, setWithdrawMethod] = useState(null);
  const [showPayPalSetup, setShowPayPalSetup] = useState(false);
  const [showStripeSetup, setShowStripeSetup] = useState(false);

  const refreshWithdrawMethod = async (resolvedVendorId) => {
    if (!resolvedVendorId) return;
    const res = await getWithdrawMethodDocByUserId(resolvedVendorId);
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

  const withdrawalMethods = useMemo(() => ([
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
  ]), []);

  return (
    <div className="wallet-page">
      <div className="wallet-header">
        <h1>Add a withdrawal method</h1>
      </div>
      <div className="wallet-content">
        <p className="wallet-subtitle">Setup your preferred withdrawal method for receiving your payments.</p>
        
        <div className="withdrawal-methods-section">
          <h2 className="section-title">Available Withdrawal Methods</h2>
          
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
                    <button className="btn-setup btn-setup-secondary" onClick={() => setShowStripeSetup(true)}>
                      Edit
                    </button>
                    <button className="btn-setup" onClick={handleDisconnectStripe}>
                      Remove
                    </button>
                  </div>
                ) : null}
                {method.id === 'paypal' && paypalConnected ? (
                  <div className="wallet-method-actions">
                    <span className="setup-badge">Setup done</span>
                    <button className="btn-setup btn-setup-secondary" onClick={() => setShowPayPalSetup(true)}>
                      Edit
                    </button>
                    <button className="btn-setup" onClick={handleDisconnectPayPal}>
                      Remove
                    </button>
                  </div>
                ) : method.id === 'stripe' && stripeConnected ? null : (
                  <button
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
