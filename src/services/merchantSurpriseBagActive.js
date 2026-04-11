import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'merchant_surprise_bag';

/**
 * Sets `is_active` on all published bags for this merchant: exactly one `true`, rest `false`.
 * @param {string} merchantId — same as `merchantId` on bag docs (typically auth uid)
 * @param {string} activeBagDocId — Firestore document id of the bag to mark active
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function setExclusiveActiveSurpriseBag(merchantId, activeBagDocId) {
  if (!merchantId || !activeBagDocId) {
    return { success: false, error: 'Missing merchant or bag id' };
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('merchantId', '==', merchantId),
      where('status', '==', 'published')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { success: false, error: 'No published bags found' };
    }

    const ids = snap.docs.map((d) => d.id);
    if (!ids.includes(activeBagDocId)) {
      return { success: false, error: 'Bag not found or not published' };
    }

    const batch = writeBatch(db);
    snap.forEach((d) => {
      const active = d.id === activeBagDocId;
      batch.update(doc(db, COLLECTION, d.id), {
        is_active: active,
        isActive: active,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[setExclusiveActiveSurpriseBag]', message);
    return { success: false, error: message };
  }
}

/**
 * Sets `is_active: false` on every published bag for this merchant (none active).
 * @param {string} merchantId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function clearAllActiveSurpriseBags(merchantId) {
  if (!merchantId) {
    return { success: false, error: 'Missing merchant id' };
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('merchantId', '==', merchantId),
      where('status', '==', 'published')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { success: true };
    }

    const batch = writeBatch(db);
    snap.forEach((d) => {
      batch.update(doc(db, COLLECTION, d.id), {
        is_active: false,
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[clearAllActiveSurpriseBags]', message);
    return { success: false, error: message };
  }
}
