import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerChatList from '../CustomerChatList/CustomerChatList';
import './ChatOptions.css';

const ChatOptions = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [showCustomerList, setShowCustomerList] = useState(false);

  if (!isOpen) return null;

  const handleOptionSelect = (option) => {
    if (option === 'admin') {
      navigate('/chat/admin');
      onClose();
    } else if (option === 'customers') {
      setShowCustomerList(true);
    }
  };

  const handleBackFromList = () => {
    setShowCustomerList(false);
  };

  if (showCustomerList) {
    return <CustomerChatList isOpen={true} onClose={onClose} onBack={handleBackFromList} />;
  }

  return (
    <div className="chat-options-overlay" onClick={onClose}>
      <div className="chat-options-content" onClick={(e) => e.stopPropagation()}>
        <div className="chat-options-header">
          <h2>Chat Options</h2>
          <button className="chat-options-close" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="chat-options-list">
          <button
            className="chat-option-card chat-option-admin"
            onClick={() => handleOptionSelect('admin')}
          >
            <div className="chat-option-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="chat-option-text">
              <h3>Chat with Admin</h3>
              <p>Get help from our support team</p>
            </div>
            <div className="chat-option-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>

          <button
            className="chat-option-card chat-option-customers"
            onClick={() => handleOptionSelect('customers')}
          >
            <div className="chat-option-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="chat-option-text">
              <h3>Chat with Vendor</h3>
              <p>Select an order to message the restaurant</p>
            </div>
            <div className="chat-option-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatOptions;
