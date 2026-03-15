import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { savePaymentCredentials } from '../../services/paymentGateways';
import './PaymentSetup.css';

const StripeSetup = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    publishableKey: '',
    secretKey: '',
    accountId: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.publishableKey || !formData.secretKey) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await savePaymentCredentials(user.uid, 'stripe', {
        publishableKey: formData.publishableKey,
        secretKey: formData.secretKey,
        accountId: formData.accountId || '',
      });

      if (result.success) {
        showToast('Stripe account connected successfully!', 'success');
        onSuccess && onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Failed to connect Stripe account', 'error');
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error);
      showToast('An error occurred while connecting Stripe', 'error');
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
            <label htmlFor="publishableKey">
              Publishable Key <span className="required">*</span>
            </label>
            <input
              type="text"
              id="publishableKey"
              name="publishableKey"
              value={formData.publishableKey}
              onChange={handleChange}
              placeholder="pk_test_..."
              required
            />
            <small className="form-hint">
              Find this in your Stripe Dashboard → Developers → API keys
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="secretKey">
              Secret Key <span className="required">*</span>
            </label>
            <input
              type="password"
              id="secretKey"
              name="secretKey"
              value={formData.secretKey}
              onChange={handleChange}
              placeholder="sk_test_..."
              required
            />
            <small className="form-hint">
              Keep this secure. Never share your secret key publicly.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="accountId">Account ID (Optional)</label>
            <input
              type="text"
              id="accountId"
              name="accountId"
              value={formData.accountId}
              onChange={handleChange}
              placeholder="acct_..."
            />
            <small className="form-hint">
              Your Stripe account ID (if using Connect)
            </small>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect Stripe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StripeSetup;
