import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getConversationDoc,
  listenThread,
  ensureConversationDoc,
  resetMerchantUnread,
  sendMerchantTextMessage,
  buildConversationId,
  ADMIN_CUSTOMER_ID,
} from '../../services/chatMerchant';
import './Chat.css';

const CustomerChat = () => {
  const navigate = useNavigate();
  const { chatId: conversationId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatData, setChatData] = useState(null);
  const [initError, setInitError] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const merchantId = user?.uid || '';
  const expectedAdminConvId = merchantId ? buildConversationId(merchantId, ADMIN_CUSTOMER_ID) : '';

  // Load / create conversation doc
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!conversationId || !user?.uid) return;

      try {
        let data = await getConversationDoc(conversationId);

        if (!data && conversationId === expectedAdminConvId) {
          await ensureConversationDoc({
            conversationId,
            merchantId: user.uid,
            customerId: ADMIN_CUSTOMER_ID,
            merchantName: user.displayName || 'Merchant',
            customerName: 'BestBy Bites Support',
          });
          data = await getConversationDoc(conversationId);
        }

        if (cancelled) return;

        if (!data) {
          showToast('Chat not found', 'error');
          setInitError(true);
          navigate('/dashboard');
          return;
        }

        if (data.merchantId && data.merchantId !== user.uid) {
          showToast('You do not have access to this chat', 'error');
          setInitError(true);
          navigate('/dashboard');
          return;
        }

        setChatData(data);
      } catch (e) {
        console.error('Error loading chat_merchant', e);
        if (!cancelled) {
          showToast('Failed to load chat', 'error');
          setInitError(true);
          navigate('/dashboard');
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [conversationId, user?.uid, user?.displayName, expectedAdminConvId, navigate, showToast]);

  // Reset merchant unread when thread is open
  useEffect(() => {
    if (!conversationId || initError || !chatData) return;
    resetMerchantUnread(conversationId).catch((e) => console.warn('resetMerchantUnread', e));
  }, [conversationId, initError, chatData]);

  useEffect(() => {
    if (!conversationId || initError || !chatData) return undefined;

    const unsubscribe = listenThread(
      conversationId,
      (msgs) => setMessages(msgs),
      () => showToast('Failed to load messages', 'error')
    );

    return () => unsubscribe();
  }, [conversationId, initError, chatData, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !user?.uid || loading || !chatData) return;

    setLoading(true);
    try {
      await sendMerchantTextMessage({
        conversationId,
        merchantId: user.uid,
        merchantName: chatData.merchantName || user.displayName || 'Merchant',
        text: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message', error);
      showToast('Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!chatData && !initError) {
    return (
      <div className="chat-page">
        <div className="chat-page-header">
          <button type="button" className="chat-page-back" onClick={() => navigate(-1)} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  if (!chatData) return null;

  const isMerchantMessage = (message) => message.senderId === user.uid;

  const headerName =
    chatData.customerId === ADMIN_CUSTOMER_ID
      ? 'BestBy Bites Support'
      : chatData.customerName || 'Customer';
  const customerPhoto = chatData.customerPhoto || chatData.customerProfileImage || '';

  const messageBody = (message) => {
    const type = message.type || 'text';
    if (type === 'image' && message.mediaUrl) {
      return <img src={message.mediaUrl} alt="" className="chat-page-message-media" />;
    }
    if (type === 'file' && message.mediaUrl) {
      return (
        <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="chat-page-message-link">
          File attachment
        </a>
      );
    }
    return <p className="chat-page-message-text">{message.text || message.message || ''}</p>;
  };

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <button type="button" className="chat-page-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="chat-page-header-info">
          <div className="chat-page-header-avatar">
            {customerPhoto ? (
              <img src={customerPhoto} alt="" />
            ) : (
              <div className="chat-page-header-avatar-placeholder">
                {headerName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1>{headerName}</h1>
            {chatData.orderId ? (
              <p className="chat-page-order-info">Order: {String(chatData.orderId).substring(0, 8)}...</p>
            ) : null}
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
                      {isMerchant ? 'You' : message.senderName || headerName}
                    </span>
                    <span className="chat-page-message-time">
                      {message.createdAt instanceof Date
                        ? message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                  {messageBody(message)}
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
