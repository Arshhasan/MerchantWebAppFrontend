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
    <div className="auth-container otp-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png" alt="Logo" className="auth-logo" />
          <h1>OTP Verification</h1>
          <p>Enter the 6-digit code sent to your phone</p>
          {phoneNumberE164 && <p style={{ marginTop: '0.25rem', color: '#757575' }}>{phoneNumberE164}</p>}
        </div>
        <form onSubmit={handleSubmit}>
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
            <div className="auth-error-message" style={{ marginTop: '0.75rem' }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <div className="auth-footer">
            <p>
              Didn't receive code?{' '}
              <Link
                to="#"
                onClick={handleResend}
                className="resend-link"
                style={isResendDisabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
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
  );
};

export default OTPVerification;
