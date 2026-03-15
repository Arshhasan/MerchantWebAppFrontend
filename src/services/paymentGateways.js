// Payment Gateway Service Utilities
import { loadStripe } from '@stripe/stripe-js';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Initialize Stripe (use publishable key from environment)
const getStripe = () => {
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!stripeKey) {
    console.warn('Stripe publishable key not found in environment variables');
    return null;
  }
  return loadStripe(stripeKey);
};

/**
 * Save payment gateway credentials to Firebase
 * @param {string} userId - User ID
 * @param {string} gateway - Payment gateway name (stripe, paypal, flutterwave)
 * @param {Object} credentials - Gateway-specific credentials
 */
export const savePaymentCredentials = async (userId, gateway, credentials) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const paymentData = {
      [`paymentGateways.${gateway}`]: {
        ...credentials,
        isConnected: true,
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    await updateDoc(userDocRef, paymentData);
    return { success: true };
  } catch (error) {
    console.error('Error saving payment credentials:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get payment gateway credentials from Firebase
 * @param {string} userId - User ID
 * @param {string} gateway - Payment gateway name
 */
export const getPaymentCredentials = async (userId, gateway) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return { success: false, error: 'User document not found' };
    }

    const userData = userDoc.data();
    const paymentGateways = userData.paymentGateways || {};
    const gatewayData = paymentGateways[gateway];

    if (!gatewayData || !gatewayData.isConnected) {
      return { success: false, error: 'Payment gateway not connected' };
    }

    return { success: true, data: gatewayData };
  } catch (error) {
    console.error('Error getting payment credentials:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Disconnect payment gateway
 * @param {string} userId - User ID
 * @param {string} gateway - Payment gateway name
 */
export const disconnectPaymentGateway = async (userId, gateway) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const paymentData = {
      [`paymentGateways.${gateway}.isConnected`]: false,
      [`paymentGateways.${gateway}.disconnectedAt`]: new Date().toISOString(),
    };

    await updateDoc(userDocRef, paymentData);
    return { success: true };
  } catch (error) {
    console.error('Error disconnecting payment gateway:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Stripe-specific functions
 */
export const stripeService = {
  /**
   * Initialize Stripe instance
   */
  init: () => getStripe(),

  /**
   * Create Stripe account link for onboarding
   * This would typically be done via a backend API
   */
  createAccountLink: async (accountId) => {
    // This should call your backend API
    // For now, return a placeholder
    return {
      success: false,
      error: 'Backend API endpoint required for Stripe account creation',
    };
  },

  /**
   * Verify Stripe account connection
   */
  verifyConnection: async (accountId) => {
    // This should call your backend API to verify Stripe account
    return {
      success: false,
      error: 'Backend API endpoint required for Stripe verification',
    };
  },
};

/**
 * PayPal-specific functions
 */
export const paypalService = {
  /**
   * Verify PayPal account connection
   */
  verifyConnection: async (email) => {
    // This should call your backend API to verify PayPal account
    return {
      success: false,
      error: 'Backend API endpoint required for PayPal verification',
    };
  },
};

/**
 * Flutterwave-specific functions
 */
export const flutterwaveService = {
  /**
   * Verify Flutterwave account connection
   */
  verifyConnection: async (accountDetails) => {
    // This should call your backend API to verify Flutterwave account
    return {
      success: false,
      error: 'Backend API endpoint required for Flutterwave verification',
    };
  },
};

export default {
  savePaymentCredentials,
  getPaymentCredentials,
  disconnectPaymentGateway,
  stripeService,
  paypalService,
  flutterwaveService,
};
