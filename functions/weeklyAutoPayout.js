/**
 * Weekly auto payout_request creation (Firestore).
 * Scheduled weekly (default: Wednesday 09:10 UTC — see functions/index.js); merchants do not trigger from the app.
 *
 * Skips merchants with any payout_requests in pending/processing (manual or auto).
 * Idempotent per week via weekRangeLabel (UTC Mon–Sun).
 */
/* eslint-env node */
/* global require, module */

const admin = require('firebase-admin');

const PAYOUT_REQUESTS = 'payout_requests';

const ORDER_COLLECTION = 'restaurant_orders';

async function fetchAdminCommissionSettings(db) {
  const snap = await db.collection('settings').doc('AdminCommission').get();
  if (!snap.exists) return { isEnabled: false };
  return snap.data() || { isEnabled: false };
}

function merchantNetFromGross(gross, settings) {
  if (typeof gross !== 'number' || !Number.isFinite(gross)) return gross;
  if (!settings || settings.isEnabled !== true) return Math.round(gross * 100) / 100;

  const type = String(settings.commissionType || '').toLowerCase();
  if (type.includes('percent')) {
    const pct = Number(settings.commissionValue);
    const p = Number.isFinite(pct) ? Math.max(0, pct) : 0;
    let commission = gross * (p / 100);
    if (commission > gross) commission = gross;
    return Math.round((gross - commission) * 100) / 100;
  }

  const fixed = Number(settings.fix_commission ?? settings.commissionValue ?? 0);
  const f = Number.isFinite(fixed) ? Math.max(0, fixed) : 0;
  return Math.round(Math.max(0, gross - f) * 100) / 100;
}

