import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useToast } from '../../contexts/ToastContext';
import './CustomerChatModal.css';

const CustomerChatModal = ({ isOpen, onClose, chat, onBack }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Subscribe to thread messages
  useEffect(() => {
    if (!isOpen || !chat?.id) return;

    const threadRef = collection(db, 'chat_restaurant', chat.id, 'thread');
    const q = query(threadRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const threadMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
        }));
        
        setMessages(threadMessages);
      },
      (error) => {
        console.error('Error fetching thread messages:', error);
        showToast('Failed to load messages', 'error');
      }
    );

    return () => unsubscribe();
  }, [isOpen, chat, showToast]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chat?.id || loading) return;

    setLoading(true);
    try {
      const threadRef = collection(db, 'chat_restaurant', chat.id, 'thread');
      
      await addDoc(threadRef, {
        message: newMessage.trim(),
        messageType: 'text',
        senderId: user.uid,
        receiverId: chat.senderId || chat.customerId || '',
        orderId: chat.orderId || '',
        createdAt: serverTimestamp(),
        url: null,
        videoThumbnail: ''
      });

      // Update the lastMessage, lastSenderId, and lastTimestamp in the parent document
      const chatDocRef = doc(db, 'chat_restaurant', chat.id);
      await updateDoc(chatDocRef, {
        lastMessage: newMessage.trim(),
        lastSenderId: user.uid,
        lastTimestamp: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isMerchantMessage = (message) => {
    return message.senderId === user.uid || message.senderId === chat.receiverId;
  };

  return (
    <div className="customer-chat-modal-overlay" onClick={onClose}>
      <div className="customer-chat-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="customer-chat-modal-header">
          <button className="customer-chat-back-button" onClick={onBack} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
                    <div className="customer-chat-header-info">
            <div className="customer-chat-header-avatar">
              {(chat.customerProfileImage || chat.senderPhoto) ? (
                <img src={chat.customerProfileImage || chat.senderPhoto} alt={chat.customerName || chat.senderName} />
              ) : (
                <div className="customer-chat-header-avatar-placeholder">
                  {(chat.customerName || chat.senderName)?.charAt(0)?.toUpperCase() || 'C'}
                </div>
              )}
            </div>
            <div>
              <h3>{chat.customerName || chat.senderName || 'Customer'}</h3>
              {chat.orderId && (
                <p className="customer-chat-order-info">Order: {chat.orderId.substring(0, 8)}...</p>
              )}
            </div>
          </div>
          <button className="customer-chat-modal-close" onClick={onClose} aria-label="Close chat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <div className="customer-chat-messages-container" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className="customer-chat-empty-state">
              <p>No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMerchant = isMerchantMessage(message);
              return (
                <div
                  key={message.id}
                  className={`customer-chat-message ${isMerchant ? 'customer-chat-message-merchant' : 'customer-chat-message-customer'}`}
                >
                  <div className="customer-chat-message-content">
                    <div className="customer-chat-message-header">
                      <span className="customer-chat-message-sender">
                        {isMerchant ? 'You' : (chat.customerName || chat.senderName || 'Customer')}
                      </span>
                      <span className="customer-chat-message-time">
                        {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="customer-chat-message-text">{message.message}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="customer-chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="customer-chat-input"
            disabled={loading}
          />
          <button
            type="submit"
            className="customer-chat-send-button"
            disabled={!newMessage.trim() || loading}
          >
            {loading ? (
              <svg className="customer-chat-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeDashoffset="32">
                  <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                  <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                </circle>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerChatModal;
