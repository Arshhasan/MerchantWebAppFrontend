import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ChatOptions from '../ChatOptions/ChatOptions';
import { listenTotalMerchantUnread } from '../../services/chatMerchant';
import './ChatButton.css';

const ChatButton = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribe = listenTotalMerchantUnread(
      user.uid,
      (total) => setUnreadCount(total),
      () => setUnreadCount(0)
    );

    return () => unsubscribe();
  }, [user?.uid]);

  return (
    <>
      <button
        type="button"
        className="chat-button"
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
        title="Chat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="white"/>
        </svg>
        {unreadCount > 0 && (
          <span className="chat-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>
      <ChatOptions isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default ChatButton;
