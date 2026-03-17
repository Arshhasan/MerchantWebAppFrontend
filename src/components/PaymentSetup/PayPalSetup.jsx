import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument } from '../../firebase/firestore';
import { upsertPayPalWithdrawMethod } from '../../services/withdrawMethodService';
import './PaymentSetup.css';

const PayPalSetup = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
  });
  const [vendorId, setVendorId] = useState(null);

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!vendorId) {
      showToast('Please set up your store first (vendor ID missing).', 'error');
      return;
    }

    if (!formData.email) {
      showToast('Please enter your PayPal email', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await upsertPayPalWithdrawMethod({
        userId: vendorId,
        email: formData.email.trim(),
      });

      if (result.success) {
        showToast('PayPal withdrawal method saved successfully!', 'success');
        onSuccess && onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Failed to save PayPal withdrawal method', 'error');
      }
    } catch (error) {
      console.error('Error connecting PayPal:', error);
      showToast('An error occurred while saving PayPal details', 'error');
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
          <small className="form-hint">
            This email will be used for PayPal payouts (stored in Firestore like the merchant panel).
          </small>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save PayPal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayPalSetup;
