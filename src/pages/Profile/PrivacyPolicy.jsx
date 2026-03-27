import { useNavigate } from 'react-router-dom';
import './BlankPage.css';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="blank-page">
      <div className="blank-page-header">
        <button type="button" className="back-button" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Privacy policy</h1>
      </div>
      <div className="blank-page-content" aria-hidden="true" />
    </div>
  );
};

export default PrivacyPolicy;
