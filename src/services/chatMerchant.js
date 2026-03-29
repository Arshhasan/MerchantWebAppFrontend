import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const CHAT_MERCHANT_COLLECTION = 'chat_merchant';
export const ADMIN_CUSTOMER_ID = 'admin';

/** @param {string} merchantId @param {string} customerId */
export function buildConversationId(merchantId, customerId) {
  return `${merchantId}_${customerId}`;
}

/**
 * @param {string} merchantId - Firebase Auth UID for merchant (matches guide / admin thread id)
 * @param {(conversations: Array<Record<string, unknown> & { id: string }>) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function listenConversations(merchantId, onData, onError) {
  const q = query(
    collection(db, CHAT_MERCHANT_COLLECTION),
    where('merchantId', '==', merchantId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const conversations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(conversations);
    },
    (err) => {
      console.error('[chatMerchant] listenConversations', err);
      if (onError) onError(err);
    }
  );
}

/**
 * @param {string} conversationId
 * @param {(messages: Array<Record<string, unknown> & { id: string }>) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function listenThread(conversationId, onData, onError) {
  const q = query(
    collection(db, CHAT_MERCHANT_COLLECTION, conversationId, 'thread'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map((d) => {
        const data = d.data();
        let createdAt = new Date();
        if (data.createdAt?.toDate) createdAt = data.createdAt.toDate();
        else if (data.createdAt?.seconds) createdAt = new Date(data.createdAt.seconds * 1000);
        return { id: d.id, ...data, createdAt };
      });
      onData(messages);
    },
    (err) => {
      console.error('[chatMerchant] listenThread', err);
      if (onError) onError(err);
    }
  );
}

/**
 * @param {object} params
 * @param {string} params.conversationId
 * @param {string} params.merchantId
 * @param {string} params.customerId
 * @param {string} params.merchantName
 * @param {string} params.customerName
 */
export async function ensureConversationDoc({
  conversationId,
  merchantId,
  customerId,
  merchantName,
  customerName,
}) {
  const ref = doc(db, CHAT_MERCHANT_COLLECTION, conversationId);
  await setDoc(
    ref,
    {
      merchantId,
      customerId,
      merchantName: merchantName || 'Merchant',
      customerName: customerName || 'Customer',
      lastMessage: '',
      createdAt: serverTimestamp(),
      merchantUnreadCount: 0,
      customerUnreadCount: 0,
    },
    { merge: true }
  );
}

/** @param {string} conversationId */
export async function resetMerchantUnread(conversationId) {
  const ref = doc(db, CHAT_MERCHANT_COLLECTION, conversationId);
  await setDoc(ref, { merchantUnreadCount: 0 }, { merge: true });
}

/**
 * @param {object} params
 * @param {string} params.conversationId
 * @param {string} params.merchantId
 * @param {string} params.merchantName
 * @param {string} params.text
 */
export async function sendMerchantTextMessage({
  conversationId,
  merchantId,
  merchantName,
  text,
}) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;

  await addDoc(collection(db, CHAT_MERCHANT_COLLECTION, conversationId, 'thread'), {
    text: trimmed,
    senderId: merchantId,
    senderName: merchantName || 'Merchant',
    createdAt: serverTimestamp(),
    type: 'text',
    mediaUrl: '',
  });

  await setDoc(
    doc(db, CHAT_MERCHANT_COLLECTION, conversationId),
    {
      lastMessage: trimmed,
      createdAt: serverTimestamp(),
      customerUnreadCount: increment(1),
      merchantUnreadCount: 0,
    },
    { merge: true }
  );
}

/** @param {string} conversationId */
export async function getConversationDoc(conversationId) {
  const snap = await getDoc(doc(db, CHAT_MERCHANT_COLLECTION, conversationId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Sum merchantUnreadCount for all conversations (same query as list).
 * @param {string} merchantId
 * @param {(total: number) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function listenTotalMerchantUnread(merchantId, onData, onError) {
  const q = query(collection(db, CHAT_MERCHANT_COLLECTION), where('merchantId', '==', merchantId));

  return onSnapshot(
    q,
    (snap) => {
      let total = 0;
      snap.docs.forEach((d) => {
        const n = d.data().merchantUnreadCount;
        total += typeof n === 'number' ? n : 0;
      });
      onData(total);
    },
    (err) => {
      console.error('[chatMerchant] listenTotalMerchantUnread', err);
      if (onError) onError(err);
    }
  );
}
