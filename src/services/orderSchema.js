export const resolveOrderVendorId = (order = {}) => {
  return (
    order.vendorID ||
    order.vendor_id ||
    order.restaurantId ||
    order.vendor?.vendorID ||
    order.vendor?.id ||
    order.vendor?.author ||
    null
  );
};

export const resolveOrderDocId = (order = {}) => {
  return order._docId || order.orderId || order.id || null;
};

/**
 * Unit price the customer pays for one line item.
 * Surprise bags often store list price in `price` and the sale price in `offerPrice` / `discountPrice`.
 * @param {Record<string, unknown>} p
 * @returns {number}
 */
export function getOrderLineItemUnitPrice(p) {
  if (!p || typeof p !== 'object') return 0;
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
    const v = parseFloat(p[key]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  const fallback = parseFloat(p.price ?? p.bagPrice ?? 0);
  return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
}

/**
 * Total payable: sum line items (using {@link getOrderLineItemUnitPrice}) + delivery − discount + tip.
 * Falls back to stored `totalAmount` / `total` when there are no product lines.
 * @param {Record<string, unknown>} order
 * @returns {number}
 */
export function computeOrderPayableTotal(order = {}) {
  const products = Array.isArray(order.products) ? order.products : [];
  const subtotal = products.reduce((sum, p) => {
    const qty = parseInt(p.quantity || 1, 10) || 1;
    return sum + getOrderLineItemUnitPrice(p) * qty;
  }, 0);
  const deliveryCharge = parseFloat(order.deliveryCharge || 0);
  const discount = parseFloat(order.discount || 0);
  const tipAmount = parseFloat(order.tip_amount || order.tipAmount || 0);
  const computed = subtotal + deliveryCharge - discount + tipAmount;

  const rawStored = order.totalAmount ?? order.total ?? order.amountPaid;
  const stored =
    typeof rawStored === 'number' ? rawStored : parseFloat(rawStored);

  if (products.length > 0) {
    const rounded = Math.round(computed * 100) / 100;
    if (Number.isFinite(rounded) && rounded > 0) return rounded;
  }
  if (Number.isFinite(stored) && stored > 0) {
    return Math.round(stored * 100) / 100;
  }
  return Math.round(Math.max(0, computed) * 100) / 100;
}

/**
 * Display string for a pickup-related value (strings, Firestore Timestamps, Date, {seconds}).
 * @param {unknown} value
 * @returns {string}
 */
function toPickupDisplay(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const t = value.trim();
    return t;
  }
  const d = coerceFirestoreDate(value);
  if (d) {
    const nonMidnight =
      d.getHours() !== 0
      || d.getMinutes() !== 0
      || d.getSeconds() !== 0
      || d.getMilliseconds() !== 0;
    if (nonMidnight) {
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return String(value).trim();
}

/**
 * @param {Record<string, unknown>} rec
 * @returns {{ from: string, to: string, combined: string, date: string }}
 */
function extractPickupFields(rec) {
  if (!rec || typeof rec !== 'object') {
    return { from: '', to: '', combined: '', date: '' };
  }

  const firstDisplay = (keys) => {
    for (const k of keys) {
      if (rec[k] == null || rec[k] === '') continue;
      const s = toPickupDisplay(rec[k]);
      if (s) return s;
    }
    return '';
  };

  return {
    from: firstDisplay([
      'pickupTimeFrom',
      'pickup_time_from',
      'pickupWindowStart',
      'pickup_window_start',
      'pickupStart',
      'windowFrom',
      'pickupFrom',
    ]),
    to: firstDisplay([
      'pickupTimeTo',
      'pickup_time_to',
      'pickupWindowEnd',
      'pickup_window_end',
      'pickupEnd',
      'windowTo',
      'pickupTo',
    ]),
    combined: firstDisplay([
      'pickupTime',
      'pickup_time',
      'pickupSlot',
      'pickup_slot',
      'timeSlot',
      'time_slot',
      'pickupWindowLabel',
      'pickup_window_label',
      'selectedPickupLabel',
    ]),
    date: firstDisplay([
      'pickupDate',
      'pickup_date',
      'scheduledPickupDate',
      'scheduled_pickup_date',
      'pickupDay',
      'pickup_day',
    ]),
  };
}

/**
 * @param {{ from: string, to: string, combined: string, date: string }} a
 * @param {{ from: string, to: string, combined: string, date: string }} b
 */
function mergePickupHints(a, b) {
  return {
    from: a.from || b.from,
    to: a.to || b.to,
    combined: a.combined || b.combined,
    date: a.date || b.date,
  };
}

/**
 * @param {{ from: string, to: string, combined: string, date: string }} h
 * @returns {string}
 */
function composePickupLabel(h) {
  const { from, to, combined, date } = h;
  if (from && to) return `${from} – ${to}`;
  if (combined) return combined;
  if (date && (from || to)) {
    const time = from || to;
    return `${date} · ${time}`;
  }
  if (date) return date;
  if (from || to) return from || to;
  return '';
}

/**
 * @param {unknown} slot
 * @returns {string}
 */
function formatSlotObject(slot) {
  if (slot == null) return '';
  if (typeof slot === 'string') return slot.trim();
  if (typeof slot !== 'object') return '';
  const label =
    slot.label ?? slot.title ?? slot.text ?? slot.displayName ?? slot.name;
  if (label && String(label).trim()) return String(label).trim();
  const sf = toPickupDisplay(slot.from ?? slot.start ?? slot.startTime);
  const st = toPickupDisplay(slot.to ?? slot.end ?? slot.endTime);
  if (sf && st) return `${sf} – ${st}`;
  return sf || st || '';
}

/**
 * Pickup window for merchant UI (order doc or first line item).
 * Handles Firestore Timestamps, snake_case fields, and split date vs time between root vs line item.
 * @param {Record<string, unknown>} order
 * @returns {string}
 */
export function formatOrderPickupWindow(order = {}) {
  const root = extractPickupFields(order);
  const p0 = Array.isArray(order.products) && order.products[0] ? order.products[0] : null;
  const line = p0 ? extractPickupFields(p0) : { from: '', to: '', combined: '', date: '' };
  let merged = mergePickupHints(root, line);

  let out = composePickupLabel(merged);
  if (out) return out;

  if (p0) {
    if (typeof p0.pickup === 'string' && p0.pickup.trim()) return p0.pickup.trim();

    const slotCandidates = [
      p0.selectedSlot,
      p0.slot,
      p0.pickupSlot,
      Array.isArray(p0.pickupSlots) ? p0.pickupSlots[0] : null,
    ];
    for (const c of slotCandidates) {
      const s = formatSlotObject(c);
      if (s) return s;
    }
  }

  const est = order.estimatedTimeToPrepare;
  if (est != null && String(est).trim()) return String(est).trim();

  return 'Not specified';
}

/**
 * @param {unknown} value - Firestore Timestamp, Date, or ISO-ish
 * @returns {Date | null}
 */
export function coerceFirestoreDate(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  if (typeof value._seconds === 'number') {
    return new Date(value._seconds * 1000);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Best-effort completion time for earnings windows (aligns with Cloud Function ordering).
 * @param {Record<string, unknown>} order
 * @param {Date} [orderCreatedFallback]
 * @returns {Date}
 */
export function getOrderCompletionDate(order, orderCreatedFallback) {
  const created =
    orderCreatedFallback
    ?? coerceFirestoreDate(order.createdAt)
    ?? new Date();
  return (
    coerceFirestoreDate(order.completedAt)
    || coerceFirestoreDate(order.deliveredAt)
    || coerceFirestoreDate(order.otpVerifiedAt)
    || coerceFirestoreDate(order.otp_verified_at)
    || coerceFirestoreDate(order.updatedAt)
    || coerceFirestoreDate(order.completed_at)
    || coerceFirestoreDate(order.delivered_at)
    || created
  );
}

/** Aligns with CreateSurpriseBag `outletTimings` keys (lowercase). */
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Surprise bag document id from first order line (`merchant_surprise_bag` doc id).
 * @param {Record<string, unknown>} order
 * @returns {string | null}
 */
export function getSurpriseBagIdFromOrder(order) {
  const p0 = Array.isArray(order.products) && order.products[0] ? order.products[0] : null;
  if (!p0) return null;
  const id = p0.id || p0.bagId || p0.productId || p0.productID || p0.surpriseBagId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/**
 * @param {unknown} s YYYY-MM-DD or Timestamp-like
 * @returns {Date | null} local noon on that calendar day
 */
function parsePickupCalendarDay(s) {
  if (s == null || s === '') return null;
  const coerced = coerceFirestoreDate(s);
  if (coerced) {
    return new Date(coerced.getFullYear(), coerced.getMonth(), coerced.getDate(), 12, 0, 0, 0);
  }
  if (typeof s === 'string') {
    const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const d = parseInt(m[3], 10);
      const dt = new Date(y, mo, d, 12, 0, 0, 0);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  return null;
}

/**
 * @param {unknown} h "09:00" / "9:30" etc.
 * @returns {string}
 */
function formatHHMMForDisplay(h) {
  if (h == null || h === '') return '';
  const s = String(h).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  const hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const dt = new Date(2000, 0, 1, hour, min, 0, 0);
  return dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Human-readable pickup line from bag `outletTimings` for a specific calendar day.
 * `d` selects which weekday row (monday…sunday) to use; it may be omitted from the label when `includeDate` is false.
 * @param {Record<string, unknown>} outletTimings
 * @param {Date} d
 * @param {{ includeDate?: boolean }} [options]
 * @returns {string}
 */
export function formatOutletTimingsForDate(outletTimings, d, options = {}) {
  const includeDate = options.includeDate !== false;
  if (!outletTimings || typeof outletTimings !== 'object' || !d || Number.isNaN(d.getTime())) {
    return '';
  }
  const key = WEEKDAY_KEYS[d.getDay()];
  let row = outletTimings[key];
  if (!row || typeof row !== 'object') {
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    row = outletTimings[cap];
  }
  const dateLine = d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!row || typeof row !== 'object') {
    return includeDate ? `${dateLine} · —` : '—';
  }
  if (row.closed === true) {
    return includeDate ? `${dateLine} · Closed` : 'Closed';
  }
  const open = formatHHMMForDisplay(row.open);
  const close = formatHHMMForDisplay(row.close);
  if (!open && !close) return includeDate ? `${dateLine} · —` : '—';
  const range = `${open || '—'} – ${close || '—'}`;
  return includeDate ? `${dateLine} · ${range}` : range;
}

/**
 * Calendar day for pickup: explicit fields, today/tomorrow from bag slots, else order creation date.
 * @param {Record<string, unknown>} order
 * @param {Record<string, unknown>} p0
 * @param {Record<string, unknown> | null | undefined} bag
 * @returns {Date | null}
 */
export function resolveOrderPickupCalendarDate(order, p0, bag) {
  const explicit =
    coerceFirestoreDate(order.pickupDate)
    || coerceFirestoreDate(order.pickup_date)
    || coerceFirestoreDate(p0?.pickupDate)
    || coerceFirestoreDate(p0?.pickup_date);
  if (explicit) {
    return new Date(
      explicit.getFullYear(),
      explicit.getMonth(),
      explicit.getDate(),
      12,
      0,
      0,
      0
    );
  }

  const ptRaw =
    order.pickupSlotType
    || order.pickupDay
    || order.scheduledPickupDay
    || p0?.pickupSlotType
    || p0?.pickupDay
    || p0?.scheduledPickupDay;
  const pt = (ptRaw != null ? String(ptRaw) : '').toLowerCase().trim();

  const slotsRaw =
    (bag?.pickupSlots && typeof bag.pickupSlots === 'object' && !Array.isArray(bag.pickupSlots)
      ? bag.pickupSlots
      : null)
    || (p0?.pickupSlots && typeof p0.pickupSlots === 'object' && !Array.isArray(p0.pickupSlots)
      ? p0.pickupSlots
      : null);

  if (slotsRaw) {
    if (pt === 'tomorrow' || pt === 't') {
      const d = parsePickupCalendarDay(slotsRaw.tomorrowDate || slotsRaw.tomorrow);
      if (d) return d;
    }
    if (pt === 'today' || pt === '' || !pt) {
      const d = parsePickupCalendarDay(slotsRaw.todayDate || slotsRaw.today);
      if (d) return d;
    }
    const dTom = parsePickupCalendarDay(slotsRaw.tomorrowDate || slotsRaw.tomorrow);
    const dTo = parsePickupCalendarDay(slotsRaw.todayDate || slotsRaw.today);
    if (pt === 'tomorrow' && dTom) return dTom;
    if (dTo) return dTo;
    if (dTom) return dTom;
  }

  const created = coerceFirestoreDate(order.createdAt);
  if (created) {
    return new Date(created.getFullYear(), created.getMonth(), created.getDate(), 12, 0, 0, 0);
  }
  return null;
}

/**
 * Pickup label for merchant UI: order fields first, else surprise bag `outletTimings` for the pickup day.
 * @param {Record<string, unknown>} order
 * @param {Record<string, unknown> | null | undefined} bagDoc `merchant_surprise_bag` doc data (optional)
 * @returns {string}
 */
export function formatOrderPickupForMerchant(order, bagDoc) {
  const direct = formatOrderPickupWindow(order);
  if (direct !== 'Not specified') return direct;

  const p0 = Array.isArray(order.products) && order.products[0] ? order.products[0] : null;
  const outletTimings =
    (bagDoc?.outletTimings && typeof bagDoc.outletTimings === 'object' ? bagDoc.outletTimings : null)
    || (p0?.outletTimings && typeof p0.outletTimings === 'object' ? p0.outletTimings : null)
    || (p0?.bagOutletTimings && typeof p0.bagOutletTimings === 'object' ? p0.bagOutletTimings : null)
    || (order.outletTimings && typeof order.outletTimings === 'object' ? order.outletTimings : null);

  if (!outletTimings) return direct;

  const pickupDay = resolveOrderPickupCalendarDate(order, p0 || {}, bagDoc || null);
  if (!pickupDay) return direct;

  const line = formatOutletTimingsForDate(outletTimings, pickupDay, { includeDate: false });
  return line || direct;
}
