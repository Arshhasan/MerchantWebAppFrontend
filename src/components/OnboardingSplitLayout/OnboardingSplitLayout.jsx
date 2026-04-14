import { useEffect, useMemo, useState } from 'react';
import { publicUrl } from '../../utils/publicUrl';
import './OnboardingSplitLayout.css';

function OnboardingFaq({ title = 'FAQs', items = [] }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="onboarding-faq" aria-label={title}>
      <div className="onboarding-faq__title">{title}</div>
      <div className="onboarding-faq__list">
        {items.map((it, idx) => (
          <details key={it?.id || `${idx}-${it?.q || 'faq'}`} className="onboarding-faq__item">
            <summary className="onboarding-faq__q">{it?.q}</summary>
            <div className="onboarding-faq__a">{it?.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function OnboardingSplitLayout({
  children,
  showHelpButton = true,
  /** Full-page photo background (e.g. business category + store details onboarding). */
  signupBackground = false,
  faqs,
  faqsTitle,
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  const faqItems = useMemo(() => {
    if (!Array.isArray(faqs)) return [];
    return faqs
      .map((x) => ({
        id: x?.id,
        q: (x?.q ?? '').toString().trim(),
        a: x?.a ?? '',
      }))
      .filter((x) => x.q && x.a);
  }, [faqs]);

  useEffect(() => {
    if (!helpOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setHelpOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [helpOpen]);

  const signupBgStyle = signupBackground
    ? {
        // Consumed by OnboardingSplitLayout.css (incl. mobile fixed full-viewport layer)
        ['--ol-signup-bg-url']: `url(${JSON.stringify(publicUrl('bg.jpg'))})`,
      }
    : undefined;

  return (
    <div
      className={
        signupBackground
          ? 'onboarding-split-layout onboarding-split-layout--signup-bg'
          : 'onboarding-split-layout'
      }
      style={signupBgStyle}
    >
      {showHelpButton && (
        <button
          type="button"
          className="onboarding-split-layout__helpBtn"
          onClick={() => setHelpOpen(true)}
          aria-label="How does Best By Bites work?"
        >
          <span className="onboarding-split-layout__helpPreview" aria-hidden="true">
            <img
              src={publicUrl('bagthumbnail.png')}
              alt=""
              className="onboarding-split-layout__helpPreviewImg"
            />
            <span className="onboarding-split-layout__helpPreviewPlay">
              <img
                src={publicUrl('play-button.png')}
                alt=""
                className="onboarding-split-layout__helpIcon"
              />
            </span>
          </span>
        </button>
      )}

      <div className="onboarding-split-layout__form">
        {children}
        <OnboardingFaq title={faqsTitle || 'FAQs'} items={faqItems} />
      </div>

      {showHelpButton && helpOpen && (
        <div
          className="onboarding-split-layout__helpOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="How Best By Bites works"
          onMouseDown={(e) => {
            // Close when clicking outside the dialog.
            if (e.target === e.currentTarget) setHelpOpen(false);
          }}
        >
          <div className="onboarding-split-layout__helpDialog">
            <button
              type="button"
              className="onboarding-split-layout__helpClose"
              onClick={() => setHelpOpen(false)}
              aria-label="Close help"
            >
              ×
            </button>

            <div className="onboarding-split-layout__helpTitle">
              How does Best By Bites work?
            </div>
            <div className="onboarding-split-layout__helpVideoWrap">
              <video
                className="onboarding-split-layout__helpVideo"
                src={publicUrl('explain.mp4')}
                controls
                autoPlay
                playsInline
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
