import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Mail, Phone } from "lucide-react";
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
import { POST_AUTH_REDIRECT_KEY } from "./postAuthRedirectKey";
import {
  getEmailLinkContinueUrl,
  getSendLoginEmailErrorMessage,
  sendMagicLoginEmail,
} from "../../services/sendMagicLoginEmail";
import { merchantAccountExists } from "../../utils/merchantAccountExists";
import "./Auth.css";

/**
 * PERF: Avoid pulling Firebase Auth + reCAPTCHA code into the initial route chunk.
 * Load Firebase only when user uses Phone OTP or Google sign-in.
 */
async function loadFirebaseAuthCore() {
  const [{ auth }, firebaseAuth] = await Promise.all([
    import("../../firebase/config"),
    import("firebase/auth"),
  ]);
  return { auth, firebaseAuth };
}

async function loadCreateUserDocument() {
  const mod = await import("../../firebase/auth");
  return { createUserDocument: mod.createUserDocument };
}

// Country codes list (ISO for Flag CDN)
const countryCodes = [
  { code: "+1", flag: "ca", name: "Canada" },
  { code: "+44", flag: "gb", name: "United Kingdom" },
  { code: "+91", flag: "in", name: "India" },
  { code: "+92", flag: "pk", name: "Pakistan" },
  { code: "+971", flag: "ae", name: "United Arab Emirates" },
  { code: "+61", flag: "au", name: "Australia" },
  { code: "+49", flag: "de", name: "Germany" },
  { code: "+33", flag: "fr", name: "France" },
];

const getFlagCdnUrl = (isoCode) =>
  `https://flagcdn.com/24x18/${String(isoCode || "").toLowerCase()}.png`;

