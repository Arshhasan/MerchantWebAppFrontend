import { getDocument } from '../firebase/firestore';

/**
 * Merchant share after platform commission (matches Cloud Functions dashboard stats).
 * @param {number} gross
 * @param {Record<string, unknown> | null | undefined} settings - settings/AdminCommission fields
 * @returns {number}
 */
export function merchantNetFromGross(gross, settings) {
  if (typeof gross !== 'number' || !Number.isFinite(gross)) return gross;
  if (!settings || settings.isEnabled !== true) {
    return Math.round(gross * 100) / 100;
  }

  const type = String(settings.commissionType || '').toLowerCase();
  let net;

  if (type.includes('percent')) {
    const pct = Number(settings.commissionValue);
    const p = Number.isFinite(pct) ? Math.max(0, pct) : 0;
    let commission = gross * (p / 100);
    if (commission > gross) commission = gross;
    net = gross - commission;
  } else {
    const fixed = Number(settings.fix_commission ?? settings.commissionValue ?? 0);
    const f = Number.isFinite(fixed) ? Math.max(0, fixed) : 0;
    net = Math.max(0, gross - f);
  }

  return Math.round(net * 100) / 100;
}

/**
 * Loads Firestore settings/AdminCommission. On failure returns null (treat as commission off).
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getAdminCommissionSettings() {
  const res = await getDocument('settings', 'AdminCommission');
  if (!res.success) {
    console.warn('[adminCommission] Failed to load AdminCommission:', res.error);
    return null;
  }
  return res.data || null;
}
