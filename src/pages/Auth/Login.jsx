import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Apple, ChevronLeft, Loader2, Mail, Phone } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  getAdditionalUserInfo,
  initializeRecaptchaConfig,
  sendSignInLinkToEmail,
  signInWithPhoneNumber,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../../firebase/config";

// Country codes list
const countryCodes = [
  { code: "+1", flag: "🇺🇸", name: "US" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+91", flag: "🇮🇳", name: "IN" },
  { code: "+92", flag: "🇵🇰", name: "PK" },
  { code: "+971", flag: "🇦🇪", name: "AE" },
  { code: "+61", flag: "🇦🇺", name: "AU" },
  { code: "+49", flag: "🇩🇪", name: "DE" },
  { code: "+33", flag: "🇫🇷", name: "FR" },
];

export default function Login() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("phone"); // "email" | "phone"
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
  const recaptchaContainerRef = useRef(null);

  // Create RecaptchaVerifier once on mount — recreating it causes token field mismatches
  useEffect(() => {
    const setup = async () => {
      if (window.location.hostname !== "localhost") {
        await initializeRecaptchaConfig(auth).catch(() => { });
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => { },
        "expired-callback": () => { },
      });
      await window.recaptchaVerifier.render();
    };
    setup();
    return () => {
      try {
        window.recaptchaVerifier?.clear();
      } catch (_) { }
    };
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Please enter your phone number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (!window.recaptchaVerifier) {
        setError("reCAPTCHA is not ready yet. Please try again in a moment.");
        return;
      }
      const fullPhone = `${countryCode}${phone.trim()}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      // Support the separate `/otp-verification` screen by persisting what it needs.
      sessionStorage.setItem("otpPhoneNumber", fullPhone);
      window.__bbb_confirmationResult = result;
      setConfirmationResult(result);
      setStep("otp");
      setResendCooldown(30);
    } catch (err) {
      const code = err?.code;
      if (code === "auth/invalid-phone-number") setError("Invalid phone number. Please check and try again.");
      else if (code === "auth/too-many-requests") setError("Too many attempts. Please try again later.");
      else setError(err?.message || "Failed to send OTP. Please check your phone number and try again.");
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
      if (!window.recaptchaVerifier) {
        setOtpError("reCAPTCHA is not ready yet. Please try again in a moment.");
        return;
      }
      const fullPhone = `${countryCode}${phone.trim()}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      sessionStorage.setItem("otpPhoneNumber", fullPhone);
      window.__bbb_confirmationResult = result;
      setConfirmationResult(result);
      setResendCooldown(30);
    } catch (err) {
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
        const isNewUser = getAdditionalUserInfo(result)?.isNewUser;
        if (isNewUser) {
          // Clear transient OTP state.
          sessionStorage.removeItem("otpPhoneNumber");
          delete window.__bbb_confirmationResult;
          navigate("/register", {
            state: {
              type: "mobileNumber",
              uid: result.user.uid,
              phoneNumber: phone,
              countryCode,
              phoneVerified: true,
            },
          });
        } else {
          sessionStorage.removeItem("otpPhoneNumber");
          delete window.__bbb_confirmationResult;
          navigate("/dashboard");
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
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: `${window.location.origin}/email-link-handler`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem("emailForSignIn", email.trim());
      setStep("emailSent");
    } catch (err) {
      const code = err?.code;
      if (code === "auth/invalid-email") setError("Invalid email address.");
      else if (code === "auth/too-many-requests") setError("Too many attempts. Please try again later.");
      else setError(err?.message || "Failed to send login link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
            emailVerified: true,
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

  // OTP box key navigation
  const handleOtpChange = (index, value) => {
  if (!/^\d*$/.test(value)) return;

  const newOtp = [...otp];
  newOtp[index] = value.slice(-1); // only last digit
  setOtp(newOtp);

  // 👉 Move to next box
  if (value && index < otp.length - 1) {
    otpRefs.current[index + 1]?.focus();
  }
};

  const handleOtpKeyDown = (index, e) => {
  if (e.key === "Backspace") {
    if (otp[index]) {
      // clear current
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
    } else if (index > 0) {
      // move back
      otpRefs.current[index - 1]?.focus();
    }
  }
};

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
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
      {/* Invisible reCAPTCHA container */}
      <div ref={recaptchaContainerRef} id="recaptcha-container" />

      <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2">
        {/* Mobile */}
        <div className="flex-1 flex flex-col lg:hidden bg-white">
          <div className="flex flex-col items-center pt-10 pb-6 px-4 relative">
            {(step === "otp" || step === "emailSent") && (
              <button
                onClick={() => { setStep("form"); setOtp(["", "", "", "", "", ""]); setOtpError(""); setError(""); }}
                className="absolute top-4 left-4"
              >
                <ChevronLeft className="h-5 w-5 text-gray-900" />
              </button>
            )}
            <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png" alt="BestBy Bites Merchant Logo" className="h-56" />
          </div>

          <div className="bg-[#0cc55c] rounded-t-[2rem] h-[50px] flex items-center justify-center relative">
            <h2 className="text-2xl font-bold text-white text-center">
              {step === "otp" ? "Verify OTP" : step === "emailSent" ? "Email Sent" : "Log In"}
            </h2>
          </div>

          <div className="flex-1 bg-white px-6 pt-6 pb-8 rounded-t-[2rem] -mt-6 relative z-10">
            {step === "emailSent" && (
              <div className="pt-2 text-center">
                <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-5">
                  <Mail className="h-7 w-7 text-[#0cc55c]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Check Your Email</h3>
                <p className="text-sm text-gray-500 mb-1">We've sent a sign-in link to</p>
                <p className="text-sm font-semibold text-gray-800 mb-6">{email}</p>
                <p className="text-xs text-gray-400 mb-6">
                  Click the link in the email to sign in. If you don't see it, check your spam folder.
                </p>
                <Button onClick={() => { setStep("form"); setError(""); }} variant="outline" className="mx-auto w-[70%] h-12 rounded-full text-base font-semibold">
                  Back to Login
                </Button>
              </div>
            )}

            {step === "form" && (
              <>
                <div className="flex mb-0">
                  <button
                    onClick={() => { setActiveTab("email"); setError(""); }}
                    className={`flex-1 pb-2.5 text-center font-medium text-sm transition-all ${activeTab === "email" ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-400 border-b border-gray-200"}`}
                  >
                    Email
                  </button>
                  <button
                    onClick={() => { setActiveTab("phone"); setError(""); }}
                    className={`flex-1 pb-2.5 text-center font-medium text-sm transition-all ${activeTab === "phone" ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-400 border-b border-gray-200"}`}
                  >
                    Phone number
                  </button>
                </div>
                <div className="h-[20px]" />

                {activeTab === "email" && (
                  <div className="flex justify-center">
                    <div className="w-[70%]">
                      <form onSubmit={handleSendEmailLink} className="space-y-5 mt-5">

                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-12 rounded-xl border border-gray-200 text-sm bg-white w-full text-center"
                            required
                          />
                        </div>
                        <div className="h-[20px]" />

                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full h-12 bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-full text-base font-semibold shadow-md"
                        >
                          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Send Login Link"}
                        </Button>

                      </form>
                    </div>
                  </div>
                )}

                {activeTab === "phone" && (
                  <div className="flex justify-center">
                    <div className="w-[70%]">
                      <form onSubmit={handleSendOTP} className="space-y-5 mt-5">

                        <div className="flex gap-2 w-full">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="h-12 px-2 border border-gray-200 rounded-xl text-sm font-medium bg-white"
                          >
                            {countryCodes.map((c) => (
                              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                            ))}
                          </select>

                          <div className="relative flex-1">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />

                            <Input
                              type="tel"
                              placeholder="   Enter phone number"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                              className="pl-10 pr-10 h-12 rounded-xl border border-gray-200 text-sm text-center w-full"
                              required
                            />

                          </div>
                          <div className="h-[20px]" />

                        </div>
                        <div className="h-[20px]" />

                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full h-12 bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-full text-base font-semibold shadow-md"
                        >
                          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Continue"}
                        </Button>

                      </form>
                    </div>
                  </div>
                )}
                <div className="h-[20px]" />
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center text-sm"><span className="bg-white px-4 text-gray-400">or</span></div>
                </div>
                <div className="h-[5px]" />

                <div className="flex flex-col gap-[20px] items-center">
                  <button type="button" disabled={loading} className="mx-auto w-[70%] h-12 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center gap-4 px-6 border border-gray-200 transition-colors">
                    {facebookIcon}
                    <span className="font-medium text-sm text-gray-800">Continue with Facebook</span>
                  </button>
                  <button type="button" onClick={handleGoogleLogin} disabled={loading} className="mx-auto w-[70%] h-12 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center gap-4 px-6 border border-gray-200 transition-colors">
                    {googleIcon}
                    <span className="font-medium text-sm text-gray-800">Continue with Google</span>
                  </button>
                  <button type="button" disabled={loading} className="mx-auto w-[70%] h-12 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center gap-4 px-6 border border-gray-200 transition-colors">
                    <Apple className="h-5 w-5 text-black flex-shrink-0" />
                    <span className="font-medium text-sm text-gray-800">Continue with Apple Id</span>
                  </button>
                </div>
                <div className="h-[10px]" />

                <p className="text-center text-xs text-gray-400 mt-5">
                  Don't have an account?{" "}
                  <Link to="/register" className="font-semibold text-primary">Sign up</Link>
                </p>
                <div className="h-[10px]" />

              </>
            )}

            {step === "otp" && (
              <div className="pt-2">
                <div className="h-[30px]" />

                <p className="text-sm text-gray-500 mb-6 text-center">
                  Enter the OTP sent to <span className="font-semibold text-gray-800">{countryCode} {phone}</span>
                </p>
                <div className="h-[25px]" />

                <form onSubmit={handleVerifyOTP} className="space-y-5">
                  <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-11 h-12 text-center text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                      />
                    ))}
                  </div>
                  <div className="h-[30px]" />

                  {otpError && <p className="text-red-500 text-sm text-center">{otpError}</p>}
                  <Button
                    type="submit"
                    disabled={loading || otp.join("").length < 6}
                    className="block mx-auto w-[70%] h-12 bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-full text-base font-semibold shadow-md"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Verify & Continue"}
                  </Button>
                  <div className="h-[10px]" />

                  <p className="text-center text-sm text-gray-400">
                    Didn’t receive the code?{" "}
                    {resendCooldown > 0 ? (
                      <span className="font-medium">Resend in {resendCooldown}s</span>
                    ) : (
                      <button type="button" onClick={handleResendOTP} disabled={loading} className="font-semibold text-primary">Send Again</button>
                    )}
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Desktop form */}
        <div className="hidden lg:flex flex-1 bg-muted/30 items-center justify-center overflow-hidden">
          <div className="w-full max-w-sm mx-auto p-10">
            <div className="bg-white rounded-3xl shadow-2xl p-10 relative">

              <Link to="/" className="flex items-center justify-center mb-6">
                <img
                  src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png"
                  alt="BestBy Bites Merchant Logo"
                  className="h-56 w-auto object-contain"
                />
              </Link>

              {step === "form" && (
                <>
                  <h2 className="text-3xl font-bold mb-5 text-center">Log In</h2>


                  <div className="flex justify-center mt-[20px]">
                    <div className="w-full max-w-[320px] flex border-b">

                      <button
                        onClick={() => { setActiveTab("email"); setError(""); }}
                        className={`flex-1 h-[70px] flex items-center justify-center text-lg font-semibold ${activeTab === "email"
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground"
                          }`}
                      >
                        Email
                      </button>

                      <button
                        onClick={() => { setActiveTab("phone"); setError(""); }}
                        className={`flex-1 h-[70px] flex items-center justify-center text-lg font-semibold ${activeTab === "phone"
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground"
                          }`}
                      >
                        Phone number
                      </button>

                    </div>
                  </div>

                  <div className="h-[20px]" />
                  {/* EMAIL */}
                  {activeTab === "email" && (
                    <div className="flex justify-center ">
                      <div className="w-full max-w-[320px]">
                        <form onSubmit={handleSendEmailLink} className="space-y-5">

                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="Enter your email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="pl-10 h-14 rounded-xl border-2 text-base w-full text-center"
                              required
                            />
                          </div>

                          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                          <div className="h-[10px]" />

                          <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-full text-lg font-medium shadow-lg"
                          >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Send Login Link"}
                          </Button>

                        </form>
                      </div>
                    </div>
                  )}


                  {/* PHONE */}
                  {activeTab === "phone" && (
                    <div className="flex justify-center ">
                      <div className="w-full max-w-[320px]">
                        <form onSubmit={handleSendOTP} className="space-y-5">

                          <div className="flex gap-2">
                            <select
                              value={countryCode}
                              onChange={(e) => setCountryCode(e.target.value)}
                              className="h-14 px-2 border-2 rounded-xl text-sm font-medium"
                            >
                              {countryCodes.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.flag} {c.code}
                                </option>
                              ))}
                            </select>

                            <div className="relative flex-1">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="tel"
                                placeholder="Enter phone number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                className="pl-10 pr-10 h-14 rounded-xl border-2 text-base text-center w-full"
                                required
                              />

                            </div>
                            <div className="h-[20px]" />

                          </div>
                          <div className="h-[20px]" />

                          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                          <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-[#0cc55c] hover:bg-[#0bb352] text-white rounded-full text-lg font-medium shadow-lg"
                          >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Continue"}
                          </Button>

                        </form>
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="flex flex-col gap-[23px]">

                    {/* ABOVE ELEMENT (form / button etc.) */}
                    <div>
                      {/* your form or content */}
                    </div>

                    {/* DIVIDER */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t-2" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-4 text-muted-foreground font-medium">or</span>
                      </div>
                    </div>

                    {/* BELOW ELEMENT (social buttons) */}
                    <div>
                      {/* your social buttons */}
                    </div>

                  </div>

                  {/* ✅ CENTERED SOCIAL BUTTONS */}
                  <div className="flex flex-col items-center gap-4">

                    <button className="w-full max-w-[320px] h-12 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center gap-4 px-6 border border-gray-200 shadow-sm">
                      {facebookIcon}
                      <span className="font-medium text-sm">Continue with Facebook</span>
                    </button>

                    <button
                      onClick={handleGoogleLogin}
                      className="w-full max-w-[320px] h-12 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center gap-4 px-6 border border-gray-200 shadow-sm"
                    >
                      {googleIcon}
                      <span className="font-medium text-sm">Continue with Google</span>
                    </button>

                    <button className="w-full max-w-[320px] h-12 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center gap-4 px-6 border border-gray-200 shadow-sm">
                      <Apple className="h-5 w-5" />
                      <span className="font-medium text-sm">Continue with Apple Id</span>
                    </button>

                  </div>
                  <div className="h-[10px]" />

                  <div className="py-[10px]">
                    <p className="text-center text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <Link to="/register" className="font-semibold text-primary hover:underline">
                        Sign up
                      </Link>
                    </p>
                  </div>
                  <div className="h-[10px]" />

                </>
              )}

              {step === "otp" && (
                <div className="otp-page text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("form");
                      setActiveTab("phone");
                      setOtp(["", "", "", "", "", ""]);
                      setOtpError("");
                      setError("");
                    }}
                    className="absolute top-8 left-10 flex items-center gap-2 text-gray-500 hover:text-gray-800"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="font-medium text-base">Back</span>
                  </button>

                  <h2 className="text-3xl font-bold mt-6 mb-3">OTP Verification</h2>
                  <div className="h-[25px]" />

                  <p className="text-sm text-gray-500 mb-2">
                    To confirm your phone number,
                    <br />
                    <div className="h-[5px]" />

                    please enter the OTP we sent to
                    <div className="h-[5px]" />

                  </p>
                  <p className="text-sm font-semibold text-gray-800 mb-6">
                    {countryCode} {phone}
                  </p>
                  <div className="h-[25px]" />


                  <form onSubmit={handleVerifyOTP}>
                    <div className="otp-container flex justify-center gap-[10px] mt-6" onPaste={handleOtpPaste}>
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-12 h-14 rounded-xl border-2 border-gray-300 text-center text-lg font-semibold focus:border-[#0cc55c] focus:outline-none"
                          required
                        />
                      ))}
                    </div>

                    {otpError && (
                      <div className="auth-error-message" role="alert">
                        {otpError}
                      </div>
                    )}
                    <div className="h-[25px]" />

                    <p className="text-center text-sm text-gray-600 mt-3">
                      Didn&apos;t get the OTP?{" "}
                      {resendCooldown > 0 ? (
                        <span className="resend-link" style={{ color: "#9e9e9e", cursor: "not-allowed" }}>
                          Resend in {resendCooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          disabled={loading}
                          className="resend-link"
                        >
                          Resend
                        </button>
                      )}
                    </p>
                    <div className="h-[15px]" />

                    <p className="text-center text-xs text-gray-400 mt-3">
                      If you do not receive the OTP in your inbox,

                      <br />
                      please check your Spam or Junk folder.

                    </p>
                    <div className="h-[30px]" />

                    <div className="w-full max-w-[320px] mx-auto mt-6 flex justify-end pr-[20%]">
                      <button
                        type="submit"
                        disabled={loading}
                        className="rounded-full w-[70%] bg-[#0cc55c] hover:bg-[#0bb352] text-white h-12 font-semibold shadow-md"
                      >
                        {loading ? "Verifying..." : "Submit"}
                      </button>
                    </div>
                    <div className="auth-footer-link">
                      <p>
                        {" "}
                        <button
                          type="button"
                          onClick={() => {
                            setStep("form");
                            setActiveTab("phone");
                            setOtp(["", "", "", "", "", ""]);
                            setOtpError("");
                            setError("");
                          }}
                          className="resend-link"
                        >
                          Go back to login methods
                        </button>
                        <div className="h-[25px]" />

                      </p>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side image */}
        <div className="hidden lg:block relative bg-primary overflow-hidden">
          <img src="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1600&q=80" alt="Food" className="absolute inset-0 w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/70 to-primary/60 flex items-center justify-center p-12">
            <div className="text-white max-w-lg">
              <h2 className="text-5xl font-bold mb-6">Welcome Back!</h2>
              <div className="h-[40px]" />

              <p className="text-xl text-white/90 mb-8">Continue your journey with Bestby Bites and discover amazing deals on quality food.</p>
              <div className="h-[20px]" />

              <ul className="space-y-4">
                {["Access your saved favorites", "Track your orders in real-time", "Get personalized recommendations"].map((text, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 shadow-lg">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg">{text}</span>
                    <div className="h-[40px]" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

