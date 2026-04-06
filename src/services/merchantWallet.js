/**
 * Vendor wallet fields (hybrid payout contract).
 * Backend should maintain wallet_balance / pending_amount on vendors/{id}.
 * Production Firestore rules must block clients from tampering with these fields.
 */

import { getDocument } from '../firebase/firestore';
import {
  fetchMerchantVisiblePayoutRequests,
  getPayoutRequestAmount,
} from './payoutRequest';

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Record<string, unknown>} data - vendors/{id} document data
 * @returns {number | null} null if field absent (caller may fallback)
 */
export function getWalletBalanceFromVendorData(data) {
  if (!data || typeof data !== 'object') return null;
  const direct = num(data.wallet_balance ?? data.walletBalance);
  if (direct != null) return Math.round(direct * 100) / 100;
  const w = data.wallet;
  if (w && typeof w === 'object') {
    const nested = num(w.walletBalance ?? w.balance ?? w.wallet_balance);
    if (nested != null) return Math.round(nested * 100) / 100;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} data
 * @returns {number | null} null if absent — compute from payout requests instead
 */
export function getPendingAmountFromVendorData(data) {
  if (!data || typeof data !== 'object') return null;
  const direct = num(data.pending_amount ?? data.pendingAmount);
  if (direct != null) return Math.round(direct * 100) / 100;
  const w = data.wallet;
  if (w && typeof w === 'object') {
    const nested = num(w.pendingAmount ?? w.pending_amount);
    if (nested != null) return Math.round(nested * 100) / 100;
  }
  return null;
}

export function getLastPayoutTimestamp(data) {
  if (!data || typeof data !== 'object') return null;
  const raw =
    data.last_payout_date ??
    data.lastPayoutDate ??
    data.wallet?.lastPayoutAt ??
    data.wallet?.last_payout_date;
  return raw ?? null;
}

export function formatLastPayoutLabel(ts) {
  if (!ts) return null;
  const d =
    typeof ts.toDate === 'function'
      ? ts.toDate()
      : new Date((ts.seconds ?? ts._seconds ?? 0) * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

const PENDING_STATUSES = new Set(['pending', 'processing']);

function isPendingOrProcessingStatus(status) {
  const s = (status || 'pending').toString().trim().toLowerCase();
  return PENDING_STATUSES.has(s);
}

/**
 * Sum amounts for merchant-visible payout rows still in flight.
 * @param {Array<Record<string, unknown>>} visiblePayoutRows
 */
export function sumPendingProcessingPayoutAmount(visiblePayoutRows) {
  const sum = (visiblePayoutRows || []).reduce((acc, row) => {
    if (!isPendingOrProcessingStatus(row.status)) return acc;
    return acc + getPayoutRequestAmount(row);
  }, 0);
  return Math.round(sum * 100) / 100;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string | null} vendorId
 */
export async function loadMerchantWalletSummary(db, vendorId) {
  if (!vendorId) {
    return {
      walletBalance: null,
      pendingInPayouts: 0,
      lastPayoutRaw: null,
      lastPayoutLabel: null,
    };
  }

  const [vendorRes, visiblePayouts] = await Promise.all([
    getDocument('vendors', vendorId),
    fetchMerchantVisiblePayoutRequests(db, vendorId),
  ]);

  const vendorData = vendorRes.success && vendorRes.data ? vendorRes.data : {};
  let walletBalance = getWalletBalanceFromVendorData(vendorData);
  const vendorPending = getPendingAmountFromVendorData(vendorData);
  const computedPending = sumPendingProcessingPayoutAmount(visiblePayouts);
  const pendingInPayouts = vendorPending != null ? vendorPending : computedPending;

  const lastPayoutRaw = getLastPayoutTimestamp(vendorData);
  const lastPayoutLabel = formatLastPayoutLabel(lastPayoutRaw);

  return {
    walletBalance,
    pendingInPayouts,
    lastPayoutRaw,
    lastPayoutLabel,
    visiblePayouts,
  };
}
