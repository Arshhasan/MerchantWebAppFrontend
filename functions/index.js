/**
 * Firebase Cloud Functions for Order OTP System
 * 
 * This file contains Cloud Functions for:
 * 1. Generating OTP when order is accepted
 * 2. Verifying OTP when customer arrives
 */
/* eslint-env node */
/* global require, exports */

// Use the v1 compatibility API surface (keeps existing `functions.https.onCall` and `functions.firestore.document` working)
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

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

    // Update order document
    await orderRef.update({
      status: 'cancelled',
      cancelledAt: now,
      cancelledReason: reason || 'No reason provided',
      rejectionReason: reason || 'No reason provided', // Also store as rejectionReason for frontend compatibility
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

function recomputeStatsFromOrders(orders) {
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

    if (effectivelyComplete) totalEarnings += amount;
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
  const orders = await fetchMergedOrdersForVendorKey(key);
  const stats = recomputeStatsFromOrders(orders);
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