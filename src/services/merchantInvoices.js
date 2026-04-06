/**
 * Firestore collection: merchant_invoices
 *
 * Required for listing: merchantId (string) — same id used for payouts (vendor / user uid).
 *
 * Typical fields:
 * - invoiceNumber, invoiceDate (Timestamp), orderId
 * - orderSnapshot (map, optional) — snapshot of restaurant_orders doc; line items derived if items omitted
 * - items (optional) — [{ description, quantity, unitPrice, lineTotal }]
 * - subtotal, vatRate, vatAmount, grandTotal, currency | currencyCode (default INR)
 * - Tax % for display/sync from Firestore `tax` collection (by country), see taxSettings.js
 * - paymentMethodLabel, paymentAmount
 * - customer (map) or customerLines (string[])
 * - store, seller — { name, lines: string[] } or storeName + storeAddress
 * - issuerDisclaimer, brandTitle, status
 */
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  computeOrderPayableTotal,
  getOrderLineItemUnitPrice,
} from './orderSchema';
import { isOrderTerminalComplete } from './payoutRequest';
import {
  formatTaxRateLine,
  parseStoredTaxLabel,
  taxLabelFromCountryAndCurrency,
} from '../utils/taxLabel';
import {
  applyTaxRuleToInvoiceViewModel,
  fetchTaxRules,
  findTaxRuleForCountry,
  parseTaxPercentFromRule,
  vatSplitFromInclusiveTotal,
} from './taxSettings';

export const MERCHANT_INVOICES_COLLECTION = 'merchant_invoices';

/**
 * @param {unknown} ts
 * @returns {Date | null}
 */
function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date | null} d
 * @returns {string}
 */
