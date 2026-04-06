import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument, createDocument, updateDocument } from '../../firebase/firestore';
import { uploadFile } from '../../firebase/storage';
import { collection, doc, getDocs, query, setDoc, where, GeoPoint, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import LocationPickerMap from '../../components/LocationPickerMap/LocationPickerMap';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import { publicUrl } from '../../utils/publicUrl';
import {
  currencyFromCountryCode,
  DEFAULT_MERCHANT_CURRENCY,
} from '../../utils/countryCurrency';
import { fetchCountryCodeFromLatLng } from '../../utils/reverseGeocodeCountry';
import './OutletInformation.css';

const OutletInformation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const onboardingQuery = searchParams.get('onboarding') === '1';
  const { user, userProfile, needsOutletSetup } = useAuth();
  /** First-time outlet setup: half-screen form + video on desktop (matches category step). */
  const showOnboardingSplit = onboardingQuery || needsOutletSetup;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  /** Preserved when phone field is hidden so updates do not clear existing vendor phone. */
  const preservedVendorPhoneRef = useRef('');
  const [formData, setFormData] = useState({
    storeName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    countryCode: '',
    latitude: '',
    longitude: '',
    email: '',
    website: '',
    description: '',
  });

  // Restaurant / outlet image upload (single image)
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    if (user) {
      // For phone-auth onboarding, vendors.phonenumber is required by AuthContext.isOutletComplete.
      // If we don't set it, onboarding can get stuck in an Outlet Info redirect loop.
      preservedVendorPhoneRef.current =
        preservedVendorPhoneRef.current ||
        user.phoneNumber ||
        userProfile?.phonenumber ||
        '';
      loadVendorStore();
    }
  }, [user, userProfile]);

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
          preservedVendorPhoneRef.current =
            vendor.phonenumber ||
            preservedVendorPhoneRef.current ||
            user.phoneNumber ||
            userProfile?.phonenumber ||
            '';
          setFormData({
            storeName: vendor.title || '',
            address: vendor.streetAddress || vendor.addressLine1 || vendor.location || '',
            city: vendor.city || '',
            state: vendor.state || '',
            zipCode: vendor.postalCode || vendor.zipCode || vendor.pinCode || '',
            country: vendor.country || '',
            countryCode: vendor.countryCode || '',
            latitude: vendor.latitude?.toString() || '',
            longitude: vendor.longitude?.toString() || '',
            email: vendor.email || '',
            website: vendor.website || '',
            description: vendor.description || '',
            // Delivery charges + Store features intentionally not used in this frontend
          });

          const existingPhoto = (vendor.photo || '').toString();
          setPhotoPreviewUrl(existingPhoto);
          setRemovePhoto(false);
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

  const handlePickLocation = ({ lat, lng }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: String(lat),
      longitude: String(lng),
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }
    // Limit to ~5MB to avoid slow uploads / storage issues
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image is too large. Please upload an image under 5MB.', 'error');
      return;
    }
    setPhotoFile(file);
    setRemovePhoto(false);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl('');
    setRemovePhoto(true);
  };

  const propagateLatLngToSurpriseBags = async ({ merchantId, latitude, longitude }) => {
    // Surprise bags are keyed by merchantId in this frontend.
    // We copy vendor latitude/longitude into each bag at creation time, so we need to re-sync when outlet changes.
    const snap = await getDocs(
      query(collection(db, 'merchant_surprise_bag'), where('merchantId', '==', merchantId))
    );

    if (snap.empty) return { updated: 0 };

    let updated = 0;
    let batch = writeBatch(db);
    let ops = 0;

    const commit = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    };

    for (const d of snap.docs) {
      batch.update(d.ref, { latitude, longitude });
      updated += 1;
      ops += 1;
      if (ops >= 450) {
        // Keep a margin under Firestore's 500 writes/batch.
        // eslint-disable-next-line no-await-in-loop
        await commit();
      }
    }

    await commit();
    return { updated };
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
      if (!formData.email) {
        showToast('Email is required', 'error');
        setSaving(false);
        return;
      }
      if (!formData.latitude || !formData.longitude) {
        showToast('Latitude and longitude are required', 'error');
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

      let countryIso = (formData.countryCode || '').trim().toUpperCase();
      if (!countryIso) {
        countryIso = (await fetchCountryCodeFromLatLng(latitude, longitude)) || '';
      }
      const currencyCode =
        currencyFromCountryCode(countryIso) || DEFAULT_MERCHANT_CURRENCY;

      // Prepare vendor data structure matching merchant app
      const vendorData = {
        id: vendorId || '', // Will be set after creation
        author: user.uid,
        title: formData.storeName,
        description: formData.description || '',
        latitude: latitude,
        longitude: longitude,
        location: formData.address,
        streetAddress: formData.address,
        addressLine1: formData.address,
        city: formData.city || '',
        state: formData.state || '',
        postalCode: formData.zipCode || '',
        pinCode: formData.zipCode || '',
        zipCode: formData.zipCode || '',
        country: formData.country || '',
        countryCode: countryIso || null,
        currencyCode,
        phonenumber:
          preservedVendorPhoneRef.current ||
          user.phoneNumber ||
          userProfile?.phonenumber ||
          '',
        coordinates: coordinates,
        hidephotos: false,
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
      };

      // Email is required
        vendorData.email = formData.email;
      if (formData.website) {
        vendorData.website = formData.website;
      }

      let newVendorId = vendorId;
      let bagsUpdatedCount = 0;

      if (!vendorId) {
        // New vendor: default store as open (no UI on this page)
        vendorData.reststatus = true;
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
        // Use setDoc to avoid "No document to update" if users/{uid} does not exist yet.
        await setDoc(
          doc(db, 'users', user.uid),
          { vendorID: newVendorId },
          { merge: true }
        );
      } else {
        // Update existing vendor document
        vendorData.id = vendorId; // Ensure ID is set
        const result = await updateDocument('vendors', vendorId, vendorData);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to update store');
        }
      }

      // Upload/clear outlet image (vendors.photo)
      try {
        if (newVendorId) {
          if (removePhoto) {
            await updateDocument('vendors', newVendorId, { photo: null });
          } else if (photoFile) {
            setPhotoUploading(true);
            const safeName = String(photoFile.name || 'photo').replace(/[^\w.\-]+/g, '-');
            const path = `vendors/${newVendorId}/photo/${Date.now()}-${safeName}`;
            const up = await uploadFile(photoFile, path);
            if (!up?.success) throw new Error(up?.error || 'Failed to upload image');
            await updateDocument('vendors', newVendorId, { photo: up.url });
          }
        }
      } finally {
        setPhotoUploading(false);
      }

      // Keep existing bags in sync with updated outlet coordinates
      try {
        const { updated } = await propagateLatLngToSurpriseBags({ merchantId: user.uid, latitude, longitude });
        bagsUpdatedCount = updated;
      } catch (syncErr) {
        console.error('Failed to propagate outlet coordinates to surprise bags:', syncErr);
        // Don't fail the save for this; surface a warning toast.
        showToast('Store saved, but failed to update existing surprise bags location.', 'warning', 5000);
      }

      // Success toast after all writes (including propagation) complete.
      if (!vendorId) {
        showToast(
          bagsUpdatedCount > 0
            ? `Store created successfully! Updated ${bagsUpdatedCount} surprise bag(s) location.`
            : 'Store created successfully!',
          'success'
        );
      } else {
        showToast(
          bagsUpdatedCount > 0
            ? `Store information updated successfully! Updated ${bagsUpdatedCount} surprise bag(s) location.`
            : 'Store information updated successfully!',
          'success'
        );
      }

      // If user is in onboarding flow, send them to dashboard after completion
      if (searchParams.get('onboarding') === '1') {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      console.error('Error saving store info:', error);
      showToast(error.message || 'Failed to save store information', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    const loadingBody = (
      <div className={`outlet-info-page${showOnboardingSplit ? ' outlet-info-page--onboarding-split' : ''}`}>
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
    if (showOnboardingSplit) {
      return (
        <OnboardingSplitLayout>
          {loadingBody}
        </OnboardingSplitLayout>
      );
    }
    return loadingBody;
  }

  const page = (
    <div className={`outlet-info-page${showOnboardingSplit ? ' outlet-info-page--onboarding-split' : ''}`}>
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
              <label htmlFor="outletPhoto">Restaurant image</label>
              <input
                id="outletPhoto"
                type="file"
                accept="image/*"
                className="file-input"
                onChange={handlePhotoChange}
              />
              <div className="form-text">Upload one image (max 5MB). This will be shown on your dashboard.</div>

              {photoPreviewUrl ? (
                <div className="photo-preview-grid">
                  <div className="photo-preview-item">
                    <img src={photoPreviewUrl} alt="Restaurant preview" />
                    <button type="button" className="remove-photo-btn" onClick={handleRemovePhoto} aria-label="Remove image">
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <div className="photo-preview-grid">
                  <div className="photo-preview-item photo-preview-item--default">
                    <img src={publicUrl('user.png')} alt="Default restaurant image" />
                  </div>
                </div>
              )}
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
                <label>Store Location (Pick on Map) *</label>
                <LocationPickerMap
                  value={{ lat: formData.latitude, lng: formData.longitude }}
                  onChange={handlePickLocation}
                  height={320}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Contact Information</h2>
            
            <div className="input-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
                required
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
            <button type="submit" className="btn btn-primary" disabled={saving || photoUploading}>
              {(saving || photoUploading) ? 'Saving...' : (vendorId ? 'Update Store' : 'Create Store')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (showOnboardingSplit) {
    return (
      <OnboardingSplitLayout>
        {page}
      </OnboardingSplitLayout>
    );
  }

  return page;
};

export default OutletInformation;
