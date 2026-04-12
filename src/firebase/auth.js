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
  FacebookAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./config";
import { clearDashboardWithoutForcedOnboarding } from "../utils/existingMerchantSession";

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Facebook Auth Provider
const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');

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

    const emailForVendor =
      user.email || additionalData.email || null;
    const vendorIdForEmailSync =
      additionalData.vendorID ||
      (userDocSnap.exists() ? userDocSnap.data()?.vendorID : null);

    const syncEmailToVendor = async () => {
      if (!vendorIdForEmailSync || !emailForVendor) return;
      try {
        await setDoc(
          doc(db, "vendors", vendorIdForEmailSync),
          { email: emailForVendor, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.warn("Could not mirror email to vendors document:", e);
      }
    };

    if (!userDocSnap.exists()) {
      // Create new document
      await setDoc(userDocRef, userData);
      await syncEmailToVendor();
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
      await syncEmailToVendor();
      return { success: true, isNew: false };
    }
  } catch (error) {
    console.error('Error creating user document:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Build a clean, modern welcome email HTML template.
 * Keep inline styles for maximum email client compatibility.
 */
const buildWelcomeEmailHtml = ({
  appName,
  firstName,
  displayName,
  ctaUrl,
  ctaText = "Get Started",
}) => {
  const safeAppName = appName || "BestBy Bites";
  const safeName =
    firstName ||
    (displayName ? displayName.split(" ")[0] : null) ||
    "there";
  const safeCtaUrl = ctaUrl || "https://example.com";

  return `
  <div style="background:#f6f7fb;padding:32px 12px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e9ecf5;">
      <div style="background:linear-gradient(135deg,#111827,#1f2937);padding:28px 28px 22px;">
        <div style="font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.7);">
          Welcome to
        </div>
        <div style="margin-top:6px;font-size:26px;line-height:1.2;color:#ffffff;font-weight:800;">
          ${safeAppName}
        </div>
      </div>

      <div style="padding:28px;">
        <h1 style="margin:0 0 10px;font-size:20px;line-height:1.35;color:#111827;">
          Hi ${safeName},
        </h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">
          Thanks for creating your merchant account. We’re excited to have you onboard.
        </p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#374151;">
          You can now set up your profile, start listing your offers, and reach new customers—while reducing food waste.
        </p>

        <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa;margin:0 0 18px;">
          <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">Quick tip</div>
          <div style="font-size:14px;color:#111827;line-height:1.55;">
            Complete your store details first—customers trust profiles with clear info and photos.
          </div>
        </div>

        <div style="text-align:center;margin:22px 0 8px;">
          <a href="${safeCtaUrl}"
             style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;font-size:14px;">
            ${ctaText}
          </a>
        </div>

        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7280;text-align:center;">
          If the button doesn’t work, copy and paste this link into your browser:<br/>
          <span style="word-break:break-all;color:#4b5563;">${safeCtaUrl}</span>
        </p>
      </div>

      <div style="padding:18px 28px;background:#ffffff;border-top:1px solid #eef0f6;">
        <div style="font-size:12px;color:#6b7280;line-height:1.6;">
          You’re receiving this email because you created an account at ${safeAppName}.
        </div>
      </div>
    </div>
  </div>
  `.trim();
};

/**
 * Enqueue a welcome email using Firebase "Trigger Email" Extension.
 * Writes a document to the `mail` collection.
 */
export const enqueueWelcomeEmail = async ({
  to,
  firstName = null,
  displayName = null,
}) => {
  if (!to) return { success: false, error: "Missing recipient email" };

  const appName = import.meta.env.VITE_APP_NAME || "BestBy Bites";
  const ctaUrl = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const subject = `Welcome to ${appName}`;

  const html = buildWelcomeEmailHtml({
    appName,
    firstName,
    displayName,
    ctaUrl,
    ctaText: "Get Started",
  });

  const text = `Welcome to ${appName}!\n\nHi ${firstName || (displayName ? displayName.split(" ")[0] : "there")},\n\nThanks for creating your merchant account. Get started here: ${ctaUrl}\n`;

  try {
    const mailRef = await addDoc(collection(db, "mail"), {
      to,
      message: {
        subject,
        html,
        text,
      },
      // optional metadata you can use for debugging/filtering
      createdByUid: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
    });

    return { success: true, id: mailRef.id };
  } catch (error) {
    console.error("Failed to enqueue welcome email:", error);
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

    // Enqueue welcome email (Trigger Email Extension)
    // This runs client-side only (no backend) by writing to Firestore `mail` collection.
    if (userCredential.user?.email) {
      const mailResult = await enqueueWelcomeEmail({
        to: userCredential.user.email,
        firstName: additionalData.firstName || null,
        displayName: displayName || userCredential.user.displayName || null,
      });
      if (!mailResult.success) {
        // Don't fail registration if email enqueue fails, but log it
        console.error("Failed to enqueue welcome email:", mailResult.error);
      }
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
    clearDashboardWithoutForcedOnboarding();
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

    // If this is a brand new user, enqueue welcome email
    if (isNewUser && user?.email) {
      await enqueueWelcomeEmail({
        to: user.email,
        firstName,
        displayName: user.displayName || null,
      });
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
 * Sign in with Facebook
 * @returns {Promise} - User credential
 */
export const signInWithFacebook = async () => {
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    // This gives you a Facebook Access Token. You can use it to access the Facebook API.
    const credential = FacebookAuthProvider.credentialFromResult(result);
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
      provider: 'facebook',
    });

    if (!userDocResult.success) {
      console.error('Failed to create/update user document:', userDocResult.error);
    }

    // If this is a brand new user, enqueue welcome email
    if (isNewUser && user?.email) {
      await enqueueWelcomeEmail({
        to: user.email,
        firstName,
        displayName: user.displayName || null,
      });
    }

    return { success: true, user, token, isNewUser };
  } catch (error) {
    // Handle Errors here.
    const errorCode = error.code;
    const errorMessage = error.message;
    // The email of the user's account used.
    const email = error.customData?.email;
    // The AuthCredential type that was used.
    const credential = FacebookAuthProvider.credentialFromError(error);
    
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
      userMessage =
        'Could not verify this app with Firebase (invalid app credential).\n\n'
        + 'Try: complete the reCAPTCHA, then send again.\n\n'
        + 'If it keeps failing, in Google Cloud → APIs enable Identity Toolkit API and reCAPTCHA Enterprise API. '
        + 'In Google Cloud → Credentials, ensure your browser API key allows Identity Toolkit API and your site origin. '
        + 'In Firebase → Authentication → Settings, add this site under Authorized domains.';
    } else if (error.code === 'auth/captcha-check-failed') {
      userMessage = 'reCAPTCHA verification failed. Please complete the reCAPTCHA checkbox and try again.';
    } else if (error.code === 'auth/too-many-requests' || error.message?.includes('TOO_MANY_ATTEMPTS')) {
      userMessage =
        'Firebase is temporarily limiting SMS to this number (too many tries from this phone, device, or network).\n\n'
        + 'Wait 15–30 minutes, try a different number, or use email sign-in instead. '
        + 'In development, add test phone numbers in Firebase Console → Authentication → Sign-in method → Phone.';
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
