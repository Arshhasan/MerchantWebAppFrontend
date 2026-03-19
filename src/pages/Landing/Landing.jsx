import { Link } from 'react-router-dom';
import { useState } from 'react';
import './Landing.css';

const Landing = ({ onLogin }) => {
  const [email, setEmail] = useState('');

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    // Handle newsletter subscription
    console.log('Newsletter subscription:', email);
    setEmail('');
  };

  return (
    <div className="landing-page">
      {/* Header Navigation */}
      <header className="landing-header py-1">
        <div className="header-container">
          <div className="logo-section">
            <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK-Photoroom.png" alt="bestby bites" className="h-35 w-auto" />
          </div>
          <div className="header-right">
            <div className="app-download-buttons">
              <a href="#" className="app-download-btn">
                <img src="/Badges2.png" alt="Download on the App Store" className="h-14 w-auto" />
              </a>
              <a href="#" className="app-download-btn">
                <img src="/Badges.png" alt="GET IT ON Google Play" className="h-13 w-auto" />
              </a>

            </div>
            <div className="header-actions">
              <Link to="/login" className="btn btn-login rounded-full">Login</Link>
              <Link to="/register" className="btn btn-signup rounded-full">Sign Up</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Save Food. Save Money. Eat Smarter */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-logo">
              <img src="/BEST-BY-BITES-FINAL-LOGO-WHITE.png" alt="bestby bites" className="hero-logo-img" />
            </div>
            <h2 className="hero-heading">
              <span className="hero-line">Save Food.</span>
              <span className="hero-line">Save Money.</span>
              <span className="hero-line">Eat Smarter.</span>
            </h2>
            <p className="hero-description">
              Bestby Bites unlocks access to surplus food from top local restaurants, bakeries, cafés, and grocery stores — at up to 80% off.
            </p>
            <p className="hero-newsletter-text">
              Get special offers, meals, and news when you subscribe to our newsletter.
            </p>
            <div className="hero-cta-buttons">
              <Link to="/login" className="btn btn-hero-login">Login</Link>
              <Link to="/register" className="btn btn-hero-signup">Sign Up</Link>
            </div>
          </div>
          <div className="hero-food-images">
            {/* Food images are displayed in the background */}
          </div>
        </div>
      </section>

      {/* Start Saving Section */}
      <section className="start-saving-section">
        <div className="start-saving-container">
          <h2 className="start-saving-heading">
            <span className="start-saving-text-dark">Start</span>{' '}
            <span className="start-saving-text-green">Saving Food and Money Today</span>
          </h2>
          <p className="start-saving-subtitle">
            Join thousands already saving up to 80% on quality food
          </p>
          <div className="app-download-large">
            <a href="#" className="app-download-btn-large">
              <img src="/Badges.png" alt="GET IT ON Google Play" className="app-badge-large" />
            </a>
            <a href="#" className="app-download-btn-large">
              <img src="/Badges2.png" alt="Download on the App Store" className="app-badge-large" />
            </a>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="how-it-works-container">
          <h2 className="how-it-works-title">How It Works</h2>
          <p className="how-it-works-subtitle">
            Simple steps to save food, prevent surplus, and enjoy great meals.
          </p>
          <div className="how-it-works-steps">
            <div className="how-it-works-step">
              <img src="/browse.jpeg" alt="Browse & Order" className="step-image" />
              <h3 className="step-title">Browse & Order</h3>
              <p className="step-description">
                Browse nearby deals and reserve meals or groceries at 60–80% off regular prices.
              </p>
            </div>
            <div className="how-it-works-step">
              <img src="/pickup.jpeg" alt="Pickup" className="step-image" />
              <h3 className="step-title">Pickup</h3>
              <p className="step-description">
                Pick up your food at a scheduled time from local businesses.
              </p>
            </div>
            <div className="how-it-works-step">
              <img src="/enjoy.jpeg" alt="Enjoy" className="step-image" />
              <h3 className="step-title">Enjoy</h3>
              <p className="step-description">
                Enjoy great meals while helping reduce surplus in your city.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Connecting Consumers Section */}
      <section className="connecting-consumers-section">
        <div className="connecting-consumers-container">
          <div className="connecting-image">
            <img src="/For-Consumers.jpg.jpeg" alt="Connecting consumers" className="connecting-image-img" />
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
            <img src="/Grow-Your-Business-With-Us.jpg.jpeg" alt="Grow Your Business" className="grow-business-image-img" />
          </div>
        </div>
      </section>

      {/* Business Model Section */}
      <section className="business-model-section">
        <div className="business-model-container">
          <h2 className="business-model-title">The Business Model</h2>
          <p className="business-model-subtitle">
            A smarter system that benefits customers, businesses, and the planet — all at the same time.
          </p>
          <div className="business-model-video">
            <video className="video-player" controls>
              <source src="/explain.mp4" type="video/mp4" />
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
                <img src="/cuatomer.jpeg" alt="For Consumers" className="section-image" />
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
                <img src="/buisness.jpeg" alt="For Businesses" className="section-image" />
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
      <section className="join-movement-section">
        <div className="join-movement-container">
          <img src="/section.jpeg" alt="Join the Movement" className="join-movement-image" />
        </div>
      </section>

      {/* App Interface Section */}
      <section className="app-interface-section">
        <div className="app-interface-container">
          <h2 className="app-interface-title">App Interface</h2>
          <p className="app-interface-tagline">A simple way to turn surplus food into value.</p>
          <div className="app-download-large">
            <a href="#" className="app-download-btn-large">
              <img src="/Badges.png" alt="GET IT ON Google Play" className="app-badge-large" />
            </a>
            <a href="#" className="app-download-btn-large">
              <img src="/Badges2.png" alt="Download on the App Store" className="app-badge-large" />
            </a>
          </div>
          <div className="phone-mockups">
            <div className="phone-mockup">
              <img src="/1.jpeg" alt="App Screen 1" className="phone-screen-img" />
            </div>
            <div className="phone-mockup">
              <img src="/2.png" alt="App Screen 2" className="phone-screen-img" />
            </div>
            <div className="phone-mockup">
              <img src="/3.jpg" alt="App Screen 3" className="phone-screen-img" />
            </div>
            <div className="phone-mockup">
              <img src="/4.jpg" alt="App Screen 4" className="phone-screen-img" />
            </div>
            <div className="phone-mockup">
              <img src="/5.png" alt="App Screen 5" className="phone-screen-img" />
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section - Not hungry yet? */}
      <section className="newsletter-section">
        <div className="newsletter-container">
          <h2 className="newsletter-heading">Not hungry yet?</h2>
          <p className="newsletter-subtitle">
            Get special offers, meals, and news when you subscribe to our newsletter.
          </p>
          <form className="newsletter-form" onSubmit={handleNewsletterSubmit}>
            <input
              type="email"
              placeholder="Enter your email address"
              className="newsletter-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn-newsletter">Get in touch</button>
          </form>
          <p className="newsletter-privacy">
            <span className="privacy-icon">🔒</span>
            We respect your privacy. No spam.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-column">
            <div className="footer-logo">
              <img src="/BEST-BY-BITES-FINAL-LOGO-WHITE.png" alt="bestby bites" className="footer-logo-img" />
            </div>
          </div>
          <div className="footer-column">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/register">Become a Partner</Link></li>
              <li><Link to="/login">Login</Link></li>
              <li><a href="#">About Us</a></li>
              <li><a href="#">FAQ</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Contact Us</h4>
            <ul className="footer-links">
              <li><a href="tel:+15551234567">+1 (555) 123-4567</a></li>
              <li><a href="mailto:support@bestbybites.com">support@bestbybites.com</a></li>
              <li>123 Food Street, Toronto, Canada</li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Download Our App</h4>
            <p className="app-description">Get exclusive deals and faster checkout</p>
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
