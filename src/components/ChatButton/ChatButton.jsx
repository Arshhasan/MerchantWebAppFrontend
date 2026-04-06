import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ChatOptions from '../ChatOptions/ChatOptions';
import { listenTotalMerchantUnreadForIds, getMerchantChatQueryIds } from '../../services/chatMerchant';
import { listenRestaurantUnreadForReceiverIds } from '../../services/chatRestaurant';
import './ChatButton.css';

const ChatButton = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return undefined;

    let alive = true;
    let unsubMerchant = () => {};
    let unsubRestaurant = () => {};
    let merchantUnread = 0;
    let restaurantUnread = 0;

    const pushTotal = () => setUnreadCount(merchantUnread + restaurantUnread);

    getMerchantChatQueryIds(user.uid).then((ids) => {
      if (!alive) return;
      unsubMerchant = listenTotalMerchantUnreadForIds(
        ids,
        (total) => {
          merchantUnread = total;
          pushTotal();
        },
        () => {
          merchantUnread = 0;
          pushTotal();
        },
        user.uid
      );
      unsubRestaurant = listenRestaurantUnreadForReceiverIds(
        ids,
        user.uid,
        (total) => {
          restaurantUnread = total;
          pushTotal();
        },
        () => {
          restaurantUnread = 0;
          pushTotal();
        }
      );
    }).catch(() => {
      merchantUnread = 0;
      restaurantUnread = 0;
      pushTotal();
    });

    return () => {
      alive = false;
      unsubMerchant();
      unsubRestaurant();
    };
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
