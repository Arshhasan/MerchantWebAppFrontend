import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GeoPoint, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import LocationPickerMap from '../../components/LocationPickerMap/LocationPickerMap';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import './OutletLocation.css';

const isValidLatLng = (lat, lng) => (
  typeof lat === 'number'
  && typeof lng === 'number'
  && Number.isFinite(lat)
  && Number.isFinite(lng)
  && lat >= -90
  && lat <= 90
  && lng >= -180
  && lng <= 180
);

/** Country options for onboarding address (value stored on vendor). */
const COUNTRY_OPTIONS = [
  { value: '', label: 'Select country' },
  { value: 'Canada', label: 'Canada' },
  { value: 'United States', label: 'United States' },
  { value: 'India', label: 'India' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Other', label: 'Other' },
];

function buildLocationLine(addr) {
  const parts = [
    addr.streetAddress,
    addr.city,
    addr.state,
    addr.postalCode,
    addr.country,
  ].map((s) => (s || '').trim()).filter(Boolean);
  return parts.join(', ');
}

export default function OutletLocation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [position, setPosition] = useState({ lat: null, lng: null });
  const [placeMeta, setPlaceMeta] = useState({ formattedAddress: '', placeName: '' });
  const [address, setAddress] = useState({
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });

  const vendorId = userProfile?.vendorID || '';
  const isOnboarding = searchParams.get('onboarding') === '1';

  useEffect(() => {
    const loadExisting = async () => {
      if (!vendorId) return;
      try {
        const snap = await getDoc(doc(db, 'vendors', vendorId));
        if (!snap.exists()) return;
        const v = snap.data() || {};
        const lat = typeof v.latitude === 'number' ? v.latitude : null;
        const lng = typeof v.longitude === 'number' ? v.longitude : null;
        if (isValidLatLng(lat, lng)) {
          setPosition({ lat, lng });
        }
        setPlaceMeta({
          formattedAddress: (v.location || '').toString(),
          placeName: '',
        });
        const street = (v.streetAddress || v.addressLine1 || '').toString().trim();
        const locLegacy = (v.location || '').toString().trim();
        setAddress({
          streetAddress: street || locLegacy || '',
          city: (v.city || '').toString(),
          state: (v.state || '').toString(),
          postalCode: (v.postalCode || v.pinCode || v.zipCode || '').toString(),
          country: (v.country || '').toString(),
        });
      } catch {
        // ignore; user can still pick on map
      }
    };
    loadExisting();
  }, [vendorId]);

  const addressComplete = useMemo(() => {
    const s = address.streetAddress.trim();
    const c = address.city.trim();
    const st = address.state.trim();
    const pc = address.postalCode.trim();
    const co = address.country.trim();
    return !!(s && c && st && pc && co);
  }, [address]);

  const canContinue = useMemo(
    () => isValidLatLng(position.lat, position.lng) && addressComplete,
    [position.lat, position.lng, addressComplete]
  );

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleContinue = async () => {
    if (!user) return;
    if (!vendorId) {
      showToast('Vendor profile not ready yet. Please try again in a moment.', 'error');
      return;
    }
    if (!isValidLatLng(position.lat, position.lng)) {
      showToast('Please select a location on the map', 'error');
      return;
    }
    if (!addressComplete) {
      showToast('Please fill in street address, city, state, PIN/postal code, and country', 'error');
      return;
    }

    setSaving(true);
    try {
      const { lat, lng } = position;
      const fromForm = buildLocationLine(address);
      const locationText = fromForm
        || (placeMeta.formattedAddress || placeMeta.placeName || '').trim();

      await setDoc(
        doc(db, 'vendors', vendorId),
        {
          latitude: lat,
          longitude: lng,
          coordinates: new GeoPoint(lat, lng),
          streetAddress: address.streetAddress.trim(),
          addressLine1: address.streetAddress.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
          pinCode: address.postalCode.trim(),
          zipCode: address.postalCode.trim(),
          country: address.country.trim(),
          // Keep same field as OutletInformation uses for display / search
          location: locationText || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const onboardingQ = isOnboarding ? '?onboarding=1' : '';
      navigate(`/store-details${onboardingQ}`, { replace: true });
    } catch (e) {
      showToast(e?.message || 'Failed to save location', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingSplitLayout>
      <div className="outlet-location-page outlet-location-page--split">
        <div className="outlet-location-header">
          <button
            type="button"
            className="outlet-location-back"
            onClick={() => navigate('/business-category?onboarding=1', { replace: true })}
            aria-label="Back to business category"
          >
            ←
          </button>
          <button
            type="button"
            className="outlet-location-forward"
            onClick={handleContinue}
            disabled={!canContinue || saving}
            aria-label="Next"
          >
            →
          </button>
          <h1>Sign up your store</h1>
          <p>Select your outlet location</p>
        </div>

        <div className="outlet-location-card">
          <h2>Outlet location *</h2>

          <LocationPickerMap
            value={{
              lat: position.lat ?? '',
              lng: position.lng ?? '',
            }}
            onChange={({ lat, lng }) => setPosition({ lat, lng })}
            onPlaceSelected={({ formattedAddress, placeName, lat, lng }) => {
              setPlaceMeta({ formattedAddress: formattedAddress || '', placeName: placeName || '' });
              if (isValidLatLng(lat, lng)) setPosition({ lat, lng });
            }}
            showCoordInputs={false}
            height={310}
          />

          <div className="outlet-location-address">
            <h3 className="outlet-location-address__title">Outlet address *</h3>
            <p className="outlet-location-address__hint">
              Enter your store&apos;s address. This should match your location on the map.
            </p>

            <div className="outlet-location-field">
              <label htmlFor="outlet-street">Street address *</label>
              <input
                id="outlet-street"
                name="streetAddress"
                type="text"
                autoComplete="street-address"
                value={address.streetAddress}
                onChange={handleAddressChange}
                placeholder="Building number, street name"
              />
            </div>

            <div className="outlet-location-fieldRow">
              <div className="outlet-location-field">
                <label htmlFor="outlet-city">City *</label>
                <input
                  id="outlet-city"
                  name="city"
                  type="text"
                  autoComplete="address-level2"
                  value={address.city}
                  onChange={handleAddressChange}
                  placeholder="City"
                />
              </div>
              <div className="outlet-location-field">
                <label htmlFor="outlet-state">State / Province *</label>
                <input
                  id="outlet-state"
                  name="state"
                  type="text"
                  autoComplete="address-level1"
                  value={address.state}
                  onChange={handleAddressChange}
                  placeholder="State or province"
                />
              </div>
            </div>

            <div className="outlet-location-fieldRow">
              <div className="outlet-location-field">
                <label htmlFor="outlet-country">Country *</label>
                <select
                  id="outlet-country"
                  name="country"
                  value={address.country}
                  onChange={handleAddressChange}
                  aria-label="Country"
                >
                  {COUNTRY_OPTIONS.map((opt) => (
                    <option key={opt.value || '__empty'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="outlet-location-field">
                <label htmlFor="outlet-postal">PIN / Postal code *</label>
                <input
                  id="outlet-postal"
                  name="postalCode"
                  type="text"
                  autoComplete="postal-code"
                  value={address.postalCode}
                  onChange={handleAddressChange}
                  placeholder="e.g. 560001 or K1A 0A6"
                />
              </div>
            </div>
          </div>

          <div className="outlet-location-actions">
            <button
              type="button"
              className="outlet-location-continue"
              onClick={handleContinue}
              disabled={!canContinue || saving}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
}

