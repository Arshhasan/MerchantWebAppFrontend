import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { computeOrderPayableTotal } from '../../services/orderSchema';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './OrderNotificationModal.css';

function formatOrderTime(createdAt) {
  if (!createdAt) return '—';
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const OrderNotificationModal = ({ isOpen, onClose, order, onOrderUpdated }) => {
  const navigate = useNavigate();
  const { vendorProfile } = useAuth();

  if (!isOpen || !order) return null;

  const handleViewOrder = () => {
    onOrderUpdated?.();
    onClose();
    navigate('/orders');
  };

  const raw = order.fullOrderData || {};
  const displayAmount = computeOrderPayableTotal(raw);

  const customerName =
    raw.author?.firstName && raw.author?.lastName
      ? `${raw.author.firstName} ${raw.author.lastName}`
      : raw.author?.firstName || raw.author?.email || 'Customer';

  const products = raw.products || [];
  const bagName =
    products.length > 0 ? products[0].name || 'Surprise Bag' : 'Surprise Bag';

  const orderTime = formatOrderTime(order.createdAt);

  return (
    <div className="order-notification-overlay" onClick={onClose}>
      <div id="recaptcha-container-order-otp" style={{ display: 'none' }} />
      <div className="order-notification-content" onClick={(e) => e.stopPropagation()}>
        <div className="order-notification-header">
          <button
            type="button"
            className="order-notification-close"
            onClick={onClose}
            aria-label="Close notification"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="order-notification-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#E8F5E9"/>
              <path d="M3 6H21" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>New Order Received!</h3>
        </div>

        <div className="order-notification-body">
          <div className="order-notification-info">
            <div className="order-info-row">
              <span className="order-info-label">Customer</span>
              <span className="order-info-value">{customerName}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Bag</span>
              <span className="order-info-value">{bagName}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Order ID</span>
              <span className="order-info-value order-info-value--id">#{order.id}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Order time</span>
              <span className="order-info-value order-info-value--time">{orderTime}</span>
            </div>
            <div className="order-info-row order-info-row--secondary">
              <span className="order-info-label">Email</span>
              <span className="order-info-value order-info-value--muted">{raw.author?.email || 'N/A'}</span>
            </div>
            <div className="order-info-row order-info-row--secondary">
              <span className="order-info-label">Phone</span>
              <span className="order-info-value order-info-value--muted">
                {raw.author?.countryCode ? `${raw.author.countryCode} ` : ''}
                {raw.author?.phoneNumber || 'N/A'}
              </span>
            </div>
            <div className="order-info-row order-info-row--secondary">
              <span className="order-info-label">Amount</span>
              <span className="order-info-value order-amount">
                {formatMerchantCurrency(displayAmount, vendorProfile)}
              </span>
            </div>
          </div>
        </div>

        <div className="order-notification-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Dismiss
          </button>
          <button type="button" onClick={handleViewOrder} className="btn btn-primary">
            View Orders
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderNotificationModal;
