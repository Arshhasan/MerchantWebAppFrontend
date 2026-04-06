import { resolveMerchantCurrencyCode } from './countryCurrency';

/**
 * Plain dollar-style amount (e.g. `$1,234.56`) without region-prefixed symbols like `CA$`.
 * @param {number} amount
 * @param {string | string[] | undefined} [locale]
 */
export function formatDollarAmount(amount, locale) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '-' : ''}$${formatted}`;
}

/**
 * @param {number} amount
 * @param {Record<string, unknown> | null | undefined} vendorProfile
 * @param {string | string[] | undefined} [locale]
 */
export function formatMerchantCurrency(amount, vendorProfile, locale) {
  void vendorProfile;
  return formatDollarAmount(amount, locale);
}

export { resolveMerchantCurrencyCode };
