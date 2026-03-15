import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createRecaptchaVerifier, createUserDocument, sendPhoneOtp } from '../../firebase/auth';
import './Auth.css';

const OTPVerification = ({ onLogin }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const [timer, setTimer] = useState(30);
  const navigate = useNavigate();

  const phoneNumberE164 = useMemo(() => sessionStorage.getItem('otpPhoneNumber') || '', []);

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

  const handleChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
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

        // Create/update user in Firestore as merchant
        await createUserDocument(result.user, {
          phoneNumber: result.user.phoneNumber || phoneNumberE164,
          provider: 'phone',
        });

        // Clear transient OTP state
        sessionStorage.removeItem('otpPhoneNumber');
        delete window.__bbb_confirmationResult;

        if (onLogin) onLogin();
        navigate('/dashboard', { replace: true });
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
            <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK-Photoroom.png" alt="Logo" className="auth-logo" />
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
            <div className="otp-container">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
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
            src="/BESTBY-BITES-WEBSITE-BANNER-bg-3-.jpg" 
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
