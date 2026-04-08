import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GeoPoint, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import LocationPickerMap from '../../components/LocationPickerMap/LocationPickerMap';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import { parseGoogleAddressComponents } from '../../utils/googleAddressComponents';
import {
  currencyFromCountryCode,
  DEFAULT_MERCHANT_CURRENCY,
} from '../../utils/countryCurrency';
import { fetchCountryCodeFromLatLng } from '../../utils/reverseGeocodeCountry';
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
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [landmark, setLandmark] = useState('');
  const [position, setPosition] = useState({ lat: null, lng: null });
  const [placeMeta, setPlaceMeta] = useState({ formattedAddress: '', placeName: '' });
  const [address, setAddress] = useState({
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    countryCode: '',
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
          countryCode: (v.countryCode || '').toString().toUpperCase(),
        });
        setLandmark((v.landmark || '').toString());
      } catch {
        // ignore
      }
    };
    loadExisting();
  }, [vendorId]);

  /** When address modal opens, backfill city/state/postal/country from reverse geocode if still missing. */
  useEffect(() => {
    if (!addressModalOpen) return;
    if (!isValidLatLng(position.lat, position.lng)) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12;

    const run = () => {
      if (cancelled) return;
      if (!window.google?.maps?.Geocoder) {
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(run, 200);
        }
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat: position.lat, lng: position.lng } },
        (results, status) => {
          if (cancelled || status !== 'OK' || !results?.[0]) return;
          const parsed = parseGoogleAddressComponents(results[0].address_components);
          if (!parsed) return;
          setAddress((prev) => {
            if (prev.city && prev.state && prev.postalCode && prev.country) return prev;
            return {
              ...prev,
              streetAddress: (prev.streetAddress || '').trim() || parsed.streetLine || '',
              city: prev.city || parsed.city || '',
              state: prev.state || parsed.state || '',
              postalCode: prev.postalCode || parsed.postalCode || '',
              country: prev.country || parsed.country || '',
              countryCode: prev.countryCode || parsed.countryCode || '',
            };
          });
        }
      );
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [addressModalOpen, position.lat, position.lng]);

  const addressComplete = useMemo(() => {
    const s = address.streetAddress.trim();
    const c = address.city.trim();
    const st = address.state.trim();
    const pc = address.postalCode.trim();
    const co = address.country.trim();
    return !!(s && c && st && pc && co);
  }, [address]);

  const canConfirmMap = useMemo(
    () => isValidLatLng(position.lat, position.lng),
    [position.lat, position.lng]
  );

  /** Reverse-geocoded lines when pin is set without a Places search result. */
  const [geocodePreview, setGeocodePreview] = useState(null);

  const displayPreview = useMemo(() => {
    const fa = (placeMeta.formattedAddress || '').trim();
    if (fa) {
      const headline = (placeMeta.placeName || '').trim() || fa.split(',')[0].trim();
      return { headline, full: fa };
    }
    if (geocodePreview?.full) return geocodePreview;
    return null;
  }, [placeMeta.formattedAddress, placeMeta.placeName, geocodePreview]);

  useEffect(() => {
    if (!isValidLatLng(position.lat, position.lng)) {
      setGeocodePreview(null);
      return undefined;
    }
    if ((placeMeta.formattedAddress || '').trim()) {
      return undefined;
    }

    let cancelled = false;
    let debounceTimer = null;
    let retryTimer = null;
    let attempts = 0;
    const maxAttempts = 12;

    const doGeocode = () => {
      if (cancelled) return;
      if (!window.google?.maps?.Geocoder) {
        attempts += 1;
        if (attempts < maxAttempts) {
          retryTimer = window.setTimeout(doGeocode, 200);
        }
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat: position.lat, lng: position.lng } },
        (results, status) => {
          if (cancelled) return;
          if (status !== 'OK' || !results?.[0]) {
            setGeocodePreview({
              headline: 'Selected location',
              full: `${Number(position.lat).toFixed(5)}, ${Number(position.lng).toFixed(5)}`,
            });
            return;
          }
          const formatted = results[0].formatted_address || '';
          const headline = formatted.split(',')[0]?.trim() || formatted;
          setGeocodePreview({ headline, full: formatted });
        }
      );
    };

    debounceTimer = window.setTimeout(doGeocode, 350);

    return () => {
      cancelled = true;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [position.lat, position.lng, placeMeta.formattedAddress]);

  // const handleChangeLocation = () => {
  //   setPlaceMeta({ formattedAddress: '', placeName: '' });
  //   window.setTimeout(() => {
  //     document.getElementById('location-search-onboarding')?.focus();
  //   }, 0);
  // };

  const canSaveInModal = useMemo(
    () => address.streetAddress.trim().length > 0 && addressComplete,
    [address.streetAddress, addressComplete]
  );

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    if (name === 'landmark') {
      setLandmark(value);
      return;
    }
    setAddress((prev) => ({ ...prev, [name]: value }));
  };

  const openAddressModal = () => {
    if (!canConfirmMap) {
      showToast('Use current location, search, or tap the map to set a pin', 'error');
      return;
    }
    setAddressModalOpen(true);
  };

  const closeAddressModal = () => {
    setAddressModalOpen(false);
  };

  const handlePlaceSelected = (payload) => {
    setPlaceMeta({
      formattedAddress: payload.formattedAddress || '',
      placeName: payload.placeName || '',
    });
    if (isValidLatLng(payload.lat, payload.lng)) {
      setPosition({ lat: payload.lat, lng: payload.lng });
    }
    const parsed = parseGoogleAddressComponents(payload.addressComponents);
    if (parsed) {
      setAddress((prev) => ({
        ...prev,
        streetAddress: (parsed.streetLine || prev.streetAddress || '').trim() || prev.streetAddress,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        postalCode: parsed.postalCode || prev.postalCode,
        country: parsed.country || prev.country,
        countryCode: parsed.countryCode || prev.countryCode || '',
      }));
    }
  };

  const handleSaveAndContinue = async () => {
    if (!user) return;
    if (!vendorId) {
      showToast('Vendor profile not ready yet. Please try again in a moment.', 'error');
      return;
    }
    if (!isValidLatLng(position.lat, position.lng)) {
      showToast('Please select a location on the map', 'error');
      return;
    }
    if (!address.streetAddress.trim()) {
      showToast('Street address is required', 'error');
      return;
    }
    if (!addressComplete) {
      showToast('We could not resolve full address from the map. Try search or move the pin, then open again.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { lat, lng } = position;
      const fromForm = buildLocationLine(address);
      const locationText = fromForm
        || (placeMeta.formattedAddress || placeMeta.placeName || '').trim();

      let countryCode = (address.countryCode || '').trim().toUpperCase();
      if (!countryCode) {
        countryCode = (await fetchCountryCodeFromLatLng(lat, lng)) || '';
      }
      const currencyCode =
        currencyFromCountryCode(countryCode) || DEFAULT_MERCHANT_CURRENCY;

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
          countryCode: countryCode || null,
          currencyCode,
          landmark: landmark.trim() || null,
          location: locationText || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const onboardingQ = isOnboarding ? '?onboarding=1' : '';
      navigate(`/first-bag${onboardingQ}`, { replace: true });
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
            onClick={() => navigate('/store-details?onboarding=1', { replace: true })}
            aria-label="Back to store details"
          >
            ←
          </button>
          {/* Forward arrow removed per onboarding UX */}
          <h1>Sign up your store</h1>
          <p>Select your outlet location</p>
        </div>

        <div className="outlet-location-card">
          <div className="outlet-location-mapBlock outlet-location-mapBlock--first">
            <div className="outlet-location-mapBlock__title">Pin on map</div>
            <p className="outlet-location-mapBlock__hint">
              Use current location or search, then tap or drag the pin to fine-tune.
            </p>
            <LocationPickerMap
              variant="onboarding"
              suppressInitialGeolocation
              value={{
                lat: position.lat ?? '',
                lng: position.lng ?? '',
              }}
              onChange={({ lat, lng, source }) => {
                setPosition({ lat, lng });
                if (source === 'map' || source === 'geolocation') {
                  setPlaceMeta({ formattedAddress: '', placeName: '' });
                }
              }}
              onPlaceSelected={handlePlaceSelected}
              showCoordInputs={false}
              height={310}
            />
          </div>

          {canConfirmMap && (
            <div className="outlet-location-preview" aria-live="polite">
              <div className="outlet-location-preview__row">
                <span className="outlet-location-preview__pin" aria-hidden>📍</span>
                <div className="outlet-location-preview__text">
                  {displayPreview ? (
                    <>
                      <div className="outlet-location-preview__headline">{displayPreview.headline}</div>
                      <div className="outlet-location-preview__full">{displayPreview.full}</div>
                    </>
                  ) : (
                    <div className="outlet-location-preview__loading">Loading address…</div>
                  )}
                </div>
                {/* <button
                  type="button"
                  className="outlet-location-preview__change"
                  onClick={handleChangeLocation}
                >
                  Change
                </button> */}
              </div>
            </div>
          )}

          <div className="outlet-location-actions">
            <button
              type="button"
              className="outlet-location-continue"
              onClick={openAddressModal}
              disabled={!canConfirmMap || saving}
            >
              Confirm location
            </button>
          </div>
        </div>
      </div>

      {addressModalOpen && (
        <div
          className="outlet-location-modal-overlay"
          role="presentation"
          onClick={closeAddressModal}
        >
          <div
            className="outlet-location-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="outlet-location-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="outlet-location-modal-title" className="outlet-location-modal__title">
              Outlet address
            </h2>
            <p className="outlet-location-modal__lead">
              Enter your street address. City and postal details are filled from the map when possible.
            </p>

            <div className="outlet-location-field">
              <label htmlFor="outlet-modal-street">Street address *</label>
              <input
                id="outlet-modal-street"
                name="streetAddress"
                type="text"
                autoComplete="street-address"
                value={address.streetAddress}
                onChange={handleAddressChange}
                placeholder="Building number, street name"
              />
            </div>

            <div className="outlet-location-field">
              <label htmlFor="outlet-modal-landmark">Landmark (optional)</label>
              <input
                id="outlet-modal-landmark"
                name="landmark"
                type="text"
                value={landmark}
                onChange={handleAddressChange}
                placeholder="Nearby landmark to help customers find you"
              />
            </div>

            {!addressComplete && address.streetAddress.trim() && (
              <p className="outlet-location-modal__warn">
                Resolving address from map… If this message stays, move the pin or use search, then try again.
              </p>
            )}

            <div className="outlet-location-modal__actions">
              <button
                type="button"
                className="outlet-location-modal__btn outlet-location-modal__btn--secondary"
                onClick={closeAddressModal}
              >
                Back
              </button>
              <button
                type="button"
                className="outlet-location-modal__btn outlet-location-modal__btn--primary"
                onClick={handleSaveAndContinue}
                disabled={!canSaveInModal || saving}
              >
                {saving ? 'Saving…' : 'Save and continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </OnboardingSplitLayout>
  );
}
