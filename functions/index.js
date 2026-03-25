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
    
    // Check if order is accepted
    if (currentStatus !== 'accepted') {
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
    
    // Check if order is accepted
    if (currentStatus !== 'accepted') {
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