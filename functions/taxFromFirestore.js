'use strict';

/**
 * Mirrors src/services/taxSettings.js matching logic for Cloud Functions (Admin SDK).
 */

function normalizeCountryKey(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (s === 'in' || s === 'ind' || s === 'india' || s.includes('india')) return 'india';
  if (s === 'ca' || s === 'can' || s === 'canada' || s.includes('canada')) return 'canada';
  return s;
}

function vatSplitFromInclusiveTotal(grandTotal, ratePercent) {
  const g = Number(grandTotal);
  const r = Number(ratePercent);
  if (!Number.isFinite(g) || g <= 0 || !Number.isFinite(r) || r <= 0) {
    return { vatAmount: 0, subtotalExclTax: Number.isFinite(g) && g > 0 ? g : 0 };
  }
  const vatAmount = Math.round((g * r) / (100 + r) * 100) / 100;
  const subtotalExclTax = Math.max(0, g - vatAmount);
  return { vatAmount, subtotalExclTax };
}

function parseTaxPercentFromRule(rule) {
  if (!rule || rule.enable === false) return 0;
  const raw = rule.tax ?? rule.rate ?? rule.percent;
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function findTaxRuleForCountry(rules, countryRaw, currencyCode) {
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
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} country
 * @param {string} currencyCode
 * @returns {Promise<number>}
 */
async function fetchTaxPercentForCountry(db, country, currencyCode) {
  const snap = await db.collection('tax').get();
  const rules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rule = findTaxRuleForCountry(rules, country, currencyCode);
  return parseTaxPercentFromRule(rule || {});
}

module.exports = {
  vatSplitFromInclusiveTotal,
  parseTaxPercentFromRule,
  findTaxRuleForCountry,
  fetchTaxPercentForCountry,
};
