/**
 * Shared: resolve customer + merchant emails for order transactional mail.
 */
/* eslint-env node */
/* global module, require */

const invoiceFromOrder = require('./invoiceFromOrder');

function isValidEmail(email) {
  if (email == null || typeof email !== 'string') return false;
  const t = email.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {Record<string, unknown>} orderData
 * @returns {Promise<string>}
 */
async function resolveCustomerEmail(db, orderData) {
  const a = orderData.author || {};
  let email = String(a.email || '').trim();
  if (!isValidEmail(email)) {
    const direct =
      orderData.customerEmail ||
      orderData.customer_email ||
      (orderData.customer && orderData.customer.email);
    if (direct) email = String(direct).trim();
  }
  if (!isValidEmail(email) && orderData.userId) {
    const u = await db.collection('users').doc(String(orderData.userId)).get();
    if (u.exists) {
      const ud = u.data() || {};
      const e = String(ud.email || '').trim();
      if (isValidEmail(e)) return e;
    }
  }
  return isValidEmail(email) ? email : '';
}

/**
 * @param {Record<string, unknown>} orderData
 * @returns {string}
 */
function customerDisplayName(orderData) {
  const a = orderData.author || {};
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();
  return name || String(a.email || orderData.customerEmail || '').trim() || 'Customer';
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {Record<string, unknown>} orderData
 * @param {string} merchantUid
 * @returns {Promise<string>}
 */
async function resolveMerchantEmail(db, orderData, merchantUid) {
  let merchantEmail = '';
  const uid =
    merchantUid != null && String(merchantUid).trim() ? String(merchantUid).trim() : '';
  if (uid) {
    try {
      const u = await db.collection('users').doc(uid).get();
      if (u.exists) {
        const ud = u.data() || {};
        merchantEmail = String(ud.email || ud.userEmail || '').trim();
      }
    } catch {
      // ignore
    }
  }
  const merchantId = invoiceFromOrder.resolveInvoiceMerchantId(orderData);
  if (!isValidEmail(merchantEmail) && merchantId) {
    try {
      const v = await db.collection('vendors').doc(String(merchantId)).get();
      if (v.exists) {
        const vd = v.data() || {};
        merchantEmail = String(vd.email || '').trim();
      }
    } catch {
      // ignore
    }
  }
  return isValidEmail(merchantEmail) ? merchantEmail : '';
}

module.exports = {
  isValidEmail,
  resolveCustomerEmail,
  resolveMerchantEmail,
  customerDisplayName,
};
