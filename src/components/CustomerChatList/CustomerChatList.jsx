import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listenConversations, ADMIN_CUSTOMER_ID } from '../../services/chatMerchant';
import './CustomerChatList.css';

const CustomerChatList = ({ isOpen, onClose, onBack }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !isOpen) {
      if (!isOpen) return;
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const merchantId = user.uid;

    const unsubscribe = listenConversations(
      merchantId,
      (conversations) => {
        const rows = conversations
          .filter((c) => c.customerId !== ADMIN_CUSTOMER_ID)
          .map((c) => {
            let lastMessageTime = new Date(0);
            const ca = c.createdAt;
            if (ca?.toDate) lastMessageTime = ca.toDate();
            else if (ca?.seconds) lastMessageTime = new Date(ca.seconds * 1000);

            return {
              id: c.id,
              customerName: c.customerName || 'Customer',
              customerProfileImage: c.customerPhoto || c.customerProfileImage || '',
              lastMessage: c.lastMessage || '',
              lastMessageTime,
              merchantUnreadCount: typeof c.merchantUnreadCount === 'number' ? c.merchantUnreadCount : 0,
              orderId: c.orderId || '',
            };
          });
        setChats(rows);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, isOpen]);

  const handleChatSelect = (chat) => {
    navigate(`/chat/customer/${chat.id}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="customer-chat-list-overlay" onClick={onClose}>
      <div className="customer-chat-list-content" onClick={(e) => e.stopPropagation()}>
        <div className="customer-chat-list-header">
          {onBack && (
            <button type="button" className="customer-chat-list-back" onClick={onBack} aria-label="Back">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <h2>Customer Chats</h2>
          <button type="button" className="customer-chat-list-close" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="customer-chat-list-body">
          {loading ? (
            <div className="customer-chat-list-loading">
              <p>Loading chats...</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="customer-chat-list-empty">
              <p>No customer chats yet.</p>
            </div>
          ) : (
            <div className="customer-chat-list-items">
              {chats.map((chat) => (
                <button
                  type="button"
                  key={chat.id}
                  className="customer-chat-item"
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="customer-chat-avatar">
                    {chat.customerProfileImage ? (
                      <img src={chat.customerProfileImage} alt="" />
                    ) : (
                      <div className="customer-chat-avatar-placeholder">
                        {chat.customerName?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                    )}
                  </div>
                  <div className="customer-chat-info">
                    <div className="customer-chat-header">
                      <h3>{chat.customerName || 'Customer'}</h3>
                      {chat.lastMessageTime && (
                        <span className="customer-chat-time">
                          {formatTime(chat.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <p className="customer-chat-preview">
                      {chat.lastMessage || 'No messages yet'}
                    </p>
                    {chat.orderId ? (
                      <span className="customer-chat-order">Order: {String(chat.orderId).substring(0, 8)}...</span>
                    ) : null}
                  </div>
                  {chat.merchantUnreadCount > 0 ? (
                    <span className="customer-chat-unread-badge" aria-label={`${chat.merchantUnreadCount} unread`}>
                      {chat.merchantUnreadCount > 99 ? '99+' : chat.merchantUnreadCount}
                    </span>
                  ) : null}
                  <div className="customer-chat-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const formatTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export default CustomerChatList;
