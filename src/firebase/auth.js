// Firebase Authentication utilities
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Create or update user document in Firestore
 * @param {Object} user - Firebase Auth user object
 * @param {Object} additionalData - Additional user data (firstName, lastName, phone, etc.)
 * @returns {Promise}
 */
export const createUserDocument = async (user, additionalData = {}) => {
  if (!user) return { success: false, error: 'No user provided' };

  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    // Determine provider
    const providerId = user.providerData?.[0]?.providerId;
    let provider = 'email';
    if (providerId === 'google.com') {
      provider = 'google';
    } else if (providerId === 'password') {
      provider = 'email';
    } else if (additionalData.provider) {
      provider = additionalData.provider;
    }

    // Prepare user data
    const userData = {
      email: user.email || null,
      firstName: additionalData.firstName || null,
      lastName: additionalData.lastName || null,
      phoneNumber: additionalData.phoneNumber || null,
      countryCode: additionalData.countryCode || null,
      profilePictureURL: user.photoURL || null,
      provider: provider,
      role: 'merchant', // Always merchant for this app
      appIdentifier: 'web', // Always web for this merchant web app
      active: true,
      isActive: true,
      isDocumentVerify: false,
      zoneId: '',
      createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!userDocSnap.exists()) {
      // Create new document
      await setDoc(userDocRef, userData);
      return { success: true, isNew: true };
    } else {
      // Update existing document (in case user signs in from different app)
      const existingData = userDocSnap.data();
      const updateData = {
        ...userData,
        // Preserve existing createdAt
        createdAt: existingData.createdAt,
      };
      
      // If user already has merchant role, keep it; otherwise update
      if (existingData.role !== 'merchant') {
        updateData.role = 'merchant';
      }
      
      await updateDoc(userDocRef, updateData);
      return { success: true, isNew: false };
    }
  } catch (error) {
    console.error('Error creating user document:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise} - User credential
 */
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Register a new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - User display name (optional)
 * @param {Object} additionalData - Additional user data (firstName, lastName, phone, countryCode)
 * @returns {Promise} - User credential
 */
export const register = async (email, password, displayName = null, additionalData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile if displayName is provided
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    
    // Create user document in Firestore
    const userDocResult = await createUserDocument(userCredential.user, {
      ...additionalData,
      provider: 'email',
    });

    if (!userDocResult.success) {
      console.error('Failed to create user document:', userDocResult.error);
      // Don't fail registration if document creation fails, but log it
    }
    
    // Send email verification
    if (userCredential.user) {
      await sendEmailVerification(userCredential.user);
    }
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Sign out the current user
 * @returns {Promise}
 */
export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise}
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get the current authenticated user
 * @returns {Object|null} - Current user or null
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Listen to authentication state changes
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Function} - Unsubscribe function
 */
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Update user profile
 * @param {Object} updates - Profile updates (displayName, photoURL, etc.)
 * @returns {Promise}
 */
export const updateUserProfile = async (updates) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: "No user is currently signed in" };
    }
    await updateProfile(user, updates);
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Sign in with Google
 * @returns {Promise} - User credential
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // This gives you a Google Access Token. You can use it to access the Google API.
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    // The signed-in user info.
    const user = result.user;

    // Check if this is a new user (first time signing in)
    const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;

    // Extract name from displayName
    const displayName = user.displayName || '';
    const nameParts = displayName.split(' ');
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ') || null;

    // Create or update user document in Firestore
    const userDocResult = await createUserDocument(user, {
      firstName: firstName,
      lastName: lastName,
      provider: 'google',
    });

    if (!userDocResult.success) {
      console.error('Failed to create/update user document:', userDocResult.error);
    }

    return { success: true, user, token, isNewUser };
  } catch (error) {
    // Handle Errors here.
    const errorCode = error.code;
    const errorMessage = error.message;
    // The email of the user's account used.
    const email = error.customData?.email;
    // The AuthCredential type that was used.
    const credential = GoogleAuthProvider.credentialFromError(error);
    
    return { 
      success: false, 
      error: errorMessage,
      errorCode,
      email,
      credential 
    };
  }
};

/**
 * Create a reCAPTCHA verifier for Firebase Phone Auth.
 * NOTE: You must render a div with the given containerId in the DOM.
 * @param {string} containerId
 * @param {Object} options - Options for reCAPTCHA (size: 'invisible' or 'normal')
 * @returns {RecaptchaVerifier}
 */
export const createRecaptchaVerifier = (containerId = "recaptcha-container", options = {}) => {
  // Use visible reCAPTCHA v2 for better reliability with real phone numbers
  // Invisible reCAPTCHA requires Enterprise API which may not be properly configured
  const defaultOptions = {
    size: options.size || "normal", // Changed from "invisible" to "normal" for better compatibility
    callback: options.callback || (() => {}),
    'expired-callback': options['expired-callback'] || (() => {}),
  };
  
  return new RecaptchaVerifier(auth, containerId, {
    ...defaultOptions,
    ...options,
  });
};

/**
 * Send OTP to a phone number using Firebase Phone Auth.
 * @param {string} phoneNumberE164 - Full phone number in E.164 format, e.g. +14155552671
 * @param {RecaptchaVerifier} appVerifier
 */
export const sendPhoneOtp = async (phoneNumberE164, appVerifier) => {
  try {
    // Verify appVerifier is valid
    if (!appVerifier) {
      return { 
        success: false, 
        error: 'Security verification not initialized. Please refresh the page.', 
        errorCode: 'auth/captcha-not-initialized' 
      };
    }

    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumberE164, appVerifier);
    return { success: true, confirmationResult };
  } catch (error) {
    // Log full error details for debugging
    console.error('Firebase Phone Auth Error:', {
      code: error.code,
      message: error.message,
      phoneNumber: phoneNumberE164,
    });

    // Provide user-friendly error messages
    let userMessage = error.message;
    
    if (error.code === 'auth/invalid-app-credential' || error.message?.includes('INVALID_APP_CREDENTIAL')) {
      userMessage = 'Firebase configuration error. Please check:\n1. reCAPTCHA Enterprise API is enabled in Google Cloud Console\n2. API key restrictions allow Identity Toolkit API\n3. Domain is authorized in Firebase Console';
    } else if (error.code === 'auth/captcha-check-failed') {
      userMessage = 'reCAPTCHA verification failed. Please complete the reCAPTCHA checkbox and try again.';
    } else if (error.code === 'auth/too-many-requests' || error.message?.includes('TOO_MANY_ATTEMPTS')) {
      userMessage = 'Too many verification attempts. Please wait 5-30 minutes before trying again, or use a different phone number.';
    } else if (error.code === 'auth/invalid-phone-number') {
      userMessage = 'Invalid phone number format. Please check and try again.';
    } else if (error.code === 'auth/quota-exceeded') {
      userMessage = 'SMS quota exceeded. Please try again later or contact support.';
    } else if (error.code === 'auth/session-expired') {
      userMessage = 'Session expired. Please refresh the page and try again.';
    }

    return { 
      success: false, 
      error: userMessage, 
      errorCode: error.code,
      originalError: error.message 
    };
  }
};
