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
import { getDocument, getDocuments } from '../firebase/firestore';
import { resolveMerchantVendorId } from './merchantVendor';

export const CHAT_MERCHANT_COLLECTION = 'chat_merchant';
/** Admin dashboard reads/writes `chat_admin/{merchantAuthUid}/thread` (not `chat_merchant`). */
export const CHAT_ADMIN_COLLECTION = 'chat_admin';
export const ADMIN_CUSTOMER_ID = 'admin';

/** Route id remains `{merchantAuthUid}_admin`; Firestore doc is `chat_admin/{merchantAuthUid}`. */
export function isAdminConversationId(conversationId, merchantAuthUid) {
  return (
    Boolean(merchantAuthUid && conversationId) &&
    conversationId === `${merchantAuthUid}_${ADMIN_CUSTOMER_ID}`
  );
}

/** Firestore `in` queries allow at most 10 values. */
const FIRESTORE_IN_MAX = 10;

/** Customer apps may key chats by vendor doc id or alternate field names on `chat_merchant`. */
const MERCHANT_CONVERSATION_ID_FIELDS = [
  'merchantId',
  'restaurantId',
  'vendorId',
  'vendorID',
  'receiverId',
];

/** Values on a conversation doc that tie it to a merchant (same keys we query in list). */
export function conversationMerchantLinkValues(data) {
  if (!data) return [];
  const out = [];
  MERCHANT_CONVERSATION_ID_FIELDS.forEach((f) => {
    const v = data[f];
    if (v != null && v !== '') out.push(String(v));
  });
  if (data.merchantAuthUid) out.push(String(data.merchantAuthUid));
  return [...new Set(out)];
}

function chunkForIn(values) {
  const chunks = [];
  for (let i = 0; i < values.length; i += FIRESTORE_IN_MAX) {
    chunks.push(values.slice(i, i + FIRESTORE_IN_MAX));
  }
  return chunks;
}

/**
 * All Firestore id values this signed-in merchant may own for chat queries.
 * Customer apps often use `users.vendorID` / vendor document id, not auth uid.
 * @param {string} authUid
 * @returns {Promise<string[]>}
 */
export async function getMerchantChatQueryIds(authUid) {
  if (!authUid) return [];
  const ids = new Set([String(authUid)]);
  try {
    const res = await getDocument('users', authUid);
    if (res.success && res.data?.vendorID) ids.add(String(res.data.vendorID));
  } catch (e) {
    console.warn('[chatMerchant] getMerchantChatQueryIds users', e);
  }
  try {
    const byAuthor = await getDocuments(
      'vendors',
      [{ field: 'author', operator: '==', value: authUid }],
      null,
      'asc',
      25
    );
    if (byAuthor.success && Array.isArray(byAuthor.data)) {
      for (const row of byAuthor.data) {
        if (row.id) ids.add(String(row.id));
        if (row.vendorID != null && row.vendorID !== '') ids.add(String(row.vendorID));
        if (row.author) ids.add(String(row.author));
      }
    }
  } catch (e) {
    console.warn('[chatMerchant] getMerchantChatQueryIds vendors', e);
  }
  try {
    const v = await resolveMerchantVendorId(authUid);
    if (v) ids.add(String(v));
  } catch (e) {
    console.warn('[chatMerchant] getMerchantChatQueryIds resolveVendor', e);
  }
  return [...ids];
}

function compareConversationCreatedDesc(a, b) {
  const ta = a.createdAt?.toDate
    ? a.createdAt.toDate().getTime()
    : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
  const tb = b.createdAt?.toDate
    ? b.createdAt.toDate().getTime()
    : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
  return tb - ta;
}

/**
 * Real-time conversation list: merges `in` queries per field so we match customer apps that
 * store vendor id on `merchantId`, `restaurantId`, `vendorId`, etc. No `orderBy` — docs without
 * `createdAt` would otherwise be excluded by Firestore.
 * @param {string[]} merchantIds
 * @param {(conversations: Array<Record<string, unknown> & { id: string }>) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function listenConversationsForMerchantIds(merchantIds, onData, onError) {
  const unique = [...new Set((merchantIds || []).filter(Boolean).map(String))];
  if (unique.length === 0) {
    onData([]);
    return () => {};
  }

  const chunks = chunkForIn(unique);
  const state = new Map();

  const emit = () => {
    const byId = new Map();
    state.forEach((list) => {
      list.forEach((c) => byId.set(c.id, c));
    });
    onData(Array.from(byId.values()).sort(compareConversationCreatedDesc));
  };

  const unsubs = [];
  MERCHANT_CONVERSATION_ID_FIELDS.forEach((field) => {
    chunks.forEach((chunk, ci) => {
      const key = `${field}:${ci}`;
      const q = query(collection(db, CHAT_MERCHANT_COLLECTION), where(field, 'in', chunk));
      const unsub = onSnapshot(
        q,
        (snap) => {
          state.set(
            key,
            snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          );
          emit();
        },
        (err) => {
          console.error('[chatMerchant] listenConversations field', field, err);
          if (onError) onError(err);
        }
      );
      unsubs.push(unsub);
    });
  });

  return () => unsubs.forEach((u) => u());
}

/**
 * Sum merchant unread across merged queries; each conversation doc is counted once.
 * @param {string[]} merchantIds
 * @param {(total: number) => void} onData
 * @param {(err: Error) => void} [onError]
 * @param {string | null} [merchantAuthUid] - adds `userUnreadCount` from `chat_admin/{uid}` (admin→merchant thread)
 */
