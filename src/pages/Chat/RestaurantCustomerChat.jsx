import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getMerchantChatQueryIds } from '../../services/chatMerchant';
import { CHAT_RESTAURANT_COLLECTION } from '../../services/chatRestaurant';
import './Chat.css';

/** Customer app uses `timestamp`; some writes use `createdAt`. */
function parseThreadMessageTime(raw) {
  const t = raw.timestamp ?? raw.createdAt;
  if (t?.toDate) return t.toDate();
  if (typeof t?.seconds === 'number') return new Date(t.seconds * 1000);
  return new Date(0);
}

const RestaurantCustomerChat = () => {
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!conversationId || !user?.uid) return;

      try {
        const allowedIds = await getMerchantChatQueryIds(user.uid);
        const allowed = new Set(allowedIds.map(String));

        const ref = doc(db, CHAT_RESTAURANT_COLLECTION, conversationId);
        const snap = await getDoc(ref);

        if (cancelled) return;

        if (!snap.exists()) {
          showToast('Chat not found', 'error');
          setInitError(true);
          navigate('/dashboard');
          return;
        }

        const data = { id: snap.id, ...snap.data() };
        const receiverId = data.receiverId != null ? String(data.receiverId) : '';
        if (!receiverId || !allowed.has(receiverId)) {
          showToast('You do not have access to this chat', 'error');
          setInitError(true);
          navigate('/dashboard');
          return;
        }

        setChatData(data);
      } catch (e) {
        console.error('Error loading chat_restaurant', e);
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
  }, [conversationId, user?.uid, navigate, showToast]);

  useEffect(() => {
    if (!conversationId || initError || !chatData) return undefined;

    const threadRef = collection(db, CHAT_RESTAURANT_COLLECTION, conversationId, 'thread');

    // No orderBy — customer messages may only have `timestamp`, not `createdAt`.
    const unsubscribe = onSnapshot(
      threadRef,
      (snapshot) => {
        const threadMessages = snapshot.docs
          .map((d) => {
            const raw = d.data();
            return { id: d.id, ...raw, createdAt: parseThreadMessageTime(raw) };
          })
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        setMessages(threadMessages);
      },
      (error) => {
        console.error('Restaurant chat thread error', error);
        showToast('Failed to load messages', 'error');
      }
    );

    return () => unsubscribe();
  }, [conversationId, initError, chatData, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !user?.uid || loading || !chatData) return;

    const customerUid = chatData.senderId != null ? String(chatData.senderId) : '';
    const vendorReceiverId =
      chatData.receiverId != null ? String(chatData.receiverId) : '';

    setLoading(true);
    try {
      const threadRef = collection(db, CHAT_RESTAURANT_COLLECTION, conversationId, 'thread');
      const ts = serverTimestamp();
      await addDoc(threadRef, {
        message: newMessage.trim(),
        messageType: 'text',
        senderId: user.uid,
        receiverId: customerUid || vendorReceiverId,
        orderId: chatData.orderId || '',
        timestamp: ts,
        createdAt: ts,
        url: null,
        videoThumbnail: '',
      });

      const chatDocRef = doc(db, CHAT_RESTAURANT_COLLECTION, conversationId);
      await updateDoc(chatDocRef, {
        lastMessage: newMessage.trim(),
        lastSenderId: user.uid,
        lastTimestamp: serverTimestamp(),
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

  const headerName =
    chatData.senderName || chatData.customerName || chatData.senderId?.slice?.(0, 8) || 'Customer';
  const customerPhoto =
    chatData.senderPhoto || chatData.customerPhoto || chatData.senderProfileImage || '';

  const isMerchantMessage = (message) => message.senderId != null && String(message.senderId) === user.uid;

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
                {String(headerName).charAt(0).toUpperCase()}
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
                  <p className="chat-page-message-text">{message.message || message.text || ''}</p>
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

export default RestaurantCustomerChat;
