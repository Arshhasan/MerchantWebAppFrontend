import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createRecaptchaVerifier, createUserDocument, sendPhoneOtp } from '../../firebase/auth';
import { publicUrl } from '../../utils/publicUrl';
import { merchantAccountExists } from '../../utils/merchantAccountExists';
import './Auth.css';

const OTPVerification = ({ onLogin }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const [timer, setTimer] = useState(30);
  const navigate = useNavigate();
  const otpRefs = useRef([]);

  const phoneNumberE164 = useMemo(() => sessionStorage.getItem('otpPhoneNumber') || '', []);
  const otpFlowIntent = useMemo(() => sessionStorage.getItem('otpFlowIntent') || 'login', []);

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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(run, 0);
      });
    });
  };

  useEffect(() => {
    // If user refreshes OTP page we lose confirmationResult (stored in memory). Send them back.
    if (!phoneNumberE164 || !window.__bbb_confirmationResult) {
      navigate('/login', { replace: true });
    }
  }, [navigate, phoneNumberE164]);

  useEffect(() => {
    let interval;
    if (isResendDisabled && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    if (timer === 0) {
      setIsResendDisabled(false);
      setTimer(30);
    }
    return () => clearInterval(interval);
  }, [isResendDisabled, timer]);

  const handleChange = (index, rawValue) => {
    const value = String(rawValue ?? '').replace(/\s+/g, '');
    if (!value) {
      setOtp((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    // Support autofill/paste into a single box ("123456") on mobile.
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6);
      if (!digits) return;

      const nextOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < digits.length; i += 1) nextOtp[i] = digits[i];
      setOtp(nextOtp);

      const nextIndex = Math.min(digits.length, 6) - 1;
      focusOtpIndex(Math.max(0, nextIndex));
      return;
    }

    if (!/^\d$/.test(value)) return;

    setOtp((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (index < 5) focusOtpIndex(index + 1);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      e.preventDefault();
      focusOtpIndex(index - 1);
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    const digits = String(text).replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    e.preventDefault();

    const nextOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length; i += 1) nextOtp[i] = digits[i];
    setOtp(nextOtp);

    const nextIndex = Math.min(digits.length, 6) - 1;
    focusOtpIndex(Math.max(0, nextIndex));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const otpValue = otp.join('');
    if (otpValue.length === 6) {
      try {
        setLoading(true);
        const confirmationResult = window.__bbb_confirmationResult;
        if (!confirmationResult) {
          setError('Session expired. Please request a new OTP.');
          navigate('/login', { replace: true });
          return;
        }

        const result = await confirmationResult.confirm(otpValue);

        const docResult = await createUserDocument(result.user, {
          phoneNumber: result.user.phoneNumber || phoneNumberE164,
          provider: 'phone',
        });

        if (!docResult?.success) {
          setError(docResult?.error || 'Failed to set up your account.');
          setLoading(false);
          return;
        }

        // Clear transient OTP state
        sessionStorage.removeItem('otpPhoneNumber');
        delete window.__bbb_confirmationResult;

        if (onLogin) onLogin();

        if (otpFlowIntent === 'signup') {
          navigate('/find-your-store?onboarding=1', { replace: true });
          return;
        }

        // Login should not set "skip onboarding" across tabs. If the merchant is not set up,
        // route into onboarding; otherwise go dashboard.
        if (docResult.isNew) {
          const isExistingMerchant = await merchantAccountExists({
            uid: result.user.uid,
            email: result.user.email,
          });
          if (!isExistingMerchant) {
            navigate('/find-your-store?onboarding=1', { replace: true });
            return;
          }
        }
        navigate('/welcome', { replace: true });
      } catch (err) {
        setError(err?.message || 'Invalid OTP. Please try again.');
        setLoading(false);
      }
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setError('');
    if (!phoneNumberE164) return;
    if (isResendDisabled) return;

    let verifier;
    try {
      setLoading(true);
      // Recreate reCAPTCHA verifier for resend
      verifier = createRecaptchaVerifier('recaptcha-container', { size: 'invisible' });
      const res = await sendPhoneOtp(phoneNumberE164, verifier);
      if (res.success) {
        window.__bbb_confirmationResult = res.confirmationResult;
        setOtp(['', '', '', '', '', '']);
        setIsResendDisabled(true);
        setTimer(30);
      } else {
        setError(res.error || 'Failed to resend OTP. Please try again.');
      }
    } catch (err) {
      setError(err?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      try {
        verifier?.clear();
      } catch {
        // ignore
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Left Panel - OTP Form */}
      <div className="login-left-panel">
        <div className="login-form-wrapper">
          {/* Logo */}
          <div className="auth-logo-section">
            <img src={publicUrl('logo-bestbbybites-merchant-dark-photoroom.png')} alt="Logo" className="auth-logo" />
          </div>

          {/* OTP Header */}
          <div className="auth-title-section">
          <h1>OTP Verification</h1>
            <p className="auth-subtitle">Enter the 6-digit code sent to your phone</p>
            {phoneNumberE164 && (
              <p style={{ marginTop: '0.5rem', color: '#757575', fontSize: '0.875rem' }}>{phoneNumberE164}</p>
            )}
        </div>

          <form onSubmit={handleSubmit} className="auth-form">
          <div className="otp-container" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { otpRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onFocus={(e) => {
                  if (!digit) return;
                  try {
                    e.target.setSelectionRange(1, 1);
                  } catch {
                    // ignore
                  }
                }}
                className="otp-input"
                required
              />
            ))}
          </div>
          {error && (
              <div className="auth-error-message" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}
            <button type="submit" className="btn-continue" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
            <div className="auth-footer-link">
            <p>
              Didn't receive code?{' '}
              <Link
                to="#"
                onClick={handleResend}
                  style={isResendDisabled ? { pointerEvents: 'none', opacity: 0.6, color: '#9e9e9e' } : { color: '#4CAF50', textDecoration: 'none' }}
              >
                {isResendDisabled ? `Resend in ${timer}s` : 'Resend'}
              </Link>
            </p>
          </div>
          {/* Firebase reCAPTCHA container (required for phone auth resend) */}
          <div id="recaptcha-container" />
        </form>
        </div>
      </div>

      {/* Right Panel - Welcome Section */}
      <div className="login-right-panel">
        <div className="welcome-background">
          <img 
            src={publicUrl('bestby-bites-website-banner-bg-3.jpg')} 
            alt="Welcome" 
            className="welcome-image"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
        <div className="welcome-overlay"></div>
        <div className="welcome-content">
          <h2>Verify Your Phone</h2>
          <p>We've sent a verification code to your phone number. Please enter it to continue.</p>
          <ul className="welcome-features">
            <li>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Secure verification</span>
            </li>
            <li>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Quick access</span>
            </li>
            <li>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Protect your account</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;
