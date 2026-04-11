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

/** Vision API Likelihood enum order (0–5). */
const LIKELIHOOD_NAMES = [
  'UNKNOWN',
  'VERY_UNLIKELY',
  'UNLIKELY',
  'POSSIBLE',
  'LIKELY',
  'VERY_LIKELY',
];

/**
 * Vision may return strings, ints (0–5), or protobuf-style names depending on SDK/runtime.
 * @param {string|number|undefined|null} value
 * @returns {string}
 */
function normalizeLikelihood(value) {
  if (value == null || value === '') return 'UNKNOWN';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const i = Math.round(value);
    if (i >= 0 && i <= 5) return LIKELIHOOD_NAMES[i];
  }
  const s = String(value).trim().toUpperCase().replace(/\s+/g, '_');
  if (LIKELIHOOD_NAMES.includes(s)) return s;
  const m = String(value).match(
    /VERY_LIKELY|VERY_UNLIKELY|UNLIKELY|POSSIBLE|LIKELY|UNKNOWN/i
  );
  return m ? m[0].toUpperCase() : 'UNKNOWN';
}

/** Bump when SafeSearch rules change so existing bags are re-evaluated (see shouldModerateImage). */
const MODERATION_POLICY_VERSION = 3;

function getPolicyVersion(data) {
  if (!data || typeof data !== 'object') return 0;
  const v = data.moderationPolicyVersion;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Food / product photos often get LIKELY on adult, violence, or racy from Vision false positives.
 * Only block the strongest tier (VERY_LIKELY) on each axis — suitable for retail food imagery.
 * @param {Record<string, string|number|undefined>|null|undefined} ann
 */
function safeSearchIndicatesUnsafe(ann) {
  if (!ann) return false;
  return (
    normalizeLikelihood(ann.adult) === 'VERY_LIKELY'
    || normalizeLikelihood(ann.violence) === 'VERY_LIKELY'
    || normalizeLikelihood(ann.racy) === 'VERY_LIKELY'
  );
}

/**
 * Optional test/staging mock: bypass Vision and return a fixed SafeSearch-style annotation.
 * Set env `SURPRISE_BAG_MODERATION_MOCK` to `reject` or `approve`. Leave unset for real Vision.
 * Do not enable in production.
 * @returns {'reject' | 'approve' | null}
 */
function getSurpriseBagModerationMock() {
  const raw = process.env.SURPRISE_BAG_MODERATION_MOCK;
  if (raw == null || String(raw).trim() === '') return null;
  const v = String(raw).trim().toLowerCase();
  const inEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

  if (v === 'reject' || v === 'unsafe' || v === 'rejected') {
    if (!inEmulator) {
      console.error(
        '[moderateSurpriseBagImage] SURPRISE_BAG_MODERATION_MOCK=reject is set in a deployed function — ignoring (use Vision). Remove from functions/.env.* or Cloud runtime env.'
      );
      return null;
    }
    return 'reject';
  }
  if (v === 'approve' || v === 'safe' || v === 'approved') {
    if (!inEmulator) {
      console.warn(
        '[moderateSurpriseBagImage] SURPRISE_BAG_MODERATION_MOCK=approve ignored outside emulator; using Vision'
      );
      return null;
    }
    return 'approve';
  }
  console.warn(
    `[moderateSurpriseBagImage] invalid SURPRISE_BAG_MODERATION_MOCK="${raw}" (use reject or approve); using Vision`
  );
  return null;
}

/**
 * @param {string} imageUrl
 */
async function runSafeSearch(imageUrl) {
  const mock = getSurpriseBagModerationMock();
  if (mock === 'reject') {
    console.warn(
      '[moderateSurpriseBagImage] MOCK SafeSearch reject (SURPRISE_BAG_MODERATION_MOCK) — Vision not called'
    );
    return {
      adult: 'VERY_LIKELY',
      violence: 'VERY_UNLIKELY',
      racy: 'VERY_UNLIKELY',
    };
  }
  if (mock === 'approve') {
    console.warn(
      '[moderateSurpriseBagImage] MOCK SafeSearch approve (SURPRISE_BAG_MODERATION_MOCK) — Vision not called'
    );
    return {
      adult: 'VERY_UNLIKELY',
      violence: 'VERY_UNLIKELY',
      racy: 'VERY_UNLIKELY',
    };
  }

  const client = getVisionClient();
  const [result] = await client.safeSearchDetection({
    image: { source: { imageUri: imageUrl } },
  });
  return result.safeSearchAnnotation || {};
}

/**
 * Re-run Vision when the primary image URL changes, or when moderationPolicyVersion is behind
 * MODERATION_POLICY_VERSION (e.g. after we fix false-positive rules).
 * @param {*} after
 * @param {*} before
 */
function shouldModerateImage(after, before) {
  const afterData = after.data() || {};
  const next = getPrimaryImageUrl(afterData);
  if (!next) return false;

  if (getPolicyVersion(afterData) < MODERATION_POLICY_VERSION) return true;

  if (!before.exists) return true;

  const prev = getPrimaryImageUrl(before.data());
  if (next !== prev) return true;

  return false;
}

/**
 * Firestore onWrite handler for merchant_surprise_bag/{bagId}.
 */
async function onSurpriseBagWrite(change, context) {
  const bagId = context.params.bagId;

  if (!change.after.exists) {
    console.log(`[moderateSurpriseBagImage] bagId=${bagId} op=delete (ignored)`);
    return null;
  }

  const afterSnap = change.after;
  const beforeSnap = change.before;
  const afterData = afterSnap.data() || {};
  const beforeData = beforeSnap.exists ? beforeSnap.data() || {} : null;
  const nextUrl = getPrimaryImageUrl(afterData);
  const prevUrl = beforeData ? getPrimaryImageUrl(beforeData) : '';

  const isCreate = !beforeSnap.exists;
  const shouldRun = shouldModerateImage(afterSnap, beforeSnap);

  if (!shouldRun) {
    let reason = 'skip';
    if (!nextUrl) reason = 'no_primary_image_url';
    else if (!isCreate && nextUrl === prevUrl && getPolicyVersion(afterData) >= MODERATION_POLICY_VERSION) {
      reason = 'unchanged_already_moderated';
    }
    console.log(
      `[moderateSurpriseBagImage] bagId=${bagId} op=${isCreate ? 'create' : 'update'} skip=true reason=${reason} policyVer=${getPolicyVersion(afterData)}/${MODERATION_POLICY_VERSION}`
    );
    return null;
  }

  const mockMode = getSurpriseBagModerationMock();
  console.log(
    `[moderateSurpriseBagImage] bagId=${bagId} op=${isCreate ? 'create' : 'update'} skip=false mode=${mockMode ? `mock_${mockMode}` : 'vision'}`
  );

  const imageUrl = getPrimaryImageUrl(afterSnap.data());
  const bagRef = afterSnap.ref;

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

  console.log(
    `[moderateSurpriseBagImage] bagId=${bagId} safeSearch ` +
      `adult=${normalizeLikelihood(annotation.adult)} violence=${normalizeLikelihood(annotation.violence)} ` +
      `racy=${normalizeLikelihood(annotation.racy)} unsafe=${unsafe}`
  );

  if (unsafe) {
    await bagRef.update({
      isUnsafe: true,
      isActive: false,
      is_active: false,
      moderationStatus: 'rejected',
      lastModeratedAt: now,
      moderationPolicyVersion: MODERATION_POLICY_VERSION,
    });
    console.warn(`[moderateSurpriseBagImage] rejected bagId=${bagId}`);
  } else {
    await bagRef.update({
      isUnsafe: false,
      moderationStatus: 'approved',
      lastModeratedAt: now,
      moderationPolicyVersion: MODERATION_POLICY_VERSION,
    });
    console.log(`[moderateSurpriseBagImage] approved bagId=${bagId}`);
  }

  return null;
}

module.exports = {
  onSurpriseBagWrite,
  getPrimaryImageUrl,
  shouldModerateImage,
  getSurpriseBagModerationMock,
  normalizeLikelihood,
  safeSearchIndicatesUnsafe,
};
