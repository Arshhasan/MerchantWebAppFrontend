'use strict';

const admin = require('firebase-admin');
const { fetchTaxPercentForCountry, vatSplitFromInclusiveTotal } = require('./taxFromFirestore');

function getOrderLineItemUnitPrice(p) {
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

function lineItemsFromOrderSnapshot(order) {
  const products = Array.isArray(order.products) ? order.products : [];
  if (products.length === 0) {
    const total = computeOrderPayableTotal(order);
    if (total > 0) {
      return [
        {
          description: String(order.bagTitle || order.bagName || 'Order'),
          quantity: 1,
          unitPrice: total,
          lineTotal: total,
        },
      ];
    }
    return [];
  }
  return products.map((p) => {
    const qty = parseInt(p.quantity || 1, 10) || 1;
    const unit = getOrderLineItemUnitPrice(p);
    const lineTotal = Math.round(unit * qty * 100) / 100;
    const desc = [p.name, p.title].filter(Boolean).join(' — ') || 'Item';
    return { description: desc, quantity: qty, unitPrice: unit, lineTotal };
  });
}

function computeOrderPayableTotal(order) {
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
  const stored = typeof rawStored === 'number' ? rawStored : parseFloat(rawStored);
  if (products.length > 0) {
    const rounded = Math.round(computed * 100) / 100;
    if (Number.isFinite(rounded) && rounded > 0) return rounded;
  }
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored * 100) / 100;
  return Math.round(Math.max(0, computed) * 100) / 100;
}

function isCancelledStatusString(s) {
  return (s || '').toString().toLowerCase().includes('cancel');
}

function isCompleteStatusString(s) {
  const t = (s || '').toString().toLowerCase();
  if (t.includes('incomplete')) return false;
  return (
    t === 'complete'
    || t === 'completed'
    || t === 'order completed'
    || t.includes('completed')
    || (t.includes('complete') && !t.includes('incomplete'))
  );
}

function shouldGenerateMerchantInvoice(data) {
  if (!data || typeof data !== 'object') return false;
  if (isCancelledStatusString(data.status)) return false;
  const total = computeOrderPayableTotal(data);
  if (!(Number.isFinite(total) && total > 0)) return false;
  const st = (data.status || '').toString().trim().toLowerCase();
  if (isCompleteStatusString(st)) return true;
  if (data.otpVerified === true) return true;
  const ds = (data.deliveryStatus || '').toString().toLowerCase();
  if (ds === 'delivered' || ds === 'completed') return true;
  if (st.includes('delivered')) return true;
  if (st.includes('picked') && st.includes('up')) return true;
  return false;
}

function resolveInvoiceMerchantId(data) {
  const v = data.vendor || {};
  return String(
    v.vendorID ||
      v.id ||
      v.author ||
      data.vendorID ||
      data.vendor_id ||
      data.restaurantId ||
      ''
  );
}

function invoiceDocId(orderId) {
  return `inv_${String(orderId).replace(/\//g, '_')}`;
}

function invoiceDateFromOrder(data) {
  return (
    data.completedAt ||
    data.deliveredAt ||
    data.otpVerifiedAt ||
    data.createdAt ||
    admin.firestore.Timestamp.now()
  );
}

function storeBlockFromOrder(data) {
  const v = data.vendor || {};
  const name = String(v.title || v.storeName || v.name || 'Store');
  const lines = [];
  if (typeof v.location === 'string' && v.location) lines.push(v.location);
  if (v.address && typeof v.address === 'string') lines.push(v.address);
  return { name, lines };
}

function countryFromOrder(data) {
  const v = data.vendor || {};
  const c =
    v.country ||
    v.countryName ||
    v.country_name ||
    v.countryCode ||
    v.country_code;
  if (c) return String(c).trim();
  const a = data.address;
  if (a && typeof a === 'object') {
    const ac = a.country || a.countryCode || a.country_code;
    if (ac) return String(ac).trim();
  }
  return '';
}

function customerFromOrder(data) {
  const a = data.author || {};
  return {
    firstName: a.firstName || a.first_name || '',
    lastName: a.lastName || a.last_name || '',
    email: a.email || '',
    phoneNumber: a.phoneNumber || a.phone || '',
  };
}

/**
 * @param {string} orderId
 * @param {Record<string, unknown>} data
 * @param {string} merchantId
 * @param {number} [taxPercent]
 */
function buildMerchantInvoicePayload(orderId, data, merchantId, taxPercent = 0) {
  const total = computeOrderPayableTotal(data);
  const items = lineItemsFromOrderSnapshot(data);
  const subtotalFromLines = items.reduce((s, it) => s + it.lineTotal, 0);
  let subtotal = Number.isFinite(subtotalFromLines) && subtotalFromLines > 0 ? subtotalFromLines : total;
  const currencyCode = String(data.currency || data.currencyCode || 'INR');
  const paymentLabel = String(
    data.paymentMethod || data.payment_method || data.paymentType || 'Paid'
  );

  const country = countryFromOrder(data);

  const pct = Number(taxPercent) || 0;
  let vatRate = 0;
  let vatAmount = 0;
  if (pct > 0) {
    const split = vatSplitFromInclusiveTotal(total, pct);
    vatAmount = split.vatAmount;
    subtotal = split.subtotalExclTax;
    vatRate = pct;
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    merchantId,
    invoiceNumber: `INV-${orderId}`,
    invoiceDate: invoiceDateFromOrder(data),
    orderId,
    orderSnapshot: data,
    items,
    subtotal,
    vatRate,
    vatAmount,
    grandTotal: total,
    currencyCode,
    paymentMethodLabel: paymentLabel,
    paymentAmount: total,
    customer: customerFromOrder(data),
    store: storeBlockFromOrder(data),
    seller: { name: 'bestby bites', lines: [] },
    brandTitle: 'bestby bites',
    brandSubtitle: 'MERCHANT',
    status: 'PAID',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (country) {
    payload.country = country;
  }
  return payload;
}

/**
 * Create or update merchant_invoices/{inv_orderId} from order document.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} orderId
 * @param {Record<string, unknown>} data
 * @returns {Promise<boolean>} true if a write was performed
 */
async function writeMerchantInvoice(db, orderId, data) {
  if (!shouldGenerateMerchantInvoice(data)) {
    return false;
  }
  const merchantId = resolveInvoiceMerchantId(data);
  if (!merchantId) {
    console.warn('[writeMerchantInvoice] missing merchantId for order', orderId);
    return false;
  }
  const ref = db.collection('merchant_invoices').doc(invoiceDocId(orderId));
  const snap = await ref.get();
  const country = countryFromOrder(data);
  const currencyCode = String(data.currency || data.currencyCode || 'INR');
  let taxPercent = 0;
  try {
    taxPercent = await fetchTaxPercentForCountry(db, country, currencyCode);
  } catch (e) {
    console.warn('[writeMerchantInvoice] tax collection read failed', e?.message || e);
  }
  const payload = buildMerchantInvoicePayload(orderId, data, merchantId, taxPercent);
  if (!snap.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await ref.set(payload, { merge: true });
  return true;
}

module.exports = {
  shouldGenerateMerchantInvoice,
  resolveInvoiceMerchantId,
  invoiceDocId,
  buildMerchantInvoicePayload,
  computeOrderPayableTotal,
  lineItemsFromOrderSnapshot,
  writeMerchantInvoice,
};
