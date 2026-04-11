import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Autocomplete, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

import './LocationPickerMap.css';

const GOOGLE_LIBRARIES = ['places'];

function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number'
    && typeof lng === 'number'
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
  );
}

function parseLatLng(value) {
  if (!value) return null;
  const lat = typeof value.lat === 'string' ? parseFloat(value.lat) : value.lat;
  const lng = typeof value.lng === 'string' ? parseFloat(value.lng) : value.lng;
  return isValidLatLng(lat, lng) ? { lat, lng } : null;
}

function SearchField({
  apiKey,
  loadError,
  isLoaded,
  search,
  setSearch,
  autocompleteRef,
  onPlaceChanged,
  inputId,
  inputClassName,
  placeholder = 'Search by address or place name',
}) {
  if (!apiKey) {
    return (
      <div className="location-picker__search-warning">
        Missing Google Maps key. Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your environment.
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="location-picker__search-warning">
        Google Maps failed to load. Check API key restrictions and billing.
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="location-picker__search-warning">
        Loading Google Places…
      </div>
    );
  }
  return (
    <Autocomplete
      onLoad={(ac) => { autocompleteRef.current = ac; }}
      onPlaceChanged={onPlaceChanged}
    >
      <input
        id={inputId}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
    </Autocomplete>
  );
}

