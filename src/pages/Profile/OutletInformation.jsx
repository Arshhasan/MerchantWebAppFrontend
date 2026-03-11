import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument, createDocument, updateDocument } from '../../firebase/firestore';
import './OutletInformation.css';

const OutletInformation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    storeName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    email: '',
    website: '',
    description: '',
  });

  useEffect(() => {
    if (user) {
      loadOutletInfo();
    }
  }, [user]);

  const loadOutletInfo = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await getDocument('merchant_outlet_info', user.uid);
      
      if (result.success && result.data && result.data.outletInfo) {
        setFormData({
          storeName: result.data.outletInfo.storeName || '',
          address: result.data.outletInfo.address || '',
          city: result.data.outletInfo.city || '',
          state: result.data.outletInfo.state || '',
          zipCode: result.data.outletInfo.zipCode || '',
          country: result.data.outletInfo.country || '',
          email: result.data.outletInfo.email || '',
          website: result.data.outletInfo.website || '',
          description: result.data.outletInfo.description || '',
        });
      }
    } catch (error) {
      console.error('Error loading outlet info:', error);
      showToast('Failed to load outlet information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);

      // Check if document exists
      const existingDoc = await getDocument('merchant_outlet_info', user.uid);
      
      const outletInfoData = {
        merchantId: user.uid,
        outletInfo: formData,
      };

      if (existingDoc.success && existingDoc.data) {
        // Update existing document
        const result = await updateDocument('merchant_outlet_info', user.uid, outletInfoData);
        if (result.success) {
          showToast('Outlet information updated successfully!', 'success');
        } else {
          throw new Error(result.error || 'Failed to update outlet information');
        }
      } else {
        // Create new document
        const result = await createDocument('merchant_outlet_info', outletInfoData, user.uid);
        if (result.success) {
          showToast('Outlet information saved successfully!', 'success');
        } else {
          throw new Error(result.error || 'Failed to save outlet information');
        }
      }
    } catch (error) {
      console.error('Error saving outlet info:', error);
      showToast(error.message || 'Failed to save outlet information', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="outlet-info-page">
        <div className="page-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Outlet Information</h1>
        </div>
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="outlet-info-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Outlet Information</h1>
      </div>

      <div className="outlet-info-content">
        <form onSubmit={handleSubmit} className="outlet-info-form">
          <div className="form-section">
            <h2>Basic Information</h2>
            
            <div className="input-group">
              <label htmlFor="storeName">Store Name *</label>
              <input
                type="text"
                id="storeName"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                placeholder="Enter store name"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="address">Address *</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter street address"
                required
              />
            </div>

            <div className="form-row">
              <div className="input-group">
                <label htmlFor="city">City *</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Enter city"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="state">State/Province</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Enter state"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="input-group">
                <label htmlFor="zipCode">Zip/Postal Code</label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="Enter zip code"
                />
              </div>

              <div className="input-group">
                <label htmlFor="country">Country</label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Enter country"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Contact Information</h2>
            
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
              />
            </div>

            <div className="input-group">
              <label htmlFor="website">Website</label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Additional Information</h2>
            
            <div className="input-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter store description"
                rows="4"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Information'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OutletInformation;
