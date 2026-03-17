import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument } from '../../firebase/firestore';
import { upsertStripeWithdrawMethod } from '../../services/withdrawMethodService';
import './PaymentSetup.css';

const StripeSetup = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  const [accountId, setAccountId] = useState('');

  useEffect(() => {
    const loadVendorId = async () => {
      if (!user) return;
      const userDoc = await getDocument('users', user.uid);
      if (userDoc.success && userDoc.data?.vendorID) {
        setVendorId(userDoc.data.vendorID);
      }
    };
    loadVendorId();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!vendorId) {
      showToast('Please set up your store first (vendor ID missing).', 'error');
      return;
    }

    const trimmed = accountId.trim();
    if (!trimmed) {
      showToast('Please enter your Stripe Account ID', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await upsertStripeWithdrawMethod({ userId: vendorId, accountId: trimmed });
      if (result.success) {
        showToast('Stripe withdrawal method saved successfully!', 'success');
        onSuccess && onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Failed to save Stripe withdrawal method', 'error');
      }
    } catch (error) {
      console.error('Error saving Stripe:', error);
      showToast('An error occurred while saving Stripe details', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-setup-modal">
      <div className="payment-setup-content">
        <div className="payment-setup-header">
          <h2>Connect Stripe Account</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="payment-setup-form">
          <div className="form-group">
            <label htmlFor="stripeAccountId">
              Stripe Account ID <span className="required">*</span>
            </label>
            <input
              type="text"
              id="stripeAccountId"
              name="stripeAccountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. acct_1234..."
              required
            />
            <small className="form-hint">
              Add your Stripe connected account ID here (stored in Firestore like the merchant panel).
            </small>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Stripe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StripeSetup;
