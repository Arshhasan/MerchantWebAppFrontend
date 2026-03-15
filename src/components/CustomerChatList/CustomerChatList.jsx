import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToCollection, getDocument } from '../../firebase/firestore';
import './CustomerChatList.css';

const CustomerChatList = ({ isOpen, onClose, onBack }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [restaurantId, setRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get restaurantId from user document
  useEffect(() => {
    const loadRestaurantId = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDocument('users', user.uid);
        console.log('User document:', userDoc);
        if (userDoc.success && userDoc.data) {
          console.log('User data:', userDoc.data);
          const vendorId = userDoc.data.vendorID;
          if (vendorId) {
            console.log('Found vendorID:', vendorId);
            setRestaurantId(vendorId);
          } else {
            console.warn('No vendorID found in user document');
          }
        } else {
          console.warn('Failed to load user document:', userDoc);
        }
      } catch (error) {
        console.error('Error loading restaurantId:', error);
      }
    };
    
    loadRestaurantId();
  }, [user]);

  // Subscribe to chat_restaurant collection
  useEffect(() => {
    if (!restaurantId || !isOpen) {
      if (!restaurantId) {
        console.log('Waiting for restaurantId...');
      }
      return;
    }

    console.log('Subscribing to chat_restaurant with receiverId:', restaurantId);
    setLoading(true);
    const filters = [
      { field: 'receiverId', operator: '==', value: restaurantId }
    ];

    const unsubscribe = subscribeToCollection(
      'chat_restaurant',
      filters,
      (docs) => {
        console.log('Received chats:', docs.length, docs);
        const sortedChats = docs
          .map(doc => ({
            id: doc.id,
            ...doc,
            customerName: doc.senderName || 'Customer',
            customerProfileImage: doc.senderPhoto || '',
            lastMessage: doc.lastMessage || '',
            lastMessageTime: doc.lastTimestamp?.toDate 
              ? doc.lastTimestamp.toDate() 
              : (doc.lastTimestamp ? new Date(doc.lastTimestamp) : (doc.lastMessageTime?.toDate ? doc.lastMessageTime.toDate() : new Date(0))),
            orderId: doc.orderId || '',
            restaurantId: doc.receiverId || '',
            restaurantName: doc.receiverName || '',
            restaurantProfileImage: doc.receiverPhoto || '',
            lastSenderId: doc.senderId || ''
          }))
          .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        
        console.log('Sorted chats:', sortedChats);
        setChats(sortedChats);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching chats:', error);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [restaurantId, isOpen]);

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
            <button className="customer-chat-list-back" onClick={onBack} aria-label="Back">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <h2>Customer Chats</h2>
          <button className="customer-chat-list-close" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="customer-chat-list-body">
          {loading ? (
            <div className="customer-chat-list-loading">
              <p>Loading chats...</p>
              {restaurantId && (
                <p style={{ fontSize: '0.75rem', color: '#9e9e9e', marginTop: '0.5rem' }}>
                  Restaurant ID: {restaurantId}
                </p>
              )}
            </div>
          ) : chats.length === 0 ? (
            <div className="customer-chat-list-empty">
              <p>No customer chats yet.</p>
              {restaurantId && (
                <p style={{ fontSize: '0.75rem', color: '#9e9e9e', marginTop: '0.5rem' }}>
                  Restaurant ID: {restaurantId}
                </p>
              )}
              {!restaurantId && (
                <p style={{ fontSize: '0.75rem', color: '#ff4444', marginTop: '0.5rem' }}>
                  No restaurant ID found. Please check your profile settings.
                </p>
              )}
            </div>
          ) : (
            <div className="customer-chat-list-items">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  className="customer-chat-item"
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="customer-chat-avatar">
                    {chat.customerProfileImage ? (
                      <img src={chat.customerProfileImage} alt={chat.customerName} />
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
                    {chat.orderId && (
                      <span className="customer-chat-order">Order: {chat.orderId.substring(0, 8)}...</span>
                    )}
                  </div>
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
