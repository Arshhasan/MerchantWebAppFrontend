/**
 * Firebase Cloud Functions for Order OTP System
 * 
 * This file contains Cloud Functions for:
 * 1. Generating OTP when order is accepted
 * 2. Verifying OTP when customer arrives
 */
/* eslint-env node */
/* global require, exports, process */

const path = require('path');
// Load secrets for emulator and any deploy where these files ship with the bundle.
// Production: Firebase CLI / Cloud Console still injects vars into process.env at runtime.
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'sendgrid.env') });
const _gcpProject = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
if (_gcpProject) {
  require('dotenv').config({ path: path.join(__dirname, `.env.${_gcpProject}`) });
}

// Register params so `firebase deploy` binds functions/.env into Gen2 (and related) runtimes.
const { defineString } = require('firebase-functions/params');
defineString('SENDGRID_MAIL_KEY', { default: '' });
defineString('SENDGRID_API_KEY', { default: '' });
defineString('SENDGRID_FROM_EMAIL', { default: '' });
defineString('MERCHANT_APP_ORIGIN', { default: '' });
/** Local/staging only: `reject` | `approve` — bypass Vision; leave empty in production. */
defineString('SURPRISE_BAG_MODERATION_MOCK', { default: '' });

// Use the v1 compatibility API surface (keeps existing `functions.https.onCall` and `functions.firestore.document` working)
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const { runSendLoginEmail } = require('./sendLoginEmail');
const invoiceFromOrder = require('./invoiceFromOrder');
const { sendPickupInvoiceEmails } = require('./pickupEmail');
const { sendOrderCancelledEmails } = require('./cancellationEmail');
const { onSurpriseBagWrite } = require('./bagImageModeration');

/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getOrderVendorCandidates(orderData = {}) {
  return [
    orderData.vendorID,
    orderData.vendor_id,
    orderData.restaurantId,
    orderData.vendor && orderData.vendor.vendorID,
    orderData.vendor && orderData.vendor.author,
    orderData.vendor && orderData.vendor.id,
  ].filter(Boolean);
}

async function assertMerchantOwnsOrder(orderData, authUid, permissionMessage) {
  const userDoc = await db.collection('users').doc(authUid).get();
  const userVendorID = userDoc.exists ? userDoc.data().vendorID : null;

  const merchantCandidates = [userVendorID, authUid].filter(Boolean);
  const orderCandidates = getOrderVendorCandidates(orderData);

  // If there is no vendor information on order, keep legacy behavior and allow.
  if (orderCandidates.length === 0) return;

  const allowed = orderCandidates.some((id) => merchantCandidates.includes(id));
  if (!allowed) {
    throw new functions.https.HttpsError('permission-denied', permissionMessage);
  }
}

/** True when order document status represents a cancelled / rejected order. */
function orderStatusLooksCancelled(data) {
  if (!data || typeof data !== 'object') return false;
  const s = (data.status || '').toString().toLowerCase().trim();
  if (!s) return false;
  if (s.includes('incomplete')) return false;
  return (
    s === 'cancelled'
    || s === 'order cancelled'
    || s === 'canceled'
    || s.includes('cancelled')
    || s.includes('rejected')
    || s.includes('cancel')
  );
}

/**
 * Cloud Function: Accept Order and Generate OTP
 * 
 * Triggered when merchant accepts an order
 * Generates a 6-digit OTP and stores it in the order document
 */
