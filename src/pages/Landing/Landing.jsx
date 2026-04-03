import { Link } from 'react-router-dom';
import Footer from '../../components/Footer/Footer';
import { publicUrl } from '../../utils/publicUrl';
import './Landing.css';

const PhoneIcon = () => (
  <svg className="hero-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="6" y="3" width="12" height="18" rx="2" />
    <path d="M10 18h4" strokeLinecap="round" />
  </svg>
);

const HandshakeIcon = () => (
  <svg className="hero-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M11 12h2a2 2 0 0 0 2-2V8" strokeLinecap="round" />
    <path d="M17 12v-1a2 2 0 0 0-2-2h-1" strokeLinecap="round" />
    <path d="M7 12v-1a2 2 0 0 1 2-2h1" strokeLinecap="round" />
    <path d="M13 12h-2a2 2 0 0 1-2-2V8" strokeLinecap="round" />
    <path d="M7 16l-2-2 3-3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 16l2-2-3-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="hero-nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Landing = () => {
  return (
    <div className="landing-page">
      <section className="hero-section">
        <header className="hero-nav">
          <div className="hero-nav-container">
            <Link to="/" className="hero-nav-brand hero-nav-brand--framed">
              <img
                src={publicUrl('logo-bestbbybites-merchant-dark-photoroom.png')}
                alt="Bestby Bites Merchant"
                className="hero-nav-logo hero-nav-logo--merchant-light"
              />
            </Link>
            {/* When adding links, remove `hidden` and restore anchor children */}
            <nav className="hero-nav-links" aria-label="Primary" hidden />
            <div className="hero-nav-actions">
              
              
              <Link to="/login" className="hero-btn-pill hero-btn-pill--white">Sign In</Link>
              <Link to="/register" className="hero-btn-pill hero-btn-pill--accent">Get Started</Link>
            </div>
          </div>
        </header>

        <div className="hero-container">
          <div className="hero-content">
            <h2 className="hero-heading">
              <span className="hero-line">Save Food.</span>
              <span className="hero-line">Save Money.</span>
              <span className="hero-line">Eat Smarter.</span>
            </h2>
            <p className="hero-description">
              Surplus food from top local restaurants, bakeries &amp; grocery stores — up to 50–80% off.
            </p>
            <div className="hero-cta-buttons">
              <Link to="/register" className="hero-btn-pill hero-btn-pill--accent hero-btn-pill--hero-cta">Get Started</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Start Saving Section */}
      <section className="start-saving-section">
        <div className="start-saving-container">
          <h2 className="start-saving-heading">
            <span className="start-saving-text-dark">Start </span>
            <span className="start-saving-text-green">Saving Food and Money</span>
            <span className="start-saving-text-dark"> Today</span>
          </h2>
          <p className="start-saving-subtitle">
            Join thousands already saving up to 80% on quality food
          </p>
          <div className="app-download-large">
            <a href="#" className="app-download-btn-large">
              <img src={publicUrl('badges2.png')} alt="Download on the App Store" className="app-badge-large" />
            </a>
            <a href="#" className="app-download-btn-large">
              <img src={publicUrl('badges.png')} alt="GET IT ON Google Play" className="app-badge-large" />
            </a>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="how-it-works-container">
          <h2 className="how-it-works-title">How It Works</h2>
          <p className="how-it-works-subtitle">
            Simple steps to save food, prevent surplus, and enjoy great meals.
          </p>
          <div className="how-it-works-steps">
            <div className="how-it-works-step">
              <img src={publicUrl('browse.jpeg')} alt="Browse & Order" className="step-image" />
              <h3 className="step-title">Browse & Order</h3>
              <p className="step-description">
                Browse nearby deals and reserve meals or groceries at 60–80% off regular prices.
              </p>
            </div>
            <div className="how-it-works-step">
              <img src={publicUrl('pickup.jpeg')} alt="Pickup" className="step-image" />
              <h3 className="step-title">Pickup</h3>
              <p className="step-description">
                Pick up your food at a scheduled time from local businesses.
              </p>
            </div>
            <div className="how-it-works-step">
              <img src={publicUrl('enjoy.jpeg')} alt="Enjoy" className="step-image" />
              <h3 className="step-title">Enjoy</h3>
              <p className="step-description">
                Enjoy great meals while helping reduce surplus in your city.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Connecting Consumers Section */}
      <section className="connecting-consumers-section" id="why-choose-us">
        <div className="connecting-consumers-container">
          <div className="connecting-image">
            <img src={publicUrl('for-consumers.jpg.jpeg')} alt="Connecting consumers" className="connecting-image-img" />
          </div>
          <div className="connecting-content">
            <h2 className="connecting-heading">Connecting consumers with better prices</h2>
            <h3 className="connecting-subheading">Eat Well for Less—Without Compromise</h3>
            <p className="connecting-description">
              Get restaurant-quality food and groceries from trusted local businesses at up to <strong>80% off</strong>, all while making a real environmental impact.
            </p>
            <ul className="connecting-benefits">
              <li>✓ Spend less on everyday meals</li>
              <li>✓ Discover new local Favourites</li>
              <li>✓ Reduce surplus effortlessly</li>
              <li>✓ Feel good about every pickup</li>
            </ul>
            <p className="connecting-newsletter">
              Get special offers, meals, and news when you subscribe to our newsletter.
            </p>
          </div>
        </div>
      </section>

      {/* Grow Business Hero Section */}
      <section className="grow-business-section">
        <div className="grow-business-container">
          <div className="grow-business-content">
            <h2 className="grow-business-heading">Grow Your Business With Us</h2>
            <h3 className="grow-business-subheading">Turn Unsold Food Into Easy Revenue</h3>
            <p className="grow-business-description">
              Stop throwing money away. Bestby Bites helps you sell surplus inventory, cut disposal costs, and reach new customers—without compromising your brand.
            </p>
            <ul className="grow-business-benefits">
              <li>✓ Recover revenue from surplus food</li>
              <li>✓ Cut disposal expenses</li>
              <li>✓ Attract new, value-driven customers</li>
              <li>✓ Strengthen sustainability and brand trust</li>
            </ul>
            <Link to="/register" className="btn btn-grow-business">Become a Partner</Link>
          </div>
          <div className="grow-business-image">
            <img src={publicUrl('grow-your-business-with-us.jpg.jpeg')} alt="Grow Your Business" className="grow-business-image-img" />
          </div>
        </div>
      </section>

      {/* Business Model — Watch & Learn */}
      <section className="business-model-section" aria-labelledby="business-model-heading">
        <div className="business-model-container">
          <p className="business-model-eyebrow">Watch &amp; learn</p>
          <h2 id="business-model-heading" className="business-model-heading">
            <span className="business-model-heading__brand">BestbyBites</span>{' '}
            <span className="business-model-heading__title">Business Model</span>
          </h2>
          <div className="business-model-video-wrap">
            <video
              className="business-model-video-player"
              controls
              playsInline
              preload="metadata"
            >
              <source
                src={publicUrl('video.mp4')}
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* For Consumers & Businesses Section */}
      <section className="consumers-businesses-section">
        <div className="consumers-businesses-container">
          <div className="consumers-box">
            <div className="section-box">
              <div className="section-box-label">For Consumers</div>
              <ul className="benefits-list">
                <li>✓ High-quality food at unbeatable prices</li>
                <li>✓ Easy access to local restaurants and stores</li>
                <li>✓ Real impact with zero lifestyle change</li>
              </ul>
              <div className="section-image-wrapper">
                <img src={publicUrl('cuatomer.jpeg')} alt="For Consumers" className="section-image" />
              </div>
              <Link to="/register" className="btn btn-section-cta">Get Started</Link>
            </div>
          </div>
          <div className="businesses-box">
            <div className="section-box">
              <div className="section-box-label">For Businesses</div>
              <h3 className="section-box-tagline">Own a food business, grow with us</h3>
              <ul className="benefits-list">
                <li>✓ Monetize surplus inventory</li>
                <li>✓ Reduce disposal costs</li>
                <li>✓ Improve sustainability and public image</li>
              </ul>
              <div className="section-image-wrapper">
                <img src={publicUrl('buisness.jpeg')} alt="For Businesses" className="section-image" />
                {/* <div className="local-stores-badge">
                  <div className="store-icon">🏪</div>
                  <span>Local Stores</span>
                </div> */}
              </div>
              <Link to="/register" className="btn btn-section-cta">Become a Partner</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Join Movement Section */}
      <section className="join-movement-section" id="testimonials">
        <div className="join-movement-container">
          <img src={publicUrl('section.jpeg')} alt="Join the Movement" className="join-movement-image" />
        </div>
      </section>

      {/* App Interface Section */}
      <section className="app-interface-section">
        <div className="app-interface-container">
          <h2 className="app-interface-title">App Interface</h2>
          <p className="app-interface-tagline">A simple way to turn surplus food into value.</p>
          <div className="app-download-large">
            <a href="#" className="app-download-btn-large">
              <img src={publicUrl('badges.png')} alt="GET IT ON Google Play" className="app-badge-large" />
            </a>
            <a href="#" className="app-download-btn-large">
              <img src={publicUrl('badges2.png')} alt="Download on the App Store" className="app-badge-large" />
            </a>
          </div>
          <div className="phone-mockups">
            <div className="phone-mockup">
              <img src={publicUrl('1.jpeg')} alt="App Screen 1" className="phone-screen-img" />
            </div>
            <div className="phone-mockup">
              <img src={publicUrl('2.png')} alt="App Screen 2" className="phone-screen-img" />
            </div>
            <div className="phone-mockup">
              <img src={publicUrl('3.jpg')} alt="App Screen 3" className="phone-screen-img" />
            </div>
            <div className="phone-mockup">
              <img src={publicUrl('4.jpg')} alt="App Screen 4" className="phone-screen-img" />
            </div>
            <div className="phone-mockup">
              <img src={publicUrl('5.png')} alt="App Screen 5" className="phone-screen-img" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
