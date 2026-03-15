import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { savePaymentCredentials } from '../../services/paymentGateways';
import './PaymentSetup.css';

const FlutterwaveSetup = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    publicKey: '',
    secretKey: '',
    encryptionKey: '',
    merchantId: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.publicKey || !formData.secretKey) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await savePaymentCredentials(user.uid, 'flutterwave', {
        publicKey: formData.publicKey,
        secretKey: formData.secretKey,
        encryptionKey: formData.encryptionKey || '',
        merchantId: formData.merchantId || '',
      });

      if (result.success) {
        showToast('Flutterwave account connected successfully!', 'success');
        onSuccess && onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Failed to connect Flutterwave account', 'error');
      }
    } catch (error) {
      console.error('Error connecting Flutterwave:', error);
      showToast('An error occurred while connecting Flutterwave', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-setup-modal">
      <div className="payment-setup-content">
        <div className="payment-setup-header">
          <h2>Connect Flutterwave Account</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="payment-setup-form">
          <div className="form-group">
            <label htmlFor="publicKey">
              Public Key <span className="required">*</span>
            </label>
            <input
              type="text"
              id="publicKey"
              name="publicKey"
              value={formData.publicKey}
              onChange={handleChange}
              placeholder="FLWPUBK-..."
              required
            />
            <small className="form-hint">
              Find this in your Flutterwave Dashboard → Settings → API Keys
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
              placeholder="FLWSECK-..."
              required
            />
            <small className="form-hint">
              Keep this secure. Never share your secret key publicly.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="encryptionKey">Encryption Key (Optional)</label>
            <input
              type="password"
              id="encryptionKey"
              name="encryptionKey"
              value={formData.encryptionKey}
              onChange={handleChange}
              placeholder="Your encryption key"
            />
          </div>

          <div className="form-group">
            <label htmlFor="merchantId">Merchant ID (Optional)</label>
            <input
              type="text"
              id="merchantId"
              name="merchantId"
              value={formData.merchantId}
              onChange={handleChange}
              placeholder="Your merchant ID"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect Flutterwave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlutterwaveSetup;
