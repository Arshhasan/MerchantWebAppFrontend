import { useRef } from 'react';
import PropTypes from 'prop-types';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import './FindStoreSearchBar.css';

const GOOGLE_LIBRARIES = ['places'];

/**
 * Google Places Autocomplete only (no map). Same script id as LocationPickerMap so one Maps load.
 */
export default function FindStoreSearchBar({
  value,
  onChangeText,
  onPlaceSelected,
  placeholder = 'Search for your store address',
  inputId = 'find-store-autocomplete',
  disabled = false,
}) {
  const autocompleteRef = useRef(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_LIBRARIES,
  });

  const handlePlaceChanged = () => {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const place = ac.getPlace?.();
    if (place && (place.place_id || place.name || place.formatted_address)) {
      onPlaceSelected?.(place);
    }
  };

  if (!apiKey) {
    return (
      <div className="find-store-search-bar__warn">
        Set <code>VITE_GOOGLE_MAPS_API_KEY</code> to search for your store.
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="find-store-search-bar__warn">
        Google Places could not load. Check your API key and billing.
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="find-store-search-bar__loading" aria-busy="true">
        Loading search…
      </div>
    );
  }

  return (
    <div className="find-store-search-bar">
      <Autocomplete
        onLoad={(ac) => { autocompleteRef.current = ac; }}
        onPlaceChanged={handlePlaceChanged}
      >
        <input
          id={inputId}
          type="text"
          className="find-store-search-bar__input"
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label="Search for your store"
        />
      </Autocomplete>
      {value ? (
        <button
          type="button"
          className="find-store-search-bar__clear"
          onClick={() => {
            onChangeText('');
            onPlaceSelected?.(null);
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

FindStoreSearchBar.propTypes = {
  value: PropTypes.string.isRequired,
  onChangeText: PropTypes.func.isRequired,
  onPlaceSelected: PropTypes.func,
  placeholder: PropTypes.string,
  inputId: PropTypes.string,
  disabled: PropTypes.bool,
};
