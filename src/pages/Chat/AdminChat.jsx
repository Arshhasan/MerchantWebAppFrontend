import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { buildConversationId, ADMIN_CUSTOMER_ID } from '../../services/chatMerchant';

/**
 * Legacy route: /chat/admin → same thread as chat_merchant `{uid}_admin`
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
