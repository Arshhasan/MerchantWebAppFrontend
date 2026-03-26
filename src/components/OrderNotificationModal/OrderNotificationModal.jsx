import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import './OrderNotificationModal.css';

const OrderNotificationModal = ({ isOpen, onClose, order, onOrderUpdated }) => {
  // All hooks must be called before any conditional returns
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [showDetails, setShowDetails] = useState(false);

  // Early return after all hooks are called
  if (!isOpen || !order) return null;

  const handleViewOrder = () => {
    onClose();
    navigate('/orders');
  };

  // Get customer name
  const customerName = order.fullOrderData?.author?.firstName && order.fullOrderData?.author?.lastName
    ? `${order.fullOrderData.author.firstName} ${order.fullOrderData.author.lastName}`
    : order.fullOrderData?.author?.firstName || order.fullOrderData?.author?.email || 'Customer';

  // Get customer contact info
  const customerEmail = order.fullOrderData?.author?.email || 'N/A';
  const customerPhone = order.fullOrderData?.author?.phoneNumber || 'N/A';
  const countryCode = order.fullOrderData?.author?.countryCode || '';

  // Get bag/products info
  const products = order.fullOrderData?.products || [];
  const bagName = products.length > 0 
    ? products[0].name || 'Surprise Bag'
    : 'Surprise Bag';

  // Get pickup time
  const pickupTime = order.fullOrderData?.estimatedTimeToPrepare || 'Not specified';

  return (
    <div className="order-notification-overlay" onClick={onClose}>
      {/* Hidden reCAPTCHA container for Firebase Phone Auth */}
      <div id="recaptcha-container-order-otp" style={{ display: 'none' }}></div>
      <div className="order-notification-content" onClick={(e) => e.stopPropagation()}>
        <div className="order-notification-header">
          <button 
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
              <span className="order-info-label">Order ID:</span>
              <span className="order-info-value">#{order.id}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Customer:</span>
              <span className="order-info-value">{customerName}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Email:</span>
              <span className="order-info-value">{customerEmail}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Phone:</span>
              <span className="order-info-value">{countryCode ? `${countryCode} ` : ''}{customerPhone}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Item:</span>
              <span className="order-info-value">{bagName}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Pickup Time:</span>
              <span className="order-info-value">{pickupTime}</span>
            </div>
            <div className="order-info-row">
              <span className="order-info-label">Amount:</span>
              <span className="order-info-value order-amount">${order.amount.toFixed(2)}</span>
            </div>
          </div>

          {showDetails && (
            <div className="order-details-expanded">
              <h4>Order Details</h4>
              <div className="products-list">
                {products.map((product, index) => (
                  <div key={index} className="product-item">
                    <span className="product-name">{product.name || 'Surprise Bag'}</span>
                    <span className="product-quantity">Qty: {product.quantity || 1}</span>
                    <span className="product-price">${parseFloat(product.price || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showDetails && (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="btn-view-details"
            >
              View Full Details
            </button>
          )}

          {showDetails && (
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="btn-view-details"
            >
              Hide Details
            </button>
          )}

          {showDetails && (
            <div className="rejection-section">
              {/* Accept/Reject actions are intentionally disabled in the notification modal.
                  Merchants should manage order state from the Orders page. */}
              <div className="rejection-textarea" style={{ background: '#f7f7f7' }}>
                Manage this order from the Orders page.
              </div>
            </div>
          )}

        </div>
        <div className="order-notification-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleViewOrder}
            className="btn btn-primary"
          >
            View Orders
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderNotificationModal;