export default function Login() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("email"); // "email" | "phone"
  const [step, setStep] = useState("form"); // "form" | "otp" | "emailSent"

  // Phone OTP state
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email state
  const [email, setEmail] = useState("");

  // Loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const otpRefs = useRef([]);
  const loginRecaptchaContainerIdRef = useRef(
    `login-recaptcha-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Date.now()}`
  );
  const loginRecaptchaInvisibleRef = useRef(false);
  const loginRecaptchaVerifierRef = useRef(null);
  const countryDropdownRef = useRef(null);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);

  const [loginRecaptchaReady, setLoginRecaptchaReady] = useState(false);
  const [loginRecaptchaInvisible, setLoginRecaptchaInvisible] = useState(false);
  const [loginCaptchaSolved, setLoginCaptchaSolved] = useState(false);
  const [loginRecaptchaSetupError, setLoginRecaptchaSetupError] = useState("");
  const [phoneOtpCooldownUntil, setPhoneOtpCooldownUntil] = useState(0);
  const [phoneOtpCooldownTick, setPhoneOtpCooldownTick] = useState(0);

  /**
   * Phone Auth + reCAPTCHA only when Phone tab is active and user is on the phone form or OTP step.
   * Email tab / email-sent step: no container, no verifier, no Identity Toolkit phone calls.
   */
  const loginNeedsRecaptcha =
    activeTab === "phone" && (step === "form" || step === "otp");

  useEffect(() => {
    if (!loginNeedsRecaptcha) {
      try {
        loginRecaptchaVerifierRef.current?.clear?.();
      } catch (_) {
        /* ignore */
      }
      loginRecaptchaVerifierRef.current = null;
      loginRecaptchaInvisibleRef.current = false;
      setLoginRecaptchaSetupError("");
      return;
    }

    let cancelled = false;
    const containerId = loginRecaptchaContainerIdRef.current;

    const waitForContainer = async () => {
      for (let i = 0; i < 30; i += 1) {
        if (cancelled) return false;
        if (document.getElementById(containerId)) return true;
        await new Promise((r) => setTimeout(r, 16));
      }
      return !!document.getElementById(containerId);
    };

    const setup = async () => {
      setLoginRecaptchaReady(false);
      setLoginCaptchaSolved(false);
      setLoginRecaptchaInvisible(false);
      loginRecaptchaInvisibleRef.current = false;
      setLoginRecaptchaSetupError("");
      try {
        loginRecaptchaVerifierRef.current?.clear?.();
      } catch (_) {
        /* ignore */
      }
      loginRecaptchaVerifierRef.current = null;
      if (cancelled) return;

      await new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(r));
      });
      if (cancelled) return;

      const hasEl = await waitForContainer();
      if (!hasEl || cancelled) {
        setLoginRecaptchaSetupError("Could not load security check. Refresh the page.");
        return;
      }

      const attachVerifier = async (size) => {
        const { auth, firebaseAuth } = await loadFirebaseAuthCore();
        const verifier = new firebaseAuth.RecaptchaVerifier(auth, containerId, {
          size,
          callback: () => setLoginCaptchaSolved(true),
          "expired-callback": () => setLoginCaptchaSolved(false),
        });
        loginRecaptchaVerifierRef.current = verifier;
        await verifier.render();
      };

      try {
        await attachVerifier("normal");
        if (cancelled) return;
        loginRecaptchaInvisibleRef.current = false;
        setLoginRecaptchaInvisible(false);
        setLoginRecaptchaReady(true);
      } catch (err) {
        console.warn("Login reCAPTCHA (checkbox) failed:", err);
        try {
          loginRecaptchaVerifierRef.current?.clear?.();
        } catch (_) {
          /* ignore */
        }
        loginRecaptchaVerifierRef.current = null;
        if (cancelled) return;

        try {
          await attachVerifier("invisible");
          if (cancelled) return;
          loginRecaptchaInvisibleRef.current = true;
          setLoginRecaptchaInvisible(true);
          setLoginCaptchaSolved(true);
          setLoginRecaptchaReady(true);
        } catch (err2) {
          console.warn("Login reCAPTCHA (invisible) failed:", err2);
          setLoginRecaptchaSetupError("Phone verification could not start. Refresh the page or use email login.");
        }
      }
    };
    setup();
    return () => {
      cancelled = true;
      try {
        loginRecaptchaVerifierRef.current?.clear?.();
      } catch (_) {
        /* ignore */
      }
      loginRecaptchaVerifierRef.current = null;
      loginRecaptchaInvisibleRef.current = false;
    };
  }, [loginNeedsRecaptcha, step, activeTab]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    const e164 = `${countryCode}${String(phone).replace(/\D/g, "")}`;
    setPhoneOtpCooldownUntil(readPhoneOtpCooldownUntil(e164));
  }, [countryCode, phone]);

  useEffect(() => {
    if (!phoneOtpCooldownUntil || Date.now() >= phoneOtpCooldownUntil) return undefined;
    const id = setInterval(() => {
      setPhoneOtpCooldownTick((x) => x + 1);
      setPhoneOtpCooldownUntil((until) => (!until || Date.now() >= until ? 0 : until));
    }, 1000);
    return () => clearInterval(id);
  }, [phoneOtpCooldownUntil]);

  // When OTP step opens, focus the first (empty) box on mobile.
  useEffect(() => {
    if (step !== "otp") return;
    const firstEmpty = otp.findIndex((d) => !d);
    focusOtpIndex(firstEmpty === -1 ? 0 : firstEmpty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const resetLoginRecaptcha = () => {
    try {
      loginRecaptchaVerifierRef.current?.reset?.();
    } catch (_) {
      /* ignore */
    }
    setLoginCaptchaSolved(loginRecaptchaInvisibleRef.current);
  };

  const phoneE164 = `${countryCode}${String(phone).replace(/\D/g, "")}`;
  const phoneOtpRateLimited = phoneOtpCooldownUntil > Date.now();
  const phoneOtpRateLimitSecondsLeft = phoneOtpRateLimited
    ? Math.max(0, Math.ceil((phoneOtpCooldownUntil - Date.now()) / 1000))
    : 0;

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Please enter your phone number");
      return;
    }
    if (phoneOtpRateLimited) {
      setError(
        `SMS limit active. Try again in ${formatRetryAfter(phoneOtpRateLimitSecondsLeft)}, or use the Email tab.`
      );
      return;
    }
    if (!loginRecaptchaReady || !loginRecaptchaVerifierRef.current) {
      setError("Security check is still loading. Wait a moment, then try again.");
      return;
    }
    if (!loginRecaptchaInvisible && !loginCaptchaSolved) {
      setError('Please tick “I’m not a robot” above, then continue.');
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { auth, firebaseAuth } = await loadFirebaseAuthCore();
      const result = await firebaseAuth.signInWithPhoneNumber(
        auth,
        phoneE164,
        loginRecaptchaVerifierRef.current
      );
      // Support the separate `/otp-verification` screen by persisting what it needs.
      sessionStorage.setItem("otpPhoneNumber", phoneE164);
      window.__bbb_confirmationResult = result;
      setConfirmationResult(result);
      setStep("otp");
      setResendCooldown(30);
      resetLoginRecaptcha();
    } catch (err) {
      const code = err?.code;
      if (code === "auth/invalid-app-credential") {
        resetLoginRecaptcha();
      }
      if (code === "auth/too-many-requests") {
        const until = defaultPhoneOtpBackoffUntilMs();
        writePhoneOtpCooldownUntil(phoneE164, until);
        setPhoneOtpCooldownUntil(until);
      }
      if (code === "auth/invalid-phone-number") setError("Invalid phone number. Please check and try again.");
      else if (code === "auth/too-many-requests") {
        setError(
          "Firebase is limiting SMS to this number. Wait 15–30 minutes, use the Email tab, or try a different number."
        );
      } else {
        setError(
          code === "auth/invalid-app-credential"
            ? "Could not verify the app with Firebase. Complete the reCAPTCHA and try again, or check Google Cloud API key (Identity Toolkit) and authorized domains."
            : err?.message || "Failed to send OTP. Please check your phone number and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    setLoading(true);
    try {
      if (phoneOtpRateLimited) {
        setOtpError(
          `SMS limit active. Try again in ${formatRetryAfter(phoneOtpRateLimitSecondsLeft)}, or use the Email tab.`
        );
        return;
      }
      if (!loginRecaptchaReady || !loginRecaptchaVerifierRef.current) {
        setOtpError("Security check is still loading. Please try again in a moment.");
        return;
      }
      if (!loginRecaptchaInvisible && !loginCaptchaSolved) {
        setOtpError("Please complete the reCAPTCHA above, then resend.");
        return;
      }
      const { auth, firebaseAuth } = await loadFirebaseAuthCore();
      const result = await firebaseAuth.signInWithPhoneNumber(
        auth,
        phoneE164,
        loginRecaptchaVerifierRef.current
      );
      sessionStorage.setItem("otpPhoneNumber", phoneE164);
      window.__bbb_confirmationResult = result;
      setConfirmationResult(result);
      setResendCooldown(30);
      resetLoginRecaptcha();
    } catch (err) {
      if (err?.code === "auth/invalid-app-credential") {
        resetLoginRecaptcha();
      }
      if (err?.code === "auth/too-many-requests") {
        const until = defaultPhoneOtpBackoffUntilMs();
        writePhoneOtpCooldownUntil(phoneE164, until);
        setPhoneOtpCooldownUntil(until);
      }
      setOtpError(err?.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      setOtpError("Please enter the complete 6-digit OTP.");
      return;
    }
    if (!confirmationResult) {
      setOtpError("Session expired. Please go back and send OTP again.");
      return;
    }
    setOtpError("");
    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otpCode);
      if (result.user) {
        const { createUserDocument } = await loadCreateUserDocument();
        const docResult = await createUserDocument(result.user, {
          phoneNumber: result.user.phoneNumber || `${countryCode}${phone.trim()}`,
          countryCode,
          provider: "phone",
        });

        sessionStorage.removeItem("otpPhoneNumber");
        delete window.__bbb_confirmationResult;

        if (!docResult?.success) {
          setError(docResult?.error || "Failed to set up your account.");
          return;
        }

        if (docResult.isNew) {
          const isExistingMerchant = await merchantAccountExists({
            uid: result.user.uid,
            email: result.user.email,
          });
          if (isExistingMerchant) {
            navigate("/dashboard", { replace: true });
            return;
          }
          navigate("/find-your-store?onboarding=1", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }
    } catch (err) {
      const code = err?.code;
      if (code === "auth/invalid-verification-code") setOtpError("Invalid OTP. Please check and try again.");
      else if (code === "auth/code-expired") setOtpError("OTP has expired. Please resend.");
      else setOtpError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendMagicLoginEmail({
        email: email.trim(),
        continueUrl: getEmailLinkContinueUrl(),
        variant: "login",
      });
      setStep("emailSent");
    } catch (err) {
      setError(
        getSendLoginEmailErrorMessage(err, "Failed to send login link. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
        const { createUserDocument } = await loadCreateUserDocument();
        const docResult = await createUserDocument(user, {
          firstName: nameParts[0] || null,
          lastName: nameParts.slice(1).join(" ") || null,
          email: user.email || "",
        });
        if (!docResult?.success) {
          setError(docResult?.error || "Failed to set up your account.");
          return;
        }
        if (docResult.isNew) {
          const isExistingMerchant = await merchantAccountExists({
            uid: user.uid,
            email: user.email,
          });
          if (isExistingMerchant) {
            navigate("/dashboard", { replace: true });
            return;
          }
          sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, "/find-your-store?onboarding=1");
          navigate("/find-your-store?onboarding=1", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // OTP: defer focus so mobile Safari/Chrome actually move to the next box (sync focus in onChange is ignored).
  const focusOtpIndex = (i) => {
    const el = otpRefs.current[i];
    if (!el) return;
    const run = () => {
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    };
    // Double rAF + micro-delay improves iOS keyboard / focus reliability.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(run, 0);
      });
    });
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
    if (e.key === "Backspace") {
      if (otp[index]) {
        // clear current
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        e.preventDefault();
        focusOtpIndex(index - 1);
      }
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
        <div className="auth-hero-inner">
          <div className="auth-hero-card">
            {(step === "otp" || step === "emailSent") && (
              <button
                type="button"
                className="auth-hero-back"
                onClick={() => {
                  setStep("form");
                  setOtp(["", "", "", "", "", ""]);
                  setOtpError("");
                  setError("");
                }}
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            <AuthBrandMark />

            {step === "emailSent" && (
              <div>
                <div className="flex justify-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-[#e8f5e9] flex items-center justify-center">
                    <Mail className="h-7 w-7 text-[#03c55b]" />
                  </div>
                </div>
                <h2 className="auth-hero-title">Check Your Email</h2>
                <p className="auth-hero-muted text-center">We&apos;ve sent a sign-in link to</p>
                <p className="auth-hero-email text-center">{email}</p>
                <p className="auth-hero-fine text-center mb-6">
                  Click the link in the email to sign in.
                  <br />
                  If you don&apos;t see it, check your spam or junk folder.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    window.open("https://mail.google.com", "_blank", "noopener,noreferrer");
                  }}
                  className="auth-btn-primary"
                >
                  <Mail className="h-7 w-7" />
                  Open Gmail
                </Button>
              </div>
            )}

            {step === "form" && (
              <>
                <h2 className="auth-hero-title auth-hero-title--spaced">Log In</h2>

                <div className="auth-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "email"}
                    className={`auth-tab ${activeTab === "email" ? "auth-tab--active" : ""}`}
                    onClick={() => {
                      setActiveTab("email");
                      setError("");
                      setStep("form");
                      setOtp(["", "", "", "", "", ""]);
                      setOtpError("");
                      setConfirmationResult(null);
                    }}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "phone"}
                    className={`auth-tab ${activeTab === "phone" ? "auth-tab--active" : ""}`}
                    onClick={() => {
                      setActiveTab("phone");
                      setError("");
                    }}
                  >
                    Phone number
                  </button>
                </div>

                {error && (
                  <p className="text-red-500 text-sm text-center mb-3 whitespace-pre-line px-1">{error}</p>
                )}

                {activeTab === "email" && (
                  <form onSubmit={handleSendEmailLink} className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="auth-input pl-10"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={loading} className="auth-btn-primary">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Send Login Link"}
                    </Button>
                    <p className="auth-helper">
                      We&apos;ll send a sign-in link to your email. No password needed.
                    </p>
                  </form>
                )}

                {activeTab === "phone" && (
                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <div className="auth-phone-row">
                      <div className="relative" ref={countryDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setCountryDropdownOpen((prev) => !prev)}
                          className="auth-country-btn"
                        >
                          {"\u00A0"}
                          <img
                            src={getFlagCdnUrl((countryCodes.find((c) => c.code === countryCode) || countryCodes[0]).flag)}
                            alt=""
                            className="h-[18px] w-6 object-cover flex-shrink-0 rounded-sm"
                            loading="lazy"
                          />
                          <span className="text-gray-800">{countryCode}</span>
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
                          <div className="absolute z-50 mt-1 w-[160px] rounded-xl border border-gray-200 bg-white shadow-lg py-1 max-h-60 overflow-auto">
                            {countryCodes.map((c) => (
                              <button
                                key={c.code}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setCountryCode(c.code);
                                  setCountryDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${countryCode === c.code ? "bg-primary/10" : ""}`}
                              >
                                <img
                                  src={getFlagCdnUrl(c.flag)}
                                  alt=""
                                  className="h-[16px] w-[22px] object-cover flex-shrink-0"
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
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                          className="auth-input pl-10 w-full"
                          required
                        />
                      </div>
                    </div>
                    {phoneOtpRateLimited ? (
                      <p className="text-sm text-center text-amber-900 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3">
                        SMS is temporarily limited. Retry in{" "}
                        <strong>{formatRetryAfter(phoneOtpRateLimitSecondsLeft)}</strong> or use the Email tab.
                      </p>
                    ) : null}
                    <div className="space-y-1">
                      <div
                        id={loginRecaptchaContainerIdRef.current}
                        className="auth-recaptcha-slot flex justify-center min-h-[78px]"
                      />
                      {loginRecaptchaSetupError ? (
                        <p className="text-red-500 text-sm text-center px-1">{loginRecaptchaSetupError}</p>
                      ) : null}
                      {loginRecaptchaReady && !loginRecaptchaInvisible && !loginCaptchaSolved ? (
                        <p className="auth-helper text-center">Complete the checkbox above to continue.</p>
                      ) : null}
                      {loginRecaptchaReady && loginRecaptchaInvisible ? (
                        <p className="auth-helper text-center">Tap Continue — a security check may run before SMS is sent.</p>
                      ) : null}
                    </div>
                    <Button
                      type="submit"
                      disabled={
                        loading
                        || phoneOtpRateLimited
                        || !loginRecaptchaReady
                        || (!loginRecaptchaInvisible && !loginCaptchaSolved)
                      }
                      className="auth-btn-primary"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Continue"}
                    </Button>
                  </form>
                )}

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
                    onClick={handleGoogleLogin}
                    disabled={loading}
                  >
                    {googleIcon}
                  </button>
                  {/* <button type="button" className="auth-social-circle" aria-label="Continue with Apple" disabled={loading}>
                    <img src={publicUrl("apple-logo.png")} alt="" className="h-5 w-5 object-contain" />
                  </button> */}
                </div>

                <p className="auth-footer-link">
                  Don&apos;t have an account?{" "}
                  <Link to="/register">Sign up</Link>
                </p>
              </>
            )}

            {step === "otp" && activeTab === "phone" && (
              <div>
                <h2 className="auth-hero-title">Verify OTP</h2>
                <p className="auth-hero-muted text-center mb-4">
                  Enter the OTP sent to{" "}
                  <span className="font-semibold text-gray-800">
                    {countryCode} {phone}
                  </span>
                </p>
                {phoneOtpRateLimited ? (
                  <p className="text-sm text-center text-amber-900 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3 mb-4">
                    SMS is temporarily limited. Retry in{" "}
                    <strong>{formatRetryAfter(phoneOtpRateLimitSecondsLeft)}</strong> or switch to email from the previous screen.
                  </p>
                ) : null}
                <div className="space-y-1 mb-4">
                  <div
                    id={loginRecaptchaContainerIdRef.current}
                    className="auth-recaptcha-slot flex justify-center min-h-[78px]"
                  />
                  {loginRecaptchaSetupError ? (
                    <p className="text-red-500 text-sm text-center px-1">{loginRecaptchaSetupError}</p>
                  ) : null}
                  {loginRecaptchaReady && !loginRecaptchaInvisible && !loginCaptchaSolved ? (
                    <p className="auth-helper text-center">Complete the reCAPTCHA to resend the SMS code.</p>
                  ) : null}
                  {loginRecaptchaReady && loginRecaptchaInvisible ? (
                    <p className="auth-helper text-center">Tap Send Again — a security check may run before SMS is sent.</p>
                  ) : null}
                </div>
                <form onSubmit={handleVerifyOTP}>
                  <div className="auth-otp-grid" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        value={digit}
                        onInput={(e) => handleOtpChange(i, e.currentTarget.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="auth-otp-cell"
                      />
                    ))}
                  </div>
                  {otpError && (
                    <p className="text-red-500 text-sm text-center mb-3 whitespace-pre-line px-1">{otpError}</p>
                  )}
                  <Button type="submit" disabled={loading || otp.join("").length < 6} className="auth-btn-primary">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Verify & Continue"}
                  </Button>
                  <p className="auth-helper mt-4">
                    Didn&apos;t receive the code?{" "}
                    {resendCooldown > 0 ? (
                      <span className="font-medium text-gray-500">Resend in {resendCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={
                          loading
                          || phoneOtpRateLimited
                          || !loginRecaptchaReady
                          || (!loginRecaptchaInvisible && !loginCaptchaSolved)
                        }
                        className="font-semibold text-[#0b3d1b] underline"
                      >
                        Send Again
                      </button>
                    )}
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
