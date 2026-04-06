/**
 * Weekly auto payout_request creation (Firestore).
 * Scheduled weekly (default: Wednesday 09:10 UTC — see functions/index.js); merchants do not trigger from the app.
 *
 * Preconditions: vendors/{id} should maintain wallet_balance (or wallet.walletBalance).
 * Skips merchants with any payout_requests in pending/processing (manual or auto).
 * Idempotent per week via weekRangeLabel (UTC Mon–Sun).
 */

const admin = require('firebase-admin');

const PAYOUT_REQUESTS = 'payout_requests';

function walletBalanceFromVendor(data) {
  if (!data || typeof data !== 'object') return 0;
  const raw =
    data.wallet_balance ??
    data.walletBalance ??
    (data.wallet && (data.wallet.walletBalance ?? data.wallet.balance));
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function utcMondaySundayRange(now = new Date()) {
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = ref.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  ref.setUTCDate(ref.getUTCDate() + delta);
  const monday = new Date(ref);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  const label = `${monday.toISOString().slice(0, 10)}_${sunday.toISOString().slice(0, 10)}`;
  return {
    label,
    weekRangeStart: admin.firestore.Timestamp.fromDate(monday),
    weekRangeEnd: admin.firestore.Timestamp.fromDate(sunday),
  };
}

async function merchantHasOpenPayout(db, merchantId) {
  const snap = await db.collection(PAYOUT_REQUESTS).where('merchantId', '==', merchantId).get();
  for (const doc of snap.docs) {
    const s = (doc.data().status || 'pending').toString().trim().toLowerCase();
    if (s === 'pending' || s === 'processing') return true;
  }
  return false;
}

async function hasAutoForWeek(db, merchantId, weekLabel) {
  const q = await db
    .collection(PAYOUT_REQUESTS)
    .where('merchantId', '==', merchantId)
    .where('type', '==', 'auto')
    .where('weekRangeLabel', '==', weekLabel)
    .limit(1)
    .get();
  return !q.empty;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<{ created: number, skipped: number, weekLabel: string }>}
 */
async function runWeeklyAutoPayoutScan(db) {
  const { label, weekRangeStart, weekRangeEnd } = utcMondaySundayRange();
  let created = 0;
  let skipped = 0;

  const vendorsSnap = await db.collection('vendors').get();

  for (const vDoc of vendorsSnap.docs) {
    const merchantId = vDoc.id;
    const amount = walletBalanceFromVendor(vDoc.data());
    if (amount <= 0) {
      skipped += 1;
      continue;
    }
    if (await merchantHasOpenPayout(db, merchantId)) {
      skipped += 1;
      continue;
    }
    if (await hasAutoForWeek(db, merchantId, label)) {
      skipped += 1;
      continue;
    }

    await db.collection(PAYOUT_REQUESTS).add({
      merchantId,
      amount,
      totalAmount: amount,
      status: 'pending',
      type: 'auto',
      weekRangeLabel: label,
      weekRangeStart,
      weekRangeEnd,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      orderIds: [],
    });
    created += 1;
  }

  return { created, skipped, weekLabel: label };
}

module.exports = { runWeeklyAutoPayoutScan, utcMondaySundayRange };
