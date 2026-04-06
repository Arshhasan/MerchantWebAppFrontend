/**
 * Firestore `tax` collection: country-based tax rate (e.g. tax: "10", type: "percentage", enable: true).
 */
import { collection, getDocs } from 'firebase/firestore';
import { formatTaxRateLine, normalizeCountryKey } from '../utils/taxLabel';

export const TAX_COLLECTION = 'tax';

/**
 * Tax-inclusive total → extract VAT/GST portion (same formula as merchantInvoices).
 * @param {number} grandTotal
 * @param {number} ratePercent
 */
export function vatSplitFromInclusiveTotal(grandTotal, ratePercent) {
  const g = Number(grandTotal);
  const r = Number(ratePercent);
  if (!Number.isFinite(g) || g <= 0 || !Number.isFinite(r) || r <= 0) {
    return { vatAmount: 0, subtotalExclTax: Number.isFinite(g) && g > 0 ? g : 0 };
  }
  const vatAmount = Math.round((g * r) / (100 + r) * 100) / 100;
  const subtotalExclTax = Math.max(0, g - vatAmount);
  return { vatAmount, subtotalExclTax };
}

/**
 * @param {Record<string, unknown> | null | undefined} rule
 * @returns {number}
 */
export function parseTaxPercentFromRule(rule) {
  if (!rule || rule.enable === false) return 0;
  const raw = rule.tax ?? rule.rate ?? rule.percent;
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Match `tax` doc by `country` / `title` to invoice country or inferred from currency (INR/CAD).
 *
 * @param {Array<Record<string, unknown>>} rules
 * @param {string} countryRaw
 * @param {string} [currencyCode]
 * @returns {Record<string, unknown> | null}
 */
export function findTaxRuleForCountry(rules, countryRaw, currencyCode) {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  let bucket = normalizeCountryKey(countryRaw);
  const cur = String(currencyCode || '').toUpperCase();
  if (!bucket) {
    if (cur === 'INR') bucket = 'india';
    if (cur === 'CAD') bucket = 'canada';
  }
  if (!bucket) return null;

  for (const rule of rules) {
    if (!rule || rule.enable === false) continue;
    const label = String(rule.country ?? rule.title ?? '').trim();
    if (!label) continue;
    if (normalizeCountryKey(label) === bucket) return rule;
  }
  return null;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchTaxRules(db) {
  const snap = await getDocs(collection(db, TAX_COLLECTION));
  return snap.docs.map((d) => {
    const data = d.data();
    return /** @type {Record<string, unknown>} */ ({ id: d.id, ...data });
  });
}

/**
 * Apply Firestore `tax` rule to an invoice view model (overrides stored vatRate when rule matches).
 *
 * @param {Record<string, unknown>} vm
 * @param {Record<string, unknown> | null} rule
 */
export function applyTaxRuleToInvoiceViewModel(vm, rule) {
  const pct = parseTaxPercentFromRule(rule);
  if (!(pct > 0)) return vm;

  const grandTotal = Number(vm.grandTotal);
  const taxLabel = typeof vm.taxLabel === 'string' ? vm.taxLabel : 'Tax';
  const { vatAmount, subtotalExclTax } = vatSplitFromInclusiveTotal(grandTotal, pct);

  return {
    ...vm,
    vatRate: pct,
    vatAmount,
    subtotal: subtotalExclTax,
    taxRateLine: formatTaxRateLine(taxLabel, pct),
  };
}
