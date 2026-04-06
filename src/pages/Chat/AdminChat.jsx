import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { buildConversationId, ADMIN_CUSTOMER_ID } from '../../services/chatMerchant';

/**
 * /chat/admin → /chat/customer/{uid}_admin — thread is `chat_admin/{uid}/thread` (same as admin app).
 */
const AdminChat = () => {
  const { user } = useAuth();
  if (!user?.uid) {
    return <Navigate to="/login" replace />;
  }
  const id = buildConversationId(user.uid, ADMIN_CUSTOMER_ID);
  return <Navigate to={`/chat/customer/${id}`} replace />;
};

export default AdminChat;
