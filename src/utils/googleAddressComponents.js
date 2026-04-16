/**
 * Parse Google Places Geocoder `address_components` into fields used by vendor docs.
 * @param {Array<{ long_name: string, short_name: string, types: string[] }>|undefined} components
 * @param {string} [formattedAddress] Optional full formatted_address from the same result — used when
 *   `street_number`/`route` are missing (common for India: premise/subpremise or first line only).
 * @returns {{ streetLine: string, city: string, state: string, postalCode: string, country: string, countryCode: string } | null}
 */
export function parseGoogleAddressComponents(components, formattedAddress = '') {
  if (!components || !Array.isArray(components)) return null;

  const get = (types) => {
    const c = components.find((x) => types.some((t) => (x.types || []).includes(t)));
    return c && c.long_name ? String(c.long_name).trim() : '';
  };

  const getShort = (types) => {
    const c = components.find((x) => types.some((t) => (x.types || []).includes(t)));
    return c && c.short_name ? String(c.short_name).trim().toUpperCase() : '';
  };

  const streetNumber = get(['street_number']);
  const route = get(['route']);
  let streetLine = [streetNumber, route].filter(Boolean).join(' ').trim();

  if (!streetLine) {
    const premise = get(['premise']);
    const subpremise = get(['subpremise']);
    const neighborhood = get(['neighborhood']);
    const sublocality3 = get(['sublocality_level_3']);
    const sublocality2 = get(['sublocality_level_2']);

    if (premise || subpremise) {
      streetLine = [premise, subpremise].filter(Boolean).join(', ').trim();
    }
    if (!streetLine && (premise || neighborhood)) {
      streetLine = [premise, neighborhood].filter(Boolean).join(', ').trim();
    }
    if (!streetLine && sublocality3) {
      streetLine = sublocality3;
    }
    if (!streetLine && sublocality2) {
      streetLine = sublocality2;
    }
    if (!streetLine && neighborhood) {
      streetLine = neighborhood;
    }
    if (!streetLine) {
      const poi = get(['point_of_interest']) || get(['establishment']);
      if (poi) streetLine = poi;
    }
    if (!streetLine) {
      const plusCode = get(['plus_code']);
      if (plusCode) streetLine = plusCode;
    }
  }

  const city =
    get(['locality'])
    || get(['sublocality', 'sublocality_level_1'])
    || get(['administrative_area_level_2'])
    || '';

  const state = get(['administrative_area_level_1']);
  const postalCode = get(['postal_code']);
  const country = get(['country']);
  const countryCode = getShort(['country']);

  if (!streetLine && formattedAddress) {
    const first = String(formattedAddress).trim().split(',')[0]?.trim() || '';
    const cityNorm = city.toLowerCase();
    const firstNorm = first.toLowerCase();
    const looksLikeStreetLine = first && (/\d/.test(first) || /[/]/.test(first) || first.length > 35);
    if (first && (firstNorm !== cityNorm || looksLikeStreetLine || !city)) {
      streetLine = first;
    }
  }

  return {
    streetLine,
    city,
    state,
    postalCode,
    country,
    countryCode,
  };
}