exports.acceptOrder = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to accept orders'
    );
  }

  const { orderId } = data;

  if (!orderId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Order ID is required'
    );
  }

  try {
    const orderRef = db.collection('restaurant_orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Order not found'
      );
    }

    const orderData = orderDoc.data();

    await assertMerchantOwnsOrder(
      orderData,
      context.auth.uid,
      'You do not have permission to accept this order'
    );

    // Normalize status for comparison
    const currentStatus = (orderData.status || '').toLowerCase();
    
    // Check if order is already accepted or completed
    if (currentStatus === 'accepted' || currentStatus === 'completed' || 
        currentStatus === 'order completed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Order is already accepted or completed'
      );
    }

    // Check if order is cancelled
    if (currentStatus === 'cancelled' || currentStatus === 'order cancelled') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Cannot accept a cancelled order'
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const now = admin.firestore.Timestamp.now();
    const expiresAt = new admin.firestore.Timestamp(
      now.seconds + 900, // 15 minutes expiration
      now.nanoseconds
    );

    // Decrement bag stock atomically when accepting the order.
    // Product id in order payload is expected to map to merchant_surprise_bag doc id.
    await db.runTransaction(async (transaction) => {
      const freshOrderDoc = await transaction.get(orderRef);
      if (!freshOrderDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Order not found');
      }

      const freshOrderData = freshOrderDoc.data() || {};
      const freshStatus = (freshOrderData.status || '').toLowerCase();
      if (freshStatus === 'accepted' || freshStatus === 'completed' || freshStatus === 'order completed') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Order is already accepted or completed'
        );
      }
      if (freshStatus === 'cancelled' || freshStatus === 'order cancelled') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Cannot accept a cancelled order'
        );
      }

      const products = Array.isArray(freshOrderData.products) ? freshOrderData.products : [];
      for (const product of products) {
        const bagId = product && (product.id || product.productId || product.bagId || product.surpriseBagId);
        if (!bagId) continue;

        const orderedQty = Math.max(1, parseInt(product.quantity || 1, 10) || 1);
        const bagRef = db.collection('merchant_surprise_bag').doc(String(bagId));
        const bagDoc = await transaction.get(bagRef);
        if (!bagDoc.exists) continue;

        const bagData = bagDoc.data() || {};
        const currentAvailable = Number(bagData.availableQuantity ?? bagData.quantity ?? 0);
        const nextAvailable = currentAvailable - orderedQty;

        if (nextAvailable < 0) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Not enough available quantity for bag ${bagId}`
          );
        }

        transaction.update(bagRef, {
          availableQuantity: nextAvailable,
          updatedAt: now,
        });
      }

      transaction.update(orderRef, {
        status: 'accepted',
        otp: otp,
        otpGeneratedAt: now,
        otpExpiresAt: expiresAt,
        otpVerified: false,
        acceptedAt: now,
        updatedAt: now,
      });
    });

    return {
      success: true,
      orderId: orderId,
      otp: otp, // Return OTP so merchant can see it
      expiresAt: expiresAt.toDate().toISOString(),
      message: 'Order accepted and OTP generated successfully'
    };
  } catch (error) {
    console.error('Error accepting order:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to accept order',
      error.message
    );
  }
});

/**
 * Cloud Function: Reject/Cancel Order
 * 
 * Triggered when merchant rejects an order
 */
exports.rejectOrder = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to reject orders'
    );
  }

  const { orderId, reason } = data;

  if (!orderId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Order ID is required'
    );
  }

  try {
    const orderRef = db.collection('restaurant_orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Order not found'
      );
    }

    const orderData = orderDoc.data();

    await assertMerchantOwnsOrder(
      orderData,
      context.auth.uid,
      'You do not have permission to reject this order'
    );

    // Normalize status for comparison
    const currentStatus = (orderData.status || '').toLowerCase();
    
    // Check if order is already completed
    if (currentStatus === 'completed' || currentStatus === 'order completed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Cannot reject a completed order'
      );
    }

    const now = admin.firestore.Timestamp.now();

    // Update order document (cancellation emails are sent by notifyOnOrderCancelledEmails trigger)
    await orderRef.update({
      status: 'cancelled',
      cancelledAt: now,
      cancelledReason: reason || 'No reason provided',
      rejectionReason: reason || 'No reason provided', // Also store as rejectionReason for frontend compatibility
      cancelledByMerchantUid: context.auth.uid,
      updatedAt: now
    });

    return {
      success: true,
      orderId: orderId,
      message: 'Order rejected successfully'
    };
  } catch (error) {
    console.error('Error rejecting order:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to reject order',
      error.message
    );
  }
});

/**
 * Cloud Function: Verify OTP
 * 
 * Verifies the OTP provided by customer against stored OTP in order document
 */
exports.verifyOTP = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to verify OTP'
    );
  }

  const { orderId, otp } = data;

  if (!orderId || !otp) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Order ID and OTP are required'
    );
  }

  // Validate OTP format (6 digits)
  if (!/^\d{6}$/.test(otp)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'OTP must be a 6-digit number'
    );
  }

  try {
    const orderRef = db.collection('restaurant_orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Order not found'
      );
    }

    const orderData = orderDoc.data();

    await assertMerchantOwnsOrder(
      orderData,
      context.auth.uid,
      'You do not have permission to verify OTP for this order'
    );

    // Normalize status for comparison
    const currentStatus = (orderData.status || '').toLowerCase();

    // Check if order is accepted (auto-accept may store "Order Accepted")
    const acceptedStatuses = new Set(['accepted', 'order accepted']);
    if (!acceptedStatuses.has(currentStatus)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Order must be accepted before OTP can be verified'
      );
    }

    // Check if OTP is already verified
    if (orderData.otpVerified === true) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'OTP has already been verified'
      );
    }

    // Check if OTP exists
    if (!orderData.otp) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No OTP found for this order'
      );
    }

    // Check if OTP is expired
    const now = admin.firestore.Timestamp.now();
    if (orderData.otpExpiresAt && orderData.otpExpiresAt < now) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'OTP has expired. Please generate a new OTP by accepting the order again.'
      );
    }

    // Verify OTP
    if (orderData.otp !== otp) {
      return {
        success: false,
        message: 'Invalid OTP',
        attemptsRemaining: 3 // You can implement attempt tracking if needed
      };
    }

    // OTP is correct - mark order as delivered/completed
    await orderRef.update({
      status: 'Order Completed', // Match frontend expectation
      deliveryStatus: 'delivered', // Additional field for delivery tracking
      otpVerified: true,
      otpVerifiedAt: now,
      pickupVerifiedByMerchantUid: context.auth.uid,
      completedAt: now,
      deliveredAt: now,
      updatedAt: now
    });

    return {
      success: true,
      orderId: orderId,
      message: 'OTP verified successfully. Order marked as delivered.'
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to verify OTP',
      error.message
    );
  }
});

/**
 * Cloud Function: Get Order OTP (for merchant to view)
 * 
 * Allows merchant to retrieve the OTP for an accepted order
 */
exports.getOrderOTP = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { orderId } = data;

  if (!orderId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Order ID is required'
    );
  }

  try {
    const orderDoc = await db.collection('restaurant_orders').doc(orderId).get();

    if (!orderDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Order not found'
      );
    }

    const orderData = orderDoc.data();

    await assertMerchantOwnsOrder(
      orderData,
      context.auth.uid,
      'You do not have permission to view this order'
    );

    // Normalize status for comparison
    const currentStatus = (orderData.status || '').toLowerCase();

    // Check if order is accepted (auto-accept may store "Order Accepted")
    const acceptedStatuses = new Set(['accepted', 'order accepted']);
    if (!acceptedStatuses.has(currentStatus)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Order must be accepted to view OTP'
      );
    }

    // Check if OTP is expired
    const now = admin.firestore.Timestamp.now();
    const isExpired = orderData.otpExpiresAt && orderData.otpExpiresAt < now;

    return {
      success: true,
      otp: orderData.otp,
      expiresAt: orderData.otpExpiresAt ? orderData.otpExpiresAt.toDate().toISOString() : null,
      isExpired: isExpired,
      otpVerified: orderData.otpVerified || false
    };
  } catch (error) {
    console.error('Error getting order OTP:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to get order OTP',
      error.message
    );
  }
});

/**
 * Callable (1st Gen): legacy `sendLoginEmail` — returns failed-precondition (login mail uses client sendSignInLinkToEmail).
 * Kept so old app builds get a clear error instead of functions/not-found.
 */
exports.sendLoginEmail = functions.region('us-central1').https.onCall(async (data) => {
  return runSendLoginEmail(data);
});

/**
 * Firestore Trigger: Sync vendor outlet info to all merchant surprise bags
 *
 * Surprise bags copy vendor meta at creation time (workingHours, location, lat/lng).
 * When vendor outlet information changes, keep all related `merchant_surprise_bag`
 * documents in sync automatically.
 */
exports.syncVendorToSurpriseBags = functions.firestore
  .document('vendors/{vendorId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    // Bags use merchantId == auth uid (vendor.author in this codebase)
    const merchantId = after.author || before.author;
    if (!merchantId) return null;

    // Only sync when relevant vendor fields change to avoid write loops/cost.
    const keys = ['workingHours', 'location', 'latitude', 'longitude'];
    const changed = keys.some((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (!changed) return null;

    const updatePayload = {
      workingHours: Array.isArray(after.workingHours) ? after.workingHours : [],
      location: typeof after.location === 'string' ? after.location : '',
      latitude: typeof after.latitude === 'number' ? after.latitude : null,
      longitude: typeof after.longitude === 'number' ? after.longitude : null,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    const bagsCol = db.collection('merchant_surprise_bag');
    const query = bagsCol.where('merchantId', '==', merchantId);

    let lastDoc = null;
    let totalUpdated = 0;

    // Paginate in chunks to respect batch limits.
    // Firestore batch limit is 500 operations.
    let hasMore = true;
    while (hasMore) {
      let page = query.orderBy(admin.firestore.FieldPath.documentId()).limit(450);
      if (lastDoc) page = page.startAfter(lastDoc);

      const snap = await page.get();
      if (snap.empty) {
        hasMore = false;
        break;
      }

      const batch = db.batch();
      snap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, updatePayload);
      });
      await batch.commit();

      totalUpdated += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    console.log(
      `[syncVendorToSurpriseBags] vendorId=${context.params.vendorId} merchantId=${merchantId} updated=${totalUpdated}`
    );
    return null;
  });

/**
 * Firestore onWrite: moderate surprise bag images when the primary image URL changes.
 * Uses Vision SafeSearch only (adult / violence / racy). Skips when photos are unchanged
 * so vendor sync and moderation field updates do not re-run Vision or loop.
 */
exports.moderateSurpriseBagImage = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .region('us-central1')
  .firestore.document('merchant_surprise_bag/{bagId}')
  .onWrite(onSurpriseBagWrite);

// =============================================================================
// Dashboard KPIs on vendors/{vendorId}.dashboardStats (recomputed from orders)
// =============================================================================

const ORDER_COLLECTION = 'restaurant_orders';

function getOrderLineItemUnitPrice(p) {
  if (!p || typeof p !== 'object') return 0;
  const preferKeys = [
    'offerPrice',
    'discountPrice',
    'restaurantDiscountPrice',
    'salePrice',
    'paidPrice',
    'finalPrice',
    'actualPrice',
  ];
  for (const key of preferKeys) {
    const v = parseFloat(p[key]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  const fallback = parseFloat(p.price ?? p.bagPrice ?? 0);
  return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
}

function computeOrderPayableTotal(order) {
  const products = Array.isArray(order.products) ? order.products : [];
  const subtotal = products.reduce((sum, p) => {
    const qty = parseInt(p.quantity || 1, 10) || 1;
    return sum + getOrderLineItemUnitPrice(p) * qty;
  }, 0);
  const deliveryCharge = parseFloat(order.deliveryCharge || 0);
  const discount = parseFloat(order.discount || 0);
  const tipAmount = parseFloat(order.tip_amount || order.tipAmount || 0);
  const computed = subtotal + deliveryCharge - discount + tipAmount;
  const rawStored = order.totalAmount ?? order.total ?? order.amountPaid;
  const stored = typeof rawStored === 'number' ? rawStored : parseFloat(rawStored);
  if (products.length > 0) {
    const rounded = Math.round(computed * 100) / 100;
    if (Number.isFinite(rounded) && rounded > 0) return rounded;
  }
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored * 100) / 100;
  return Math.round(Math.max(0, computed) * 100) / 100;
}

function getOrderBagQuantity(raw) {
  const products = raw.products || [];
  const sum = products.reduce((acc, p) => acc + parseInt(p.quantity || 1, 10), 0);
  return sum > 0 ? sum : 1;
}

function coerceDate(value) {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getOrderCompletionDate(raw, orderCreatedAt) {
  return (
    coerceDate(raw.completedAt)
    || coerceDate(raw.deliveredAt)
    || coerceDate(raw.otpVerifiedAt)
    || coerceDate(raw.otp_verified_at)
    || coerceDate(raw.updatedAt)
    || coerceDate(raw.completed_at)
    || coerceDate(raw.delivered_at)
    || (orderCreatedAt ? new Date(orderCreatedAt) : null)
  );
}

function getOrderCancellationDate(raw, orderCreatedAt) {
  return (
    coerceDate(raw.cancelledAt)
    || coerceDate(raw.canceledAt)
    || coerceDate(raw.cancelled_at)
    || coerceDate(raw.updatedAt)
    || (orderCreatedAt ? new Date(orderCreatedAt) : null)
  );
}

function isSameDayUtc(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getUTCFullYear() === y.getUTCFullYear()
    && x.getUTCMonth() === y.getUTCMonth()
    && x.getUTCDate() === y.getUTCDate()
  );
}

function isCompleteStatusString(s) {
  const t = (s || '').toString().toLowerCase();
  if (t.includes('incomplete')) return false;
  return (
    t === 'complete'
    || t === 'completed'
    || t === 'order completed'
    || t.includes('completed')
    || t.endsWith(' complete')
  );
}

function isCancelledStatusString(s) {
  return (s || '').toString().toLowerCase().includes('cancel');
}

function orderCreatedAtDate(data) {
  const c = data.createdAt;
  if (c && typeof c.toDate === 'function') return c.toDate();
  if (c && typeof c.seconds === 'number') return new Date(c.seconds * 1000);
  return new Date();
}

function orderStatusNormalized(order) {
  const status = order.status || 'Pending';
  const st = (status || '').toString().trim().toLowerCase();
  if (st.includes('cancel')) return 'Cancelled';
  if (!st.includes('incomplete') && (st.includes('complete') || st === 'complete')) return 'Complete';
  return status;
}

async function fetchMergedOrdersForVendorKey(key) {
  const ref = db.collection(ORDER_COLLECTION);
  const snaps = await Promise.all([
    ref.where('vendor.vendorID', '==', key).get(),
    ref.where('vendor.author', '==', key).get(),
    ref.where('vendor.id', '==', key).get(),
    ref.where('vendorID', '==', key).get(),
    ref.where('vendor_id', '==', key).get(),
  ]);
  const byId = new Map();
  snaps.forEach((snap) => {
    snap.docs.forEach((d) => {
      byId.set(d.id, { ...d.data(), id: d.id });
    });
  });
  return Array.from(byId.values());
}

async function resolveVendorDocRefForKey(key) {
  if (!key || typeof key !== 'string') return null;
  const direct = db.collection('vendors').doc(key);
  const directSnap = await direct.get();
  if (directSnap.exists) return direct;
  const q = await db.collection('vendors').where('author', '==', key).limit(1).get();
  if (!q.empty) return q.docs[0].ref;
  return null;
}

/** Same rules as src/services/adminCommission.js */
async function fetchAdminCommissionSettings() {
  const snap = await db.collection('settings').doc('AdminCommission').get();
  if (!snap.exists) return { isEnabled: false };
  return snap.data() || { isEnabled: false };
}

function merchantNetFromGross(gross, settings) {
  if (typeof gross !== 'number' || !Number.isFinite(gross)) return gross;
  if (!settings || settings.isEnabled !== true) {
    return Math.round(gross * 100) / 100;
  }
  const type = String(settings.commissionType || '').toLowerCase();
  let net;
  if (type.includes('percent')) {
    const pct = Number(settings.commissionValue);
    const p = Number.isFinite(pct) ? Math.max(0, pct) : 0;
    let commission = gross * (p / 100);
    if (commission > gross) commission = gross;
    net = gross - commission;
  } else {
    const fixed = Number(settings.fix_commission ?? settings.commissionValue ?? 0);
    const f = Number.isFinite(fixed) ? Math.max(0, fixed) : 0;
    net = Math.max(0, gross - f);
  }
  return Math.round(net * 100) / 100;
}

function recomputeStatsFromOrders(orders, commissionSettings) {
  const now = new Date();
  let totalEarnings = 0;
  let bagsSoldToday = 0;
  let pendingPickups = 0;
  let cancelledBagsToday = 0;

  orders.forEach((raw) => {
    const qty = getOrderBagQuantity(raw);
    const amount = computeOrderPayableTotal(raw);
    const createdAt = orderCreatedAtDate(raw);
    const statusLabel = orderStatusNormalized(raw);

    const effectivelyComplete = (() => {
      if (isCompleteStatusString(statusLabel)) return true;
      if (raw.otpVerified === true) return true;
      const ds = (raw.deliveryStatus || '').toString().toLowerCase();
      return ds === 'delivered' || ds === 'completed';
    })();
    const effectivelyCancelled = isCancelledStatusString(statusLabel);

    if (effectivelyComplete) totalEarnings += merchantNetFromGross(amount, commissionSettings);
    if (!effectivelyComplete && !effectivelyCancelled) pendingPickups += qty;
    if (effectivelyComplete) {
      const completionDate = getOrderCompletionDate(raw, createdAt);
      if (completionDate && isSameDayUtc(completionDate, now)) {
        bagsSoldToday += qty;
      }
    }
    if (effectivelyCancelled) {
      const cancelDate = getOrderCancellationDate(raw, createdAt);
      if (cancelDate && isSameDayUtc(cancelDate, now)) {
        cancelledBagsToday += qty;
      }
    }
  });

  return {
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    bagsSoldToday,
    pendingPickups,
    cancelledBagsToday,
  };
}

async function recomputeDashboardStatsForVendorKey(key) {
  const vendorRef = await resolveVendorDocRefForKey(key);
  if (!vendorRef) return;
  const [orders, commissionSettings] = await Promise.all([
    fetchMergedOrdersForVendorKey(key),
    fetchAdminCommissionSettings(),
  ]);
  const stats = recomputeStatsFromOrders(orders, commissionSettings);
  await vendorRef.set(
    {
      dashboardStats: {
        ...stats,
        lastComputedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );
  console.log(`[syncVendorDashboardStats] vendors/${vendorRef.id}`, stats);
}

/**
 * Recompute vendors.dashboardStats whenever an order changes.
 * Uses UTC calendar day for "today" metrics (aligns with server clock).
 */
exports.syncVendorDashboardStats = functions.firestore
  .document('restaurant_orders/{orderId}')
  .onWrite(async (change) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const keys = new Set();
    if (before) getOrderVendorCandidates(before).forEach((k) => keys.add(String(k)));
    if (after) getOrderVendorCandidates(after).forEach((k) => keys.add(String(k)));
    await Promise.all(
      Array.from(keys).map((k) =>
        recomputeDashboardStatsForVendorKey(k).catch((err) => {
          console.error('[syncVendorDashboardStats] key=', k, err);
        })
      )
    );
    return null;
  });

/**
 * When an order becomes eligible (completed / OTP verified / delivered), upsert merchant_invoices.
 * Deterministic doc id: inv_{orderId} — idempotent with merge.
 */
exports.syncMerchantInvoiceOnOrderWrite = functions.firestore
  .document('restaurant_orders/{orderId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;
    const orderId = context.params.orderId;
    const data = change.after.data() || {};
    try {
      const wrote = await invoiceFromOrder.writeMerchantInvoice(db, orderId, data);
      if (wrote) {
        console.log('[syncMerchantInvoiceOnOrderWrite] upsert invoice for order', orderId);
      }
    } catch (err) {
      console.error('[syncMerchantInvoiceOnOrderWrite]', orderId, err);
    }
    return null;
  });

/**
 * SendGrid: when an order first moves to cancelled/rejected, email customer + merchant.
 * Covers rejectOrder callable and any client/admin that updates Firestore directly.
 */
exports.notifyOnOrderCancelledEmails = functions.firestore
  .document('restaurant_orders/{orderId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;
    const orderId = context.params.orderId;
    const before = change.before.exists ? change.before.data() || {} : {};
    const after = change.after.data() || {};
    if (after.cancellationNotificationEmailsSent === true) return null;
    if (!orderStatusLooksCancelled(after)) return null;
    if (change.before.exists && orderStatusLooksCancelled(before)) return null;
    const merchantUidHint =
      after.cancelledByMerchantUid ||
      after.cancelledByUid ||
      before.cancelledByMerchantUid ||
      '';
    try {
      await sendOrderCancelledEmails(
        db,
        orderId,
        after,
        String(merchantUidHint || ''),
        after.cancelledReason || after.rejectionReason || ''
      );
    } catch (err) {
      console.error('[notifyOnOrderCancelledEmails]', orderId, err);
    }
    return null;
  });

/**
 * SendGrid: after OTP pickup, email customer + merchant with PDF invoice (idempotent via pickupNotificationEmailsSent).
 */
exports.notifyOnOrderPickupEmails = functions.firestore
  .document('restaurant_orders/{orderId}')
  .onUpdate(async (change, context) => {
    if (!change.after.exists) return null;
    const orderId = context.params.orderId;
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    if (after.pickupNotificationEmailsSent === true) return null;
    if (after.otpVerified !== true) return null;
    if (before.otpVerified === true) return null;
    const merchantUidHint =
      after.pickupVerifiedByMerchantUid ||
      after.otpVerifiedByUid ||
      '';
    try {
      await sendPickupInvoiceEmails(db, orderId, after, String(merchantUidHint || ''));
    } catch (err) {
      console.error('[notifyOnOrderPickupEmails]', orderId, err);
    }
    return null;
  });

// =============================================================================
// FCM: notify customer when merchant sends a chat_merchant thread message
// Admin SDK only. Skips customerId === "admin".
// =============================================================================

exports.onChatMerchantThreadMessageCreate = functions.firestore
  .document('chat_merchant/{conversationId}/thread/{messageId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const { conversationId } = context.params;
    const senderId = data.senderId;
    if (!senderId || !conversationId) return null;

    const convRef = db.collection('chat_merchant').doc(conversationId);
    const convDoc = await convRef.get();
    if (!convDoc.exists) return null;

    const conv = convDoc.data() || {};
    const merchantId = conv.merchantId;
    const customerId = conv.customerId;
    if (senderId !== merchantId) return null;
    if (!customerId || customerId === 'admin') return null;

    const bodyText = (data.text || 'New message').toString().slice(0, 200);
    const title = (conv.merchantName || data.senderName || 'Store').toString().slice(0, 100);

    const userDoc = await db.collection('users').doc(String(customerId)).get();
    if (!userDoc.exists) return null;

    const u = userDoc.data() || {};
    const tokens = [u.fcmToken, u.fcmTokenWeb].filter((t) => typeof t === 'string' && t.length > 0);

    if (tokens.length === 0) return null;

    const messaging = admin.messaging();
    await Promise.all(
      tokens.map(async (token) => {
        try {
          await messaging.send({
            token,
            notification: { title, body: bodyText },
            data: {
              type: 'chat_merchant',
              conversationId: String(conversationId),
              title,
              body: bodyText,
            },
          });
        } catch (err) {
          console.warn(
            '[onChatMerchantThreadMessageCreate] FCM failed',
            token.substring(0, 16),
            err.message || err
          );
        }
      })
    );

    return null;
  });

// =============================================================================
// FCM: notify merchant when admin sends a chat_admin thread message (senderId !== merchant uid)
// =============================================================================

exports.onChatAdminThreadMessageCreate = functions.firestore
  .document('chat_admin/{merchantId}/thread/{messageId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const { merchantId } = context.params;
    const senderId = data.senderId;
    if (!senderId || !merchantId) return null;
    if (String(senderId) === String(merchantId)) return null;

    const bodyText = (data.text || data.message || 'New message').toString().slice(0, 200);
    const title = (data.senderName || 'Support').toString().slice(0, 100);

    const userDoc = await db.collection('users').doc(String(merchantId)).get();
    if (!userDoc.exists) return null;

    const u = userDoc.data() || {};
    const tokens = [u.fcmToken, u.fcmTokenWeb].filter((t) => typeof t === 'string' && t.length > 0);

    if (tokens.length === 0) return null;

    const messaging = admin.messaging();
    await Promise.all(
      tokens.map(async (token) => {
        try {
          await messaging.send({
            token,
            notification: { title, body: bodyText },
            data: {
              type: 'chat_admin',
              merchantId: String(merchantId),
              title,
              body: bodyText,
            },
          });
        } catch (err) {
          console.warn(
            '[onChatAdminThreadMessageCreate] FCM failed',
            token.substring(0, 16),
            err.message || err
          );
        }
      })
    );

    return null;
  });

// =============================================================================
// Weekly auto payout_request documents (scheduled; merchants do not see type=auto in app)
// Cron: minute hour dom month dow — Wednesday 09:10 UTC (dow 3 = Wed in standard cron)
// =============================================================================

const { runWeeklyAutoPayoutScan } = require('./weeklyAutoPayout');

// exports.scheduledWeeklyAutoPayoutRequests = functions.pubsub
//   .schedule('10 9 * * 3')
//   .timeZone('Etc/UTC')
//   .onRun(async () => {
//     try {
//       const res = await runWeeklyAutoPayoutScan(db);
//       console.log('[scheduledWeeklyAutoPayoutRequests]', JSON.stringify(res));
//     } catch (err) {
//       console.error('[scheduledWeeklyAutoPayoutRequests]', err);
//     }
//     return null;
//   });
exports.scheduledWeeklyAutoPayoutRequests = functions
  .region('us-central1')
  .pubsub.schedule('10 9 * * 3')
  .timeZone('Etc/UTC')
  .onRun(async () => {
    try {
      const res = await runWeeklyAutoPayoutScan(db);
      console.log('[scheduledWeeklyAutoPayoutRequests]', JSON.stringify(res));
    } catch (err) {
      console.error('[scheduledWeeklyAutoPayoutRequests]', err);
    }
    return null;
  });

// =============================================================================
// Welcome email (SendGrid, HTML + logo) when onboarding completes:
// Firestore doc has valid `email` + store `title` and `welcomeEmailSent` is not true.
// Uses onDocumentWritten so emails fire after OutletInformation (not the stub vendor create).
// Env: SENDGRID_MAIL_KEY, MERCHANT_APP_ORIGIN (e.g. https://host/merchant) for logo + dashboard URL
// =============================================================================

const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const { getSendgridApiKey } = require('./sendgridEnv');
const {
  sendWelcomeEmail,
  extractDisplayName,
  isEligibleForWelcomeEmail,
  isValidEmail,
  resolveWelcomeRecipientEmail,
} = require('./welcomeEmail');

function buildWelcomeWriteTriggerOptions(documentPath) {
  return {
    document: documentPath,
    region: 'us-central1',
  };
}

/**
 * Read fresh Firestore data and send welcome email via SendGrid.
 * Does not rely on v2 Firestore event snapshot shape (avoids missed sends when event.data is wrong).
 * @param {string} collectionName
 * @param {string} docId
 * @returns {Promise<{ ok: boolean, reason?: string, message?: string }>}
 */
async function processWelcomeEmailForMerchantDoc(collectionName, docId) {
  const logLabel = `${collectionName}/${docId}`;
  const apiKey = getSendgridApiKey();
  if (!apiKey) {
    console.error(
      '[welcomeEmail] Missing SENDGRID_MAIL_KEY or SENDGRID_API_KEY — set in functions/.env, sendgrid.env, or Cloud runtime',
      { logLabel }
    );
    return { ok: false, reason: 'no_api_key' };
  }

  let after;
  try {
    const snap = await db.collection(collectionName).doc(docId).get();
    if (!snap.exists) {
      console.log('[welcomeEmail] skip: document missing', { logLabel });
      return { ok: false, reason: 'missing_doc' };
    }
    after = snap.data();
  } catch (readErr) {
    console.error('[welcomeEmail] read failed', { logLabel, message: readErr.message });
    return { ok: false, reason: 'read_failed', message: readErr.message };
  }

  if (!isEligibleForWelcomeEmail(after)) {
    console.log('[welcomeEmail] skip: not eligible yet', {
      logLabel,
      welcomeEmailSent: after && after.welcomeEmailSent === true,
      hasValidEmailOnVendor: !!(after && isValidEmail(after.email)),
      hasTitle: !!(after && String(after.title || '').trim()),
      hasAuthor: !!(after && after.author),
    });
    return { ok: false, reason: 'not_eligible' };
  }

  const resolved = await resolveWelcomeRecipientEmail(admin.auth(), db, after);
  if (!resolved || !resolved.email) {
    console.log('[welcomeEmail] skip: no recipient email (vendor doc, users doc, and Auth)', {
      logLabel,
      author: after && after.author ? String(after.author) : null,
    });
    return { ok: false, reason: 'no_recipient' };
  }

  const { email, source: emailSource } = resolved;
  const name = extractDisplayName(after);
  const storeTitle = String(after.title || '').trim();
  const storeName = storeTitle || name;

  try {
    const sgResult = await sendWelcomeEmail(apiKey, {to: email, name, storeName});
    const updates = {
      welcomeEmailSent: true,
      welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (sgResult && sgResult.messageId) {
      updates.welcomeEmailSendGridMessageId = sgResult.messageId;
    }
    if (emailSource !== 'vendor' && !isValidEmail(after.email)) {
      updates.email = email;
    }
    await db.collection(collectionName).doc(docId).update(updates);
    console.log('[welcomeEmail] Sent', {
      logLabel,
      email,
      name,
      emailSource,
      sendGridMessageId: sgResult && sgResult.messageId,
    });
    return { ok: true };
  } catch (err) {
    console.error('[welcomeEmail] Failed', {
      logLabel,
      email,
      message: err && err.message,
    });
    return { ok: false, reason: 'send_failed', message: err.message };
  }
}

/**
 * @param {*} event Firestore onDocumentWritten event
 * @param {string} collectionName
 * @param {string} idParam
 * @returns {Promise<void>}
 */
async function runWelcomeOnMerchantDocWrite(event, collectionName, idParam) {
  const docId = event.params[idParam];
  await processWelcomeEmailForMerchantDoc(collectionName, docId);
}

/**
 * Callable: merchant taps "Resend welcome email" — runs same SendGrid path as the Firestore trigger.
 */
exports.requestMerchantWelcomeEmail = functions.region('us-central1').https.onCall(async (data, context) => {
  void data;
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  const uid = context.auth.uid;
  const userSnap = await db.collection('users').doc(uid).get();
  const vendorId = userSnap.exists && userSnap.data().vendorID;
  if (!vendorId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No store is linked to this account yet.'
    );
  }
  const vSnap = await db.collection('vendors').doc(vendorId).get();
  if (!vSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Store profile not found.');
  }
  const v = vSnap.data();
  if (String(v.author || '') !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not allowed.');
  }

  const result = await processWelcomeEmailForMerchantDoc('vendors', vendorId);
  if (result.reason === 'no_api_key') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Email service is not configured (SendGrid API key missing on the server).'
    );
  }
  if (result.reason === 'not_eligible') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Welcome email was already sent, or your store still needs a title and email on the outlet profile.'
    );
  }
  if (result.reason === 'no_recipient') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No email address found for this store. Add it under Profile → Outlet information.'
    );
  }
  if (result.reason === 'send_failed') {
    throw new functions.https.HttpsError(
      'internal',
      result.message || 'SendGrid could not send the email. Check SendGrid activity and suppressions.'
    );
  }
  if (!result.ok) {
    throw new functions.https.HttpsError(
      'internal',
      result.message || 'Welcome email could not be sent.'
    );
  }
  return { success: true };
});

exports.sendWelcomeEmailOnVendorWrite = onDocumentWritten(
  buildWelcomeWriteTriggerOptions('vendors/{vendorId}'),
  (event) => runWelcomeOnMerchantDocWrite(event, 'vendors', 'vendorId')
);

exports.sendWelcomeEmailOnStoreWrite = onDocumentWritten(
  buildWelcomeWriteTriggerOptions('stores/{storeId}'),
  (event) => runWelcomeOnMerchantDocWrite(event, 'stores', 'storeId')
);

exports.sendWelcomeEmailOnMerchantWrite = onDocumentWritten(
  buildWelcomeWriteTriggerOptions('merchants/{merchantId}'),
  (event) => runWelcomeOnMerchantDocWrite(event, 'merchants', 'merchantId')
);