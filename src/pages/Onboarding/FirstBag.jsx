import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import { publicUrl } from '../../utils/publicUrl';
import './FirstBag.css';

export default function FirstBag() {
  const navigate = useNavigate();
  const { vendorProfile } = useAuth();
  const inlineVideoRef = useRef(null);

  const storeName = useMemo(() => (vendorProfile?.title || 'your store').toString(), [vendorProfile?.title]);

  // Autoplay when landing on this page (muted is required by most browsers).
  useEffect(() => {
    const el = inlineVideoRef.current;
    if (!el) return undefined;
    const tryPlay = () => {
      el.muted = true;
      el.play().catch(() => {});
    };
    tryPlay();
    el.addEventListener('loadeddata', tryPlay, { once: true });
    return () => el.removeEventListener('loadeddata', tryPlay);
  }, []);

  return (
    <OnboardingSplitLayout>
      <div className="first-bag-page">
        <div className="first-bag-header">
          <button
            type="button"
            className="first-bag-back"
            onClick={() => navigate('/outlet-location?onboarding=1', { replace: true })}
            aria-label="Back"
          >
            ←
          </button>
          <h1>Hi, {storeName}</h1>
        </div>

        <div className="first-bag-card">
          <div className="first-bag-hero">
            <div className="first-bag-hero__text">
              <div className="first-bag-hero__title">
                To start selling your surplus food, create your first Surprise Bag
              </div>
              <button
                type="button"
                className="first-bag-hero__cta"
                onClick={() =>
                  navigate({ pathname: '/create-bag', search: '?firstBag=1' })
                }
              >
                Create a Surprise Bag
              </button>
            </div>
          </div>

          <section className="first-bag-videoSection" aria-labelledby="first-bag-video-heading">
            <div className="first-bag-videoSection__wrap">
              <video
                ref={inlineVideoRef}
                className="first-bag-videoSection__video"
                src={publicUrl('explain.mp4')}
                controls
                autoPlay
                muted
                playsInline
                preload="auto"
              />
            </div>
            <h2 id="first-bag-video-heading" className="first-bag-videoSection__title">
              HOW DOES BESTBYBITES WORK?
            </h2>
          </section>

          <div className="first-bag-help">
            <div className="first-bag-help__title">Need more help?</div>
            <div className="first-bag-help__text">
              Visit our Help centre or contact us directly at <a href="tel:+14378874377">+1 437 887 4377</a>
            </div>
          </div>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
}

