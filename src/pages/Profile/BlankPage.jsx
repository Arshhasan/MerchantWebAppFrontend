import { useNavigate } from 'react-router-dom';
import './BlankPage.css';

const BlankPage = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div className="blank-page">
      <div className="blank-page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>{title}</h1>
      </div>
      <div className="blank-page-content">
        <p>This page is under development.</p>
      </div>
    </div>
  );
};

export default BlankPage;
