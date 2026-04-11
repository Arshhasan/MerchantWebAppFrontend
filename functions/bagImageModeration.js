/**
 * Surprise bag image moderation via Google Cloud Vision SafeSearch only.
 * Triggered from Firestore onWrite when the primary image URL changes.
 */
'use strict';

const vision = require('@google-cloud/vision');
const admin = require('firebase-admin');

let visionClient;
function getVisionClient() {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient();
  }
  return visionClient;
}

/**
 * Primary image for moderation: explicit imageUrl, else first entry in photos[].
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {string}
 */
function getPrimaryImageUrl(data) {
  if (!data || typeof data !== 'object') return '';
  const direct = data.imageUrl;
  if (typeof direct === 'string') {
    const t = direct.trim();
    if (t.startsWith('http')) return t;
  }
  const photos = data.photos;
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const first = photos[0];
  if (typeof first === 'string') {
    const t = first.trim();
    if (t.startsWith('http')) return t;
  }
  if (first && typeof first === 'object') {
    const u = first.url || first.preview;
    if (typeof u === 'string' && u.trim().startsWith('http')) return u.trim();
  }
  return '';
}

function isLikelyOrVeryLikely(level) {
  return level === 'LIKELY' || level === 'VERY_LIKELY';
}

/**
 * Unsafe if adult, violence, or racy is LIKELY or VERY_LIKELY.
 * @param {Record<string, string|undefined>|null|undefined} ann
 */
function safeSearchIndicatesUnsafe(ann) {
  if (!ann) return false;
  return (
    isLikelyOrVeryLikely(ann.adult) ||
    isLikelyOrVeryLikely(ann.violence) ||
    isLikelyOrVeryLikely(ann.racy)
  );
}

/**
 * @param {string} imageUrl
 */
async function runSafeSearch(imageUrl) {
  const client = getVisionClient();
  const [result] = await client.safeSearchDetection({
    image: { source: { imageUri: imageUrl } },
  });
  return result.safeSearchAnnotation || {};
}

/**
 * @param {*} after
 * @param {*} before
 */
function shouldModerateImage(after, before) {
  const next = getPrimaryImageUrl(after.data());
  if (!next) return false;

  if (!before.exists) return true;

  const prev = getPrimaryImageUrl(before.data());
  if (next !== prev) return true;

  return false;
}

/**
 * Firestore onWrite handler for merchant_surprise_bag/{bagId}.
 */
async function onSurpriseBagWrite(change, context) {
  if (!change.after.exists) return null;

  const afterSnap = change.after;
  const beforeSnap = change.before;

  if (!shouldModerateImage(afterSnap, beforeSnap)) {
    return null;
  }

  const imageUrl = getPrimaryImageUrl(afterSnap.data());
  const bagRef = afterSnap.ref;
  const bagId = context.params.bagId;

  let annotation;
  try {
    annotation = await runSafeSearch(imageUrl);
  } catch (err) {
    console.error(`[moderateSurpriseBagImage] Vision SafeSearch failed bagId=${bagId}`, err);
    await bagRef.update({
      moderationStatus: 'pending',
      lastModeratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  }

  const unsafe = safeSearchIndicatesUnsafe(annotation);
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (unsafe) {
    await bagRef.update({
      isUnsafe: true,
      isActive: false,
      is_active: false,
      moderationStatus: 'rejected',
      lastModeratedAt: now,
    });
    console.warn(`[moderateSurpriseBagImage] rejected bagId=${bagId}`);
  } else {
    await bagRef.update({
      isUnsafe: false,
      moderationStatus: 'approved',
      lastModeratedAt: now,
    });
    console.log(`[moderateSurpriseBagImage] approved bagId=${bagId}`);
  }

  return null;
}

module.exports = {
  onSurpriseBagWrite,
  getPrimaryImageUrl,
  shouldModerateImage,
};
