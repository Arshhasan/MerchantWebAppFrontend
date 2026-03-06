import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn, signInWithGoogle } from '../../firebase/auth';
import './Auth.css';

const Login = ({ onLogin }) => {
  const [loginMethod, setLoginMethod] = useState('phone'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('us');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const countries = [
    { code: 'us', flag: '🇺🇸', name: 'United States', dialCode: '+1' },
    { code: 'gb', flag: '🇬🇧', name: 'United Kingdom', dialCode: '+44' },
    { code: 'in', flag: '🇮🇳', name: 'India', dialCode: '+91' },
    { code: 'pk', flag: '🇵🇰', name: 'Pakistan', dialCode: '+92' },
    { code: 'ae', flag: '🇦🇪', name: 'United Arab Emirates', dialCode: '+971' },
    { code: 'au', flag: '🇦🇺', name: 'Australia', dialCode: '+61' },
    { code: 'de', flag: '🇩🇪', name: 'Germany', dialCode: '+49' },
    { code: 'fr', flag: '🇫🇷', name: 'France', dialCode: '+33' },
    { code: 'ca', flag: '🇨🇦', name: 'Canada', dialCode: '+1' },
    { code: 'mx', flag: '🇲🇽', name: 'Mexico', dialCode: '+52' },
  ];

  const selectedCountry = countries.find(c => c.code === countryCode) || countries[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (loginMethod === 'email') {
      if (!email || !password) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      const result = await signIn(email, password);
      if (result.success) {
        if (onLogin) onLogin();
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed. Please try again.');
        setLoading(false);
      }
    } else {
      // Phone number login - you can implement phone auth later
      setError('Phone number login is not yet implemented. Please use email login.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await signInWithGoogle();
      if (result.success) {
        if (onLogin) onLogin();
        navigate('/dashboard');
      } else {
        setError(result.error || 'Google sign-in failed. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      setError('An error occurred during Google sign-in.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Left Panel - Login Form */}
      <div className="login-left-panel">
        <div className="login-form-wrapper">
          {/* Logo */}
          <div className="auth-logo-section">
            <div className="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8 2 4.5 4.5 4.5 8.5C4.5 12.5 8 15 12 15C16 15 19.5 12.5 19.5 8.5C19.5 4.5 16 2 12 2Z" fill="#013727"/>
                <path d="M8 18C6 18 4.5 19.5 4.5 21.5C4.5 23.5 6 25 8 25C10 25 11.5 23.5 11.5 21.5C11.5 19.5 10 18 8 18Z" fill="#013727"/>
                <path d="M16 18C14 18 12.5 19.5 12.5 21.5C12.5 23.5 14 25 16 25C18 25 19.5 23.5 19.5 21.5C19.5 19.5 18 18 16 18Z" fill="#013727"/>
              </svg>
            </div>
            <div className="logo-text">
              <h2 className="logo-brand">bestby bites</h2>
              <div className="logo-tagline-container">
                <p className="logo-tagline">FOOD MARKETPLACE</p>
                <div className="logo-line"></div>
              </div>
            </div>
          </div>

          {/* Login Header */}
          <div className="auth-title-section">
            <h1>Log In</h1>
          </div>

        {/* Login Method Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${loginMethod === 'email' ? 'active' : ''}`}
            onClick={() => setLoginMethod('email')}
          >
            Email
          </button>
          <button
            type="button"
            className={`auth-tab ${loginMethod === 'phone' ? 'active' : ''}`}
            onClick={() => setLoginMethod('phone')}
          >
            Phone number
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="auth-form">
              {loginMethod === 'email' ? (
                <>
                  <div className="input-group">
                    <div className="input-with-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4H20C21.1046 4 22 4.89543 22 6V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V6C2 4.89543 2.89543 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>
                  <div className="input-group">
                    <div className="input-with-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          {showPassword ? (
                            <>
                              <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </>
                          ) : (
                            <>
                              <path d="M17.94 17.94C16.2306 19.243 14.1491 20.4641 12 20.4641C5 20.4641 1 12.4641 1 12.4641C2.24389 10.1533 3.96914 8.05491 6.06 6.34M14.12 14.12C13.8454 14.4147 13.5141 14.6511 13.1462 14.8151C12.7782 14.9791 12.3809 15.0673 11.9781 15.0744C11.5753 15.0815 11.1751 15.0074 10.8016 14.8565C10.4281 14.7056 10.0887 14.481 9.80385 14.1961C9.51897 13.9113 9.29439 13.5719 9.14351 13.1984C8.99262 12.8249 8.91853 12.4247 8.92563 12.0219C8.93274 11.6191 9.02091 11.2218 9.18488 10.8538C9.34884 10.4859 9.58525 10.1546 9.88 9.88M1 1L23 23M14.12 14.12L1 1M14.12 14.12L9.88 9.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="auth-actions">
                    <Link to="#" className="forgot-password">
                      Forgot Password?
                    </Link>
                  </div>
                </>
              ) : (
                <div className="input-group">
                  <div className="phone-input-group">
                    <div className="country-select-wrapper">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="country-code-select"
                      >
                        {countries.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.code.toUpperCase()} {country.dialCode}
                          </option>
                        ))}
                      </select>
                      <div className="country-select-display">
                        <span className="country-flag">{selectedCountry.flag}</span>
                        <span className="country-code-text">{selectedCountry.code.toUpperCase()} {selectedCountry.dialCode}</span>
                        <svg className="dropdown-arrow" width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L6 6L11 1" stroke="#9e9e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <div className="phone-input-wrapper">
                      <svg className="phone-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 16.92V19.92C22 20.52 21.52 21 20.92 21C9.4 21 0 11.6 0 0.08C0 -0.52 0.48 -1 1.08 -1H4.08C4.68 -1 5.16 -0.52 5.16 0.08C5.16 1.08 5.28 2.04 5.52 2.96C5.64 3.4 5.56 3.88 5.24 4.2L3.68 5.76C4.96 8.48 7.52 11.04 10.24 12.32L11.8 10.76C12.12 10.44 12.6 10.36 13.04 10.48C13.96 10.72 14.92 10.84 15.92 10.84C16.52 10.84 17 11.32 17 11.92V14.92C17 15.52 16.52 16 15.92 16Z" stroke="#9e9e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter phone number"
                        className="phone-number-input"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="auth-error-message">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-continue" disabled={loading}>
                {loading ? 'Please wait...' : 'Continue'}
              </button>

              <div className="separator">
                <span>or</span>
              </div>

              <div className="social-login">
                <button type="button" className="social-btn facebook-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 2H15C13.6739 2 12.4021 2.52678 11.4645 3.46447C10.5268 4.40215 10 5.67392 10 7V10H7V14H10V22H14V14H17L18 10H14V7C14 6.73478 14.1054 6.48043 14.2929 6.29289C14.4804 6.10536 14.7348 6 15 6H18V2Z" fill="#1877F2"/>
                  </svg>
                  <span>Continue with Facebook</span>
                </button>
                <button 
                  type="button" 
                  className="social-btn google-btn" 
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.51H17.94C17.66 15.99 16.88 17.24 15.71 18.09V21.09H19.28C21.36 19.13 22.56 16.38 22.56 12.25Z" fill="#4285F4"/>
                    <path d="M12 23C14.97 23 17.46 22.01 19.28 20.09L15.71 17.09C14.73 17.75 13.48 18.14 12 18.14C9.11 18.14 6.72 16.22 5.84 13.59H2.18V16.68C3.99 20.27 7.7 23 12 23Z" fill="#34A853"/>
                    <path d="M5.84 13.59C5.63 12.99 5.5 12.35 5.5 11.68C5.5 11.01 5.63 10.37 5.84 9.77V6.68H2.18C1.52 8.04 1.14 9.57 1.14 11.18C1.14 12.79 1.52 14.32 2.18 15.68L5.84 13.59Z" fill="#FBBC05"/>
                    <path d="M12 5.14C13.55 5.14 14.96 5.63 16.1 6.58L19.35 3.33C17.45 1.58 14.97 0.68 12 0.68C7.7 0.68 3.99 3.41 2.18 7L5.84 10.09C6.72 7.46 9.11 5.14 12 5.14Z" fill="#EA4335"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
                <button type="button" className="social-btn apple-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.05 20.28C16.07 21.28 14.87 21.47 13.67 21.36C12.43 21.25 11.27 21.25 10.13 21.36C8.97 21.47 7.65 21.25 6.78 20.28C4.17 17.43 4.69 12.1 7.12 9.07C8.12 7.85 9.49 7.1 10.9 7.1C12.31 7.1 13.37 7.85 14.37 9.07C12.84 10.04 11.8 11.79 11.8 13.83C11.8 16.08 13.12 17.95 15.12 18.78C14.5 19.65 13.78 20.28 13.05 20.28H17.05ZM10.28 6.78C10.07 4.23 12.14 2.18 14.47 2C14.76 4.81 12.37 7.05 10.28 6.78Z" fill="currentColor"/>
                  </svg>
                  <span>Continue with Apple Id</span>
                </button>
              </div>
            </form>

            {/* Footer Link */}
            <div className="auth-footer-link">
              <p>
                Don't have an account? <Link to="/register">Sign up</Link>
              </p>
            </div>
        </div>
      </div>

      {/* Right Panel - Welcome Section (Web Only) */}
      <div className="login-right-panel">
        <div className="welcome-background">
          <img 
            src="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1600&q=80" 
            alt="Food background" 
            className="welcome-image"
          />
          <div className="welcome-overlay"></div>
        </div>
        <div className="welcome-content">
          <h2>Welcome Back!</h2>
          <p>Continue your journey with Bestby Bites and discover amazing deals on quality food.</p>
          <ul className="welcome-features">
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Access your saved favorites</span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Track your orders in real-time</span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Get personalized recommendations</span>
            </li>
          </ul>
        </div>
        <div className="welcome-footer-icons">         
        </div>
      </div>
    </div>
  );
};

export default Login;
