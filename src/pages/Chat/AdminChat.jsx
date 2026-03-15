import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToCollection, createDocument, updateDocument } from '../../firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import './Chat.css';

const AdminChat = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Subscribe to admin messages
  useEffect(() => {
    if (!user) return;

    const filters = [
      { field: 'merchantID', operator: '==', value: user.uid },
      { field: 'chatType', operator: '==', value: 'admin' }
    ];

    const unsubscribe = subscribeToCollection(
      'chat_messages',
      filters,
      (docs) => {
        const sortedMessages = docs
          .map(doc => ({
            id: doc.id,
            ...doc,
            createdAt: doc.createdAt?.toDate 
              ? doc.createdAt.toDate() 
              : (doc.createdAt ? new Date(doc.createdAt) : new Date())
          }))
          .sort((a, b) => a.createdAt - b.createdAt);
        
        setMessages(sortedMessages);
        
        // Mark unread messages as read
        sortedMessages.forEach(msg => {
          if (!msg.readByMerchant) {
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
  }, [user, showToast]);

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

    setLoading(true);
    try {
      await createDocument('chat_messages', {
        merchantID: user.uid,
        message: newMessage.trim(),
        senderType: 'merchant',
        senderName: user.displayName || 'Merchant',
        chatType: 'admin',
        readByMerchant: true,
        readByCustomer: false,
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <button className="chat-page-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Admin Chat</h1>
      </div>
      
      <div className="chat-page-messages" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="chat-page-empty">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-page-message ${message.senderType === 'merchant' ? 'chat-page-message-merchant' : 'chat-page-message-customer'}`}
            >
              <div className="chat-page-message-content">
                <div className="chat-page-message-header">
                  <span className="chat-page-message-sender">
                    {message.senderName || (message.senderType === 'merchant' ? 'You' : 'Admin')}
                  </span>
                  <span className="chat-page-message-time">
                    {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="chat-page-message-text">{message.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-page-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="chat-page-input"
          disabled={loading}
        />
        <button
          type="submit"
          className="chat-page-send-button"
          disabled={!newMessage.trim() || loading}
        >
          {loading ? (
            <svg className="chat-page-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
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
  );
};

export default AdminChat;
