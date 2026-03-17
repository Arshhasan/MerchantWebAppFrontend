import { collection, getDocs, query, where, doc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Merchant project parity:
 * Collection: withdraw_method
 * Document shape (example):
 * {
 *   id: <docId>,
 *   userId: <vendorId>,
 *   paypal: { name: 'PayPal', enable: true, email: '...' }
 * }
 */

export async function getWithdrawMethodDocByUserId(userId) {
  const ref = collection(db, 'withdraw_method');
  const q = query(ref, where('userId', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) return { success: true, data: null };
  const first = snap.docs[0];
  return { success: true, data: { id: first.id, ...first.data() } };
}

export async function upsertPayPalWithdrawMethod({ userId, email }) {
  if (!userId) return { success: false, error: 'Missing userId' };
  if (!email) return { success: false, error: 'Missing email' };

  try {
    const existing = await getWithdrawMethodDocByUserId(userId);
    if (!existing.success) throw new Error(existing.error || 'Failed to read withdraw method');

    const paypalObject = { name: 'PayPal', enable: true, email };

    if (existing.data?.id) {
      const docRef = doc(db, 'withdraw_method', existing.data.id);
      await updateDoc(docRef, { paypal: paypalObject });
      return { success: true, id: existing.data.id };
    }

    // Create new doc; use deterministic id to avoid duplicates per vendor
    const newId = `withdraw_${userId}`;
    const docRef = doc(db, 'withdraw_method', newId);
    await setDoc(docRef, { id: newId, userId, paypal: paypalObject }, { merge: true });
    return { success: true, id: newId };
  } catch (error) {
    console.error('Error saving PayPal withdraw method:', error);
    return { success: false, error: error.message };
  }
}

export async function removePayPalWithdrawMethod({ userId }) {
  if (!userId) return { success: false, error: 'Missing userId' };
  try {
    const existing = await getWithdrawMethodDocByUserId(userId);
    if (!existing.success) throw new Error(existing.error || 'Failed to read withdraw method');
    if (!existing.data?.id) return { success: true }; // nothing to remove

    const docRef = doc(db, 'withdraw_method', existing.data.id);
    await updateDoc(docRef, { paypal: deleteField() });
    return { success: true };
  } catch (error) {
    console.error('Error removing PayPal withdraw method:', error);
    return { success: false, error: error.message };
  }
}

export async function upsertStripeWithdrawMethod({ userId, accountId }) {
  if (!userId) return { success: false, error: 'Missing userId' };
  if (!accountId) return { success: false, error: 'Missing accountId' };

  try {
    const existing = await getWithdrawMethodDocByUserId(userId);
    if (!existing.success) throw new Error(existing.error || 'Failed to read withdraw method');

    const stripeObject = { name: 'Stripe', enable: true, accountId };

    if (existing.data?.id) {
      const docRef = doc(db, 'withdraw_method', existing.data.id);
      await updateDoc(docRef, { stripe: stripeObject });
      return { success: true, id: existing.data.id };
    }

    const newId = `withdraw_${userId}`;
    const docRef = doc(db, 'withdraw_method', newId);
    await setDoc(docRef, { id: newId, userId, stripe: stripeObject }, { merge: true });
    return { success: true, id: newId };
  } catch (error) {
    console.error('Error saving Stripe withdraw method:', error);
    return { success: false, error: error.message };
  }
}

export async function removeStripeWithdrawMethod({ userId }) {
  if (!userId) return { success: false, error: 'Missing userId' };
  try {
    const existing = await getWithdrawMethodDocByUserId(userId);
    if (!existing.success) throw new Error(existing.error || 'Failed to read withdraw method');
    if (!existing.data?.id) return { success: true };

    const docRef = doc(db, 'withdraw_method', existing.data.id);
    await updateDoc(docRef, { stripe: deleteField() });
    return { success: true };
  } catch (error) {
    console.error('Error removing Stripe withdraw method:', error);
    return { success: false, error: error.message };
  }
}

