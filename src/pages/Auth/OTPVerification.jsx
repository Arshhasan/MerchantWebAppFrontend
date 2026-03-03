import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

const OTPVerification = ({ onLogin }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const navigate = useNavigate();

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

  const handleSubmit = (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length === 6) {
      // Static verification - redirect to store signup
      navigate('/store-signup');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png" alt="Logo" className="auth-logo" />
          <h1>OTP Verification</h1>
          <p>Enter the 6-digit code sent to your email</p>
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
          <button type="submit" className="btn btn-primary btn-full">
            Verify OTP
          </button>
          <div className="auth-footer">
            <p>
              Didn't receive code? <Link to="#" className="resend-link">Resend</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OTPVerification;
