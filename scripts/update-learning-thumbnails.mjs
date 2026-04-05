/**
 * Sets the same `thumbnail` URL on every document in `learning_videos`.
 *
 * Credentials: same as seed:learning-videos (see scripts/firebaseAdminInit.mjs).
 *
 * Run: npm run update:learning-thumbnails
 */
import { initAdmin, admin } from './firebaseAdminInit.mjs';

const THUMBNAIL_URL =
  'https://firebasestorage.googleapis.com/v0/b/bestbybites-76bcd.firebasestorage.app/o/images%2FBEST-BY-BITES-FINAL-LOGO_1765315914209.png?alt=media&token=c0911ce7-c25e-4539-b038-8ea9938e7ddf';

const BATCH_LIMIT = 500;

async function main() {
  initAdmin();
  const db = admin.firestore();
  const snap = await db.collection('learning_videos').get();

  if (snap.empty) {
    console.log('No documents in learning_videos.');
    return;
  }

  let batch = db.batch();
  let batchOps = 0;
  let total = 0;

  for (const doc of snap.docs) {
    batch.update(doc.ref, { thumbnail: THUMBNAIL_URL });
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

  console.log(`Updated thumbnail on ${total} document(s) in learning_videos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
