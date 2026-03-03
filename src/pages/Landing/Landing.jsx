import { Link } from 'react-router-dom';
import './Landing.css';

const Landing = ({ onLogin }) => {
  return (
    <div className="landing-page">
      

      {/* Header Navigation */}
      <header className="landing-header">
        <div className="header-container">
          <div className="logo-section">
            <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png" alt="BestByBites" className="header-logo" />
            <span className="logo-text">Merchant Platform</span>
          </div>
          <div className="header-actions">
            <Link to="/register" className="btn btn-outline-header">
              Become a Partner
            </Link>
            <Link to="/login" className="btn btn-primary-header">
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">Turn Surplus Food Into Revenue</h1>
            <p className="hero-subtitle">
              Join thousands of merchants reducing food waste while increasing profits. 
              Sell surplus inventory at discounted prices to engaged customers.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="btn btn-hero-primary">
                Start Selling Today
              </Link>
              <Link to="/login" className="btn btn-hero-secondary">
                Login to Dashboard
              </Link>
            </div>
          </div>
          <div className="hero-image">
            <div className="image-placeholder">
              <img src="/BAGS.png" alt="Surprise Bags" className="hero-img" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="section-title">Why Merchants Choose BestByBites</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Monetize Surplus</h3>
              <p>Turn unsold inventory into revenue instead of waste. Every item sold is profit recovered.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Real-Time Analytics</h3>
              <p>Track sales, performance, and customer insights with our comprehensive dashboard.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🌱</div>
              <h3>Sustainability Impact</h3>
              <p>Reduce food waste and improve your environmental footprint while building brand reputation.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Easy Management</h3>
              <p>Simple interface to create surprise bags, manage orders, and track pickups effortlessly.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Reach More Customers</h3>
              <p>Connect with price-conscious customers actively seeking great deals on quality food.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💳</div>
              <h3>Fast Payouts</h3>
              <p>Get paid quickly with automated payouts directly to your account.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="works-container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-icon">📝</div>
              <h3>Create Surprise Bags</h3>
              <p>List your surplus items as surprise bags with photos, descriptions, and pickup times.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-icon">📱</div>
              <h3>Customers Order</h3>
              <p>Customers browse and purchase your bags through our platform.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-icon">✅</div>
              <h3>Confirm & Pickup</h3>
              <p>Confirm orders via QR code or PIN when customers arrive for pickup.</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-icon">💰</div>
              <h3>Get Paid</h3>
              <p>Receive payments directly to your account with transparent reporting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          <div className="stat-item">
            <div className="stat-number">10K+</div>
            <div className="stat-label">Active Merchants</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">$2M+</div>
            <div className="stat-label">Revenue Generated</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">500K+</div>
            <div className="stat-label">Bags Sold</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">75%</div>
            <div className="stat-label">Waste Reduction</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Start Selling?</h2>
          <p>Join BestByBites today and turn your surplus food into revenue</p>
          <Link to="/register" className="btn btn-cta">
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-column">
            <div className="footer-logo">
              <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png" alt="Logo" className="footer-logo-img" />
              <p className="footer-tagline">FOOD MARKETPLACE</p>
            </div>
            <p className="footer-mission">
              Help merchants reduce food waste while maximizing revenue through our innovative platform.
            </p>
            <div className="social-icons">
              <a href="#" className="social-icon" aria-label="Facebook">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 2H15C13.6739 2 12.4021 2.52678 11.4645 3.46447C10.5268 4.40215 10 5.67392 10 7V10H7V14H10V22H14V14H17L18 10H14V7C14 6.73478 14.1054 6.48043 14.2929 6.29289C14.4804 6.10536 14.7348 6 15 6H18V2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a href="#" className="social-icon" aria-label="Twitter">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23 3C22.0424 3.67548 20.9821 4.19211 19.88 4.53C19.3676 3.83751 18.6692 3.34669 17.892 3.12393C17.1147 2.90116 16.2882 2.95718 15.543 3.28447C14.7978 3.61177 14.1777 4.1944 13.7737 4.95372C13.3697 5.71305 13.2049 6.61234 13.305 7.5C11.4104 7.57046 9.54049 7.14006 7.85982 6.25329C6.17915 5.36652 4.73695 4.05119 3.67 2.43C3.25823 3.1016 3.03334 3.86426 3.02 4.65C3.02 6.24 3.77 7.74 4.97 8.5C4.42582 8.48823 3.88964 8.33683 3.41 8.06V8.12C3.41 9.54 4.36 10.81 5.73 11.12C5.315 11.2071 4.884 11.2272 4.46 11.18C4.693 12.0826 5.152 12.9042 5.787 13.5578C6.422 14.2114 7.209 14.6722 8.07 14.89C7.409 15.5903 6.612 16.1278 5.73 16.47C4.848 16.8122 3.901 16.952 2.95 16.88C4.561 17.8506 6.407 18.3453 8.29 18.31C15.84 18.31 20.17 11.88 20.17 6.41C20.17 6.25 20.17 6.09 20.16 5.93C21.1514 5.34768 22.027 4.59733 22.75 3.71L23 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a href="#" className="social-icon" aria-label="Instagram">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 11.37C16.1234 12.2022 15.9813 13.0522 15.5938 13.799C15.2063 14.5458 14.5932 15.1514 13.8416 15.5297C13.0901 15.9079 12.2385 16.0396 11.4078 15.9059C10.5771 15.7723 9.80977 15.3801 9.21485 14.7852C8.61993 14.1902 8.22774 13.4229 8.09408 12.5922C7.96042 11.7615 8.09208 10.9099 8.47034 10.1584C8.8486 9.40685 9.45419 8.79374 10.201 8.40624C10.9478 8.01874 11.7978 7.87659 12.63 8C13.4789 8.12588 14.2649 8.52146 14.8717 9.1283C15.4785 9.73514 15.8741 10.5211 16 11.37Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17.5 6.5H17.51" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>
          <div className="footer-column">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/register">Become a Partner</Link></li>
              <li><Link to="/login">Merchant Login</Link></li>
              <li><a href="#">About Us</a></li>
              <li><a href="#">FAQ</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Contact Us</h4>
            <div className="contact-info">
              <div className="contact-item">
                <span className="contact-icon contact-icon-phone">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7292C21.7209 20.9842 21.5573 21.2131 21.3523 21.4011C21.1473 21.5891 20.9053 21.7321 20.6399 21.8212C20.3745 21.9103 20.0922 21.9436 19.8125 21.9189C16.7429 21.5855 13.787 20.5341 11.19 18.8489C8.77382 17.3037 6.72533 15.2552 5.18008 12.8389C3.49308 10.2419 2.44168 7.28599 2.10828 4.21639C2.08359 3.93672 2.11688 3.65441 2.20598 3.38901C2.29508 3.12361 2.43808 2.88164 2.62608 2.67664C2.81408 2.47164 3.04301 2.30805 3.29801 2.19646C3.55301 2.08487 3.82872 2.02787 4.10728 2.02895H7.10728C7.59353 2.02699 8.06852 2.16949 8.47778 2.4399C8.88704 2.71031 9.21229 3.09699 9.41728 3.54895L10.9773 7.03895C11.1741 7.47554 11.2543 7.95699 11.2106 8.43407C11.1669 8.91115 11.0011 9.36787 10.7273 9.75895L9.26728 11.7189C10.4775 13.9707 12.0293 15.5225 14.2813 16.7327L16.2413 15.2727C16.6324 14.9989 17.0891 14.8331 17.5662 14.7894C18.0433 14.7457 18.5247 14.8259 18.9613 15.0227L22.4513 16.5827C22.9033 16.7877 23.29 17.1129 23.5604 17.5222C23.8308 17.9315 23.9733 18.4065 23.9713 18.8927L22.9713 16.8927H22Z" fill="#FF6B9D" stroke="#FF6B9D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="contact-item">
                <span className="contact-icon contact-icon-email">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="#B794F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 6L12 13L2 6" stroke="#B794F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>merchants@bestbybites.com</span>
              </div>
              <div className="contact-item">
                <span className="contact-icon contact-icon-location">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" fill="#FF6B9D" stroke="#FF6B9D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>123 Food Street, Toronto, Canada</span>
              </div>
            </div>
            <Link to="/register" className="btn btn-footer">
              Contact Us
            </Link>
          </div>
          <div className="footer-column">
            <h4>Merchant Resources</h4>
            <p className="footer-desc">Get exclusive merchant tools and faster support</p>
            <div className="app-buttons">
              <a href="#" className="app-badge-link">
                <img src="/Badges.png" alt="Get it on Google Play" className="app-badge" />
              </a>
              <a href="#" className="app-badge-link">
                <img src="/Badges2.png" alt="Download on the App Store" className="app-badge" />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 BestByBites. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
