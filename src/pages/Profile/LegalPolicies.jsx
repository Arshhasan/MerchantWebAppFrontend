import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { publicUrl } from '../../utils/publicUrl';
import './BlankPage.css';
import './LegalPolicies.css';

const TABS = [
  { id: 'privacy', label: 'Privacy policy', pdf: 'legal/privacy-policy.pdf' },
  { id: 'refund', label: 'Refund & cancellation', pdf: 'legal/refund-cancellation-policy.pdf' },
  { id: 'grievance', label: 'Grievance & contact', pdf: 'legal/grievance-contact-policy.pdf' },
  { id: 'terms', label: 'Terms of use', pdf: 'legal/terms-of-use.pdf' },
];

const TAB_IDS = new Set(TABS.map((t) => t.id));

const LegalPolicies = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeId = useMemo(() => {
    const raw = searchParams.get('tab');
    return raw && TAB_IDS.has(raw) ? raw : TABS[0].id;
  }, [searchParams]);

  const active = TABS.find((t) => t.id === activeId) ?? TABS[0];
  const pdfSrc = publicUrl(active.pdf);

  return (
    <div className="blank-page legal-policies">
      <div className="blank-page-header">
        <button type="button" className="back-button" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1>Legal</h1>
      </div>

      <div className="legal-policies__body">
        <div className="legal-policies__tabs" role="tablist" aria-label="Legal documents">
          {TABS.map((tab) => {
            const selected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`legal-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`legal-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className={`legal-policies__tab${selected ? ' legal-policies__tab--active' : ''}`}
                onClick={() => setSearchParams({ tab: tab.id })}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          className="legal-policies__panel"
          role="tabpanel"
          id={`legal-panel-${active.id}`}
          aria-labelledby={`legal-tab-${active.id}`}
        >
          <p className="legal-policies__open-hint">
            <a href={pdfSrc} target="_blank" rel="noopener noreferrer">
              Open {active.label.toLowerCase()} in a new tab
            </a>
          </p>
          <iframe title={active.label} className="legal-policies__frame" src={pdfSrc} />
        </div>
      </div>
    </div>
  );
};

export default LegalPolicies;
