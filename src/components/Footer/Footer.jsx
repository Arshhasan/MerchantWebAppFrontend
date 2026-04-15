import { Link } from 'react-router-dom';
import { useState } from 'react';
import { publicUrl } from '../../utils/publicUrl';
import './Footer.css';

const LeafClusterIcon = () => (
  <svg className="site-footer__leaf-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 8c0 4-3 7-7 9-1-4 0-8 3-11 2 1 4 1.5 4 2z" fill="currentColor" />
    <path d="M7 8c0 3 2 6 5 8-3-2-6-5-5-8z" fill="currentColor" opacity="0.85" />
    <path d="M12 4c-2 2-3 5-2 8 2-2 3-5 2-8z" fill="currentColor" opacity="0.7" />
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m22 6-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HeartIcon = () => (
  <svg className="site-footer__heart" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const Footer = ({ showNewsletter = true }) => {
  const [email, setEmail] = useState('');

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    console.log('Newsletter subscription:', email);
    setEmail('');
  };

  return (
    <footer className="site-footer" id="contact">
      {showNewsletter ? (
        <>
          <div className="site-footer__newsletter">
            <div className="site-footer__inner site-footer__newsletter-grid">
              <div className="site-footer__newsletter-copy">
                <div className="site-footer__eyebrow">
                  {/* <LeafClusterIcon /> */}
                  <span>Join the movement</span>
                </div>
                <h2 className="site-footer__headline">Save food, save money</h2>
                <p className="site-footer__lede">
                  Get exclusive deals, new restaurant alerts, and sustainability tips delivered to your inbox.
                </p>
              </div>
              <form className="site-footer__subscribe" onSubmit={handleNewsletterSubmit}>
                <div className="site-footer__subscribe-box">
                  <label htmlFor="footer-newsletter-email" className="visually-hidden">
                    Email address
                  </label>
                  <div className="site-footer__input-wrap">
                    <span className="site-footer__input-icon" aria-hidden="true">
                      <MailIcon />
                    </span>
                    <input
                      id="footer-newsletter-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      className="site-footer__email-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="site-footer__subscribe-btn">
                    Subscribe
                    <ArrowRightIcon />
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="site-footer__rule" role="presentation" />
        </>
      ) : null}

      <div className="site-footer__main">
        <div className="site-footer__inner site-footer__columns">
          <div className="site-footer__brand">
            <div className="site-footer__brand-mark">
              <img
                src={publicUrl('best-by-bites-final-logo-white.png')}
                alt=""
                className="site-footer__brand-logo"
                width="160"
                height="48"
              />
              <span className="site-footer__brand-tagline">Food marketplace</span>
            </div>
            <p className="site-footer__brand-desc">
              Save up to 75% off surplus food from restaurants &amp; grocery stores. Delicious food, smaller footprint.
            </p>
            <div className="site-footer__socials">
              <a href="#" className="site-footer__social" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="#" className="site-footer__social" aria-label="X (Twitter)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </a>
              <a href="#" className="site-footer__social" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              </a>
              <a href="#" className="site-footer__social" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2 29 29 0 0 0-.46 5.25 29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 9.5v5l4.25-2.5L10 9.5z" fill="currentColor" />
                </svg>
              </a>
            </div>
            <div className="site-footer__store-badges">
              <a href="#" className="site-footer__store-badge">
                <img src={publicUrl('badges.png')} alt="Get it on Google Play" />
              </a>
              <a href="#" className="site-footer__store-badge">
                <img src={publicUrl('badges-2.png')} alt="Download on the App Store" />
              </a>
            </div>
          </div>

          <nav className="site-footer__nav-col" aria-labelledby="footer-nav-company">
            <h3 id="footer-nav-company" className="site-footer__nav-title">Company</h3>
            <ul className="site-footer__nav-list">
              <li><a href="#">About Us</a></li>
              <li><a href="#">How It Works</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Careers</a></li>
            </ul>
          </nav>

          <nav className="site-footer__nav-col" aria-labelledby="footer-nav-product">
            <h3 id="footer-nav-product" className="site-footer__nav-title">Product</h3>
            <ul className="site-footer__nav-list">
              <li><a href="#">Surprise Bags</a></li>
              <li><Link to="/register">For Merchants</Link></li>
              <li><a href="#">Download App</a></li>
              <li><a href="#">Pricing</a></li>
            </ul>
          </nav>

          <nav className="site-footer__nav-col" aria-labelledby="footer-nav-support">
            <h3 id="footer-nav-support" className="site-footer__nav-title">Support</h3>
            <ul className="site-footer__nav-list">
              <li><a href="#">Help Center</a></li>
              <li><Link to="/contact-us">Contact Us</Link></li>
              <li><a href="#">Report a Problem</a></li>
            </ul>
          </nav>

          <nav className="site-footer__nav-col" aria-labelledby="footer-nav-legal">
            <h3 id="footer-nav-legal" className="site-footer__nav-title">Legal</h3>
            <ul className="site-footer__nav-list">
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Cookie Policy</a></li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="site-footer__rule" role="presentation" />

      <div className="site-footer__bar">
        <div className="site-footer__inner site-footer__bar-inner">
          <p className="site-footer__copyright">© 2026 Bestby Bites Inc. All rights reserved.</p>
          <p className="site-footer__made">
            Made with <HeartIcon /> for a sustainable future
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