export default function LocationPickerMap({
  value,
  onChange,
  onPlaceSelected,
  showCoordInputs = true,
  height = 320,
  defaultZoom = 15,
  fallbackCenter = { lat: 25.2048, lng: 55.2708 },
  variant = 'default',
  suppressInitialGeolocation = false,
  hideHint = false,
  immersiveTopLeft = null,
  immersiveSearchPlaceholder = 'Search for an address',
  mapTypeId = 'roadmap',
}) {
  const initial = useMemo(() => parseLatLng(value) || fallbackCenter, [value, fallbackCenter]);
  const [position, setPosition] = useState(initial);
  const [status, setStatus] = useState('idle');
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [search, setSearch] = useState('');

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_LIBRARIES,
  });

  const pick = (next, source = 'map') => {
    if (!isValidLatLng(next.lat, next.lng)) return;
    setPosition(next);
    onChange?.({ lat: next.lat, lng: next.lng, source });
    const map = mapRef.current;
    if (map) map.panTo(next);
  };

  useEffect(() => {
    const parsed = parseLatLng(value);
    if (parsed && (!isValidLatLng(position.lat, position.lng) || parsed.lat !== position.lat || parsed.lng !== position.lng)) {
      setPosition(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    if (suppressInitialGeolocation) return;
    const parsed = parseLatLng(value);
    if (parsed) return;
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setStatus('idle');
        pick(next, 'geolocation');
      },
      (err) => {
        if (err?.code === 1) setStatus('denied');
        else setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppressInitialGeolocation]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setStatus('idle');
        pick(next, 'geolocation');
      },
      (err) => {
        if (err?.code === 1) setStatus('denied');
        else setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handlePlaceChanged = () => {
    const ac = autocompleteRef.current;
    const place = ac?.getPlace?.();
    const loc = place?.geometry?.location;
    if (!loc) return;
    const next = { lat: loc.lat(), lng: loc.lng() };
    pick(next, 'place');

    const formattedAddress = place?.formatted_address || '';
    const placeName = place?.name || '';
    if (formattedAddress) setSearch(formattedAddress);
    else if (placeName) setSearch(placeName);

    onPlaceSelected?.({
      lat: next.lat,
      lng: next.lng,
      formattedAddress,
      placeName,
      placeId: place?.place_id || '',
      addressComponents: place?.address_components || null,
    });
  };

  const setLatLngFromInput = (nextLat, nextLng) => {
    if (!isValidLatLng(nextLat, nextLng)) return;
    pick({ lat: nextLat, lng: nextLng });
  };

  const mapBlock = (
    <div className="location-picker__map" style={{ height }}>
      {apiKey && isLoaded ? (
        <GoogleMap
          center={position}
          zoom={defaultZoom}
          mapContainerStyle={{ height: '100%', width: '100%' }}
          onLoad={(map) => { mapRef.current = map; }}
          onClick={(e) => {
            const lat = e.latLng?.lat?.();
            const lng = e.latLng?.lng?.();
            if (typeof lat === 'number' && typeof lng === 'number') pick({ lat, lng });
          }}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: 'greedy',
            mapTypeId: mapTypeId || 'roadmap',
          }}
        >
          <Marker
            position={position}
            draggable
            onDragEnd={(e) => {
              const lat = e.latLng?.lat?.();
              const lng = e.latLng?.lng?.();
              if (typeof lat === 'number' && typeof lng === 'number') pick({ lat, lng });
            }}
          />
        </GoogleMap>
      ) : (
        <div className="location-picker__map-loading">
          {apiKey ? 'Loading map…' : 'Map requires Google Maps API key.'}
        </div>
      )}
    </div>
  );

  const statusBlock = status !== 'idle' && (
    <div className="location-picker__status">
      {status === 'locating' && 'Getting your current location…'}
      {status === 'denied' && 'Location permission denied. You can still pick on the map.'}
      {status === 'unavailable' && 'Geolocation not available. You can still pick on the map.'}
      {status === 'error' && 'Could not fetch location. You can still pick on the map.'}
    </div>
  );

  if (variant === 'immersive') {
    return (
      <div className="location-picker location-picker--immersive">
        <div className="location-picker__immersiveTop">
          {immersiveTopLeft}
          <div className="location-picker__immersiveSearchBar">
            <span className="location-picker__immersiveSearchIcon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <SearchField
              apiKey={apiKey}
              loadError={loadError}
              isLoaded={isLoaded}
              search={search}
              setSearch={setSearch}
              autocompleteRef={autocompleteRef}
              onPlaceChanged={handlePlaceChanged}
              inputId="location-search-immersive"
              inputClassName="location-picker__search-input location-picker__search-input--immersive"
              placeholder={immersiveSearchPlaceholder}
            />
          </div>
        </div>
        {statusBlock}
        <div className="location-picker__immersiveMapWrap">
          <div className="location-picker__map location-picker__map--immersive">
            {apiKey && isLoaded ? (
              <GoogleMap
                center={position}
                zoom={defaultZoom}
                mapContainerStyle={{ height: '100%', width: '100%' }}
                onLoad={(map) => { mapRef.current = map; }}
                onClick={(e) => {
                  const lat = e.latLng?.lat?.();
                  const lng = e.latLng?.lng?.();
                  if (typeof lat === 'number' && typeof lng === 'number') pick({ lat, lng });
                }}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                  clickableIcons: false,
                  gestureHandling: 'greedy',
                  mapTypeId: mapTypeId || 'hybrid',
                }}
              >
                <Marker
                  position={position}
                  draggable
                  onDragEnd={(e) => {
                    const lat = e.latLng?.lat?.();
                    const lng = e.latLng?.lng?.();
                    if (typeof lat === 'number' && typeof lng === 'number') pick({ lat, lng });
                  }}
                />
              </GoogleMap>
            ) : (
              <div className="location-picker__map-loading">
                {apiKey ? 'Loading map…' : 'Map requires Google Maps API key.'}
              </div>
            )}
          </div>
          <button
            type="button"
            className="location-picker__locateFab"
            onClick={useMyLocation}
            aria-label="Use my current location"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polygon points="12 2 19 21 12 17 5 21 12 2" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'onboarding') {
    return (
      <div className="location-picker location-picker--onboarding">
        <div className="location-picker__toolbar">
          <button
            type="button"
            className="location-picker__toolbar-btn location-picker__toolbar-btn--outline"
            onClick={useMyLocation}
          >
            <span className="location-picker__toolbar-icon" aria-hidden>◎</span>
            Current location
          </button>
          <div className="location-picker__toolbar-search">
            <SearchField
              apiKey={apiKey}
              loadError={loadError}
              isLoaded={isLoaded}
              search={search}
              setSearch={setSearch}
              autocompleteRef={autocompleteRef}
              onPlaceChanged={handlePlaceChanged}
              inputId="location-search-onboarding"
              inputClassName="location-picker__search-input location-picker__search-input--toolbar"
            />
          </div>
        </div>
        {statusBlock}
        {mapBlock}
        {!hideHint && (
          <div className="location-picker__hint">
            Tap the map or drag the pin to fine-tune. Then confirm below.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="location-picker">
      <div className="location-picker__header">
        <div className="location-picker__meta">
          {showCoordInputs && (
            <div className="location-picker__coords">
              <div className="location-picker__coord">
                <label className="location-picker__coord-label" htmlFor="location-picker-lat">Lat</label>
                <input
                  id="location-picker-lat"
                  className="location-picker__coord-input"
                  type="number"
                  step="0.000001"
                  inputMode="decimal"
                  value={Number.isFinite(position.lat) ? position.lat : ''}
                  onChange={(e) => {
                    const nextLat = e.target.value === '' ? NaN : parseFloat(e.target.value);
                    setPosition((prev) => ({ ...prev, lat: Number.isFinite(nextLat) ? nextLat : prev.lat }));
                    setLatLngFromInput(nextLat, position.lng);
                  }}
                />
              </div>
              <div className="location-picker__coord">
                <label className="location-picker__coord-label" htmlFor="location-picker-lng">Lng</label>
                <input
                  id="location-picker-lng"
                  className="location-picker__coord-input"
                  type="number"
                  step="0.000001"
                  inputMode="decimal"
                  value={Number.isFinite(position.lng) ? position.lng : ''}
                  onChange={(e) => {
                    const nextLng = e.target.value === '' ? NaN : parseFloat(e.target.value);
                    setPosition((prev) => ({ ...prev, lng: Number.isFinite(nextLng) ? nextLng : prev.lng }));
                    setLatLngFromInput(position.lat, nextLng);
                  }}
                />
              </div>
            </div>
          )}
          {status !== 'idle' && (
            <div className="location-picker__status">
              {status === 'locating' && 'Getting your current location…'}
              {status === 'denied' && 'Location permission denied. You can still pick on the map.'}
              {status === 'unavailable' && 'Geolocation not available. You can still pick on the map.'}
              {status === 'error' && 'Could not fetch location. You can still pick on the map.'}
            </div>
          )}
        </div>
        <button type="button" className="btn btn-secondary location-picker__btn" onClick={useMyLocation}>
          Use my current location
        </button>
      </div>

      <div className="location-picker__search">
        <label className="location-picker__search-label" htmlFor="location-search">
          Search location
        </label>
        <div className="location-picker__search-inputWrap">
          <SearchField
            apiKey={apiKey}
            loadError={loadError}
            isLoaded={isLoaded}
            search={search}
            setSearch={setSearch}
            autocompleteRef={autocompleteRef}
            onPlaceChanged={handlePlaceChanged}
            inputId="location-search"
            inputClassName="location-picker__search-input"
          />
        </div>
      </div>

      {mapBlock}

      {!hideHint && (
        <div className="location-picker__hint">
          Tip: click anywhere on the map to set the pin, or drag the pin to fine-tune the location.
        </div>
      )}
    </div>
  );
}

LocationPickerMap.propTypes = {
  value: PropTypes.shape({
    lat: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    lng: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  onChange: PropTypes.func,
  onPlaceSelected: PropTypes.func,
  showCoordInputs: PropTypes.bool,
  height: PropTypes.number,
  defaultZoom: PropTypes.number,
  fallbackCenter: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
  }),
  variant: PropTypes.oneOf(['default', 'onboarding', 'immersive']),
  immersiveTopLeft: PropTypes.node,
  immersiveSearchPlaceholder: PropTypes.string,
  mapTypeId: PropTypes.string,
  suppressInitialGeolocation: PropTypes.bool,
  hideHint: PropTypes.bool,
};
