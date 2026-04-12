/**
 * Serialize Google Places PlaceResult for Firestore (plain JSON, no functions).
 * @param {google.maps.places.PlaceResult | null | undefined} place
 * @returns {Record<string, unknown> | null}
 */
export function placeResultToFirestore(place) {
  if (!place) return null;

  const latLng = place.geometry?.location;
  let lat;
  let lng;
  if (latLng) {
    lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
  }

  const out = {
    place_id: place.place_id || null,
    name: place.name || null,
    formatted_address: place.formatted_address || null,
    vicinity: place.vicinity || null,
    adr_address: place.adr_address || null,
    url: place.url || null,
    utc_offset_minutes: place.utc_offset_minutes ?? place.utc_offset ?? null,
    types: Array.isArray(place.types) ? [...place.types] : null,
    business_status: place.business_status || null,
    formatted_phone_number: place.formatted_phone_number || null,
    international_phone_number: place.international_phone_number || null,
    website: place.website || null,
    rating: place.rating != null ? Number(place.rating) : null,
    user_ratings_total: place.user_ratings_total != null ? Number(place.user_ratings_total) : null,
    price_level: place.price_level != null ? Number(place.price_level) : null,
    plus_code: place.plus_code
      ? {
        compound_code: place.plus_code.compound_code || null,
        global_code: place.plus_code.global_code || null,
      }
      : null,
    geometry: lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? { location: { lat, lng } }
      : null,
  };

  if (Array.isArray(place.address_components)) {
    out.address_components = place.address_components.map((c) => ({
      long_name: c.long_name || '',
      short_name: c.short_name || '',
      types: Array.isArray(c.types) ? [...c.types] : [],
    }));
  }

  if (place.opening_hours?.weekday_text) {
    out.opening_hours_weekday_text = [...place.opening_hours.weekday_text];
  }

  return out;
}

/**
 * Derive vendor title / description / coordinates from a saved place object.
 * @param {Record<string, unknown>} saved
 */
export function vendorFieldsFromSavedPlace(saved) {
  if (!saved || typeof saved !== 'object') {
    return { title: '', description: '', latitude: null, longitude: null };
  }
  const title = (saved.name || saved.formatted_address || 'Store').toString().trim();
  const description = (
    saved.formatted_address
    || saved.vicinity
    || saved.name
    || ''
  ).toString().trim();
  const loc = saved.geometry?.location;
  const latitude = typeof loc?.lat === 'number' ? loc.lat : null;
  const longitude = typeof loc?.lng === 'number' ? loc.lng : null;
  return { title, description, latitude, longitude };
}
