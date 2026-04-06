/**
 * Invoice tax line labels by country (India → GST, Canada → VAT).
 */

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeCountryKey(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (s === 'in' || s === 'ind' || s === 'india' || s.includes('india')) return 'india';
  if (s === 'ca' || s === 'can' || s === 'canada' || s.includes('canada')) return 'canada';
  return s;
}

/**
 * @param {string} [country] — country name or code from vendor / invoice
 * @returns {'GST' | 'VAT' | 'Tax'}
 */
export function taxLabelFromCountry(country) {
  const k = normalizeCountryKey(country);
  if (k === 'india') return 'GST';
  if (k === 'canada') return 'VAT';
  return 'Tax';
}

/**
 * @param {string} [country]
 * @param {string} [currencyCode] — ISO 4217, used when country is missing
 * @returns {'GST' | 'VAT' | 'Tax'}
 */
export function taxLabelFromCountryAndCurrency(country, currencyCode) {
  const fromCountry = taxLabelFromCountry(country);
  if (fromCountry !== 'Tax') return fromCountry;
  const cur = String(currencyCode || '').toUpperCase();
  if (cur === 'INR') return 'GST';
  if (cur === 'CAD') return 'VAT';
  return 'Tax';
}

/**
 * @param {string | undefined} stored — optional override from Firestore (e.g. "GST")
 * @returns {'GST' | 'VAT' | 'Tax' | null}
 */
export function parseStoredTaxLabel(stored) {
  const t = String(stored || '')
    .trim()
    .toLowerCase();
  if (t === 'gst') return 'GST';
  if (t === 'vat') return 'VAT';
  if (t === 'tax') return 'Tax';
  return null;
}

/**
 * @param {'GST' | 'VAT' | 'Tax'} taxLabel
 * @param {number} rate
 */
export function formatTaxRateLine(taxLabel, rate) {
  const name = taxLabel || 'Tax';
  const r = Number(rate);
  if (Number.isFinite(r) && r > 0) return `${name}, ${r}%`;
  return `${name}, 0%`;
}
