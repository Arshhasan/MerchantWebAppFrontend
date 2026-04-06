/**
 * Sets `thumbnail` on every document in `learning_videos`, cycling
 * THUMBNAIL-1.png → THUMBNAIL-2.png → THUMBNAIL-3.png (see learningVideoThumbnails.mjs).
 * Document order is stable: sorted by document id.
 *
 * Credentials: same as seed:learning-videos (see scripts/firebaseAdminInit.mjs).
 *
 * Run: npm run update:learning-thumbnails
 */
import { initAdmin, admin } from './firebaseAdminInit.mjs';
import { thumbnailForIndex } from './learningVideoThumbnails.mjs';

const BATCH_LIMIT = 500;

async function main() {
  initAdmin();
  const db = admin.firestore();
  const snap = await db.collection('learning_videos').get();

  if (snap.empty) {
    console.log('No documents in learning_videos.');
    return;
  }

  const docs = [...snap.docs].sort((a, b) => a.id.localeCompare(b.id));

  let batch = db.batch();
  let batchOps = 0;
  let total = 0;

  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i];
    batch.update(doc.ref, { thumbnail: thumbnailForIndex(i) });
    batchOps += 1;
    total += 1;

    if (batchOps >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  console.log(`Updated thumbnail on ${total} document(s) in learning_videos (cycling 3 URLs).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
