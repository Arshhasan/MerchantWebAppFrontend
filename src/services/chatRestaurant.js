import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

export const CHAT_RESTAURANT_COLLECTION = 'chat_restaurant';

const FIRESTORE_IN_MAX = 10;

function chunkForIn(values) {
  const chunks = [];
  for (let i = 0; i < values.length; i += FIRESTORE_IN_MAX) {
    chunks.push(values.slice(i, i + FIRESTORE_IN_MAX));
  }
  return chunks;
}

function lastActivityTime(data) {
  const lt = data.lastTimestamp;
  if (lt?.toDate) return lt.toDate();
  if (lt?.seconds) return new Date(lt.seconds * 1000);
  const ca = data.createdAt;
  if (ca?.toDate) return ca.toDate();
  if (ca?.seconds) return new Date(ca.seconds * 1000);
  return new Date(0);
}

/**
 * Per-conversation unread for merchant: last activity was from the customer, not the signed-in merchant.
 * @param {Record<string, unknown>} data
 * @param {string} merchantAuthUid
 */
function restaurantDocUnreadForMerchant(data, merchantAuthUid) {
  const last = data.lastSenderId;
  if (last == null || last === '') return 0;
  return String(last) !== String(merchantAuthUid) ? 1 : 0;
}

/**
 * @param {Record<string, unknown> & { id: string }} d
 * @param {string} merchantAuthUid
 */
export function mapRestaurantDocToListRow(d, merchantAuthUid) {
  const customerName =
    d.senderName || d.customerName || (d.senderId ? String(d.senderId).slice(0, 8) : 'Customer');
  const customerProfileImage = d.senderPhoto || d.customerPhoto || d.senderProfileImage || '';
  const lastMessageTime = lastActivityTime(d);
  return {
    id: d.id,
    source: 'restaurant',
    customerName,
    customerProfileImage,
    lastMessage: d.lastMessage || '',
    lastMessageTime,
    merchantUnreadCount: restaurantDocUnreadForMerchant(d, merchantAuthUid),
    orderId: d.orderId || '',
    senderId: d.senderId,
    receiverId: d.receiverId,
    receiverName: d.receiverName,
  };
}

/**
 * Real-time list of chat_restaurant parent docs where receiverId is the vendor document id.
 * @param {string[]} receiverIds from getMerchantChatQueryIds (includes vendor doc ids)
 * @param {string} merchantAuthUid Firebase Auth uid (for unread heuristic)
 */
export function listenRestaurantChatsForReceiverIds(receiverIds, merchantAuthUid, onData, onError) {
  const unique = [...new Set((receiverIds || []).filter(Boolean).map(String))];
  if (unique.length === 0) {
    onData([]);
    return () => {};
  }

  const chunks = chunkForIn(unique);
  const state = new Map();

  const emit = () => {
    const byId = new Map();
    state.forEach((list) => {
      list.forEach((d) => byId.set(d.id, d));
    });
    const rows = Array.from(byId.values())
      .map((d) => mapRestaurantDocToListRow(d, merchantAuthUid))
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    onData(rows);
  };

  const unsubs = [];
  chunks.forEach((chunk, ci) => {
    const key = `receiverId:${ci}`;
    const q = query(collection(db, CHAT_RESTAURANT_COLLECTION), where('receiverId', 'in', chunk));
    const unsub = onSnapshot(
      q,
      (snap) => {
        state.set(
          key,
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        emit();
      },
      (err) => {
        console.error('[chatRestaurant] listenRestaurantChatsForReceiverIds', err);
        if (onError) onError(err);
      }
    );
    unsubs.push(unsub);
  });

  return () => unsubs.forEach((u) => u());
}

/**
 * Sum "has unread from customer" across chat_restaurant docs for this merchant.
 * @param {string[]} receiverIds
 * @param {string} merchantAuthUid
 */
export function listenRestaurantUnreadForReceiverIds(
  receiverIds,
  merchantAuthUid,
  onData,
  onError
) {
  const unique = [...new Set((receiverIds || []).filter(Boolean).map(String))];
  if (unique.length === 0) {
    onData(0);
    return () => {};
  }

  const chunks = chunkForIn(unique);
  const state = new Map();

  const emit = () => {
    const byId = new Map();
    state.forEach((list) => {
      list.forEach((d) => byId.set(d.id, d));
    });
    let total = 0;
    byId.forEach((data) => {
      total += restaurantDocUnreadForMerchant(data, merchantAuthUid);
    });
    onData(total);
  };

  const unsubs = [];
  chunks.forEach((chunk, ci) => {
    const key = `receiverId:${ci}`;
    const q = query(collection(db, CHAT_RESTAURANT_COLLECTION), where('receiverId', 'in', chunk));
    const unsub = onSnapshot(
      q,
      (snap) => {
        state.set(
          key,
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        emit();
      },
      (err) => {
        console.error('[chatRestaurant] listenRestaurantUnreadForReceiverIds', err);
        if (onError) onError(err);
      }
    );
    unsubs.push(unsub);
  });

  return () => unsubs.forEach((u) => u());
}
