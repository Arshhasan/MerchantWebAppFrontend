import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import './FirstBag.css';

export default function FirstBag() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { vendorProfile } = useAuth();
  const [videoOpen, setVideoOpen] = useState(false);

  const isOnboarding = searchParams.get('onboarding') === '1';
  const storeName = useMemo(() => (vendorProfile?.title || 'your store').toString(), [vendorProfile?.title]);

  useEffect(() => {
    if (!videoOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setVideoOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [videoOpen]);

  return (
    <OnboardingSplitLayout>
      <div className="first-bag-page">
        <div className="first-bag-header">
          <button
            type="button"
            className="first-bag-back"
            onClick={() => navigate('/store-details?onboarding=1', { replace: true })}
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
                onClick={() => navigate('/create-bag?firstBag=1')}
              >
                Create a Surprise Bag
              </button>
            </div>
          </div>

          <button
            type="button"
            className="first-bag-videoCard"
            onClick={() => setVideoOpen(true)}
            aria-label="Watch how BestByBites works"
          >
            <div className="first-bag-videoCard__thumb">
              <div className="first-bag-videoCard__play">▶</div>
            </div>
            <div className="first-bag-videoCard__title">HOW DOES BESTBYBITES WORK?</div>
          </button>

          <div className="first-bag-help">
            <div className="first-bag-help__title">Need more help?</div>
            <div className="first-bag-help__text">
              Visit our Help centre or contact us directly at <a href="tel:+14378874377">+1 437 887 4377</a>
            </div>
          </div>
        </div>

        {videoOpen && (
          <div
            className="first-bag-videoOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="How does BestByBites work"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setVideoOpen(false);
            }}
          >
            <div className="first-bag-videoDialog">
              <button
                type="button"
                className="first-bag-videoClose"
                onClick={() => setVideoOpen(false)}
                aria-label="Close video"
              >
                ×
              </button>
              <div className="first-bag-videoTitle">How does BestByBites work?</div>
              <div className="first-bag-videoWrap">
                <video
                  className="first-bag-video"
                  src="/explain.mp4"
                  controls
                  autoPlay
                  muted
                  playsInline
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </OnboardingSplitLayout>
  );
}

