import { useMemo, useRef } from 'react';
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

  return (
    <OnboardingSplitLayout
      showHelpButton={false}
      faqsTitle="First Surprise Bag FAQs"
      faqs={[
        {
          id: 'fb-1',
          q: 'What is a Surprise Bag?',
          a: 'A Surprise Bag is a discounted bundle of surplus food you sell to reduce waste. You describe the bag broadly, and contents can vary day-to-day.',
        },
        {
          id: 'fb-2',
          q: 'What photos should I upload?',
          a: 'Use clear, well-lit photos that represent what customers can expect (e.g. typical items, packaging, or your store). Avoid blurry or dark images.',
        },
        {
          id: 'fb-3',
          q: 'Can I save as draft and publish later?',
          a: 'Yes. You can save a bag as draft, review it, and publish when you’re ready to start selling.',
        },
      ]}
    >
      <div className="first-bag-page">
        <div className="first-bag-header">
          <button
            type="button"
            className="first-bag-back"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
              else navigate('/outlet-location?onboarding=1');
            }}
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
            <div className="first-bag-videoSection__heading">
              <p className="first-bag-videoSection__eyebrow">How does</p>
              <h2 id="first-bag-video-heading" className="first-bag-videoSection__title">
                <span className="first-bag-videoSection__title-brand">BestByBites</span>{' '}
                <span className="first-bag-videoSection__title-rest">work</span>
              </h2>
            </div>
            <div className="first-bag-videoSection__wrap">
              <video
                ref={inlineVideoRef}
                className="first-bag-videoSection__video"
                src={publicUrl('explain.mp4')}
                poster={publicUrl('bagthumbnail.png')}
                controls
                muted
                playsInline
                preload="auto"
              />
            </div>
            
          </section>

          <div className="first-bag-help">
            <div className="first-bag-help__title">Need more help?</div>
            <div className="first-bag-help__text">
              Visit our Help centre or contact us directly at{' '}
              <a href="mailto:support@bestbybites.com">support@bestbybites.com</a>
            </div>
          </div>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
}

