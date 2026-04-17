import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoPoint, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronLeft,
  Home,
  MapPin,
  Navigation,
  Search,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import { MapChunkFallback } from '../../components/PageLoadingFallback';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';

const LocationPickerMap = lazy(() => import('../../components/LocationPickerMap/LocationPickerMap'));
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

/** Prefer scalar latitude/longitude; fall back to Firestore GeoPoint. */
function coordsFromVendorData(v) {
  if (!v) return null;
  const lat = typeof v.latitude === 'number' ? v.latitude : null;
  const lng = typeof v.longitude === 'number' ? v.longitude : null;
  if (isValidLatLng(lat, lng)) return { lat, lng };
  const gp = v.coordinates;
  if (gp && typeof gp.latitude === 'number' && typeof gp.longitude === 'number') {
    const glat = gp.latitude;
    const glng = gp.longitude;
    if (isValidLatLng(glat, glng)) return { lat: glat, lng: glng };
  }
  return null;
}

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

const ADDRESS_TAGS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'work', label: 'Work', Icon: Briefcase },
  { id: 'hotel', label: 'Hotel', Icon: Building2 },
  { id: 'other', label: 'Other', Icon: User },
];

export default function OutletLocation() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [addressTag, setAddressTag] = useState('home');
  const [landmark, setLandmark] = useState('');
  const [position, setPosition] = useState({ lat: null, lng: null });
  /** After first vendor read: lets the map run browser geolocation only when no saved pin. */
  const [vendorLocationLoaded, setVendorLocationLoaded] = useState(false);
  const [placeMeta, setPlaceMeta] = useState({ formattedAddress: '', placeName: '' });
  const [address, setAddress] = useState({
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    countryCode: '',
  });
  // If the user manually edits streetAddress, don't overwrite it from map geocoding.
  const streetEditedRef = useRef(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');
  const panelSearchInputRef = useRef(null);
  const panelAutocompleteRef = useRef(null);
  const handlePlaceSelectedRef = useRef(null);

  const vendorId = userProfile?.vendorID || '';

  useEffect(() => {
    let cancelled = false;

    const loadExisting = async () => {
      if (!vendorId) {
        setVendorLocationLoaded(true);
        return;
      }
      setVendorLocationLoaded(false);
      try {
        const snap = await getDoc(doc(db, 'vendors', vendorId));
        if (cancelled) return;
        if (!snap.exists()) {
          return;
        }
        const v = snap.data() || {};
        const pin = coordsFromVendorData(v);
        if (pin) {
          setPosition(pin);
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
        const tag = (v.addressTag || v.outletAddressTag || '').toString().toLowerCase();
        if (['home', 'work', 'hotel', 'other'].includes(tag)) {
          setAddressTag(tag);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setVendorLocationLoaded(true);
      }
    };

    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  /** Backfill city/state/postal/country from reverse geocode if still missing. */
  useEffect(() => {
    if (!isValidLatLng(position.lat, position.lng)) return;
    // Even if other fields are already filled, we still want to populate street+number from the map
    // as long as the user hasn't manually edited that field.

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
          const parsed = parseGoogleAddressComponents(
            results[0].address_components,
            results[0].formatted_address
          );
          if (!parsed) return;
          setAddress((prev) => {
            return {
              ...prev,
              streetAddress: streetEditedRef.current
                ? prev.streetAddress
                : ((parsed.streetLine || '').trim() || prev.streetAddress || ''),
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
  }, [position.lat, position.lng]);

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

  useEffect(() => {
    if (canConfirmMap) {
      setMapLocationError(false);
    }
  }, [canConfirmMap]);

  // const handleChangeLocation = () => {
  //   setPlaceMeta({ formattedAddress: '', placeName: '' });
  //   window.setTimeout(() => {
  //     document.getElementById('location-search-onboarding')?.focus();
  //   }, 0);
  // };

  /** Shown after a failed save attempt; cleared when the field is fixed. */
  const [fieldErrors, setFieldErrors] = useState({});
  const [mapLocationError, setMapLocationError] = useState(false);
  /** Short-lived flag to re-run shake animation on invalid submit. */
  const [shakeActive, setShakeActive] = useState(false);

  const clearFieldErrorKey = (name) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    if (name === 'landmark') {
      setLandmark(value);
      return;
    }
    if (name === 'streetAddress') {
      streetEditedRef.current = true;
    }
    setAddress((prev) => ({ ...prev, [name]: value }));
    clearFieldErrorKey(name);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Location is not available in this browser.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        streetEditedRef.current = false;
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setPlaceMeta({ formattedAddress: '', placeName: '' });
      },
      () => {
        showToast('Could not access your location. Check permissions or search on the map.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handlePlaceSelected = (payload) => {
    streetEditedRef.current = false;
    setPlaceMeta({
      formattedAddress: payload.formattedAddress || '',
      placeName: payload.placeName || '',
    });
    if (isValidLatLng(payload.lat, payload.lng)) {
      setPosition({ lat: payload.lat, lng: payload.lng });
    }
    const parsed = parseGoogleAddressComponents(
      payload.addressComponents,
      payload.formattedAddress
    );
    if (parsed) {
      setAddress((prev) => ({
        ...prev,
        streetAddress: streetEditedRef.current
          ? prev.streetAddress
          : ((parsed.streetLine || '').trim() || prev.streetAddress),
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        postalCode: parsed.postalCode || prev.postalCode,
        country: parsed.country || prev.country,
        countryCode: parsed.countryCode || prev.countryCode || '',
      }));
    }
  };

  useEffect(() => {
    handlePlaceSelectedRef.current = handlePlaceSelected;
  }, [handlePlaceSelected]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const google = window.google;
    if (!google?.maps?.places?.Autocomplete) return undefined;
    if (!panelSearchInputRef.current) return undefined;
    if (panelAutocompleteRef.current) return undefined;

    const ac = new google.maps.places.Autocomplete(panelSearchInputRef.current, {
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
      types: ['geocode', 'establishment'],
    });
    panelAutocompleteRef.current = ac;

    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const loc = place?.geometry?.location;
      const lat = typeof loc?.lat === 'function' ? loc.lat() : null;
      const lng = typeof loc?.lng === 'function' ? loc.lng() : null;
      const formattedAddress = place?.formatted_address || '';
      const placeName = place?.name || '';

      setPanelSearch(formattedAddress || placeName || '');
      handlePlaceSelectedRef.current?.({
        lat,
        lng,
        formattedAddress,
        placeName,
        addressComponents: place?.address_components || [],
      });
    });

    return () => {
      try {
        if (listener?.remove) listener.remove();
      } catch (_) {
        // ignore
      }
      panelAutocompleteRef.current = null;
    };
  }, []);

  const triggerShake = () => {
    setShakeActive(false);
    window.setTimeout(() => {
      setShakeActive(true);
      window.setTimeout(() => setShakeActive(false), 450);
    }, 0);
  };

  const fieldClass = (name) => (
    `ol-field ${fieldErrors[name] ? 'ol-field--error' : ''} ${fieldErrors[name] && shakeActive ? 'ol-field--shake' : ''}`
  );

  const handleSaveAndContinue = async () => {
    if (!user) return;
    if (!vendorId) {
      showToast('Vendor profile not ready yet. Please try again in a moment.', 'error');
      return;
    }

    setFieldErrors({});
    setMapLocationError(false);

    if (!isValidLatLng(position.lat, position.lng)) {
      setMapLocationError(true);
      triggerShake();
      setSheetExpanded(true);
      showToast('Please select a location on the map (search, drag the pin, or use current location).', 'error');
      return;
    }

    const nextErrors = {};
    if (!address.streetAddress.trim()) nextErrors.streetAddress = true;
    if (!address.city.trim()) nextErrors.city = true;
    if (!address.state.trim()) nextErrors.state = true;
    if (!address.postalCode.trim()) nextErrors.postalCode = true;
    if (!address.country.trim()) nextErrors.country = true;

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      triggerShake();
      setSheetExpanded(true);
      showToast('Please fill in the highlighted required fields.', 'error');
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
          addressTag,
          location: locationText || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      navigate('/onboarding-congrats', { replace: true });
    } catch (e) {
      showToast(e?.message || 'Failed to save location', 'error');
    } finally {
      setSaving(false);
    }
  };

  const immersiveBackButton = useMemo(
    () => (
      <button
        type="button"
        className="ol-immersive__mapBack"
        onClick={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
          else navigate('/business-category?onboarding=1');
        }}
        aria-label="Back to store details"
      >
        <ChevronLeft className="ol-immersive__mapBackIcon" strokeWidth={2.25} aria-hidden />
      </button>
    ),
    [navigate]
  );

  return (
    <OnboardingSplitLayout showHelpButton={false}>
      <div className="ol-immersive">
        <header className="ol-immersive__pageHeader ol-immersive__pageHeader--desktopOnly">
          <button
            type="button"
            className="ol-immersive__backLink"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
              else navigate('/business-category?onboarding=1');
            }}
          >
            <ChevronLeft className="ol-immersive__backLinkIcon" strokeWidth={2.25} aria-hidden />
            <span>Back</span>
          </button>
          <div className="ol-immersive__pageHeaderTitles">
            <h1 className="ol-immersive__pageTitle">Set your location</h1>
            <p className="ol-immersive__pageSubtitle">
              Pin where customers pick up orders — we'll use this for your storefront address.
            </p>
          </div>
          <div className="ol-immersive__pageHeaderSpacer" aria-hidden />
        </header>

        <div className="ol-immersive__main">
          <section
            className={`ol-immersive__map ${mapLocationError ? 'ol-immersive__map--error' : ''} ${mapLocationError && shakeActive ? 'ol-immersive__map--shake' : ''}`}
            aria-label="Map — choose outlet location"
          >
            <Suspense fallback={<MapChunkFallback minHeight={480} />}>
              <LocationPickerMap
                variant="immersive"
                mapTypeId="hybrid"
                immersiveTopLeft={immersiveBackButton}
                immersiveSearchPlaceholder="Search for an address or place…"
                suppressInitialGeolocation={
                  !vendorLocationLoaded || isValidLatLng(position.lat, position.lng)
                }
                hideHint
                value={{
                  lat: position.lat ?? '',
                  lng: position.lng ?? '',
                }}
                onChange={({ lat, lng, source }) => {
                  setPosition({ lat, lng });
                  if (source === 'map' || source === 'geolocation') {
                    streetEditedRef.current = false;
                    setPlaceMeta({ formattedAddress: '', placeName: '' });
                  }
                }}
                onPlaceSelected={handlePlaceSelected}
                showCoordInputs={false}
              />
            </Suspense>
          </section>

          <aside className={`ol-immersive__panel${sheetExpanded ? ' ol-immersive__panel--expanded' : ' ol-immersive__panel--collapsed'}`}>
            <div className="ol-immersive__sheet">
              <button
                type="button"
                className="ol-immersive__sheetToggle"
                onClick={() => setSheetExpanded((v) => !v)}
                aria-expanded={sheetExpanded}
                aria-label={sheetExpanded ? 'Collapse address sheet' : 'Expand address sheet'}
              >
                <span className="ol-immersive__handle" aria-hidden />
                <ChevronDown className={`ol-immersive__sheetChevron${sheetExpanded ? ' is-up' : ''}`} strokeWidth={2.25} aria-hidden />
              </button>
              <div className="ol-immersive__sheetBody">
                <div className="ol-immersive__mobileCollapsedPeek">
                  <p className="ol-immersive__mobilePeekHint">Tap on the map to select your location</p>
                  <button
                    type="button"
                    className="ol-immersive__cta ol-immersive__cta--mobilePeek"
                    onClick={handleSaveAndContinue}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save & continue'}
                  </button>
                </div>

                <div className="ol-immersive__sheetFormMain">
                <div className="ol-immersive__panelHead ol-immersive__panelHead--sheetOnly">
                  <div className="ol-immersive__iconWrap" aria-hidden>
                    <MapPin className="ol-immersive__headIcon" strokeWidth={2} />
                  </div>
                  <h2 className="ol-immersive__title">Set your location</h2>
                  <p className="ol-immersive__subtitle">Search or drag the marker on the map.</p>
                </div>

                <div className="ol-immersive__panelSearch" aria-label="Search address">
                  <div className="ol-immersive__panelSearchBar">
                    <Search className="ol-immersive__panelSearchIcon" strokeWidth={2} aria-hidden />
                    <input
                      ref={panelSearchInputRef}
                      className="ol-immersive__panelSearchInput"
                      type="text"
                      inputMode="search"
                      placeholder="Search for an address or place…"
                      value={panelSearch}
                      onChange={(e) => setPanelSearch(e.target.value)}
                    />
                  </div>
                  <div className="ol-immersive__panelSearchHintBox" role="note">
                    Tap on the map or search to pick a location
                  </div>
                </div>

                <div className="ol-immersive__fields">
                  <div className={fieldClass('streetAddress')}>
                    <label htmlFor="outlet-street">Address *</label>
                    <input
                      id="outlet-street"
                      name="streetAddress"
                      type="text"
                      autoComplete="street-address"
                      value={address.streetAddress}
                      onChange={handleAddressChange}
                      placeholder="House / Flat / Floor No."
                      aria-invalid={fieldErrors.streetAddress ? 'true' : undefined}
                    />
                  </div>

                  <div className="ol-fieldRow">
                    <div className={fieldClass('city')}>
                      <label htmlFor="outlet-city">City *</label>
                      <input
                        id="outlet-city"
                        name="city"
                        type="text"
                        autoComplete="address-level2"
                        value={address.city}
                        onChange={handleAddressChange}
                        placeholder="City / Area"
                        aria-invalid={fieldErrors.city ? 'true' : undefined}
                      />
                    </div>
                    <div className={fieldClass('state')}>
                      <label htmlFor="outlet-state">Province / State *</label>
                      <input
                        id="outlet-state"
                        name="state"
                        type="text"
                        autoComplete="address-level1"
                        value={address.state}
                        onChange={handleAddressChange}
                        placeholder="State or province"
                        aria-invalid={fieldErrors.state ? 'true' : undefined}
                      />
                    </div>
                  </div>

                  <div className="ol-fieldRow">
                    <div className={fieldClass('postalCode')}>
                      <label htmlFor="outlet-postal">Postal / ZIP *</label>
                      <input
                        id="outlet-postal"
                        name="postalCode"
                        type="text"
                        autoComplete="postal-code"
                        value={address.postalCode}
                        onChange={handleAddressChange}
                        placeholder="Postal code"
                        aria-invalid={fieldErrors.postalCode ? 'true' : undefined}
                      />
                    </div>
                    <div className={fieldClass('country')}>
                      <label htmlFor="outlet-country">Country *</label>
                      <input
                        id="outlet-country"
                        name="country"
                        type="text"
                        autoComplete="country-name"
                        value={address.country}
                        onChange={handleAddressChange}
                        placeholder="Country"
                        aria-invalid={fieldErrors.country ? 'true' : undefined}
                      />
                    </div>
                  </div>

                  <div className="ol-field">
                    <label htmlFor="outlet-landmark" className="ol-field__labelMuted">
                      Landmark (optional)
                    </label>
                    <input
                      id="outlet-landmark"
                      name="landmark"
                      type="text"
                      value={landmark}
                      onChange={handleAddressChange}
                      placeholder="e.g. Near City Mall"
                    />
                  </div>

                  {!addressComplete && address.streetAddress.trim() && (
                    <p className="ol-immersive__warn">
                      Filling address from map… Move the pin or search if details stay empty.
                    </p>
                  )}
                </div>

                

                <button
                  type="button"
                  className="ol-immersive__useLoc"
                  onClick={handleUseCurrentLocation}
                >
                  <Navigation className="ol-immersive__useLocIcon" strokeWidth={2} aria-hidden />
                  Use my current location
                </button>

                <button
                  type="button"
                  className="ol-immersive__cta ol-immersive__cta--formFooter"
                  onClick={handleSaveAndContinue}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save & continue'}
                </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
}
