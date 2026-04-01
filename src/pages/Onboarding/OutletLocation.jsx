import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GeoPoint, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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

export default function OutletLocation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [position, setPosition] = useState({ lat: null, lng: null });
  const [placeMeta, setPlaceMeta] = useState({ formattedAddress: '', placeName: '' });

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
      } catch {
        // ignore; user can still pick on map
      }
    };
    loadExisting();
  }, [vendorId]);

  const canContinue = useMemo(
    () => isValidLatLng(position.lat, position.lng),
    [position.lat, position.lng]
  );

  const handleContinue = async () => {
    if (!user) return;
    if (!vendorId) {
      showToast('Vendor profile not ready yet. Please try again in a moment.', 'error');
      return;
    }
    if (!canContinue) {
      showToast('Please select a location on the map', 'error');
      return;
    }

    setSaving(true);
    try {
      const { lat, lng } = position;
      const locationText = (placeMeta.formattedAddress || placeMeta.placeName || '').trim();

      await setDoc(
        doc(db, 'vendors', vendorId),
        {
          latitude: lat,
          longitude: lng,
          coordinates: new GeoPoint(lat, lng),
          // Keep same field as OutletInformation uses for address
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