export function listenTotalMerchantUnreadForIds(merchantIds, onData, onError, merchantAuthUid = null) {
  const unique = [...new Set((merchantIds || []).filter(Boolean).map(String))];
  if (unique.length === 0 && !merchantAuthUid) {
    onData(0);
    return () => {};
  }

  const chunks = chunkForIn(unique);
  const state = new Map();
  let chatAdminUserUnread = 0;

  const emit = () => {
    const byDocId = new Map();
    state.forEach((rows) => {
      rows.forEach(({ id, n }) => {
        if (!byDocId.has(id)) byDocId.set(id, n);
      });
    });
    let sum = chatAdminUserUnread;
    byDocId.forEach((n) => {
      sum += n;
    });
    onData(sum);
  };

  const unsubs = [];
  MERCHANT_CONVERSATION_ID_FIELDS.forEach((field) => {
    chunks.forEach((chunk, ci) => {
      const key = `${field}:${ci}`;
      const q = query(collection(db, CHAT_MERCHANT_COLLECTION), where(field, 'in', chunk));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map((d) => {
            const n = d.data().merchantUnreadCount;
            return { id: d.id, n: typeof n === 'number' ? n : 0 };
          });
          state.set(key, rows);
          emit();
        },
        (err) => {
          console.error('[chatMerchant] listenTotalUnread field', field, err);
          if (onError) onError(err);
        }
      );
      unsubs.push(unsub);
    });
  });

  if (merchantAuthUid) {
    const unsubAdmin = onSnapshot(
      doc(db, CHAT_ADMIN_COLLECTION, merchantAuthUid),
      (snap) => {
        chatAdminUserUnread = snap.exists() ? Number(snap.data()?.userUnreadCount) || 0 : 0;
        emit();
      },
      (err) => {
        console.error('[chatMerchant] listenTotalUnread chat_admin', err);
        chatAdminUserUnread = 0;
        emit();
        if (onError) onError(err);
      }
    );
    unsubs.push(unsubAdmin);
  }

  return () => unsubs.forEach((u) => u());
}

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
    where('merchantId', '==', merchantId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const conversations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(conversations.sort(compareConversationCreatedDesc));
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
 * @param {string | null} [merchantAuthUid] - when set and this is the admin thread, listens under `chat_admin/{uid}/thread`
 */
export function listenThread(conversationId, onData, onError, merchantAuthUid = null) {
  const useAdmin =
    merchantAuthUid && isAdminConversationId(conversationId, merchantAuthUid);
  const threadCol = useAdmin
    ? collection(db, CHAT_ADMIN_COLLECTION, merchantAuthUid, 'thread')
    : collection(db, CHAT_MERCHANT_COLLECTION, conversationId, 'thread');

  const q = query(threadCol, orderBy('createdAt', 'asc'));

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

/**
 * Admin support thread metadata — aligns with admin app: `chat_admin/{merchantAuthUid}`.
 * @param {{ merchantAuthUid: string, merchantName?: string }} params
 */
export async function ensureAdminConversationDoc({ merchantAuthUid, merchantName }) {
  if (!merchantAuthUid) return;
  const ref = doc(db, CHAT_ADMIN_COLLECTION, merchantAuthUid);
  await setDoc(
    ref,
    {
      merchantName: merchantName || 'Merchant',
      lastMessage: '',
      createdAt: serverTimestamp(),
      userUnreadCount: 0,
      adminUnreadCount: 0,
    },
    { merge: true }
  );
}

/** @param {string} conversationId @param {string | null} [merchantAuthUid] */
export async function resetMerchantUnread(conversationId, merchantAuthUid = null) {
  if (merchantAuthUid && isAdminConversationId(conversationId, merchantAuthUid)) {
    await setDoc(doc(db, CHAT_ADMIN_COLLECTION, merchantAuthUid), { userUnreadCount: 0 }, { merge: true });
    return;
  }
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
  merchantAuthUid = null,
}) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;

  const useAdmin =
    merchantAuthUid && isAdminConversationId(conversationId, merchantAuthUid);

  if (useAdmin) {
    await addDoc(collection(db, CHAT_ADMIN_COLLECTION, merchantId, 'thread'), {
      text: trimmed,
      senderId: merchantId,
      senderName: merchantName || 'Merchant',
      createdAt: serverTimestamp(),
      type: 'text',
      mediaUrl: '',
    });

    await setDoc(
      doc(db, CHAT_ADMIN_COLLECTION, merchantId),
      {
        lastMessage: trimmed,
        createdAt: serverTimestamp(),
        adminUnreadCount: increment(1),
        userUnreadCount: 0,
      },
      { merge: true }
    );
    return;
  }

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

/**
 * @param {string} conversationId
 * @param {string | null} [merchantAuthUid] - required to load `chat_admin` for `{uid}_admin` routes
 */
export async function getConversationDoc(conversationId, merchantAuthUid = null) {
  if (merchantAuthUid && isAdminConversationId(conversationId, merchantAuthUid)) {
    const snap = await getDoc(doc(db, CHAT_ADMIN_COLLECTION, merchantAuthUid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: conversationId,
      merchantAuthUid,
      merchantId: merchantAuthUid,
      customerId: ADMIN_CUSTOMER_ID,
      customerName: d.customerName || 'BestBy Bites Support',
      merchantName: d.merchantName || 'Merchant',
      lastMessage: d.lastMessage,
      createdAt: d.createdAt,
      customerPhoto: d.customerPhoto || d.customerProfileImage,
      orderId: d.orderId,
      _source: 'chat_admin',
    };
  }

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
  return listenTotalMerchantUnreadForIds([merchantId], onData, onError);
}
