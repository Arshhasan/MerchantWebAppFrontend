/**
 * Parse Google Places Geocoder `address_components` into fields used by vendor docs.
 * @param {Array<{ long_name: string, short_name: string, types: string[] }>|undefined} components
 * @returns {{ streetLine: string, city: string, state: string, postalCode: string, country: string, countryCode: string } | null}
 */
export function parseGoogleAddressComponents(components) {
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
  const streetLine = [streetNumber, route].filter(Boolean).join(' ').trim();

  const city =
    get(['locality'])
    || get(['sublocality', 'sublocality_level_1'])
    || get(['administrative_area_level_2'])
    || '';

  const state = get(['administrative_area_level_1']);
  const postalCode = get(['postal_code']);
  const country = get(['country']);
  const countryCode = getShort(['country']);

  return {
    streetLine,
    city,
    state,
    postalCode,
    country,
    countryCode,
  };
}
