import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { computeOrderPayableTotal } from './orderSchema';

const ORDERS_COLLECTION = 'restaurant_orders';
const PAYOUT_REQUESTS_COLLECTION = 'payout_requests';
const PAYMENT_REQUEST_COLLECTION = 'payment_request';

function getRawOrderStatus(order = {}) {
  const v =
    order.status ??
    order.orderStatus ??
    order.order_status ??
    order.state ??
    '';
  return (v == null ? '' : String(v)).trim();
}

function payoutAlreadyRequested(order) {
  return order.payoutRequested === true || order.payout_requested === true;
}

function hasPayoutLink(order) {
  return !!(order.payoutId || order.payout_id);
}

/**
 * Order is in a final success state (completed / delivered), not cancelled.
 * Matches merchant-facing "done" states including OTP-verified pickup (status may still be "accepted").
 */
export function isOrderTerminalComplete(order) {
  const st = getRawOrderStatus(order).toLowerCase();
  if (st.includes('cancel')) return false;
  if (st.includes('incomplete')) return false;

  if (
    order.orderCompleted === true ||
    order.isOrderCompleted === true ||
    order.is_complete === true
  ) {
    return true;
  }

  if (st === 'order completed' || st === 'completed') return true;
  if (st.includes('complete') && !st.includes('incomplete')) return true;
  if (st === 'delivered' || st.includes('delivered')) return true;
  if (st.includes('picked') && st.includes('up')) return true;

  const accepted =
    st === 'accepted' ||
    st === 'order accepted' ||
    st === 'order_accepted';
  const otpOk =
    order.otpVerified === true || order.otp_verified === true;
  if (accepted && otpOk) return true;

  return false;
}

/**
 * Completed, not already tied to a payout request, positive payable total.
 */
export function isOrderEligibleForPayout(order) {
  if (payoutAlreadyRequested(order)) return false;
  if (hasPayoutLink(order)) return false;
  if (!isOrderTerminalComplete(order)) return false;
  const total = computeOrderPayableTotal(order);
  return Number.isFinite(total) && total > 0;
}

/**
 * How the merchant asked to receive this payout (from Wallet / withdraw_method).
 * @typedef {{ method: 'paypal'|'stripe', paypalEmail?: string, stripeAccountId?: string }} PayoutPaymentInput
 */

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} merchantId
 * @param {string[]} orderIds — restaurant_orders document IDs
 * @param {PayoutPaymentInput} payoutPayment
 */
export async function createPayoutRequest(db, merchantId, orderIds, payoutPayment) {
  if (!merchantId || typeof merchantId !== 'string') {
    throw new Error('Invalid merchant');
  }
  const unique = [...new Set((orderIds || []).filter(Boolean))];
  if (unique.length === 0) {
    throw new Error('Select at least one order');
  }

  const method = payoutPayment?.method;
  if (method !== 'paypal' && method !== 'stripe') {
    throw new Error('Choose PayPal or Stripe for this payout');
  }
  const paypalEmail =
    method === 'paypal' ? String(payoutPayment.paypalEmail || '').trim() : '';
  const stripeAccountId =
    method === 'stripe' ? String(payoutPayment.stripeAccountId || '').trim() : '';
  if (method === 'paypal' && !paypalEmail) {
    throw new Error('PayPal email is missing — set it up in Wallet');
  }
  if (method === 'stripe' && !stripeAccountId) {
    throw new Error('Stripe account ID is missing — set it up in Wallet');
  }

  const payoutPaymentDetails =
    method === 'paypal'
      ? { paypal: { email: paypalEmail } }
      : { stripe: { accountId: stripeAccountId } };

  return runTransaction(db, async (transaction) => {
    const refs = unique.map((id) => doc(db, ORDERS_COLLECTION, id));
    const snaps = await Promise.all(refs.map((r) => transaction.get(r)));

    let totalAmount = 0;

    snaps.forEach((snap, i) => {
      const id = unique[i];
      if (!snap.exists()) {
        throw new Error(`Order ${id} not found`);
      }
      const data = snap.data();
      const merged = { ...data, id };
      if (payoutAlreadyRequested(data)) {
        throw new Error(`Order ${id} is already included in a payout request`);
      }
      if (hasPayoutLink(data)) {
        throw new Error(`Order ${id} is already linked to a payout request`);
      }
      if (!isOrderEligibleForPayout(merged)) {
        throw new Error(`Order ${id} is not eligible for payout`);
      }
      totalAmount += computeOrderPayableTotal(data);
    });

    totalAmount = Math.round(totalAmount * 100) / 100;

    const payoutRef = doc(collection(db, PAYOUT_REQUESTS_COLLECTION));
    transaction.set(payoutRef, {
      merchantId,
      orderIds: unique,
      totalAmount,
      status: 'pending',
      createdAt: serverTimestamp(),
      payoutPaymentMethod: method,
      payoutPaymentDetails,
    });

    const paymentRequestRef = doc(db, PAYMENT_REQUEST_COLLECTION, payoutRef.id);
    transaction.set(paymentRequestRef, {
      payoutRequestId: payoutRef.id,
      merchantId,
      method,
      ...(method === 'paypal'
        ? { paypal: { email: paypalEmail } }
        : { stripe: { accountId: stripeAccountId } }),
      orderIds: unique,
      totalAmount,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    unique.forEach((orderId) => {
      transaction.update(doc(db, ORDERS_COLLECTION, orderId), {
        payoutRequested: true,
        payoutId: payoutRef,
      });
    });

    return { payoutId: payoutRef.id, totalAmount };
  });
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} merchantId
 */
export async function fetchPayoutRequestsForMerchant(db, merchantId) {
  if (!merchantId) return [];
  const q = query(
    collection(db, PAYOUT_REQUESTS_COLLECTION),
    where('merchantId', '==', merchantId)
  );
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const millis = (t) => {
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.seconds === 'number') return t.seconds * 1000;
    return 0;
  };
  rows.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
  return rows;
}

/** Auto weekly requests must not appear in merchant UI. Legacy docs without `type` count as manual. */
export function isMerchantVisiblePayoutRequest(row) {
  const t = row?.type;
  if (t == null || t === '') return true;
  return String(t).toLowerCase() !== 'auto';
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} merchantId
 */
export async function fetchMerchantVisiblePayoutRequests(db, merchantId) {
  const rows = await fetchPayoutRequestsForMerchant(db, merchantId);
  return rows.filter(isMerchantVisiblePayoutRequest);
}

export function getPayoutRequestAmount(row) {
  const n = row?.totalAmount ?? row?.amount;
  const v = typeof n === 'number' ? n : parseFloat(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}
