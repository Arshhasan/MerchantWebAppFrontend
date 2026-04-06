/**
 * Reverse geocode lat/lng to ISO 3166-1 alpha-2 using OpenStreetMap Nominatim (no API key).
 * Use when Google Geocoder is unavailable (e.g. manage store without Maps script).
 */
export async function fetchCountryCodeFromLatLng(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(la)}&lon=${encodeURIComponent(ln)}&format=json`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'BestByBites-Merchant-Web/1.0 (contact: merchant-app)',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const cc = data?.address?.country_code;
    return typeof cc === 'string' ? cc.toUpperCase() : null;
  } catch {
    return null;
  }
}
