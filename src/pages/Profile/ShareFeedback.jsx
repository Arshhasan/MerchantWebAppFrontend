import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import './ShareFeedback.css';

const ShareFeedback = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [feedback, setFeedback] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      showToast('Please enter your feedback', 'error');
      return;
    }

    if (!phoneNumber.trim()) {
      showToast('Please provide your phone number', 'error');
      return;
    }

    try {
      setSubmitting(true);
      // TODO: Implement API call to submit feedback
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showToast('Thank you for your feedback! We\'ll get back to you soon.', 'success');
      setFeedback('');
      setPhoneNumber('');
    } catch (error) {
      showToast('Failed to submit feedback. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="share-feedback-page">
      <div className="share-feedback-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Share your feedback</h1>
      </div>

      <div className="share-feedback-content">
        <p className="intro-text">
          Tell us what you love about the app, or what we could be doing better
        </p>

        <div className="info-box">
          <div className="info-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21ZM12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2ZM14.85 13.1L14 13.7V16H10V13.7L9.15 13.1C7.8 12.16 7 10.63 7 9C7 6.24 9.24 4 12 4C14.76 4 17 6.24 17 9C17 10.63 16.2 12.16 14.85 13.1Z" fill="currentColor"/>
            </svg>
          </div>
          <div className="info-text">
            Issues related to timings, orders, menu etc. can be best raised and resolved at the earliest by using the{' '}
            <button 
              className="help-centre-link" 
              onClick={() => navigate('/help-centre')}
            >
              Help Centre
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="feedback-form">
          <div className="form-group">
            <label htmlFor="feedback">Enter feedback</label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder=""
              rows={6}
              className="feedback-input"
            />
          </div>

          <p className="phone-note">
            Please provide your phone number for us to call you back
          </p>

          <div className="form-group">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder=""
              className="phone-input"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShareFeedback;
