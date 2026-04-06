import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getMerchantChatQueryIds } from './chatMerchant';

const FIRESTORE_IN_MAX = 10;
const BAGS_COLLECTION = 'merchant_surprise_bag';
const REVIEWS_COLLECTION = 'foods_review';

/** @param {Record<string, unknown> | undefined} data */
function firstBagPhotoUrlFromBagData(data) {
  if (!data || typeof data !== 'object') return null;
  const photos = data.photos;
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const first = photos[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    return first.url || first.preview || null;
  }
  return null;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Real-time reviews for the signed-in merchant: `foods_review.productId` must match a
 * `merchant_surprise_bag` document id whose `merchantId` is one of this merchant's ids.
 *
 * @param {string} authUid
 * @param {(reviews: Array<Record<string, unknown> & { id: string }>) => void} onReviews
 * @param {(e: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function subscribeToMerchantReviewsByProductId(authUid, onReviews, onError) {
  let cancelled = false;
  /** @type {(() => void)[]} */
  let unsubBag = [];
  /** @type {(() => void)[]} */
  let unsubRev = [];

  const cleanupReviews = () => {
    unsubRev.forEach((u) => u());
    unsubRev = [];
  };

  const cleanupAll = () => {
    unsubBag.forEach((u) => u());
    unsubBag = [];
    cleanupReviews();
  };

  const start = async () => {
    const merchantIds = await getMerchantChatQueryIds(authUid);
    if (cancelled) return;

    if (merchantIds.length === 0) {
      onReviews([]);
      return;
    }

    /** chunkIndex -> bag rows { id, data } */
    const bagState = new Map();
    /** Avoid tearing down review listeners when bag docs change but id set is unchanged. */
    let prevProductIdsKey;

    const recomputeReviews = () => {
      if (cancelled) return;

      const bagById = new Map();
      bagState.forEach((rows) => {
        rows.forEach((row) => bagById.set(row.id, row));
      });
      const bags = [...bagById.values()];
      const productIds = bags.map((b) => b.id);
      const key = productIds.slice().sort().join('|');
      if (prevProductIdsKey !== undefined && key === prevProductIdsKey) {
        return;
      }
      prevProductIdsKey = key;

      /** @type {Record<string, { title: string, imageUrl: string | null, offerPrice: number | null, bagPrice: number | null }>} */
      const bagMetaByProductId = {};
      bags.forEach((b) => {
        const d = b.data || {};
        const offerRaw = d.offerPrice ?? d.offer_price;
        const bagRaw = d.bagPrice ?? d.bag_price;
        bagMetaByProductId[b.id] = {
          title: d.bagTitle || d.title || d.name || 'Surprise bag',
          imageUrl: firstBagPhotoUrlFromBagData(d),
          offerPrice:
            typeof offerRaw === 'number' ? offerRaw : offerRaw != null ? parseFloat(String(offerRaw)) : null,
          bagPrice:
            typeof bagRaw === 'number' ? bagRaw : bagRaw != null ? parseFloat(String(bagRaw)) : null,
        };
      });

      cleanupReviews();

      if (productIds.length === 0) {
        onReviews([]);
        return;
      }

      const chunks = chunkArray(productIds, FIRESTORE_IN_MAX);
      /** @type {Record<number, Array<Record<string, unknown> & { id: string }>>} */
      const chunkData = {};

      const emit = () => {
        const byId = new Map();
        Object.values(chunkData)
          .flat()
          .forEach((d) => {
            const pid = String(d.productId ?? d.product_id ?? '');
            const meta = pid && bagMetaByProductId[pid] ? bagMetaByProductId[pid] : null;
            const enriched = { ...d };
            if (meta) {
              enriched._bagTitleFromJoin = meta.title;
              enriched._bagImageUrl = meta.imageUrl;
              enriched._bagOfferPrice = meta.offerPrice;
              enriched._bagPrice = meta.bagPrice;
            }
            byId.set(d.id, enriched);
          });
        onReviews([...byId.values()]);
      };

      chunks.forEach((chunk, ci) => {
        const q = query(collection(db, REVIEWS_COLLECTION), where('productId', 'in', chunk));
        const unsub = onSnapshot(
          q,
          (snap) => {
            chunkData[ci] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
            emit();
          },
          (err) => {
            console.error('[merchantReviews] foods_review snapshot', err);
            if (onError) onError(err);
          }
        );
        unsubRev.push(unsub);
      });
    };

    const idChunks = chunkArray(merchantIds, FIRESTORE_IN_MAX);
    idChunks.forEach((chunk, ci) => {
      const q = query(collection(db, BAGS_COLLECTION), where('merchantId', 'in', chunk));
      const unsub = onSnapshot(
        q,
        (snap) => {
          bagState.set(
            ci,
            snap.docs.map((d) => ({ id: d.id, data: d.data() }))
          );
          recomputeReviews();
        },
        (err) => {
          console.error('[merchantReviews] merchant_surprise_bag snapshot', err);
          if (onError) onError(err);
        }
      );
      unsubBag.push(unsub);
    });
  };

  start();

  return () => {
    cancelled = true;
    cleanupAll();
  };
}
