import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToCollection, createDocument, updateDocument, getDocument } from '../../firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import './ChatModal.css';

const ChatModal = ({ isOpen, onClose, chatType = 'admin' }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [vendorId, setVendorId] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Get vendorID from user document (only for customer chat)
  useEffect(() => {
    if (chatType === 'admin') return;
    
    const loadVendorId = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDocument('users', user.uid);
        if (userDoc.success && userDoc.data && userDoc.data.vendorID) {
          setVendorId(userDoc.data.vendorID);
        }
      } catch (error) {
        console.error('Error loading vendorID:', error);
      }
    };
    
    loadVendorId();
  }, [user, chatType]);

  // Subscribe to messages
  useEffect(() => {
    if (!isOpen) return;
    if (chatType !== 'admin' && !vendorId) return;
    if (chatType === 'admin' && !user) return;

    let filters = [];
    if (chatType === 'admin') {
      filters = [
        { field: 'merchantID', operator: '==', value: user.uid },
        { field: 'chatType', operator: '==', value: 'admin' }
      ];
    } else {
      filters = [
        { field: 'vendorID', operator: '==', value: vendorId }
      ];
    }

    const unsubscribe = subscribeToCollection(
      'chat_messages',
      filters,
      (docs) => {
        const sortedMessages = docs
          .map(doc => ({
            id: doc.id,
            ...doc,
            createdAt: doc.createdAt?.toDate ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date())
          }))
          .sort((a, b) => a.createdAt - b.createdAt);
        
        setMessages(sortedMessages);
        
        // Mark unread messages as read
        sortedMessages.forEach(msg => {
          if (!msg.readByMerchant && msg.senderType === 'customer') {
            updateDocument('chat_messages', msg.id, { readByMerchant: true });
          }
        });
      },
      (error) => {
        console.error('Error fetching messages:', error);
        showToast('Failed to load messages', 'error');
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [vendorId, isOpen, chatType, user, showToast]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;
    if (chatType !== 'admin' && !vendorId) return;
    if (chatType === 'admin' && !user) return;

    setLoading(true);
    try {
      const messageData = {
        merchantID: user.uid,
        message: newMessage.trim(),
        senderType: 'merchant',
        senderName: user.displayName || 'Merchant',
        readByMerchant: true,
        readByCustomer: false,
      };

      if (chatType === 'admin') {
        messageData.chatType = 'admin';
      } else {
        messageData.vendorID = vendorId;
      }

      await createDocument('chat_messages', messageData);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <h3>{chatType === 'admin' ? 'Admin Chat' : 'Customer Chat'}</h3>
          <button className="chat-modal-close" onClick={onClose} aria-label="Close chat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <div className="chat-messages-container" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <p>No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${message.senderType === 'merchant' ? 'chat-message-merchant' : 'chat-message-customer'}`}
              >
                <div className="chat-message-content">
                  <div className="chat-message-header">
                    <span className="chat-message-sender">{message.senderName || (message.senderType === 'merchant' ? 'You' : 'Customer')}</span>
                    <span className="chat-message-time">
                      {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="chat-message-text">{message.message}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="chat-input"
            disabled={loading}
          />
          <button
            type="submit"
            className="chat-send-button"
            disabled={!newMessage.trim() || loading}
          >
            {loading ? (
              <svg className="chat-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
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

export default ChatModal;
