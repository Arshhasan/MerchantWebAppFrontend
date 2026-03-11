import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument, createDocument, updateDocument } from '../../firebase/firestore';
import './PhoneNumbers.css';

const PhoneNumbers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState([
    { id: Date.now(), number: '', label: 'Primary', isPrimary: true },
  ]);

  useEffect(() => {
    if (user) {
      loadPhoneNumbers();
    }
  }, [user]);

  const loadPhoneNumbers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await getDocument('merchant_outlet_info', user.uid);
      
      if (result.success && result.data && result.data.phoneNumbers && result.data.phoneNumbers.length > 0) {
        setPhoneNumbers(result.data.phoneNumbers);
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error);
      showToast('Failed to load phone numbers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhone = () => {
    setPhoneNumbers(prev => [
      ...prev,
      { id: Date.now(), number: '', label: '', isPrimary: false }
    ]);
  };

  const handleRemovePhone = (id) => {
    if (phoneNumbers.length === 1) {
      showToast('At least one phone number is required', 'error');
      return;
    }
    setPhoneNumbers(prev => prev.filter(phone => phone.id !== id));
  };

  const handlePhoneChange = (id, field, value) => {
    setPhoneNumbers(prev => prev.map(phone => {
      if (phone.id === id) {
        if (field === 'isPrimary' && value) {
          // If setting this as primary, unset others
          return { ...phone, [field]: value };
        }
        return { ...phone, [field]: value };
      }
      // If setting a phone as primary, unset others
      if (field === 'isPrimary' && value) {
        return { ...phone, isPrimary: false };
      }
      return phone;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    // Validate at least one phone number
    const validPhones = phoneNumbers.filter(phone => phone.number.trim() !== '');
    if (validPhones.length === 0) {
      showToast('Please add at least one phone number', 'error');
      return;
    }

    // Ensure at least one is primary
    const hasPrimary = validPhones.some(phone => phone.isPrimary);
    if (!hasPrimary && validPhones.length > 0) {
      validPhones[0].isPrimary = true;
    }

    try {
      setSaving(true);

      // Check if document exists
      const existingDoc = await getDocument('merchant_outlet_info', user.uid);
      
      const phoneData = {
        merchantId: user.uid,
        phoneNumbers: validPhones,
      };

      if (existingDoc.success && existingDoc.data) {
        // Update existing document
        const result = await updateDocument('merchant_outlet_info', user.uid, phoneData);
        if (result.success) {
          showToast('Phone numbers updated successfully!', 'success');
        } else {
          throw new Error(result.error || 'Failed to update phone numbers');
        }
      } else {
        // Create new document
        const result = await createDocument('merchant_outlet_info', phoneData, user.uid);
        if (result.success) {
          showToast('Phone numbers saved successfully!', 'success');
        } else {
          throw new Error(result.error || 'Failed to save phone numbers');
        }
      }
    } catch (error) {
      console.error('Error saving phone numbers:', error);
      showToast(error.message || 'Failed to save phone numbers', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="phone-numbers-page">
        <div className="page-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Phone Numbers</h1>
        </div>
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-numbers-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Phone Numbers</h1>
      </div>

      <div className="phone-numbers-content">
        <form onSubmit={handleSubmit} className="phone-numbers-form">
          <div className="phones-list">
            {phoneNumbers.map((phone, index) => (
              <div key={phone.id} className="phone-row">
                <div className="phone-inputs">
                  <div className="input-group">
                    <label>Phone Number *</label>
                    <input
                      type="tel"
                      value={phone.number}
                      onChange={(e) => handlePhoneChange(phone.id, 'number', e.target.value)}
                      placeholder="+1234567890"
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Label</label>
                    <input
                      type="text"
                      value={phone.label}
                      onChange={(e) => handlePhoneChange(phone.id, 'label', e.target.value)}
                      placeholder="e.g., Primary, Delivery, Support"
                    />
                  </div>
                  <div className="input-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={phone.isPrimary}
                        onChange={(e) => handlePhoneChange(phone.id, 'isPrimary', e.target.checked)}
                      />
                      <span>Primary</span>
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => handleRemovePhone(phone.id)}
                  disabled={phoneNumbers.length === 1}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-add"
            onClick={handleAddPhone}
          >
            + Add Phone Number
          </button>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Phone Numbers'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PhoneNumbers;
