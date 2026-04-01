import { useEffect, useState } from 'react';
import './OnboardingSplitLayout.css';

export default function OnboardingSplitLayout({
  children,
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

  return (
    <div className="onboarding-split-layout">
      <button
        type="button"
        className="onboarding-split-layout__helpBtn"
        onClick={() => setHelpOpen(true)}
        aria-label="How does Best By Bites work?"
      >
        <img
          src="/play-button.png"
          alt=""
          className="onboarding-split-layout__helpIcon"
          aria-hidden="true"
        />
        <span className="onboarding-split-layout__helpLinkText">
          How does Best By Bites work?
        </span>
      </button>

      <div className="onboarding-split-layout__form">{children}</div>

      {helpOpen && (
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
                src="/explain.mp4"
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
