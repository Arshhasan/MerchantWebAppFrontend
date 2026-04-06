/**
 * Seeds 30 documents into Firestore `learning_videos` for UI testing.
 *
 * Credentials (pick one):
 *   1. Place Firebase service account JSON at scripts/serviceAccount.json (gitignored), or
 *   2. In .env or .env.local at project root, set:
 *        GOOGLE_APPLICATION_CREDENTIALS=./scripts/serviceAccount.json
 *      (download key: Firebase Console → Project settings → Service accounts → Generate new private key)
 *   3. Or export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json
 *   4. Or export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   5. Or run: gcloud auth application-default login   (then uses ADC if project matches)
 *
 * Run: npm run seed:learning-videos
 */
import { Timestamp } from 'firebase-admin/firestore';
import { initAdmin, admin } from './firebaseAdminInit.mjs';
import { thumbnailForIndex } from './learningVideoThumbnails.mjs';

const SAMPLE_VIDEO_URL =
  'https://firebasestorage.googleapis.com/v0/b/bestbybites-76bcd.firebasestorage.app/o/LearningVideos%2Ftestvideo1.mp4?alt=media&token=ddbe4d11-ee4f-4873-9617-de249ef0d3e6';

const CATEGORIES = ['Getting Started', 'Customer Experience', 'Orders & payouts', 'Growth tips'];

const TITLES = [
  'Welcome to Best By Bites',
  'Set up your store profile',
  'Create your first Surprise Bag',
  'Price and schedule bags',
  'Understanding order notifications',
  'Prepare orders for pickup',
  'Handle customer ratings',
  'Refund and complaint basics',
  'Payouts and wallet overview',
  'Promotions and offers',
  'Surprise Bag best practices',
  'Reduce food waste tips',
  'Photography for your listings',
  'Opening hours and closures',
  'Staff roles overview',
  'Chat with customers',
  'Analytics dashboard tour',
  'Holiday and peak planning',
  'Allergen and dietary notes',
  'Pickup window settings',
  'Cancellation policies',
  'Tax and invoicing basics',
  'Multi-location overview',
  'Inventory sync tips',
  'Customer loyalty ideas',
  'Social media checklist',
  'Learning Centre overview',
  'FAQ for new merchants',
  'Support and help centre',
  'Safety and hygiene',
  'Next steps after onboarding',
];

async function main() {
  initAdmin();
  const db = admin.firestore();
  const col = db.collection('learning_videos');
  const batch = db.batch();
  const now = new Date();

  for (let i = 0; i < 30; i += 1) {
    const ref = col.doc();
    const created = Timestamp.fromDate(new Date(now.getTime() - i * 3600_000));
    batch.set(ref, {
      CreatedAt: created,
      category: CATEGORIES[i % CATEGORIES.length],
      isActive: true,
      thumbnail: thumbnailForIndex(i),
      videoTitle: TITLES[i] || `Sample video ${i + 1}`,
      videoUrl: SAMPLE_VIDEO_URL,
    });
  }

  await batch.commit();
  console.log('Wrote 30 documents to learning_videos.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
