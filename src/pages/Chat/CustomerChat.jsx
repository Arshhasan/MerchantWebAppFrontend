import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useToast } from '../../contexts/ToastContext';
import './Chat.css';

const CustomerChat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatData, setChatData] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Load chat data
  useEffect(() => {
    const loadChatData = async () => {
      if (!chatId) return;
      
      try {
        const chatDoc = await getDoc(doc(db, 'chat_restaurant', chatId));
        if (chatDoc.exists()) {
          setChatData({ id: chatDoc.id, ...chatDoc.data() });
        } else {
          showToast('Chat not found', 'error');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error loading chat data:', error);
        showToast('Failed to load chat', 'error');
      }
    };

    loadChatData();
  }, [chatId, navigate, showToast]);

  // Subscribe to thread messages
  useEffect(() => {
    if (!chatId) return;

    const threadRef = collection(db, 'chat_restaurant', chatId, 'thread');
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
  }, [chatId, showToast]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || loading) return;

    setLoading(true);
    try {
      const threadRef = collection(db, 'chat_restaurant', chatId, 'thread');
      
      await addDoc(threadRef, {
        message: newMessage.trim(),
        messageType: 'text',
        senderId: user.uid,
        receiverId: chatData?.senderId || '',
        orderId: chatData?.orderId || '',
        createdAt: serverTimestamp(),
        url: null,
        videoThumbnail: ''
      });

      // Update the lastMessage, lastSenderId, and lastTimestamp in the parent document
      const chatDocRef = doc(db, 'chat_restaurant', chatId);
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

  if (!chatData) {
    return (
      <div className="chat-page">
        <div className="chat-page-header">
          <button className="chat-page-back" onClick={() => navigate(-1)} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  const isMerchantMessage = (message) => {
    return message.senderId === user.uid || message.senderId === chatData.receiverId;
  };

  const customerName = chatData.customerName || chatData.senderName || 'Customer';
  const customerPhoto = chatData.customerProfileImage || chatData.senderPhoto || '';

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <button className="chat-page-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="chat-page-header-info">
          <div className="chat-page-header-avatar">
            {customerPhoto ? (
              <img src={customerPhoto} alt={customerName} />
            ) : (
              <div className="chat-page-header-avatar-placeholder">
                {customerName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1>{customerName}</h1>
            {chatData.orderId && (
              <p className="chat-page-order-info">Order: {chatData.orderId.substring(0, 8)}...</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="chat-page-messages" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="chat-page-empty">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMerchant = isMerchantMessage(message);
            return (
              <div
                key={message.id}
                className={`chat-page-message ${isMerchant ? 'chat-page-message-merchant' : 'chat-page-message-customer'}`}
              >
                <div className="chat-page-message-content">
                  <div className="chat-page-message-header">
                    <span className="chat-page-message-sender">
                      {isMerchant ? 'You' : customerName}
                    </span>
                    <span className="chat-page-message-time">
                      {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="chat-page-message-text">{message.message}</p>
                </div>
              </div>
            );
          })
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

export default CustomerChat;
