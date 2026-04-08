import { useEffect, useMemo, useRef, useState } from 'react';
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
    { id: Date.now(), countryCode: '+1', number: '', isPrimary: true },
  ]);

  // Match Login/Signup country picker (flagcdn + dial code)
  const countryCodes = useMemo(
    () => [
      { code: '+1', flag: 'ca', name: 'Canada' },
      { code: '+44', flag: 'gb', name: 'United Kingdom' },
      { code: '+91', flag: 'in', name: 'India' },
      { code: '+92', flag: 'pk', name: 'Pakistan' },
      { code: '+971', flag: 'ae', name: 'United Arab Emirates' },
      { code: '+61', flag: 'au', name: 'Australia' },
      { code: '+49', flag: 'de', name: 'Germany' },
      { code: '+33', flag: 'fr', name: 'France' },
    ],
    []
  );

  const getFlagCdnUrl = (isoCode) =>
    `https://flagcdn.com/24x18/${String(isoCode || '').toLowerCase()}.png`;

  const [openCountryForId, setOpenCountryForId] = useState(null);
  const countryDropdownRef = useRef(null);

  useEffect(() => {
    if (!openCountryForId) return undefined;
    const onDocMouseDown = (event) => {
      if (!countryDropdownRef.current?.contains(event.target)) {
        setOpenCountryForId(null);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openCountryForId]);

  const normalizeLoadedPhones = (loaded) => {
    const arr = Array.isArray(loaded) ? loaded : [];
    if (arr.length === 0) return null;

    const normalized = arr.map((p) => {
      const id = p.id || Date.now() + Math.random();
      const isPrimary = !!p.isPrimary;

      // New shape already present
      if (p.countryCode || p.number) {
        const cc = String(p.countryCode || '+').trim() || '+';
        const num = String(p.number || '').replace(/\D/g, '');
        return {
          id,
          countryCode: cc.startsWith('+') ? cc : `+${cc.replace(/\D/g, '')}`,
          number: num,
          isPrimary,
        };
      }

      // Legacy shape: { number: "+1234567890" }
      const legacy = String(p.number || '').trim();
      const match = legacy.match(/^(\+\d{1,4})\s*(.*)$/);
      const countryCode = match?.[1] || '+1';
      const number = String(match?.[2] || legacy).replace(/\D/g, '');
      return { id, countryCode, number, isPrimary };
    });

    // Ensure single primary
    const primaryIndex = normalized.findIndex((p) => p.isPrimary);
    if (primaryIndex === -1) normalized[0].isPrimary = true;
    if (primaryIndex > -1) {
      normalized.forEach((p, idx) => {
        if (idx !== primaryIndex) p.isPrimary = false;
      });
    }

    return normalized;
  };

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
        const normalized = normalizeLoadedPhones(result.data.phoneNumbers);
        if (normalized) setPhoneNumbers(normalized);
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
      { id: Date.now(), countryCode: '+1', number: '', isPrimary: false }
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
    setPhoneNumbers((prev) => prev.map((phone) => {
      if (phone.id !== id) return phone;
      if (field === 'countryCode') {
        const raw = String(value || '').trim();
        const next = raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
        return { ...phone, countryCode: next === '+' ? '+1' : next };
      }
      if (field === 'number') {
        return { ...phone, number: String(value || '').replace(/\D/g, '') };
      }
      return { ...phone, [field]: value };
    }));
  };

  const handleSetPrimary = (id) => {
    setPhoneNumbers((prev) => prev.map((p) => ({ ...p, isPrimary: p.id === id })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    // Validate at least one phone number
    const validPhones = phoneNumbers
      .map((p) => ({
        ...p,
        countryCode: String(p.countryCode || '').trim() || '+1',
        number: String(p.number || '').replace(/\D/g, ''),
      }))
      .filter((phone) => phone.number.trim() !== '');
    if (validPhones.length === 0) {
      showToast('Please add at least one phone number', 'error');
      return;
    }

    // Ensure at least one is primary
    const hasPrimary = validPhones.some(phone => phone.isPrimary);
    if (!hasPrimary && validPhones.length > 0) {
      validPhones[0].isPrimary = true;
    }
    // Ensure only one primary
    const primaryIdx = validPhones.findIndex((p) => p.isPrimary);
    validPhones.forEach((p, idx) => {
      p.isPrimary = idx === (primaryIdx === -1 ? 0 : primaryIdx);
    });

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
          navigate('/dashboard', { replace: true });
        } else {
          throw new Error(result.error || 'Failed to update phone numbers');
        }
      } else {
        // Create new document
        const result = await createDocument('merchant_outlet_info', phoneData, user.uid);
        if (result.success) {
          showToast('Phone numbers saved successfully!', 'success');
          navigate('/dashboard', { replace: true });
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
            {phoneNumbers.map((phone) => (
              <div key={phone.id} className="phone-row">
                <div className="input-group phone-row__countryCode">
                  <label htmlFor={`cc-${phone.id}`}>Country</label>
                  <div className="phone-country-picker" ref={openCountryForId === phone.id ? countryDropdownRef : null}>
                    <button
                      id={`cc-${phone.id}`}
                      type="button"
                      className="phone-country-btn"
                      onClick={() => setOpenCountryForId((prev) => (prev === phone.id ? null : phone.id))}
                      aria-haspopup="listbox"
                      aria-expanded={openCountryForId === phone.id}
                    >
                      {'\u00A0'}
                      <img
                        src={getFlagCdnUrl((countryCodes.find((c) => c.code === phone.countryCode) || countryCodes[0]).flag)}
                        alt=""
                        className="phone-country-flag"
                        loading="lazy"
                      />
                      <span className="phone-country-code">{phone.countryCode || '+1'}</span>
                      <svg
                        className={`phone-country-caret ${openCountryForId === phone.id ? 'open' : ''}`}
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {openCountryForId === phone.id && (
                      <div className="phone-country-dropdown" role="listbox" aria-label="Country code">
                        {countryCodes.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePhoneChange(phone.id, 'countryCode', c.code);
                              setOpenCountryForId(null);
                            }}
                            className={`phone-country-option ${phone.countryCode === c.code ? 'selected' : ''}`}
                          >
                            <img
                              src={getFlagCdnUrl(c.flag)}
                              alt=""
                              className="phone-country-option-flag"
                              loading="lazy"
                            />
                            <span className="phone-country-option-name">{c.name}</span>
                            <span className="phone-country-option-code">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="input-group phone-row__phone">
                  <label htmlFor={`phone-${phone.id}`}>Phone number *</label>
                  <input
                    id={`phone-${phone.id}`}
                    type="tel"
                    inputMode="tel"
                    value={phone.number}
                    onChange={(e) => handlePhoneChange(phone.id, 'number', e.target.value)}
                    placeholder="1234567890"
                    required
                  />
                </div>
                <div className="input-group checkbox-group phone-row__primary">
                  <span className="checkbox-group__field-label">Primary</span>
                  <label className="checkbox-label" htmlFor={`primary-${phone.id}`}>
                    <input
                      id={`primary-${phone.id}`}
                      type="checkbox"
                      checked={phone.isPrimary}
                      onChange={() => handleSetPrimary(phone.id)}
                    />
                    <span>Use as primary</span>
                  </label>
                </div>
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => handleRemovePhone(phone.id)}
                  disabled={phoneNumbers.length === 1}
                  aria-label="Delete phone number"
                  title="Delete"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M8 6V4.5C8 3.67157 8.67157 3 9.5 3H14.5C15.3284 3 16 3.67157 16 4.5V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M6.5 6L7.3 20.1C7.34 20.86 7.97 21.45 8.73 21.45H15.27C16.03 21.45 16.66 20.86 16.7 20.1L17.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-add"
            onClick={handleAddPhone}
            aria-label="Add phone number"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 5V19M5 12H19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
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
