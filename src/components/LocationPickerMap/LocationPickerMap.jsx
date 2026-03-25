import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import './LocationPickerMap.css';

function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parseLatLng(value) {
  if (!value) return null;
  const lat = typeof value.lat === 'string' ? parseFloat(value.lat) : value.lat;
  const lng = typeof value.lng === 'string' ? parseFloat(value.lng) : value.lng;
  return isValidLatLng(lat, lng) ? { lat, lng } : null;
}

function ClickAndDragHandlers({ position, onPick }) {
  const markerIcon = useMemo(
    () =>
      L.icon({
        // From Vite `public/` folder
        iconUrl: '/location-pin.png',
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34],
      }),
    []
  );

  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={markerIcon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const latlng = e.target.getLatLng();
          onPick({ lat: latlng.lat, lng: latlng.lng });
        },
      }}
    />
  );
}

ClickAndDragHandlers.propTypes = {
  position: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
  }).isRequired,
  onPick: PropTypes.func.isRequired,
};

export default function LocationPickerMap({
  value,
  onChange,
  height = 320,
  defaultZoom = 15,
  fallbackCenter = { lat: 25.2048, lng: 55.2708 }, // Dubai-ish fallback
}) {
  const initial = useMemo(() => parseLatLng(value) || fallbackCenter, [value, fallbackCenter]);
  const [position, setPosition] = useState(initial);
  const [status, setStatus] = useState('idle'); // idle | locating | denied | unavailable | error
  const mapRef = useRef(null);

  // Keep internal state in sync when parent loads existing vendor coordinates.
  useEffect(() => {
    const parsed = parseLatLng(value);
    if (parsed && (!isValidLatLng(position.lat, position.lng) || parsed.lat !== position.lat || parsed.lng !== position.lng)) {
      setPosition(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  // If no valid value provided, try to default to user's current location.
  useEffect(() => {
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
        setPosition(next);
        onChange?.(next);
      },
      (err) => {
        if (err?.code === 1) setStatus('denied');
        else setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (next) => {
    if (!isValidLatLng(next.lat, next.lng)) return;
    setPosition(next);
    onChange?.(next);
    const map = mapRef.current;
    if (map) map.panTo([next.lat, next.lng], { animate: true });
  };

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
        pick(next);
      },
      (err) => {
        if (err?.code === 1) setStatus('denied');
        else setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  return (
    <div className="location-picker">
      <div className="location-picker__header">
        <div className="location-picker__meta">
          <div className="location-picker__coords">
            <span>Lat: {position.lat.toFixed(6)}</span>
            <span>Lng: {position.lng.toFixed(6)}</span>
          </div>
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

      <div className="location-picker__map" style={{ height }}>
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={defaultZoom}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickAndDragHandlers position={position} onPick={pick} />
        </MapContainer>
      </div>

      <div className="location-picker__hint">
        Tip: click anywhere on the map to set the pin, or drag the pin to fine-tune the location.
      </div>
    </div>
  );
}

LocationPickerMap.propTypes = {
  value: PropTypes.shape({
    lat: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    lng: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  onChange: PropTypes.func,
  height: PropTypes.number,
  defaultZoom: PropTypes.number,
  fallbackCenter: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
  }),
};

