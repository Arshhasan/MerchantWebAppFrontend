import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, CheckCircle, Gift, Loader2, Mail, Phone, User } from "lucide-react";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  getAdditionalUserInfo,
  signInWithPopup,
  sendSignInLinkToEmail,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth } from "../../firebase/config";
import { createUserDocument } from "../../firebase/auth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { publicUrl } from "../../utils/publicUrl";
import AuthBrandMark from "./AuthBrandMark";
import "./Auth.css";

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
  const [referralCode, setReferralCode] = useState("");

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

  const otpRefs = useRef([]);
  const countryDropdownRef = useRef(null);

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

  // Setup recaptcha for phone OTP (only if phone is not already verified)
  useEffect(() => {
    if (phonePreFilled || phoneVerified) return;

    const setup = async () => {
      try {
        window.signupRecaptchaVerifier = new RecaptchaVerifier(
          auth,
          "signup-recaptcha-container",
          {
            size: "invisible",
            callback: () => { },
            "expired-callback": () => { },
          }
        );
        await window.signupRecaptchaVerifier.render();
      } catch (err) {
        console.warn("reCAPTCHA setup failed:", err);
      }
    };

    setup();

    return () => {
      try {
        window.signupRecaptchaVerifier?.clear?.();
      } catch (_) {
        // ignore
      }
    };
  }, [phonePreFilled, phoneVerified]);

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

  const handleSendEmailLink = async (e) => {
    e.preventDefault();
    setEmailError("");

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address first.");
      return;
    }

    setEmailLoading(true);
    try {
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
        })
      );

      window.localStorage.setItem("emailForSignIn", email.trim());

      await sendSignInLinkToEmail(auth, email.trim(), {
        url: `${window.location.origin}/email-link-handler`,
        handleCodeInApp: true,
      });

      setEmailLinkSent(true);
      setEmailResendCooldown(60);
    } catch (err) {
      const firebaseError = err;
      setEmailError(firebaseError?.code === "auth/too-many-requests"
        ? "Too many attempts. Please try again later."
        : firebaseError?.message || "Failed to send verification email.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResendEmailLink = async () => {
    if (emailResendCooldown > 0) return;
    if (!email.trim()) return;

    setEmailLoading(true);
    setEmailError("");
    try {
      window.localStorage.setItem("emailForSignIn", email.trim());
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: `${window.location.origin}/email-link-handler`,
        handleCodeInApp: true,
      });
      setEmailResendCooldown(60);
    } catch (err) {
      setEmailError(err?.message || "Failed to resend verification email.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendPhoneOTP = async () => {
    if (!phone.trim()) {
      setOtpError("Please enter your phone number first.");
      return;
    }
    setOtpError("");
    setOtpLoading(true);

    try {
      const fullPhone = `${countryCode}${phone.trim()}`;

      if (!window.signupRecaptchaVerifier) {
        setOtpError("reCAPTCHA is not ready yet. Please try again in a moment.");
        return;
      }

      const result = await signInWithPhoneNumber(auth, fullPhone, window.signupRecaptchaVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setResendCooldown(30);
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
      const fullPhone = `${countryCode}${phone.trim()}`;

      if (!window.signupRecaptchaVerifier) {
        setOtpError("reCAPTCHA is not ready yet. Please try again in a moment.");
        return;
      }

      const result = await signInWithPhoneNumber(auth, fullPhone, window.signupRecaptchaVerifier);
      setConfirmationResult(result);
      setResendCooldown(30);
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
    if (!email.trim()) return "Please enter your email address.";
    if (!/\S+@\S+\.\S+/.test(email)) return "Please enter a valid email address.";
    if (!emailVerified) return "Please verify your email address first.";
    if (!phone.trim()) return "Please enter your phone number.";
    if (!phoneVerified) return "Please verify your phone number first.";
    return null;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const uid = navState.uid || auth.currentUser?.uid;
      if (!uid) throw new Error("Authentication error. Please try again.");

      const provider =
        signupType === "mobileNumber"
          ? "phone"
          : signupType === "emailLink" || signupType === "direct"
            ? "email"
            : signupType;

      // Phone OTP in this screen can be confirmed via an ephemeral auth instance.
      // Use that verified user as fallback when main `auth.currentUser` is not yet set.
      const userForProfile =
        auth.currentUser ||
        verifiedOtpUser ||
        {
          uid,
          email: email.trim().toLowerCase(),
          photoURL: null,
          providerData: [{ providerId: provider === "phone" ? "phone" : "password" }],
        };

      const result = await createUserDocument(userForProfile, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phone.trim(),
        countryCode,
        provider,
        referralCode: referralCode.trim() || null,
      });

      if (!result?.success) throw new Error(result?.error || "Failed to create profile");

      window.localStorage.removeItem("signupFormState");

      navigate("/business-category?onboarding=1", { replace: true });
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
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const additionalInfo = getAdditionalUserInfo(result);

      if (additionalInfo?.isNewUser) {
        const user = result.user;
        const nameParts = user.displayName?.split(" ") || [];
        navigate("/register", {
          state: {
            type: "google",
            uid: user.uid,
            email: user.email || "",
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
          },
        });
      } else {
        navigate("/dashboard");
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
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative" ref={countryDropdownRef}>
          <button
            type="button"
            onClick={() => !phonePreFilled && setCountryDropdownOpen((prev) => !prev)}
            disabled={phonePreFilled}
            className="h-12 min-w-[75px] pl-[30px] pr-2 border border-gray-200 rounded-xl text-sm font-medium bg-white disabled:bg-gray-50 disabled:text-gray-500 flex items-center gap-2"
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

        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, ""));
              setPhoneVerified(false);
              setOtpSent(false);
            }}
            disabled={phonePreFilled || phoneVerified}
            className="pl-10 pr-4 h-12 rounded-xl border translate-x-[5px] border-gray-200 text-sm disabled:bg-gray-50 disabled:text-gray-500 text-center"
            required
          />
        </div>

        {!phonePreFilled && !phoneVerified && !otpSent && (
          <Button
            type="button"
            onClick={handleSendPhoneOTP}
            disabled={otpLoading || !phone.trim()}
            className="h-12 w-[70px] bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-xl text-sm font-semibold"
          >
            {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </Button>
        )}

        {phoneVerified && (
          <div className="h-12 w-[90px] bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-xl text-sm font-semibold ml-[5px]">
            <CheckCircle className="h-4 w-4 translate-x-[5px] translate-y-[18px] " />
             <div className="translate-x-[25px]">Verified</div> 
          </div>
        )}
      </div>

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

          {otpError && <p className="text-red-500 text-xs text-center">{otpError}</p>}

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <button type="button" onClick={handleResendOTP} disabled={otpLoading} className="font-semibold text-primary">
                  Resend OTP
                </button>
              )}
            </p>

            <Button
              type="button"
              onClick={handleVerifyPhoneOTP}
              disabled={otpLoading || otp.join("").length < 6}
              className="h-9 px-4 bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-lg text-sm font-semibold"
            >
              {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm OTP"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const formFields = (
    <form onSubmit={handleSignup} className="flex flex-col items-center space-y-3 w-full">

      {/* ✅ MAIN WRAPPER (IMPORTANT) */}
      <div className="max-w-[416px] mx-auto space-y-3">

        {/* NAME */}
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
        {/* <div className="h-[7px]" /> */}

        {/* EMAIL */}
        <div className="space-y-2">
          <div className="flex gap-2 w-full">

            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailVerified(emailPreVerified);
                  setEmailLinkSent(false);
                }}
                disabled={emailPreVerified || emailVerified}
                className="pl-10 h-12 rounded-xl border border-gray-200 text-sm text-center w-full"
                required
              />
            </div>

            {!emailPreVerified && !emailVerified && !emailLinkSent && (
              <Button
                type="button"
                onClick={handleSendEmailLink}
                disabled={emailLoading || !email.trim()}
                className="h-12 w-[70px] bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-xl text-sm font-semibold"
              >
                {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
            )}

            {emailVerified && (
              <div className="h-12 px-3 flex items-center gap-1 text-green-600 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Verified
              </div>
            )}
          </div>

          {/* Email link sent message (shown below email row) */}
          {emailLinkSent && !emailVerified && (
            <div className="bg-green-50 rounded-xl p-4 space-y-2 text-center">
                            {/* <div className="h-[4px]" /> */}

              <div className="flex items-center justify-center gap-2 text-green-700 text-sm font-medium">
<Mail className="h-4 w-4 translate-x-[25px]" />
                Verification link sent to {email}
              </div>
                            <div className="h-[7px]" />

              <p className="text-xs text-gray-500">
                Click the link in your email to verify. Check spam folder if not found.
              </p>
                            {/* <div className="h-[4px]" /> */}

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
        {/* <div className="h-[7px]" /> */}

        {/* PHONE */}
        {phoneVerificationUI}
        {/* <div className="h-[7px]" /> */}

        {/* REFERRAL */}
        <div className="relative">
          <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Referral Code (Optional)"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            className="pl-10 h-12 rounded-xl border border-gray-200 text-sm text-center w-full"
          />
        </div>
        {/* <div className="h-[7px]" /> */}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        {/* SUBMIT */}
        <Button
          type="submit"
          disabled={loading}
          className="auth-btn-primary"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Sign Up"}
        </Button>

      </div>
    </form>
  );

  return (
    <>
      <div id="signup-recaptcha-container" />

      <div
        className="auth-hero-page"
        style={{ "--auth-bg-image": `url(${publicUrl("loginsignupbg.jpg")})` }}
      >
        <div className="auth-hero-overlay" aria-hidden />
        <div className="auth-hero-inner auth-hero-inner--register">
          <div className="auth-hero-card">
            <Link to="/login" className="auth-hero-back" aria-label="Back to login">
              <ChevronLeft className="h-5 w-5" />
            </Link>

            <AuthBrandMark />

            <h2 className="auth-hero-title">
              {isPreAuthenticated ? "Complete Profile" : "Create Account"}
            </h2>
            <p className="auth-hero-sublead">
              {isPreAuthenticated
                ? "Just a few more details to get started"
                : "Create an account with your Email or Mobile Number"}
            </p>

            {formFields}

            {!isPreAuthenticated && (
              <>
                <div className="auth-or">
                  <div className="auth-or-line" />
                  <span className="auth-or-text">or</span>
                  <div className="auth-or-line" />
                </div>

                <div className="auth-social-row">
                  <button type="button" className="auth-social-circle" aria-label="Continue with Facebook" disabled={loading}>
                    {facebookIcon}
                  </button>
                  <button
                    type="button"
                    className="auth-social-circle"
                    aria-label="Continue with Google"
                    onClick={handleGoogleSignup}
                    disabled={loading}
                  >
                    {googleIcon}
                  </button>
                  <button type="button" className="auth-social-circle" aria-label="Continue with Apple" disabled={loading}>
                    <img src={publicUrl("apple-logo.png")} alt="" className="h-5 w-5 object-contain" />
                  </button>
                </div>
              </>
            )}

            <p className="auth-footer-link">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
