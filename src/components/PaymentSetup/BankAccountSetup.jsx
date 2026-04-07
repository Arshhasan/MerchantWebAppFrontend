import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument } from '../../firebase/firestore';
import { upsertBankWithdrawMethod } from '../../services/withdrawMethodService';
import './PaymentSetup.css';

/**
 * @param {{ onClose: () => void; onSuccess?: () => void; initialBank?: Record<string, unknown> | null }} props
 */
const BankAccountSetup = ({ onClose, onSuccess, initialBank = null }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  const [formData, setFormData] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    iban: '',
    swiftBic: '',
  });

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

  useEffect(() => {
    if (!initialBank || typeof initialBank !== 'object') return;
    setFormData({
      accountHolderName: String(initialBank.accountHolderName ?? ''),
      bankName: String(initialBank.bankName ?? ''),
      accountNumber: String(initialBank.accountNumber ?? ''),
      routingNumber: String(initialBank.routingNumber ?? ''),
      iban: String(initialBank.iban ?? ''),
      swiftBic: String(initialBank.swiftBic ?? ''),
    });
  }, [initialBank]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) {
      showToast('Please set up your store first (vendor ID missing).', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await upsertBankWithdrawMethod({
        userId: vendorId,
        accountHolderName: formData.accountHolderName,
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        routingNumber: formData.routingNumber,
        iban: formData.iban,
        swiftBic: formData.swiftBic,
      });

      if (result.success) {
        showToast('Bank details saved successfully.', 'success');
        onSuccess && onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Failed to save bank details', 'error');
      }
    } catch (error) {
      console.error('Error saving bank details:', error);
      showToast('An error occurred while saving bank details', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-setup-modal">
      <div className="payment-setup-content payment-setup-content--wide payment-setup-bank">
        <div className="payment-setup-header">
          <h2>Bank account for payouts</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="payment-setup-form">
          <p className="form-hint bank-setup-intro">
            Wire or local transfer — use the same details your finance team expects for settlements.
          </p>

          <div className="bank-form-compact">
            <div className="form-group">
              <label htmlFor="accountHolderName">
                Account holder <span className="required">*</span>
              </label>
              <input
                type="text"
                id="accountHolderName"
                name="accountHolderName"
                value={formData.accountHolderName}
                onChange={handleChange}
                autoComplete="name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="bankName">
                Bank name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="bankName"
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="accountNumber">Account no.</label>
              <input
                type="text"
                id="accountNumber"
                name="accountNumber"
                value={formData.accountNumber}
                onChange={handleChange}
                autoComplete="off"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label htmlFor="iban">IBAN</label>
              <input
                type="text"
                id="iban"
                name="iban"
                value={formData.iban}
                onChange={handleChange}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="routingNumber">Routing / sort / IFSC</label>
              <input
                type="text"
                id="routingNumber"
                name="routingNumber"
                value={formData.routingNumber}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="swiftBic">SWIFT / BIC</label>
              <input
                type="text"
                id="swiftBic"
                name="swiftBic"
                value={formData.swiftBic}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>
          </div>

          <small className="form-hint bank-setup-foot">
            Require account no. <strong>or</strong> IBAN. Stored in wallet settings.
          </small>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save bank details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BankAccountSetup;
