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
 * @param {string} currencyCode ISO 4217
 * @param {string | string[] | undefined} [locale]
 */
function formatCurrencyAmount(amount, currencyCode, locale) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    let s = formatter.format(n);

    // Some locales produce region-prefixed dollars like "CA$1.00" or "A$1.00".
    // Keep the dollar symbol while dropping the region prefix for cleaner UI.
    s = s.replace(/\b[A-Z]{1,3}\$/g, '$');
    return s;
  } catch {
    // Fallback for unknown currency codes / older environments.
    return formatDollarAmount(n, locale);
  }
}

/**
 * @param {number} amount
 * @param {Record<string, unknown> | null | undefined} vendorProfile
 * @param {string | string[] | undefined} [locale]
 */
export function formatMerchantCurrency(amount, vendorProfile, locale) {
  const currencyCode = resolveMerchantCurrencyCode(vendorProfile);
  return formatCurrencyAmount(amount, currencyCode, locale);
}

export { resolveMerchantCurrencyCode };
