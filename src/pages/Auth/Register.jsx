import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, CheckCircle, Loader2, Mail, Phone, User } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { publicUrl } from "../../utils/publicUrl";
import {
  defaultPhoneOtpBackoffUntilMs,
  formatRetryAfter,
  readPhoneOtpCooldownUntil,
  writePhoneOtpCooldownUntil,
} from "../../utils/phoneOtpCooldown";
import AuthBrandMark from "./AuthBrandMark";
import {
  getEmailLinkContinueUrl,
  getSendLoginEmailErrorMessage,
  sendMagicLoginEmail,
} from "../../services/sendMagicLoginEmail";
import { isEmailRegisteredInFirebaseAuth } from "../../services/authEmailLookup";
import { rememberDashboardWithoutForcedOnboarding } from "../../utils/existingMerchantSession";
import "./Auth.css";

/**
 * PERF: Keep first paint fast by deferring Firebase Auth + Phone reCAPTCHA code until needed.
 */
async function loadFirebaseAuthCore() {
  const [{ auth }, firebaseAuth] = await Promise.all([
    import("../../firebase/config"),
    import("firebase/auth"),
  ]);
  return { auth, firebaseAuth };
}

async function loadFirebaseAuthHelpers() {
  const mod = await import("../../firebase/auth");
  return {
    createRecaptchaVerifier: mod.createRecaptchaVerifier,
    createUserDocument: mod.createUserDocument,
    sendPhoneOtp: mod.sendPhoneOtp,
  };
}

async function loadFirestoreHelpers() {
  const mod = await import("../../firebase/firestore");
  return {
    getDocuments: mod.getDocuments,
  };
}

async function lookupExistingAccountByEmail(email) {
  const trimmed = String(email || "").trim().toLowerCase();
  if (!trimmed) return { exists: false };
  // Use Admin-backed callable when possible (client fetchSignInMethodsForEmail is unreliable
  // when Firebase Email Enumeration Protection is enabled).
  const existsInAuth = await isEmailRegisteredInFirebaseAuth(trimmed);
  let methods = [];
  try {
    const { auth, firebaseAuth } = await loadFirebaseAuthCore();
    methods = await firebaseAuth.fetchSignInMethodsForEmail(auth, trimmed);
  } catch (_) {
    methods = [];
  }

  return {
    exists: existsInAuth,
    methods,
    existsInAuth,
    existsInFirestore: false,
  };
}

async function lookupExistingAccountByPhone({ phoneDigits, countryCode }) {
  const digits = String(phoneDigits || "").replace(/\D/g, "");
  const cc = String(countryCode || "").trim();
  if (!digits || !cc) return { exists: false };

  // Phone numbers can't be reliably looked up via Firebase Auth APIs from the client.
  // And Firestore may contain stale records after deleting the Auth user.
  // So we do not block signup based on Firestore for phone.
  return { exists: false };
}

const countryCodes = [
  { code: "+1", flag: "CA", name: "CA" },
  { code: "+44", flag: "GB", name: "UK" },
  { code: "+91", flag: "IN", name: "IN" },
  { code: "+92", flag: "PK", name: "PK" },
  { code: "+971", flag: "AE", name: "AE" },
  { code: "+61", flag: "AU", name: "AU" },
  { code: "+49", flag: "DE", name: "DE" },
  { code: "+33", flag: "FR", name: "FR" },
];

