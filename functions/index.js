/**
 * Firebase Cloud Functions for Order OTP System
 * 
 * This file contains Cloud Functions for:
 * 1. Generating OTP when order is accepted
 * 2. Verifying OTP when customer arrives
 */
/* eslint-env node */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    // Verify merchant owns this order (if vendorID is set)
    if (orderData.vendorID) {
      const userDoc = await db.collection('users').doc(context.auth.uid).get();
      const userVendorID = userDoc.exists ? userDoc.data().vendorID : null;
      
      if (userVendorID !== orderData.vendorID) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to accept this order'
        );
      }
    }
    // If vendorID is not set on order, allow any authenticated merchant to accept

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

    // Update order document
    await orderRef.update({
      status: 'accepted',
      otp: otp,
      otpGeneratedAt: now,
      otpExpiresAt: expiresAt,
      otpVerified: false,
      acceptedAt: now,
      updatedAt: now
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

    // Verify merchant owns this order (if vendorID is set)
    if (orderData.vendorID) {
      const userDoc = await db.collection('users').doc(context.auth.uid).get();
      const userVendorID = userDoc.exists ? userDoc.data().vendorID : null;
      
      if (userVendorID !== orderData.vendorID) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to reject this order'
        );
      }
    }
    // If vendorID is not set on order, allow any authenticated merchant to reject

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

    // Verify merchant owns this order (if vendorID is set)
    if (orderData.vendorID) {
      const userDoc = await db.collection('users').doc(context.auth.uid).get();
      const userVendorID = userDoc.exists ? userDoc.data().vendorID : null;
      
      if (userVendorID !== orderData.vendorID) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to verify OTP for this order'
        );
      }
    }
    // If vendorID is not set on order, allow any authenticated merchant to verify

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

    // OTP is correct - mark order as completed
    await orderRef.update({
      status: 'Order Completed', // Match frontend expectation
      otpVerified: true,
      otpVerifiedAt: now,
      completedAt: now,
      updatedAt: now
    });

    return {
      success: true,
      orderId: orderId,
      message: 'OTP verified successfully. Order marked as completed.'
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

    // Verify merchant owns this order (if vendorID is set)
    if (orderData.vendorID) {
      const userDoc = await db.collection('users').doc(context.auth.uid).get();
      const userVendorID = userDoc.exists ? userDoc.data().vendorID : null;
      
      if (userVendorID !== orderData.vendorID) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to view this order'
        );
      }
    }
    // If vendorID is not set on order, allow any authenticated merchant to view

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
