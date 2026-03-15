import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToCollection } from '../../firebase/firestore';
import ChatOptions from '../ChatOptions/ChatOptions';
import './ChatButton.css';

const ChatButton = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to unread messages for this merchant
  useEffect(() => {
    if (!user) return;

    let unsubscribe = null;

    // Get restaurantId from user document
    const loadRestaurantId = async () => {
      try {
        const { getDocument } = await import('../../firebase/firestore');
        const userDoc = await getDocument('users', user.uid);
        if (userDoc.success && userDoc.data && userDoc.data.vendorID) {
          const restaurantId = userDoc.data.vendorID;
          
          // Subscribe to chat_restaurant collection to count chats with unread messages
          // We'll count chats where lastSenderId is not the merchant (meaning customer sent last message)
          const filters = [
            { field: 'receiverId', operator: '==', value: restaurantId }
          ];
          
          unsubscribe = subscribeToCollection(
            'chat_restaurant',
            filters,
            (chats) => {
              // Count chats where the last message was from customer (not merchant)
              const unreadChats = chats.filter(chat => {
                // If lastSenderId is not the merchant's ID, it's unread
                return chat.lastSenderId && chat.lastSenderId !== user.uid && chat.lastSenderId !== restaurantId;
              });
              setUnreadCount(unreadChats.length);
            },
            (error) => {
              console.error('Error fetching unread chats:', error);
            }
          );
        }
      } catch (error) {
        console.error('Error loading restaurantId:', error);
      }
    };

    loadRestaurantId();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  return (
    <>
      <button
        className="chat-button"
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
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