const getFlagCdnUrl = (isoCode) =>
  `https://flagcdn.com/24x18/${String(isoCode || "").toLowerCase()}.png`;

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};

  const signupType = navState.type || "direct";

  // Form fields
  const [firstName, setFirstName] = useState(navState.firstName || "");
  const [lastName, setLastName] = useState(navState.lastName || "");
  const [email, setEmail] = useState(navState.email || "");
  const [countryCode, setCountryCode] = useState(navState.countryCode || "+1");
  const [phone, setPhone] = useState(navState.phoneNumber || "");

  // Signup method: require either email OR phone (OTP)
  const [signupMethod, setSignupMethod] = useState(() => {
    if (signupType === "mobileNumber" || navState.phoneVerified) return "phone";
    if (signupType === "emailLink" || navState.emailVerified) return "email";
    return navState.signupMethod === "phone" ? "phone" : "email";
  });

  // Email verification state
  const emailPreVerified =
    signupType === "emailLink" ||
    signupType === "google" ||
    signupType === "apple" ||
    !!navState.emailVerified;

  const [emailVerified, setEmailVerified] = useState(!!emailPreVerified);
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);

  // Phone OTP verification state
  const phonePreFilled = signupType === "mobileNumber" && !!navState.phoneNumber;
  const [phoneVerified, setPhoneVerified] = useState(!!navState.phoneVerified);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verifiedOtpUser, setVerifiedOtpUser] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  /** After Firebase `auth/too-many-requests`, block repeat SMS for a period (persisted per E.164). */
  const [phoneOtpCooldownUntil, setPhoneOtpCooldownUntil] = useState(0);
  const [phoneOtpCooldownTick, setPhoneOtpCooldownTick] = useState(0);

  const otpRefs = useRef([]);
  const countryDropdownRef = useRef(null);
  const signupRecaptchaRef = useRef(null);
  /** Stable DOM id so reCAPTCHA always mounts into a real element (avoids Strict Mode / timing races). */
  const signupRecaptchaContainerIdRef = useRef(
    `signup-recaptcha-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Date.now()}`
  );
  /** Invisible mode: challenge runs when tapping Verify (no checkbox). */
  const signupRecaptchaInvisibleRef = useRef(false);

  /** Phone Auth: widget rendered and user completed the checkbox (required before sendVerificationCode). */
  const [signupRecaptchaReady, setSignupRecaptchaReady] = useState(false);
  const [signupRecaptchaInvisible, setSignupRecaptchaInvisible] = useState(false);
  const [signupCaptchaSolved, setSignupCaptchaSolved] = useState(false);
  const [recaptchaSetupError, setRecaptchaSetupError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPreAuthenticated =
    signupType === "mobileNumber" ||
    signupType === "google" ||
    signupType === "apple" ||
    signupType === "emailLink" ||
    !!navState.emailVerified ||
    !!navState.phoneVerified;

  // Restore state saved before redirecting to email-link-handler.
  useEffect(() => {
    const savedRaw = window.localStorage.getItem("signupFormState");
    const saved = savedRaw ? JSON.parse(savedRaw) : null;

    if (saved) {
      if (saved.firstName) setFirstName(saved.firstName);
      if (saved.lastName) setLastName(saved.lastName);
      if (saved.email) setEmail(saved.email);
      if (saved.phoneNumber) setPhone(saved.phoneNumber);
      if (saved.countryCode) setCountryCode(saved.countryCode);
      if (typeof saved.emailVerified === "boolean") setEmailVerified(saved.emailVerified);
      if (typeof saved.phoneVerified === "boolean") setPhoneVerified(saved.phoneVerified);
    }
  }, []);

  // Mark phone as verified if it came from OTP login flow
  useEffect(() => {
    if (phonePreFilled) setPhoneVerified(true);
  }, [phonePreFilled]);

  const registerNeedsRecaptcha =
    signupMethod === "phone" && !phonePreFilled && !phoneVerified;

  useEffect(() => {
    if (!registerNeedsRecaptcha) {
      try {
        signupRecaptchaRef.current?.clear?.();
      } catch (_) {
        /* ignore */
      }
      signupRecaptchaRef.current = null;
      signupRecaptchaInvisibleRef.current = false;
      setRecaptchaSetupError("");
      return;
    }

    let cancelled = false;
    const containerId = signupRecaptchaContainerIdRef.current;

    const waitForContainer = async () => {
      for (let i = 0; i < 30; i += 1) {
        if (cancelled) return false;
        if (document.getElementById(containerId)) return true;
        await new Promise((r) => setTimeout(r, 16));
      }
      return !!document.getElementById(containerId);
    };

    const setup = async () => {
      setSignupRecaptchaReady(false);
      setSignupCaptchaSolved(false);
      setSignupRecaptchaInvisible(false);
      signupRecaptchaInvisibleRef.current = false;
      setRecaptchaSetupError("");
      try {
        signupRecaptchaRef.current?.clear?.();
      } catch (_) {
        /* ignore */
      }
      signupRecaptchaRef.current = null;
      if (cancelled) return;

      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r));
      });
      if (cancelled) return;

      const hasEl = await waitForContainer();
      if (!hasEl || cancelled) {
        setRecaptchaSetupError("Could not load security check. Refresh the page or use email sign-up.");
        return;
      }

      const attachVerifier = async (size) => {
        const { createRecaptchaVerifier } = await loadFirebaseAuthHelpers();
        const verifier = createRecaptchaVerifier(containerId, {
          size,
          callback: () => setSignupCaptchaSolved(true),
          "expired-callback": () => setSignupCaptchaSolved(false),
        });
        signupRecaptchaRef.current = verifier;
        await verifier.render();
      };

      try {
        await attachVerifier("normal");
        if (cancelled) return;
        signupRecaptchaInvisibleRef.current = false;
        setSignupRecaptchaInvisible(false);
        setSignupRecaptchaReady(true);
      } catch (err) {
        console.warn("Register reCAPTCHA (checkbox) failed:", err);
        try {
          signupRecaptchaRef.current?.clear?.();
        } catch (_) {
          /* ignore */
        }
        signupRecaptchaRef.current = null;
        if (cancelled) return;

        try {
          await attachVerifier("invisible");
          if (cancelled) return;
          signupRecaptchaInvisibleRef.current = true;
          setSignupRecaptchaInvisible(true);
          setSignupCaptchaSolved(true);
          setSignupRecaptchaReady(true);
        } catch (err2) {
          console.warn("Register reCAPTCHA (invisible) failed:", err2);
          setRecaptchaSetupError(
            "Phone verification could not start. Refresh the page, confirm Phone sign-in is enabled in Firebase, or use email sign-up."
          );
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      try {
        signupRecaptchaRef.current?.clear?.();
      } catch (_) {
        /* ignore */
      }
      signupRecaptchaRef.current = null;
      signupRecaptchaInvisibleRef.current = false;
    };
  }, [registerNeedsRecaptcha]);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Cooldown timer for email resend
  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = setTimeout(() => setEmailResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailResendCooldown]);

  useEffect(() => {
    if (!countryDropdownOpen) return;
    const handleOutsideClick = (event) => {
      if (!countryDropdownRef.current?.contains(event.target)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [countryDropdownOpen]);

  // If the user opened the email link in the same browser, they are signed in — treat email as verified
  // even after a refresh (navigation state may be lost).
  useEffect(() => {
    if (signupMethod !== "email") return undefined;
    const em = email.trim().toLowerCase();
    if (!em) return undefined;
    let unsub = null;
    let cancelled = false;
    (async () => {
      // Defer work until after first paint.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;
      const { auth, firebaseAuth } = await loadFirebaseAuthCore();
      unsub = firebaseAuth.onAuthStateChanged(auth, (user) => {
        if (user?.email && user.email.toLowerCase() === em) {
          setEmailVerified(true);
        }
      });
    })();
    return () => {
      cancelled = true;
      try { unsub && unsub(); } catch (_) { /* ignore */ }
    };
  }, [signupMethod, email]);

  useEffect(() => {
    const e164 = `${countryCode}${String(phone).replace(/\D/g, "")}`;
    setPhoneOtpCooldownUntil(readPhoneOtpCooldownUntil(e164));
  }, [countryCode, phone]);

  useEffect(() => {
    if (!phoneOtpCooldownUntil || Date.now() >= phoneOtpCooldownUntil) return undefined;
    const id = setInterval(() => {
      setPhoneOtpCooldownTick((x) => x + 1);
      setPhoneOtpCooldownUntil((until) => (until && Date.now() >= until ? 0 : until));
    }, 1000);
    return () => clearInterval(id);
  }, [phoneOtpCooldownUntil]);

  const phoneDigitsForOtp = String(phone).replace(/\D/g, "");
  const phoneE164 = `${countryCode}${phoneDigitsForOtp}`;
  const phoneOtpRateLimited = phoneOtpCooldownUntil > Date.now();
  const phoneOtpRateLimitSecondsLeft = phoneOtpRateLimited
    ? Math.max(0, Math.ceil((phoneOtpCooldownUntil - Date.now()) / 1000))
    : 0;

  /** Send sign-up magic link (also used by main Sign Up button on the email tab). */
  const sendSignupEmailLink = async () => {
    setEmailError("");

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setEmailLoading(true);
    try {
      const existsRes = await lookupExistingAccountByEmail(email.trim());
      if (existsRes.exists) {
        setEmailError("Account already exists. Please log in instead.");
        return;
      }

      const { auth } = await loadFirebaseAuthCore();
      window.localStorage.setItem(
        "signupFormState",
        JSON.stringify({
          type: signupType,
          uid: navState.uid || auth.currentUser?.uid,
          phoneNumber: phone,
          countryCode,
          firstName,
          lastName,
          email: email.trim(),
          phoneVerified,
          signUpWithEmailLink: true,
        })
      );

      window.localStorage.setItem("emailForSignIn", email.trim());

      const signupName = [firstName, lastName].filter(Boolean).join(" ").trim() || firstName.trim() || email.trim().split("@")[0] || "there";
      await sendMagicLoginEmail({
        email: email.trim(),
        displayName: signupName,
        continueUrl: getEmailLinkContinueUrl(),
        variant: "signup",
      });

      setEmailLinkSent(true);
      setEmailResendCooldown(60);
    } catch (err) {
      setEmailError(getSendLoginEmailErrorMessage(err));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResendEmailLink = async () => {
    if (emailResendCooldown > 0) return;
    if (!email.trim()) return;

    await sendSignupEmailLink();
  };

  const resetSignupRecaptcha = () => {
    try {
      signupRecaptchaRef.current?.reset?.();
    } catch (_) {
      /* ignore */
    }
    setSignupCaptchaSolved(signupRecaptchaInvisibleRef.current);
  };

  const handleSendPhoneOTP = async () => {
    if (!phone.trim()) {
      setOtpError("Please enter your phone number first.");
      return;
    }
    if (phoneOtpRateLimited) {
      setOtpError(
        `SMS limit active. Try again in ${formatRetryAfter(phoneOtpRateLimitSecondsLeft)}, or switch to the Email tab.`
      );
      return;
    }
    if (!signupRecaptchaReady || !signupRecaptchaRef.current) {
      setOtpError("Security verification is still loading. Wait a moment, then try again.");
      return;
    }
    if (!signupRecaptchaInvisible && !signupCaptchaSolved) {
      setOtpError("Please tick “I’m not a robot” above, then tap Verify.");
      return;
    }
    setOtpError("");
    setOtpLoading(true);

    try {
      const existing = await lookupExistingAccountByPhone({
        phoneDigits: phoneDigitsForOtp,
        countryCode,
      });
      if (existing.exists) {
        setOtpError("Account already exists with this phone number. Please login.");
        return;
      }

      const { sendPhoneOtp } = await loadFirebaseAuthHelpers();
      const res = await sendPhoneOtp(phoneE164, signupRecaptchaRef.current);
      if (!res?.success) {
        if (res?.errorCode === "auth/invalid-app-credential") {
          resetSignupRecaptcha();
        }
        if (res?.errorCode === "auth/too-many-requests") {
          const until = defaultPhoneOtpBackoffUntilMs();
          writePhoneOtpCooldownUntil(phoneE164, until);
          setPhoneOtpCooldownUntil(until);
        }
        setOtpError(res?.error || "Failed to send OTP. Please try again.");
        return;
      }

      setConfirmationResult(res.confirmationResult);
      setOtpSent(true);
      setResendCooldown(30);
      resetSignupRecaptcha();
    } catch (err) {
      const code = err?.code;

      if (code === "auth/invalid-phone-number") {
        setOtpError("Invalid phone number. Please check and try again.");
      } else if (code === "auth/too-many-requests") {
        setOtpError("Too many attempts. Please try again later.");
      } else {
        setOtpError(err?.message || "Failed to send OTP. Please try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyPhoneOTP = async (e) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      setOtpError("Please enter the complete 6-digit OTP.");
      return;
    }
    if (!confirmationResult) {
      setOtpError("Session expired. Please resend OTP.");
      return;
    }

    setOtpError("");
    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otpCode);

      if (result?.user) {
        setVerifiedOtpUser(result.user);
        setPhoneVerified(true);
        setOtpSent(false);
      }
    } catch (err) {
      const firebaseError = err;
      if (firebaseError?.code === "auth/invalid-verification-code") {
        setOtpError("Invalid OTP. Please check and try again.");
      } else if (firebaseError?.code === "auth/code-expired") {
        setOtpError("OTP has expired. Please resend.");
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    setOtpLoading(true);

    try {
      if (phoneOtpRateLimited) {
        setOtpError(
          `SMS limit active. Try again in ${formatRetryAfter(phoneOtpRateLimitSecondsLeft)}, or switch to the Email tab.`
        );
        return;
      }

      if (!signupRecaptchaReady || !signupRecaptchaRef.current) {
        setOtpError(
          "Security verification is still loading. Wait a moment, complete the checkbox if shown, then try again."
        );
        return;
      }
      if (!signupRecaptchaInvisible && !signupCaptchaSolved) {
        setOtpError("Please complete the reCAPTCHA again, then resend.");
        return;
      }

      const existing = await lookupExistingAccountByPhone({
        phoneDigits: phoneDigitsForOtp,
        countryCode,
      });
      if (existing.exists) {
        setOtpError("Account already exists with this phone number. Please login.");
        return;
      }

      const { sendPhoneOtp } = await loadFirebaseAuthHelpers();
      const res = await sendPhoneOtp(phoneE164, signupRecaptchaRef.current);
      if (!res?.success) {
        if (res?.errorCode === "auth/invalid-app-credential") {
          resetSignupRecaptcha();
        }
        if (res?.errorCode === "auth/too-many-requests") {
          const until = defaultPhoneOtpBackoffUntilMs();
          writePhoneOtpCooldownUntil(phoneE164, until);
          setPhoneOtpCooldownUntil(until);
        }
        setOtpError(res?.error || "Failed to resend OTP.");
        return;
      }

      setConfirmationResult(res.confirmationResult);
      setResendCooldown(30);
      resetSignupRecaptcha();
    } catch (err) {
      setOtpError(err?.message || "Failed to resend OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const focusOtpIndex = (i) => {
    window.setTimeout(() => {
      otpRefs.current[i]?.focus?.();
    }, 0);
  };

  const handleOtpChange = (index, rawValue) => {
    const digits = String(rawValue).replace(/\D/g, "");
    const newOtp = [...otp];

    if (digits.length === 0) {
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    if (digits.length > 1) {
      for (let i = 0; i < digits.length && index + i < 6; i += 1) {
        newOtp[index + i] = digits[i];
      }
      setOtp(newOtp);
      focusOtpIndex(Math.min(index + digits.length, 5));
      return;
    }

    newOtp[index] = digits;
    setOtp(newOtp);
    if (index < 5) focusOtpIndex(index + 1);
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      focusOtpIndex(index - 1);
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      focusOtpIndex(5);
    }
  };

  const validateForm = () => {
    if (!firstName.trim()) return "Please enter your first name.";
    if (!lastName.trim()) return "Please enter your last name.";
    if (signupMethod === "email") {
      if (!email.trim()) return "Please enter your email address.";
      if (!/\S+@\S+\.\S+/.test(email)) return "Please enter a valid email address.";
      const emailReady =
        emailVerified
        || emailPreVerified
        || isPreAuthenticated
        || !!navState.emailVerified;
      if (!emailReady) {
        return "Open the link in your email to continue, then tap Sign Up again.";
      }
      return null;
    }
    if (!phone.trim()) return "Please enter your phone number.";
    if (!phoneVerified) return "Please verify your phone number first.";
    return null;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (signupMethod === "email" && !isPreAuthenticated) {
      if (emailLinkSent && !emailVerified) {
        return;
      }
      if (!emailVerified) {
        await sendSignupEmailLink();
        return;
      }
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const signupStateRaw = typeof window !== "undefined"
        ? window.localStorage.getItem("signupFormState")
        : null;
      const signupState = signupStateRaw ? JSON.parse(signupStateRaw) : null;

      const uid =
        navState.uid
        || (await loadFirebaseAuthCore()).auth.currentUser?.uid
        || verifiedOtpUser?.uid;
      if (!uid) throw new Error("Authentication error. Please try again.");

      const provider = signupMethod === "phone" ? "phone" : "email";

      // Phone OTP in this screen can be confirmed via an ephemeral auth instance.
      // Use that verified user as fallback when main `auth.currentUser` is not yet set.
      const { auth } = await loadFirebaseAuthCore();
      const userForProfile =
        auth.currentUser ||
        verifiedOtpUser ||
        {
          uid,
          email: signupMethod === "email" ? email.trim().toLowerCase() : null,
          photoURL: null,
          providerData: [{ providerId: provider === "phone" ? "phone" : "password" }],
        };

      const { createUserDocument } = await loadFirebaseAuthHelpers();
      const result = await createUserDocument(userForProfile, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(signupMethod === "email"
          ? { email: email.trim().toLowerCase() }
          : {}),
        ...(signupMethod === "phone"
          ? {
            phoneNumber: phone.trim(),
            countryCode,
          }
          : {}),
        provider,
      });

      if (!result?.success) throw new Error(result?.error || "Failed to create profile");

      window.localStorage.removeItem("signupFormState");

      const uidForSession = userForProfile?.uid || uid;
      const cameFromSignupEmailLink =
        signupType === "emailLink" || signupState?.signUpWithEmailLink === true;
      // Some flows (email-link) may have created the Firestore user doc earlier, but are still a new merchant.
      const shouldStartOnboarding = result.isNew || cameFromSignupEmailLink;
      if (shouldStartOnboarding) {
        navigate("/find-your-store?onboarding=1", { replace: true });
      } else {
        rememberDashboardWithoutForcedOnboarding(uidForSession);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError("");
    try {
      const { auth, firebaseAuth } = await loadFirebaseAuthCore();
      const provider = new firebaseAuth.GoogleAuthProvider();
      const result = await firebaseAuth.signInWithPopup(auth, provider);
      const additionalInfo = firebaseAuth.getAdditionalUserInfo(result);

      if (additionalInfo?.isNewUser) {
        const user = result.user;
        const nameParts = user.displayName?.split(" ") || [];
        const { createUserDocument } = await loadFirebaseAuthHelpers();
        const docResult = await createUserDocument(user, {
          firstName: nameParts[0] || null,
          lastName: nameParts.slice(1).join(" ") || null,
          email: user.email || "",
        });
        if (!docResult?.success) {
          setError(docResult?.error || "Failed to set up your account.");
          return;
        }
        window.localStorage.removeItem("signupFormState");
        if (docResult.isNew || additionalInfo?.isNewUser) {
          navigate("/find-your-store?onboarding=1", { replace: true });
        } else {
          rememberDashboardWithoutForcedOnboarding(user.uid);
          navigate("/dashboard", { replace: true });
        }
      } else {
        rememberDashboardWithoutForcedOnboarding(result.user.uid);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const facebookIcon = (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );

  const googleIcon = (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  const selectedCountry = countryCodes.find((c) => c.code === countryCode) || countryCodes[0];

  const phoneVerificationUI = (
    <div className="space-y-2 w-full">
      <div className="auth-phone-row">
        <div className="relative shrink-0" ref={countryDropdownRef}>
          <button
            type="button"
            onClick={() => !phonePreFilled && setCountryDropdownOpen((prev) => !prev)}
            disabled={phonePreFilled}
            className="auth-country-btn disabled:opacity-60"
          >
            {/* Invisible character spacing to create a small left gap before the flag */}
            {"\u00A0"}
            <img
              src={getFlagCdnUrl(selectedCountry.flag)}
              alt={`${selectedCountry.name} flag`}
              className="h-[18px] w-6 object-cover flex-shrink-0"
              loading="lazy"
            />
            <span className="text-gray-800">{selectedCountry.code}</span>
            <svg
              className={`h-4 w-4 text-gray-600 transition-transform ${countryDropdownOpen ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {countryDropdownOpen && (
            <div className="absolute z-50 mt-1 w-[120px] rounded-xl border border-gray-200 bg-white shadow-lg py-1 max-h-none overflow-visible">
              {countryCodes.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCountryCode(c.code);
                    setPhoneVerified(false);
                    setOtpSent(false);
                    setCountryDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 min-h-[40px] text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${countryCode === c.code ? "bg-primary/10" : ""}`}
                >
                  <img
                    src={getFlagCdnUrl(c.flag)}
                    alt={`${c.name} flag`}
                    className="h-[16px] w-[22px]  object-cover flex-shrink-0"
                    loading="lazy"
                  />
                  <span className="text-gray-800">{c.name}</span>
                  <span className="text-gray-500">{c.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex-1 min-w-0">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            type="tel"
            placeholder="Enter phone number"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, ""));
              setPhoneVerified(false);
              setOtpSent(false);
            }}
            disabled={phonePreFilled || phoneVerified}
            className="auth-input pl-10 w-full disabled:opacity-70"
            required
          />
        </div>

        {!phonePreFilled && !phoneVerified && !otpSent && (
          <Button
            type="button"
            onClick={handleSendPhoneOTP}
            disabled={
              otpLoading
              || !phone.trim()
              || phoneOtpRateLimited
              || !signupRecaptchaReady
              || (!signupRecaptchaInvisible && !signupCaptchaSolved)
            }
            className="h-[2.75rem] shrink-0 px-3 bg-[#03c55b] hover:bg-[#02a54f] text-white rounded-xl text-sm font-semibold"
          >
            {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </Button>
        )}

        {phoneVerified && (
          <div className="h-[2.75rem] shrink-0 min-w-[5.5rem] px-2 flex items-center justify-center gap-1 bg-[#03c55b] text-white rounded-xl text-xs font-semibold">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            Verified
          </div>
        )}
      </div>

      {registerNeedsRecaptcha ? (
        <div className="space-y-1 w-full">
          <div
            id={signupRecaptchaContainerIdRef.current}
            className="auth-recaptcha-slot flex justify-center min-h-[78px]"
          />
          {recaptchaSetupError ? (
            <p className="text-xs text-center text-red-500 px-2">{recaptchaSetupError}</p>
          ) : null}
          {signupRecaptchaReady && !signupRecaptchaInvisible && !signupCaptchaSolved ? (
            <p className="text-xs text-center text-gray-500">Complete the checkbox above to enable Verify.</p>
          ) : null}
          {signupRecaptchaReady && signupRecaptchaInvisible ? (
            <p className="text-xs text-center text-gray-500">Tap Verify — a quick security check may appear before the SMS is sent.</p>
          ) : null}
        </div>
      ) : null}

      {signupMethod === "phone" && phoneOtpRateLimited ? (
        <p className="text-xs text-center text-amber-900 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3">
          SMS is temporarily limited for this number. Retry in{" "}
          <strong>{formatRetryAfter(phoneOtpRateLimitSecondsLeft)}</strong>
          , switch to{" "}
          <button
            type="button"
            className="font-semibold underline text-amber-950"
            onClick={() => {
              setSignupMethod("email");
              setOtpError("");
            }}
          >
            Email
          </button>
          , or wait.
        </p>
      ) : null}

      {signupMethod === "phone" && !otpSent && otpError ? (
        <p className="text-red-500 text-xs text-center whitespace-pre-line px-2">{otpError}</p>
      ) : null}

      {otpSent && !phoneVerified && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-600 text-center">
            Enter the OTP sent to <span className="font-semibold">{countryCode} {phone}</span>
          </p>

          <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-10 h-11 text-center text-lg font-bold border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition bg-white"
              />
            ))}
          </div>

          {otpError && (
            <p className="text-red-500 text-xs text-center whitespace-pre-line">{otpError}</p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={
                    otpLoading
                    || phoneOtpRateLimited
                    || !signupRecaptchaReady
                    || (!signupRecaptchaInvisible && !signupCaptchaSolved)
                  }
                  className="font-semibold text-primary"
                >
                  Resend OTP
                </button>
              )}
            </p>

            <Button
              type="button"
              onClick={handleVerifyPhoneOTP}
              disabled={otpLoading || otp.join("").length < 6}
              className="h-9 px-4 bg-[#03c55b] hover:bg-[#02a54f] text-white rounded-lg text-sm font-semibold"
            >
              {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm OTP"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const signupTabs = (
    <div className="auth-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={signupMethod === "email"}
        className={`auth-tab ${signupMethod === "email" ? "auth-tab--active" : ""}`}
        onClick={() => {
          setSignupMethod("email");
          setOtpSent(false);
          setOtpError("");
          setConfirmationResult(null);
        }}
      >
        Email
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={signupMethod === "phone"}
        className={`auth-tab ${signupMethod === "phone" ? "auth-tab--active" : ""}`}
        onClick={() => setSignupMethod("phone")}
      >
        Phone number
      </button>
    </div>
  );

  const formFields = (
    <form onSubmit={handleFormSubmit} className="flex flex-col items-center space-y-3 w-full">

      {/* ✅ MAIN WRAPPER (IMPORTANT) */}
      <div className="max-w-[416px] mx-auto space-y-3 w-full">

        {signupMethod === "email" && (
          <div className="space-y-2 w-full">
            <div className="relative w-full">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailVerified(emailPreVerified);
                  setEmailLinkSent(false);
                }}
                disabled={emailPreVerified || emailVerified}
                className="auth-input pl-10 w-full"
                required={signupMethod === "email"}
              />
            </div>

            {emailVerified && (
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-600">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Email verified
              </p>
            )}

            {emailLinkSent && !emailVerified && (
              <div className="bg-green-50 rounded-xl p-4 space-y-2 text-center">
                <div className="flex items-center justify-center gap-2 text-green-700 text-sm font-medium">
                  <Mail className="h-4 w-4" />
                  Verification link sent to {email}
                </div>

                <p className="text-xs text-gray-500">
                  Click the link in your email to verify. Check spam folder if not found.
                </p>

                <p className="text-xs text-gray-400">
                  {emailResendCooldown > 0 ? (
                    <span>Resend in {emailResendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendEmailLink}
                      disabled={emailLoading}
                      className="font-semibold text-primary"
                    >
                      Resend Link
                    </button>
                  )}
                </p>
                {emailError && <p className="text-red-500 text-xs">{emailError}</p>}
              </div>
            )}

            {emailError && !emailLinkSent && (
              <p className="text-red-500 text-xs">{emailError}</p>
            )}
          </div>
        )}
        {/* <div className="h-[7px]" /> */}

        {/* PHONE */}
        {signupMethod === "phone" ? phoneVerificationUI : null}
        {/* <div className="h-[7px]" /> */}

        {/* NAME — below email/phone */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="pl-9 h-12 rounded-xl border border-gray-200 text-sm text-center w-full"
              required
            />
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="pl-9 h-12 rounded-xl border border-gray-200 text-sm text-center w-full"
              required
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        {/* SUBMIT — email tab: sends magic link first; after send, muted until link is opened */}
        <Button
          type="submit"
          disabled={
            loading
            || emailLoading
            || (signupMethod === "email"
              && !isPreAuthenticated
              && emailLinkSent
              && !emailVerified)
          }
          className={`auth-btn-primary ${
            signupMethod === "email"
            && !isPreAuthenticated
            && emailLinkSent
            && !emailVerified
              ? "auth-btn-primary--sent"
              : ""
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : emailLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : signupMethod === "email" && !isPreAuthenticated && emailLinkSent && !emailVerified ? (
            "Link Sent — Check Email"
          ) : (
            "Sign Up"
          )}
        </Button>

      </div>
    </form>
  );

  return (
    <>
      <div className="auth-hero-page">
        <picture className="auth-hero-bg" aria-hidden="true">
          <source
            media="(min-width: 769px)"
            srcSet={publicUrl("loginbg.webp")}
            type="image/webp"
          />
          <source
            media="(min-width: 769px)"
            srcSet={publicUrl("loginbg.jpg")}
            type="image/jpeg"
          />
          <img
            className="auth-hero-bg__img"
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width="1920"
            height="1080"
          />
        </picture>
        <div className="auth-hero-overlay" aria-hidden />
        <div className="auth-hero-inner auth-hero-inner--register">
          <div className="auth-hero-card">
            {/* <Link to="/login" className="auth-hero-back" aria-label="Back to login">
              <ChevronLeft className="h-5 w-5" />
            </Link> */}

            <AuthBrandMark />

            <h2 className="auth-hero-title auth-hero-title--spaced">
              {isPreAuthenticated ? "Complete Profile" : "Sign Up"}
            </h2>
            <p className="auth-hero-sublead hidden md:block">
              {isPreAuthenticated
                ? "Just a few more details to get started"
                : "Create an account with your Email or Mobile Number"}
            </p>

            {signupTabs}

            {formFields}

            {!isPreAuthenticated && (
              <>
                <div className="auth-or">
                  <div className="auth-or-line" />
                  <span className="auth-or-text">or</span>
                  <div className="auth-or-line" />
                </div>

                <div className="auth-social-row">
                  {/* <button type="button" className="auth-social-circle" aria-label="Continue with Facebook" disabled={loading}>
                    {facebookIcon}
                  </button> */}
                  <button
                    type="button"
                    className="auth-social-circle"
                    aria-label="Continue with Google"
                    onClick={handleGoogleSignup}
                    disabled={loading}
                  >
                    {googleIcon}
                  </button>
                  {/* <button type="button" className="auth-social-circle" aria-label="Continue with Apple" disabled={loading}>
                    <img src={publicUrl("apple-logo.png")} alt="" className="h-5 w-5 object-contain" />
                  </button> */}
                </div>
              </>
            )}

            <p className="auth-footer-link">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
            <p className="auth-footer-link auth-footer-link--secondary">
              Need help or support? <Link to="/contact-us">Contact us</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