function coerceDate(value) {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getOrderCompletionDate(raw, orderCreatedAt) {
  return (
    coerceDate(raw.completedAt)
    || coerceDate(raw.deliveredAt)
    || coerceDate(raw.otpVerifiedAt)
    || coerceDate(raw.otp_verified_at)
    || coerceDate(raw.updatedAt)
    || coerceDate(raw.completed_at)
    || coerceDate(raw.delivered_at)
    || (orderCreatedAt ? new Date(orderCreatedAt) : null)
  );
}

function orderCreatedAtDate(data) {
  const c = data.createdAt;
  if (c && typeof c.toDate === 'function') return c.toDate();
  if (c && typeof c.seconds === 'number') return new Date(c.seconds * 1000);
  return new Date();
}

function isCancelledStatusString(s) {
  return (s || '').toString().toLowerCase().includes('cancel');
}

function isCompleteStatusString(s) {
  const t = (s || '').toString().trim().toLowerCase();
  if (t.includes('incomplete')) return false;
  return (
    t === 'complete'
    || t === 'completed'
    || t === 'order completed'
    || t.includes('completed')
    || t.endsWith(' complete')
  );
}

function computeOrderPayableTotal(order) {
  const products = Array.isArray(order.products) ? order.products : [];
  const unitPrice = (p) => {
    const preferKeys = [
      'offerPrice',
      'discountPrice',
      'restaurantDiscountPrice',
      'salePrice',
      'paidPrice',
      'finalPrice',
      'actualPrice',
    ];
    for (const key of preferKeys) {
      const v = parseFloat(p && p[key]);
      if (Number.isFinite(v) && v > 0) return v;
    }
    const fallback = parseFloat((p && (p.price ?? p.bagPrice)) ?? 0);
    return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
  };
  const subtotal = products.reduce((sum, p) => {
    const qty = Math.max(1, parseInt(p && p.quantity ? p.quantity : 1, 10) || 1);
    return sum + unitPrice(p) * qty;
  }, 0);
  const deliveryCharge = parseFloat(order.deliveryCharge || 0);
  const discount = parseFloat(order.discount || 0);
  const tipAmount = parseFloat(order.tip_amount || order.tipAmount || 0);
  const computed = subtotal + deliveryCharge - discount + tipAmount;
  const rounded = Math.round(Math.max(0, computed) * 100) / 100;
  return rounded;
}

function getOrderVendorCandidates(orderData = {}) {
  return [
    orderData.vendorID,
    orderData.vendor_id,
    orderData.restaurantId,
    orderData.vendor && orderData.vendor.vendorID,
    orderData.vendor && orderData.vendor.author,
    orderData.vendor && orderData.vendor.id,
    orderData.merchantId,
  ].filter(Boolean).map(String);
}

async function fetchMergedOrdersForVendorKey(db, key) {
  const ref = db.collection(ORDER_COLLECTION);
  const snaps = await Promise.all([
    ref.where('vendor.vendorID', '==', key).get(),
    ref.where('vendor.author', '==', key).get(),
    ref.where('vendor.id', '==', key).get(),
    ref.where('vendorID', '==', key).get(),
    ref.where('vendor_id', '==', key).get(),
    ref.where('merchantId', '==', key).get().catch(() => ({ docs: [] })), // optional schema
  ]);
  const byId = new Map();
  snaps.forEach((snap) => {
    (snap.docs || []).forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
  });
  return Array.from(byId.values());
}

function computeEligibleWeekPayout(orders, commissionSettings, weekStart, weekEnd, vendorKeysSet) {
  const weekStartDate = weekStart.toDate ? weekStart.toDate() : new Date(weekStart);
  const weekEndDate = weekEnd.toDate ? weekEnd.toDate() : new Date(weekEnd);
  let total = 0;
  const orderIds = [];

  orders.forEach((o) => {
    if (!o || typeof o !== 'object') return;
    const createdAt = orderCreatedAtDate(o);
    const status = o.status || '';
    if (isCancelledStatusString(status)) return;
    const complete =
      isCompleteStatusString(status)
      || o.otpVerified === true
      || ['delivered', 'completed'].includes(String(o.deliveryStatus || '').toLowerCase());
    if (!complete) return;

    const keys = getOrderVendorCandidates(o);
    const belongs = keys.some((k) => vendorKeysSet.has(String(k)));
    if (!belongs) return;

    const completedAt = getOrderCompletionDate(o, createdAt);
    if (!completedAt) return;
    if (completedAt < weekStartDate || completedAt > weekEndDate) return;

    const gross = computeOrderPayableTotal(o);
    const net = merchantNetFromGross(gross, commissionSettings);
    if (!Number.isFinite(net) || net <= 0) return;

    total += net;
    orderIds.push(String(o.id));
  });

  return {
    totalAmount: Math.round(total * 100) / 100,
    orderIds,
  };
}

function utcMondaySundayRange(now = new Date()) {
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = ref.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  ref.setUTCDate(ref.getUTCDate() + delta);
  const monday = new Date(ref);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  const label = `${monday.toISOString().slice(0, 10)}_${sunday.toISOString().slice(0, 10)}`;
  return {
    label,
    weekRangeStart: admin.firestore.Timestamp.fromDate(monday),
    weekRangeEnd: admin.firestore.Timestamp.fromDate(sunday),
  };
}

async function merchantHasOpenPayout(db, merchantId) {
  const snap = await db.collection(PAYOUT_REQUESTS).where('merchantId', '==', merchantId).get();
  for (const doc of snap.docs) {
    const s = (doc.data().status || 'pending').toString().trim().toLowerCase();
    if (s === 'pending' || s === 'processing') return true;
  }
  return false;
}

async function hasAutoForWeek(db, merchantId, weekLabel) {
  const q = await db
    .collection(PAYOUT_REQUESTS)
    .where('merchantId', '==', merchantId)
    .where('type', '==', 'auto')
    .where('weekRangeLabel', '==', weekLabel)
    .limit(1)
    .get();
  return !q.empty;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<{ created: number, skipped: number, weekLabel: string }>}
 */
async function runWeeklyAutoPayoutScan(db) {
  const { label, weekRangeStart, weekRangeEnd } = utcMondaySundayRange();
  let created = 0;
  let skipped = 0;

  const [vendorsSnap, commissionSettings] = await Promise.all([
    db.collection('vendors').get(),
    fetchAdminCommissionSettings(db),
  ]);

  for (const vDoc of vendorsSnap.docs) {
    const v = vDoc.data() || {};
    const merchantUid = v.author || v.userId || v.merchantId || null;
    // payout_requests in this app use merchant auth uid (not vendor doc id).
    const merchantId = merchantUid ? String(merchantUid) : String(vDoc.id);

    // Build a set of keys that can appear on orders for this vendor.
    const vendorKeys = new Set([String(vDoc.id), merchantId].filter(Boolean));
    // Some schemas store vendorID separately.
    if (v.vendorID) vendorKeys.add(String(v.vendorID));

    // Compute weekly eligible net earnings from completed orders in this week.
    const orders = await fetchMergedOrdersForVendorKey(db, merchantId);
    const computed = computeEligibleWeekPayout(
      orders,
      commissionSettings,
      weekRangeStart,
      weekRangeEnd,
      vendorKeys
    );
    const amount = computed.totalAmount;
    const orderIds = computed.orderIds;

    if (amount <= 0 || orderIds.length === 0) {
      skipped += 1;
      continue;
    }
    if (await merchantHasOpenPayout(db, merchantId)) {
      skipped += 1;
      continue;
    }
    if (await hasAutoForWeek(db, merchantId, label)) {
      skipped += 1;
      continue;
    }

    await db.collection(PAYOUT_REQUESTS).add({
      merchantId,
      amount,
      totalAmount: amount,
      status: 'pending',
      type: 'auto',
      weekRangeLabel: label,
      weekRangeStart,
      weekRangeEnd,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      orderIds,
    });
    created += 1;
  }

  return { created, skipped, weekLabel: label };
}

module.exports = { runWeeklyAutoPayoutScan, utcMondaySundayRange };
