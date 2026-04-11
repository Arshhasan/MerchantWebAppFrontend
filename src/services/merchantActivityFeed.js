/**
 * Builds a unified merchant activity list (orders, bags, payouts) for the last rolling 24 hours.
 */
import { computeOrderPayableTotal } from './orderSchema';
import { getPayoutRequestAmount, isMerchantVisiblePayoutRequest } from './payoutRequest';
import { formatMerchantCurrency } from '../utils/merchantCurrencyFormat';

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * @param {unknown} ts Firestore Timestamp | Date | { seconds?: number } | undefined
 * @returns {number}
 */
export function timestampToMillis(ts) {
  if (ts == null) return 0;
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  }
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (typeof ts === 'object' && typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
  }
  return 0;
}

/**
 * @param {number} ms
 * @param {number} nowMs
 */
function formatActivityWhen(ms, nowMs) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.round((nowMs - ms) / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function effectiveBagActivityMillis(bag) {
  return Math.max(timestampToMillis(bag.createdAt), timestampToMillis(bag.updatedAt));
}

function humanizeOrderStatus(raw) {
  const s = (raw || '').toString().trim();
  if (!s) return 'New';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function payoutTitleForStatus(statusRaw) {
  const s = (statusRaw || 'pending').toString().trim().toLowerCase();
  if (s === 'completed' || s === 'complete' || s === 'paid' || s === 'success' || s === 'processed') {
    return 'Payout received';
  }
  if (s === 'failed' || s === 'rejected' || s === 'cancelled' || s === 'canceled') {
    return 'Payout update';
  }
  return 'Payout request';
}

/**
 * @param {{
 *   orders: Array<Record<string, unknown> & { id?: string }>;
 *   draftBags: Array<Record<string, unknown> & { id: string }>;
 *   publishedBags: Array<Record<string, unknown> & { id: string }>;
 *   payouts: Array<Record<string, unknown> & { id: string }>;
 *   now: number;
 * }} input
 * @param {Record<string, unknown> | null | undefined} vendorProfile
 */
export function buildMerchantActivityItems(input, vendorProfile) {
  const { orders, draftBags, publishedBags, payouts, now } = input;
  const nowMs = typeof now === 'number' ? now : Date.now();
  const cutoff = nowMs - TWENTY_FOUR_HOURS_MS;

  /** @type {Array<Record<string, unknown>>} */
  const out = [];

  (orders || []).forEach((order) => {
    const orderId = order.orderId || order.id;
    if (!orderId) return;
    const ms = timestampToMillis(order.createdAt);
    if (ms < cutoff) return;
    const total = computeOrderPayableTotal(order);
    const st = humanizeOrderStatus(order.status);
    const when = formatActivityWhen(ms, nowMs);
    out.push({
      id: `order-${orderId}`,
      title: 'New order',
      body: `${formatMerchantCurrency(total, vendorProfile)} · ${st}`,
      timeLabel: when,
      actionLabel: 'View orders',
      actionHref: '/orders',
      read: true,
      accent: 'green',
      sortTime: ms,
    });
  });

  (draftBags || []).forEach((bag) => {
    const ms = effectiveBagActivityMillis(bag);
    if (ms < cutoff) return;
    const title = (bag.bagTitle || 'Untitled bag').toString();
    const when = formatActivityWhen(ms, nowMs);
    out.push({
      id: `bag-draft-${bag.id}`,
      title: 'Draft bag saved',
      body: title,
      timeLabel: when,
      actionLabel: 'Bags',
      actionHref: '/bags',
      read: true,
      accent: 'blue',
      sortTime: ms,
    });
  });

  (publishedBags || []).forEach((bag) => {
    const ms = effectiveBagActivityMillis(bag);
    if (ms < cutoff) return;
    const name = (bag.bagTitle || 'Surprise bag').toString();
    const price = Number(bag.bagPrice) || 0;
    const when = formatActivityWhen(ms, nowMs);
    out.push({
      id: `bag-published-${bag.id}`,
      title: 'Surprise bag published',
      body: `${name} · ${formatMerchantCurrency(price, vendorProfile)}`,
      timeLabel: when,
      actionLabel: 'Bags',
      actionHref: '/bags',
      read: true,
      accent: 'teal',
      sortTime: ms,
    });
  });

  (payouts || []).forEach((row) => {
    if (!isMerchantVisiblePayoutRequest(row)) return;
    const ms = timestampToMillis(row.createdAt);
    if (ms < cutoff) return;
    const amount = getPayoutRequestAmount(row);
    const status = (row.status || 'pending').toString();
    const title = payoutTitleForStatus(status);
    const when = formatActivityWhen(ms, nowMs);
    out.push({
      id: `payout-${row.id}`,
      title,
      body: `${formatMerchantCurrency(amount, vendorProfile)} · ${status}`,
      timeLabel: when,
      actionLabel: 'Wallet',
      actionHref: '/payout',
      read: true,
      accent: 'amber',
      sortTime: ms,
    });
  });

  out.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
  return out;
}
