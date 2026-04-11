import { useEffect, useState } from 'react';
import { publicUrl } from '../../utils/publicUrl';
import './OnboardingSplitLayout.css';

export default function OnboardingSplitLayout({
  children,
  showHelpButton = true,
  /** Full-page photo background (e.g. business category + store details onboarding). */
  signupBackground = false,
}) {
  const [helpOpen, setHelpOpen] = useState(false);

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

      <div className="onboarding-split-layout__form">{children}</div>

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
