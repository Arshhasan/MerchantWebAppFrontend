import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { savePaymentCredentials } from '../../services/paymentGateways';
import './PaymentSetup.css';

const PayPalSetup = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    email: '',
    mode: 'sandbox', // sandbox or live
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.clientId || !formData.clientSecret || !formData.email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await savePaymentCredentials(user.uid, 'paypal', {
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        email: formData.email,
        mode: formData.mode,
      });

      if (result.success) {
        showToast('PayPal account connected successfully!', 'success');
        onSuccess && onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Failed to connect PayPal account', 'error');
      }
    } catch (error) {
      console.error('Error connecting PayPal:', error);
      showToast('An error occurred while connecting PayPal', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-setup-modal">
      <div className="payment-setup-content">
        <div className="payment-setup-header">
          <h2>Connect PayPal Account</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="payment-setup-form">
          <div className="form-group">
            <label htmlFor="email">
              PayPal Email <span className="required">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your-email@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="clientId">
              Client ID <span className="required">*</span>
            </label>
            <input
              type="text"
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              placeholder="Your PayPal Client ID"
              required
            />
            <small className="form-hint">
              Find this in PayPal Developer Dashboard → My Apps & Credentials
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="clientSecret">
              Client Secret <span className="required">*</span>
            </label>
            <input
              type="password"
              id="clientSecret"
              name="clientSecret"
              value={formData.clientSecret}
              onChange={handleChange}
              placeholder="Your PayPal Client Secret"
              required
            />
            <small className="form-hint">
              Keep this secure. Never share your client secret publicly.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="mode">Environment</label>
            <select
              id="mode"
              name="mode"
              value={formData.mode}
              onChange={handleChange}
            >
              <option value="sandbox">Sandbox (Testing)</option>
              <option value="live">Live (Production)</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect PayPal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayPalSetup;
