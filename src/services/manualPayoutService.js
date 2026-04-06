/**
 * Manual wallet payout via Cloud Function (server must implement `createManualPayoutRequest`).
 * Expected payload: { amount: number, payoutMethod: 'paypal' | 'stripe' }
 * Expected success data: { payoutRequestId?: string, ok?: boolean }
 *
 * Production: restrict Firestore writes on payout_requests / wallet fields; only callable + admin.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

const CALLABLE_NAME = 'createManualPayoutRequest';

/**
 * @param {{ amount: number, payoutMethod: 'paypal'|'stripe' }} params
 * @returns {Promise<{ payoutRequestId?: string, ok?: boolean }>}
 */
export async function createManualPayoutRequestCallable(params) {
  const { amount, payoutMethod } = params;
  if (!payoutMethod || (payoutMethod !== 'paypal' && payoutMethod !== 'stripe')) {
    throw new Error('Choose PayPal or Stripe');
  }
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Enter a valid amount');
  }
  const fn = httpsCallable(functions, CALLABLE_NAME);
  const result = await fn({
    amount: Math.round(n * 100) / 100,
    payoutMethod,
  });
  return result.data || {};
}

export function isCallableNotDeployedError(err) {
  const code = err?.code;
  const msg = (err?.message || '').toLowerCase();
  return (
    code === 'functions/not-found'
    || code === 'failed-precondition'
    || msg.includes('not found')
    || msg.includes('internal')
  );
}
