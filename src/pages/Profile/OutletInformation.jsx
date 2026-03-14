import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument, createDocument, updateDocument } from '../../firebase/firestore';
import { doc, updateDoc, GeoPoint } from 'firebase/firestore';
import { db } from '../../firebase/config';
import './OutletInformation.css';

const OutletInformation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  const [formData, setFormData] = useState({
    storeName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    latitude: '',
    longitude: '',
    email: '',
    website: '',
    description: '',
    phoneNumber: '',
    zoneId: '',
  });

  useEffect(() => {
    if (user) {
      loadVendorStore();
    }
  }, [user]);

  const loadVendorStore = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // First check if user has a vendorID
      const userDoc = await getDocument('users', user.uid);
      let existingVendorId = null;
      
      if (userDoc.success && userDoc.data && userDoc.data.vendorID) {
        existingVendorId = userDoc.data.vendorID;
        setVendorId(existingVendorId);
        
        // Load vendor store data
        const vendorDoc = await getDocument('vendors', existingVendorId);
        
        if (vendorDoc.success && vendorDoc.data) {
          const vendor = vendorDoc.data;
          setFormData({
            storeName: vendor.title || '',
            address: vendor.location || '',
            city: '',
            state: '',
            zipCode: '',
            country: '',
            latitude: vendor.latitude?.toString() || '',
            longitude: vendor.longitude?.toString() || '',
            email: vendor.email || '',
            website: vendor.website || '',
            description: vendor.description || '',
            phoneNumber: vendor.phonenumber || '',
            zoneId: vendor.zoneId || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading vendor store:', error);
      showToast('Failed to load store information', 'error');
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

      // Validation
      if (!formData.storeName) {
        showToast('Store name is required', 'error');
        setSaving(false);
        return;
      }
      if (!formData.address) {
        showToast('Address is required', 'error');
        setSaving(false);
        return;
      }
      if (!formData.latitude || !formData.longitude) {
        showToast('Latitude and longitude are required', 'error');
        setSaving(false);
        return;
      }
      if (!formData.phoneNumber) {
        showToast('Phone number is required', 'error');
        setSaving(false);
        return;
      }
      if (!formData.description) {
        showToast('Description is required', 'error');
        setSaving(false);
        return;
      }

      const latitude = parseFloat(formData.latitude);
      const longitude = parseFloat(formData.longitude);

      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        showToast('Invalid latitude', 'error');
        setSaving(false);
        return;
      }
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        showToast('Invalid longitude', 'error');
        setSaving(false);
        return;
      }

      // Create GeoPoint for coordinates
      const coordinates = new GeoPoint(latitude, longitude);

      // Prepare vendor data structure matching merchant app
      const vendorData = {
        id: vendorId || '', // Will be set after creation
        author: user.uid,
        title: formData.storeName,
        description: formData.description || '',
        latitude: latitude,
        longitude: longitude,
        location: formData.address,
        phonenumber: formData.phoneNumber,
        categoryID: formData.categoryID || [],
        coordinates: coordinates,
        reststatus: false, // Default to closed
        zoneId: formData.zoneId || '',
        hidephotos: false,
        // Additional fields that might be needed
        photo: null, // Will be set when gallery images are uploaded
        photos: [],
        restaurantMenuPhotos: [],
        restaurantCost: '', // Discount price
        openDineTime: '',
        closeDineTime: '', // Actual price
        DeliveryCharge: {
          delivery_charges_per_km: 0,
          minimum_delivery_charges: 0,
          minimum_delivery_charges_within_km: 0
        },
        specialDiscount: [],
        specialDiscountEnable: false,
        workingHours: [
          { day: 'Monday', timeslot: [{ from: '00:00', to: '23:59' }] },
          { day: 'Tuesday', timeslot: [{ from: '00:00', to: '23:59' }] },
          { day: 'Wednesday', timeslot: [{ from: '00:00', to: '23:59' }] },
          { day: 'Thursday', timeslot: [{ from: '00:00', to: '23:59' }] },
          { day: 'Friday', timeslot: [{ from: '00:00', to: '23:59' }] },
          { day: 'Saturday', timeslot: [{ from: '00:00', to: '23:59' }] },
          { day: 'Sunday', timeslot: [{ from: '00:00', to: '23:59' }] },
        ],
        isSelfDelivery: false,
      };

      // Add email and website if provided
      if (formData.email) {
        vendorData.email = formData.email;
      }
      if (formData.website) {
        vendorData.website = formData.website;
      }

      let newVendorId = vendorId;

      if (!vendorId) {
        // Create new vendor document with auto-generated ID
        const result = await createDocument('vendors', vendorData);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to create store');
        }
        
        newVendorId = result.id;
        setVendorId(newVendorId);
        
        // Update vendor document with its own ID
        await updateDocument('vendors', newVendorId, { id: newVendorId });
        
        // Update user document with vendorID reference
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          vendorID: newVendorId,
        });
        
        showToast('Store created successfully!', 'success');
      } else {
        // Update existing vendor document
        vendorData.id = vendorId; // Ensure ID is set
        const result = await updateDocument('vendors', vendorId, vendorData);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to update store');
        }
        
        showToast('Store information updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error saving store info:', error);
      showToast(error.message || 'Failed to save store information', 'error');
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
              <label htmlFor="phoneNumber">Phone Number *</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="Enter phone number"
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
                <label htmlFor="city">City</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Enter city"
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

            <div className="form-row">
              <div className="input-group">
                <label htmlFor="latitude">Latitude *</label>
                <input
                  type="number"
                  id="latitude"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  placeholder="e.g., 40.7128"
                  step="any"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="longitude">Longitude *</label>
                <input
                  type="number"
                  id="longitude"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  placeholder="e.g., -74.0060"
                  step="any"
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="zoneId">Zone ID</label>
              <input
                type="text"
                id="zoneId"
                name="zoneId"
                value={formData.zoneId}
                onChange={handleChange}
                placeholder="Enter zone ID"
              />
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
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter store description"
                rows="4"
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (vendorId ? 'Update Store' : 'Create Store')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OutletInformation;