function formatInvoiceDate(d) {
  if (!d) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Line item for {@link import('../components/Invoice/InvoiceDocument.jsx').default}
 * @typedef {{ description: string, quantity: number, unitPrice: number, lineTotal: number }} InvoiceLineItem
 */

/**
 * @param {Record<string, unknown>} order
 * @returns {InvoiceLineItem[]}
 */
export function lineItemsFromOrderSnapshot(order) {
  const products = Array.isArray(order.products) ? order.products : [];
  if (products.length === 0) {
    const total = computeOrderPayableTotal(order);
    if (total > 0) {
      return [
        {
          description: order.bagTitle || order.bagName || 'Order',
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
    return {
      description:
        [p.name, p.title].filter(Boolean).join(' — ') || 'Item',
      quantity: qty,
      unitPrice: unit,
      lineTotal,
    };
  });
}

/**
 * Map Firestore `merchant_invoices` doc + id to InvoiceDocument props.
 * Supports rich docs or minimal `{ merchantId, orderSnapshot, invoiceNumber, invoiceDate }`.
 *
 * @param {string} docId
 * @param {Record<string, unknown>} data
 */
export function firestoreInvoiceToViewModel(docId, data) {
  const order =
    data.orderSnapshot && typeof data.orderSnapshot === 'object'
      ? /** @type {Record<string, unknown>} */ (data.orderSnapshot)
      : null;

  const currencyCode =
    (typeof data.currency === 'string' && data.currency) ||
    (typeof data.currencyCode === 'string' && data.currencyCode) ||
    'INR';

  let items = Array.isArray(data.items) ? data.items : null;
  if (!items || items.length === 0) {
    items = order ? lineItemsFromOrderSnapshot(order) : [];
  }
  items = items.map((row) => {
    const r = /** @type {Record<string, unknown>} */ (row);
    const qty = Number(r.quantity) || 0;
    const unit =
      Number(r.unitPrice ?? r.price ?? 0) ||
      Number(r.unit_price ?? 0);
    const lineTotal =
      Number(r.lineTotal ?? r.total ?? r.line_total) ||
      Math.round(unit * qty * 100) / 100;
    return {
      description: String(r.description ?? r.name ?? r.title ?? 'Item'),
      quantity: qty || 1,
      unitPrice: unit,
      lineTotal: lineTotal || unit * (qty || 1),
    };
  });

  const subtotalFromLines = items.reduce((s, it) => s + it.lineTotal, 0);
  const grandTotalRaw =
    Number(data.grandTotal ?? data.total ?? data.amount);
  const grandTotal =
    Number.isFinite(grandTotalRaw) && grandTotalRaw > 0
      ? grandTotalRaw
      : order
        ? computeOrderPayableTotal(order)
        : subtotalFromLines;
  const vatRate =
    data.vatRate != null ? Number(data.vatRate) : data.taxRate != null ? Number(data.taxRate) : 0;
  const explicitVat = data.vatAmount ?? data.tax ?? data.vat;
  const vatAmount =
    explicitVat != null && explicitVat !== ''
      ? Number(explicitVat)
      : vatRate > 0
        ? Math.round((grandTotal * vatRate) / (100 + vatRate) * 100) / 100
        : 0;
  const subtotal =
    data.subtotal != null && data.subtotal !== '' && Number.isFinite(Number(data.subtotal))
      ? Number(data.subtotal)
      : Math.max(0, grandTotal - vatAmount);

  const invoiceDate = toDate(data.invoiceDate ?? data.date ?? data.createdAt);
  const orderId =
    String(data.orderId ?? data.orderID ?? order?.id ?? order?.orderId ?? docId);

  const customer = data.customer && typeof data.customer === 'object'
    ? /** @type {Record<string, unknown>} */ (data.customer)
    : {};
  const first = customer.firstName ?? customer.first_name;
  const last = customer.lastName ?? customer.last_name;
  let customerName = [first, last].filter(Boolean).join(' ').trim()
    || String(customer.name ?? customer.displayName ?? '');
  let customerEmail = String(customer.email ?? '');
  let customerLines = parseLines(data.customerLines);

  if (!customerName && order?.author && typeof order.author === 'object') {
    const a = /** @type {Record<string, unknown>} */ (order.author);
    const fn = a.firstName ?? a.first_name;
    const ln = a.lastName ?? a.last_name;
    const composed = [fn, ln].filter(Boolean).join(' ').trim();
    if (composed) customerName = composed;
    if (!customerEmail) customerEmail = String(a.email ?? '');
    if (!customerLines.length && a.phoneNumber) {
      customerLines = [String(a.phoneNumber)];
    }
  }

  const storeBlock = normalizeAddressBlock(data.store, {
    name: data.storeName ?? data.outletName,
    lines: parseLines(data.storeAddress ?? data.storeLines),
  });
  const sellerBlock = normalizeAddressBlock(data.seller, {
    name: data.sellerName ?? data.platformSellerName ?? 'bestby bites',
    lines: parseLines(data.sellerLines ?? data.sellerAddress),
  });

  if (!storeBlock.lines.length && order?.vendor && typeof order.vendor === 'object') {
    const v = /** @type {Record<string, unknown>} */ (order.vendor);
    const title = v.title ?? v.storeName ?? v.name;
    const loc = v.location;
    const extra =
      typeof loc === 'string'
        ? [loc]
        : loc && typeof loc === 'object'
          ? [String(loc.address || ''), String(loc.city || '')].filter(Boolean)
          : [];
    storeBlock.name = String(title || storeBlock.name || 'Store');
    storeBlock.lines = extra.length ? extra : storeBlock.lines;
  }

  const paymentLabel =
    String(
      data.paymentMethodLabel ??
        data.paymentMethod ??
        data.payment_method ??
        'Paid'
    );
  const issuerDisclaimer =
    typeof data.issuerDisclaimer === 'string'
      ? data.issuerDisclaimer
      : undefined;

  const countryForTax = pickCountryForInvoice(data, order);
  const storedTax = parseStoredTaxLabel(
    typeof data.taxLabel === 'string' ? data.taxLabel : ''
  );
  const taxLabel =
    storedTax ||
    taxLabelFromCountryAndCurrency(countryForTax, currencyCode);

  return {
    id: docId,
    invoiceNumber: String(
      data.invoiceNumber ?? data.invoiceNo ?? `INV-${docId.slice(0, 10)}`
    ),
    invoiceDateLabel: formatInvoiceDate(invoiceDate),
    orderId,
    currencyCode,
    customerName,
    customerEmail,
    customerLines,
    items,
    subtotal,
    vatRate,
    vatAmount,
    taxLabel,
    taxRateLine: formatTaxRateLine(taxLabel, vatRate),
    country: countryForTax || undefined,
    grandTotal,
    paymentMethodLabel: paymentLabel,
    paymentAmount: Number(data.paymentAmount) || grandTotal,
    issuerDisclaimer,
    store: storeBlock,
    seller: sellerBlock,
    brandTitle: String(data.brandTitle ?? data.platformName ?? 'bestby bites'),
    brandSubtitle: String(data.brandSubtitle ?? 'MERCHANT'),
    status: String(data.status ?? 'PAID'),
  };
}

/**
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown> | null} order
 */
function pickCountryForInvoice(data, order) {
  const fromDoc =
    (typeof data.country === 'string' && data.country.trim()) ||
    (typeof data.invoiceCountry === 'string' && data.invoiceCountry.trim()) ||
    (typeof data.storeCountry === 'string' && data.storeCountry.trim()) ||
    '';
  if (fromDoc) return fromDoc;
  if (order?.vendor && typeof order.vendor === 'object') {
    const v = /** @type {Record<string, unknown>} */ (order.vendor);
    const c = v.country ?? v.countryName ?? v.country_name ?? v.countryCode ?? v.country_code;
    if (c) return String(c).trim();
  }
  if (order?.address && typeof order.address === 'object') {
    const a = /** @type {Record<string, unknown>} */ (order.address);
    const c = a.country ?? a.countryCode ?? a.country_code;
    if (c) return String(c).trim();
  }
  return '';
}

/**
 * @param {unknown} v
 * @returns {string[]}
 */
function parseLines(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string') return v.split(/\n/).map((s) => s.trim()).filter(Boolean);
  return [];
}

/**
 * @param {unknown} raw
 * @param {{ name?: string, lines?: string[] }} fallback
 */
function normalizeAddressBlock(raw, fallback) {
  if (raw && typeof raw === 'object') {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const name = String(o.name ?? o.title ?? fallback.name ?? '');
    const lines =
      Array.isArray(o.lines) ? o.lines.map(String).filter(Boolean) : parseLines(o.address ?? o.addressLines);
    return { name: name || fallback.name || '', lines: lines.length ? lines : fallback.lines || [] };
  }
  return {
    name: String(fallback.name ?? ''),
    lines: fallback.lines || [],
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} merchantId
 */
/**
 * Same doc id as Cloud Function (`functions/invoiceFromOrder.js`).
 * @param {string} orderId
 */
export function merchantInvoiceDocId(orderId) {
  return `inv_${String(orderId).replace(/\//g, '_')}`;
}

/**
 * Completed (or OTP-verified) orders with a positive payable total — same bar as automatic invoices.
 * @param {Record<string, unknown>} order
 */
export function orderQualifiesForMerchantInvoice(order) {
  if (!order?.id) return false;
  const st = (order.status || '').toString().toLowerCase();
  if (st.includes('cancel')) return false;
  const total = computeOrderPayableTotal(order);
  if (!Number.isFinite(total) || total <= 0) return false;
  return isOrderTerminalComplete(order);
}

function pickOrderTimestamp(order, keys) {
  for (const key of keys) {
    const v = order[key];
    if (v && typeof v.toDate === 'function') return v;
    if (v && typeof v.seconds === 'number') {
      return new Timestamp(v.seconds, v.nanoseconds || 0);
    }
  }
  return null;
}

function storeBlockFromOrderClient(order) {
  const v = order.vendor && typeof order.vendor === 'object' ? order.vendor : {};
  const name = String(v.title || v.storeName || v.name || 'Store');
  const lines = [];
  if (typeof v.location === 'string' && v.location) lines.push(v.location);
  if (v.address && typeof v.address === 'string') lines.push(v.address);
  return { name, lines };
}

/** @param {Record<string, unknown>} order */
function countryFromOrderClient(order) {
  const v = order.vendor && typeof order.vendor === 'object' ? order.vendor : {};
  const c =
    v.country ?? v.countryName ?? v.country_name ?? v.countryCode ?? v.country_code;
  if (c) return String(c).trim();
  const a = order.address && typeof order.address === 'object' ? order.address : null;
  if (a) {
    const ac = /** @type {Record<string, unknown>} */ (a).country
      ?? /** @type {Record<string, unknown>} */ (a).countryCode
      ?? /** @type {Record<string, unknown>} */ (a).country_code;
    if (ac) return String(ac).trim();
  }
  return '';
}

function customerFromOrderClient(order) {
  const a = order.author && typeof order.author === 'object' ? order.author : {};
  return {
    firstName: a.firstName || a.first_name || '',
    lastName: a.lastName || a.last_name || '',
    email: a.email || '',
    phoneNumber: a.phoneNumber || a.phone || '',
  };
}

/**
 * Payload written to `merchant_invoices` (aligned with Cloud Function).
 * @param {Record<string, unknown>} order
 * @param {string} merchantId
 * @param {{ setCreatedAt?: boolean, fallbackCurrencyCode?: string, taxPercent?: number }} [options]
 */
export function buildMerchantInvoiceWritePayload(order, merchantId, options = {}) {
  const { setCreatedAt = false, fallbackCurrencyCode, taxPercent } = options;
  const id = String(order.id);
  const total = computeOrderPayableTotal(order);
  const items = lineItemsFromOrderSnapshot(order);
  const subtotalFromLines = items.reduce((s, it) => s + it.lineTotal, 0);
  let subtotal =
    Number.isFinite(subtotalFromLines) && subtotalFromLines > 0 ? subtotalFromLines : total;
  const currencyCode = String(
    order.currency || order.currencyCode || fallbackCurrencyCode || 'INR'
  );
  const taxPct = taxPercent != null ? Number(taxPercent) : 0;
  let vatRate = 0;
  let vatAmount = 0;
  if (Number.isFinite(taxPct) && taxPct > 0) {
    const split = vatSplitFromInclusiveTotal(total, taxPct);
    vatAmount = split.vatAmount;
    subtotal = split.subtotalExclTax;
    vatRate = taxPct;
  }
  const paymentLabel = String(
    order.paymentMethod || order.payment_method || order.paymentType || 'Paid'
  );
  const invoiceDate =
    pickOrderTimestamp(order, [
      'completedAt',
      'deliveredAt',
      'otpVerifiedAt',
      'createdAt',
    ]) || serverTimestamp();

  const country = countryFromOrderClient(order);

  /** @type {Record<string, unknown>} */
  const payload = {
    merchantId,
    invoiceNumber: `INV-${id}`,
    invoiceDate,
    orderId: id,
    orderSnapshot: order,
    items,
    subtotal,
    vatRate,
    vatAmount,
    grandTotal: total,
    currencyCode,
    paymentMethodLabel: paymentLabel,
    paymentAmount: total,
    customer: customerFromOrderClient(order),
    store: storeBlockFromOrderClient(order),
    seller: { name: 'bestby bites', lines: [] },
    brandTitle: 'bestby bites',
    brandSubtitle: 'MERCHANT',
    status: 'PAID',
    updatedAt: serverTimestamp(),
  };
  if (country) {
    payload.country = country;
  }
  if (setCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

/**
 * Creates missing `merchant_invoices` docs for qualifying orders (client-side backfill).
 * Safe to call repeatedly; only writes docs that do not exist yet.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} merchantId
 * @param {Record<string, unknown>[]} orders — e.g. ordersForMerchant
 * @param {{ fallbackCurrencyCode?: string }} [syncOptions]
 * @returns {Promise<{ created: number }>}
 */
export async function syncMissingMerchantInvoices(db, merchantId, orders, syncOptions = {}) {
  if (!merchantId || !Array.isArray(orders) || orders.length === 0) {
    return { created: 0 };
  }

  const existingSnap = await getDocs(
    query(collection(db, MERCHANT_INVOICES_COLLECTION), where('merchantId', '==', merchantId))
  );
  const existingDocIds = new Set(existingSnap.docs.map((d) => d.id));

  const toCreate = orders.filter(
    (o) => orderQualifiesForMerchantInvoice(o) && !existingDocIds.has(merchantInvoiceDocId(o.id))
  );

  if (toCreate.length === 0) return { created: 0 };

  let taxRules = [];
  try {
    taxRules = await fetchTaxRules(db);
  } catch (e) {
    console.warn('syncMissingMerchantInvoices: could not load tax collection', e);
  }

  let created = 0;
  const chunkSize = 400;
  for (let i = 0; i < toCreate.length; i += chunkSize) {
    const chunk = toCreate.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const o of chunk) {
      const ref = doc(db, MERCHANT_INVOICES_COLLECTION, merchantInvoiceDocId(o.id));
      const country = countryFromOrderClient(o);
      const currencyCode = String(
        o.currency || o.currencyCode || syncOptions.fallbackCurrencyCode || 'INR'
      );
      const rule = findTaxRuleForCountry(taxRules, country, currencyCode);
      const taxPct = parseTaxPercentFromRule(rule);
      batch.set(
        ref,
        buildMerchantInvoiceWritePayload(o, merchantId, {
          setCreatedAt: true,
          fallbackCurrencyCode: syncOptions.fallbackCurrencyCode,
          taxPercent: taxPct,
        }),
        {
          merge: true,
        }
      );
      created += 1;
    }
    await batch.commit();
  }

  return { created };
}

export async function fetchMerchantInvoices(db, merchantId) {
  if (!merchantId) return [];
  const q = query(
    collection(db, MERCHANT_INVOICES_COLLECTION),
    where('merchantId', '==', merchantId)
  );
  const [taxRules, snap] = await Promise.all([
    fetchTaxRules(db).catch((e) => {
      console.warn('fetchMerchantInvoices: could not load tax collection', e);
      return [];
    }),
    getDocs(q),
  ]);
  const byId = new Map(snap.docs.map((d) => [d.id, d.data()]));
  const rows = snap.docs.map((d) => {
    let vm = firestoreInvoiceToViewModel(d.id, d.data());
    const rule = findTaxRuleForCountry(
      taxRules,
      typeof vm.country === 'string' ? vm.country : '',
      vm.currencyCode
    );
    if (rule) {
      vm = applyTaxRuleToInvoiceViewModel(vm, rule);
    }
    return vm;
  });
  rows.sort((a, b) => {
    const da = toDate(byId.get(a.id)?.invoiceDate ?? byId.get(a.id)?.createdAt);
    const db_ = toDate(byId.get(b.id)?.invoiceDate ?? byId.get(b.id)?.createdAt);
    return (db_?.getTime() ?? 0) - (da?.getTime() ?? 0);
  });
  return rows;
}
