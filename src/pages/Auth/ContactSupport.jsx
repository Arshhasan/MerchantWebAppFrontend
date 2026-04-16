import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Send } from 'lucide-react';
import Footer from '../../components/Footer/Footer';
import { useToast } from '../../contexts/ToastContext';
import { sendSupportContactEmail } from '../../services/contactSupport';
import { publicUrl } from '../../utils/publicUrl';
import './ContactSupport.css';

const INITIAL_FORM = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  company: '',
  subject: '',
  message: '',
  website: '',
};

const REGION_OPTIONS = [
  { code: 'CA', label: 'Canada', flag: '🇨🇦' },
  { code: 'US', label: 'USA', flag: '🇺🇸' },
  { code: 'IN', label: 'India', flag: '🇮🇳' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺', disabled: true, helper: 'Coming Soon' },
  { code: 'UK', label: 'UK', flag: '🇬🇧', disabled: true, helper: 'Coming Soon' },
];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export default function ContactSupport() {
  const { showToast } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('IN');
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const regionMenuRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (regionMenuRef.current && !regionMenuRef.current.contains(event.target)) setRegionMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (regionMenuRef.current && !regionMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [mobileMenuOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!form.subject.trim()) {
      setError('Please add a subject.');
      return;
    }
    if (!form.message.trim()) {
      setError('Please tell us how we can help.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await sendSupportContactEmail(form);
      setForm(INITIAL_FORM);
      showToast('Your message has been sent. We will get back to you shortly.', 'success');
    } catch (err) {
      const message = err?.message || 'Could not send your message right now.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contact-support-page">
      <header className="contact-support-topbar">
        <div className="contact-support-topbar__inner">
          <Link to="/" className="contact-support-brand" aria-label="Bestby Bites home">
            <img
              src={publicUrl('lgo.jpeg')}
              alt="Bestby Bites"
              className="contact-support-brand__logo"
            />
          </Link>

          <div className="contact-support-topbar__actions">
            <Link to="/login" className="contact-support-topbar__btn contact-support-topbar__btn--ghost">
              Log in
            </Link>
            <Link to="/register" className="contact-support-topbar__btn">
              Sign up
            </Link>
            <div className="contact-support-topbar__locale-wrap" ref={regionMenuRef}>
              <button
                type="button"
                className="contact-support-topbar__locale"
                aria-label={`Selected region ${selectedRegion}`}
                aria-expanded={regionMenuOpen}
                onClick={() => setRegionMenuOpen((open) => !open)}
              >
                <span className="contact-support-topbar__flag" aria-hidden="true">
                  {REGION_OPTIONS.find((item) => item.code === selectedRegion)?.flag}
                </span>
                <span>{selectedRegion}</span>
                <svg
                  className={`contact-support-topbar__locale-arrow${regionMenuOpen ? ' is-open' : ''}`}
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {regionMenuOpen ? (
                <div className="contact-support-topbar__locale-menu" role="menu" aria-label="Region selection">
                  {REGION_OPTIONS.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      className={`contact-support-topbar__locale-option${selectedRegion === item.code ? ' is-selected' : ''}${item.disabled ? ' is-disabled' : ''}`}
                      onClick={() => {
                        if (item.disabled) return;
                        setSelectedRegion(item.code);
                        setRegionMenuOpen(false);
                      }}
                    >
                      <span className="contact-support-topbar__locale-option-flag" aria-hidden="true">{item.flag}</span>
                      <span className="contact-support-topbar__locale-option-copy">
                        <span>{item.label}</span>
                        {item.helper ? <small>{item.helper}</small> : null}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="contact-support-topbar__mobileWrap" ref={regionMenuRef}>
            <button
              type="button"
              className="contact-support-topbar__hamburger"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>

            {mobileMenuOpen ? (
              <div
                className="contact-support-mobileSheet"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setMobileMenuOpen(false);
                }}
              >
                <div className="contact-support-mobileSheet__panel" role="document">
                  <div className="contact-support-mobileSheet__header">
                    <img
                      src={publicUrl('log.png')}
                      alt="Bestby Bites"
                      className="contact-support-mobileSheet__logo"
                    />
                    <button
                      type="button"
                      className="contact-support-mobileSheet__close"
                      aria-label="Close"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="contact-support-mobileSheet__body">
                    <div className="contact-support-mobileSheet__title">COUNTRY</div>
                    <div className="contact-support-mobileSheet__grid" role="group" aria-label="Country selection">
                      {REGION_OPTIONS.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          disabled={item.disabled}
                          className={`contact-support-mobileSheet__country${selectedRegion === item.code ? ' is-selected' : ''}${item.disabled ? ' is-disabled' : ''}`}
                          onClick={() => {
                            if (item.disabled) return;
                            setSelectedRegion(item.code);
                          }}
                        >
                          <span className="contact-support-mobileSheet__countryFlag" aria-hidden="true">
                            {item.flag}
                          </span>
                          <span className="contact-support-mobileSheet__countryCopy">
                            <span>{item.label}</span>
                            {item.helper ? <small>{item.helper}</small> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="contact-support-mobileSheet__footer">
                    <Link
                      to="/login"
                      className="contact-support-mobileSheet__cta contact-support-mobileSheet__cta--primary"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log in
                    </Link>
                    <Link
                      to="/register"
                      className="contact-support-mobileSheet__cta contact-support-mobileSheet__cta--secondary"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign up
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="contact-support-hero">
        <div className="contact-support-hero__inner">
          <h1>Contact Us</h1>
          <p>We&apos;d love to hear from you</p>
        </div>
      </section>

      <main className="contact-support-main">
        <div className="contact-support-shell">
          <section className="contact-support-form-card">
            <h2>Send us a Message</h2>
            <p>Fill out the form below and we&apos;ll get back to you shortly.</p>

            <form onSubmit={handleSubmit} className="contact-support-form">
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={handleChange}
                className="contact-support-honeypot"
                tabIndex="-1"
                autoComplete="off"
              />

              <div className="contact-support-grid">
                <label className="contact-support-field">
                  <span>Full Name <em>*</em></span>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Your name"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label className="contact-support-field">
                  <span>Email <em>*</em></span>
                  <input
                    type="email"
                    name="email"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label className="contact-support-field">
                  <span>Phone Number</span>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+1 (123) 456-7890"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </label>

                <label className="contact-support-field">
                  <span>Address</span>
                  <input
                    type="text"
                    name="address"
                    placeholder="Your address"
                    value={form.address}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <label className="contact-support-field">
                <span>Company</span>
                <input
                  type="text"
                  name="company"
                  placeholder="Business or store name"
                  value={form.company}
                  onChange={handleChange}
                />
              </label>

              <label className="contact-support-field">
                <span>Subject <em>*</em></span>
                <input
                  type="text"
                  name="subject"
                  placeholder="What is this regarding?"
                  value={form.subject}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="contact-support-field">
                <span>Message <em>*</em></span>
                <textarea
                  name="message"
                  placeholder="Tell us how we can help..."
                  value={form.message}
                  onChange={handleChange}
                  rows={5}
                  required
                />
              </label>

              {error ? <p className="contact-support-error">{error}</p> : null}

              <button type="submit" className="contact-support-submit" disabled={submitting}>
                <Send size={18} />
                <span>{submitting ? 'Sending...' : 'Send Message'}</span>
              </button>
            </form>
          </section>

          <aside className="contact-support-side">
            <article className="contact-support-info-card contact-support-info-card--highlight">
              <div className="contact-support-info-card__icon">
                <Mail size={26} />
              </div>
              <div>
                <h3>Email Us</h3>
                <p>We typically respond within 24 hours</p>
                <a href="mailto:support@bestbybites.com">support@bestbybites.com</a>
              </div>
            </article>

<br />
            <article className="contact-support-info-card">
              <div className="contact-support-info-card__icon">
                <MapPin size={26} />
              </div>
              <div>
                <h3>Visit Us</h3>
                <p>Our office location</p>
                <strong>Toronto, Ontario, Canada</strong>
              </div>
            </article>
<br />
            <article className="contact-support-help-card">
              <h3>Need quick help?</h3>
              <p>
                For order-related queries, please include your Order ID in the subject line for
                faster resolution.
              </p>
            </article>
          </aside>
        </div>
      </main>

      <Footer showNewsletter={false} />
    </div>
  );
}
