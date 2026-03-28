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
 * Pickup window for merchant UI (order doc or first line item).
 * @param {Record<string, unknown>} order
 * @returns {string}
 */
export function formatOrderPickupWindow(order = {}) {
  const from = order.pickupTimeFrom || order.pickup_time_from || '';
  const to = order.pickupTimeTo || order.pickup_time_to || '';
  const combined = order.pickupTime || order.pickup_time;

  if (from && to) return `${from} - ${to}`;
  if (combined && String(combined).trim()) return String(combined).trim();

  const p0 = Array.isArray(order.products) && order.products[0] ? order.products[0] : null;
  if (p0) {
    const pf = p0.pickupTimeFrom || p0.pickup_time_from || '';
    const pt = p0.pickupTimeTo || p0.pickup_time_to || '';
    if (pf && pt) return `${pf} - ${pt}`;
    const pc = p0.pickupTime || p0.pickup_time;
    if (pc && String(pc).trim()) return String(pc).trim();
  }

  const date = order.pickupDate || (p0 && p0.pickupDate);
  if (date && from) return `${date} ${from}${to ? ` - ${to}` : ''}`;

  const est = order.estimatedTimeToPrepare;
  if (est && String(est).trim()) return String(est).trim();

  return 'Not specified';
}
