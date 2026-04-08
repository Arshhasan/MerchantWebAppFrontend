import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import { getDocument, createDocument, updateDocument } from '../../firebase/firestore';
import './ManageStaff.css';
import './PhoneNumbers.css';

/** @param {Record<string, unknown> | null | undefined} member */
function parseStaffPhoneFields(member) {
  if (!member || typeof member !== 'object') {
    return { countryCode: '+1', phoneNumber: '' };
  }
  const ccRaw = member.countryCode;
  const numRaw = member.phoneNumber;
  if (ccRaw != null && String(ccRaw).trim() !== '') {
    const cc = String(ccRaw).trim().startsWith('+')
      ? String(ccRaw).trim()
      : `+${String(ccRaw).replace(/\D/g, '')}`;
    return {
      countryCode: cc || '+1',
      phoneNumber: String(numRaw ?? '').replace(/\D/g, ''),
    };
  }
  const raw = String(member.phone || '').trim();
  const match = raw.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) {
    return {
      countryCode: match[1],
      phoneNumber: String(match[2] || '').replace(/\D/g, ''),
    };
  }
  return { countryCode: '+1', phoneNumber: raw.replace(/\D/g, '') };
}

const ManageStaff = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, staffId: null });
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    role: '',
    countryCode: '+1',
    phoneNumber: '',
  });
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const staffCountryPickerRef = useRef(null);

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

  useEffect(() => {
    if (!countryDropdownOpen) return undefined;
    const onDocMouseDown = (event) => {
      if (!staffCountryPickerRef.current?.contains(event.target)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [countryDropdownOpen]);

  useEffect(() => {
    if (user) {
      loadStaff();
    }
  }, [user]);

  const loadStaff = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await getDocument('merchant_outlet_info', user.uid);
      
      if (result.success && result.data && result.data.staff && result.data.staff.length > 0) {
        setStaff(result.data.staff);
      } else {
        setStaff([]);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      showToast('Failed to load staff members', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffFormChange = (e) => {
    const { name, value } = e.target;
    setStaffForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({ name: '', email: '', role: '', countryCode: '+1', phoneNumber: '' });
    setCountryDropdownOpen(false);
    setShowAddStaff(true);
  };

  const handleEditStaff = (member) => {
    setEditingStaff(member);
    const { countryCode, phoneNumber } = parseStaffPhoneFields(member);
    setStaffForm({
      name: member.name || '',
      email: member.email || '',
      role: member.role || '',
      countryCode,
      phoneNumber,
    });
    setCountryDropdownOpen(false);
    setShowAddStaff(true);
  };

  const handleCancelEdit = () => {
    setShowAddStaff(false);
    setEditingStaff(null);
    setStaffForm({ name: '', email: '', role: '', countryCode: '+1', phoneNumber: '' });
    setCountryDropdownOpen(false);
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);

      const national = String(staffForm.phoneNumber || '').replace(/\D/g, '');
      if (!national) {
        showToast('Please enter a phone number', 'error');
        setSaving(false);
        return;
      }

      const cc = String(staffForm.countryCode || '+1').trim().startsWith('+')
        ? String(staffForm.countryCode || '+1').trim()
        : `+${String(staffForm.countryCode || '').replace(/\D/g, '')}`;
      const phoneCombined = `${cc}${national}`;

      const staffPayload = {
        name: staffForm.name,
        email: staffForm.email,
        role: staffForm.role,
        countryCode: cc,
        phoneNumber: national,
        phone: phoneCombined,
      };

      let updatedStaff;
      if (editingStaff) {
        // Update existing staff member
        updatedStaff = staff.map(s =>
          s.id === editingStaff.id
            ? { ...editingStaff, ...staffPayload }
            : s
        );
      } else {
        // Add new staff member
        const newStaff = {
          id: Date.now().toString(),
          ...staffPayload,
        };
        updatedStaff = [...staff, newStaff];
      }

      // Check if document exists
      const existingDoc = await getDocument('merchant_outlet_info', user.uid);
      
      const staffData = {
        merchantId: user.uid,
        staff: updatedStaff,
      };

      if (existingDoc.success && existingDoc.data) {
        // Update existing document
        const result = await updateDocument('merchant_outlet_info', user.uid, staffData);
        if (result.success) {
          setStaff(updatedStaff);
          showToast(editingStaff ? 'Staff member updated successfully!' : 'Staff member added successfully!', 'success');
          handleCancelEdit();
        } else {
          throw new Error(result.error || 'Failed to update staff');
        }
      } else {
        // Create new document
        const result = await createDocument('merchant_outlet_info', staffData, user.uid);
        if (result.success) {
          setStaff(updatedStaff);
          showToast('Staff member added successfully!', 'success');
          handleCancelEdit();
        } else {
          throw new Error(result.error || 'Failed to save staff');
        }
      }
    } catch (error) {
      console.error('Error saving staff:', error);
      showToast(error.message || 'Failed to save staff member', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!user || !deleteModal.staffId) return;

    try {
      setSaving(true);
      const updatedStaff = staff.filter(s => s.id !== deleteModal.staffId);

      // Check if document exists
      const existingDoc = await getDocument('merchant_outlet_info', user.uid);
      
      const staffData = {
        merchantId: user.uid,
        staff: updatedStaff,
      };

      if (existingDoc.success && existingDoc.data) {
        // Update existing document
        const result = await updateDocument('merchant_outlet_info', user.uid, staffData);
        if (result.success) {
          setStaff(updatedStaff);
          showToast('Staff member deleted successfully!', 'success');
          setDeleteModal({ isOpen: false, staffId: null });
        } else {
          throw new Error(result.error || 'Failed to delete staff');
        }
      } else {
        throw new Error('Document not found');
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
      showToast(error.message || 'Failed to delete staff member', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="manage-staff-page">
        <div className="page-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Manage Staff</h1>
        </div>
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-staff-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Manage Staff</h1>
        <button className="btn-add-header" onClick={handleAddStaff}>
          + Add Staff
        </button>
      </div>

      <div className="manage-staff-content">
        {showAddStaff && (
          <div className="staff-form-card">
            <h2>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
            <form onSubmit={handleStaffSubmit} className="staff-form">
              <div className="input-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={staffForm.name}
                  onChange={handleStaffFormChange}
                  placeholder="Enter staff name"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={staffForm.email}
                  onChange={handleStaffFormChange}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="role">Role *</label>
                <select
                  id="role"
                  name="role"
                  value={staffForm.role}
                  onChange={handleStaffFormChange}
                  required
                >
                  <option value="">Select Role</option>
                  <option value="Manager">Manager</option>
                  <option value="Staff">Staff</option>
                  <option value="Helper">Helper</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Cook">Cook</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </div>

              <div className="input-group staff-phone-field">
                <span className="staff-phone-field__label">Phone *</span>
                <div className="staff-phone-field__row">
                  <div className="phone-country-picker" ref={staffCountryPickerRef}>
                    <button
                      type="button"
                      id="staff-country-code"
                      className="phone-country-btn"
                      onClick={() => setCountryDropdownOpen((o) => !o)}
                      aria-haspopup="listbox"
                      aria-expanded={countryDropdownOpen}
                    >
                      <img
                        src={getFlagCdnUrl(
                          (countryCodes.find((c) => c.code === staffForm.countryCode) || countryCodes[0]).flag
                        )}
                        alt=""
                        className="phone-country-flag"
                        loading="lazy"
                      />
                      <span className="phone-country-code">{staffForm.countryCode || '+1'}</span>
                      <svg
                        className={`phone-country-caret ${countryDropdownOpen ? 'open' : ''}`}
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 7.5L10 12.5L15 7.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {countryDropdownOpen && (
                      <div className="phone-country-dropdown" role="listbox" aria-label="Country code">
                        {countryCodes.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setStaffForm((prev) => ({ ...prev, countryCode: c.code }));
                              setCountryDropdownOpen(false);
                            }}
                            className={`phone-country-option ${staffForm.countryCode === c.code ? 'selected' : ''}`}
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
                  <input
                    type="tel"
                    id="staff-phone-national"
                    name="phoneNumber"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={staffForm.phoneNumber}
                    onChange={(e) =>
                      setStaffForm((prev) => ({
                        ...prev,
                        phoneNumber: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="Phone number"
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingStaff ? 'Update Staff' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="staff-list">
          {staff.length === 0 ? null : (
            <div className="staff-grid">
              {staff.map((member) => (
                <div key={member.id} className="staff-card">
                  <div className="staff-info">
                    <h3>{member.name}</h3>
                    <p className="staff-role">{member.role}</p>
                    <p className="staff-email">{member.email}</p>
                    <p className="staff-phone">{member.phone}</p>
                  </div>
                  <div className="staff-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleEditStaff(member)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteModal({ isOpen: true, staffId: member.id })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, staffId: null })}
        onConfirm={handleDeleteStaff}
        title="Delete Staff Member"
        message="Are you sure you want to delete this staff member? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default ManageStaff;
