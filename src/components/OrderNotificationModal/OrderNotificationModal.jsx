import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { acceptOrder, rejectOrder } from '../../services/orderService';
import './OrderNotificationModal.css';

const OrderNotificationModal = ({ isOpen, onClose, order, onOrderUpdated }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  if (!isOpen || !order) return null;

  const handleViewOrder = () => {
    onClose();
    navigate('/orders');
  };

  const [generatedOTP, setGeneratedOTP] = useState(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const orderId = order.fullOrderData?.orderId || order.fullOrderData?.id || order.id;
      const result = await acceptOrder(orderId, order.fullOrderData);
      
      if (result.success) {
        // Store OTP to display to merchant
        setGeneratedOTP(result.otp);
        setOtpExpiresAt(result.expiresAt);
        showToast('Order accepted! OTP generated. Please share this OTP with the customer.', 'success');
        if (onOrderUpdated) {
          onOrderUpdated();
        }
        // Don't close modal immediately - show OTP to merchant
      } else {
        showToast(result.error || 'Failed to accept order', 'error');
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      showToast('Failed to accept order', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      showToast('Please provide a reason for rejection', 'warning');
      return;
    }

    setLoading(true);
    try {
      const orderId = order.fullOrderData?.orderId || order.fullOrderData?.id || order.id;
      const result = await rejectOrder(orderId, rejectionReason);
      
      if (result.success) {
        showToast('Order rejected successfully', 'success');
        if (onOrderUpdated) {
          onOrderUpdated();
        }
        onClose();
        setRejectionReason('');
      } else {
        showToast(result.error || 'Failed to reject order', 'error');
      }
    } catch (error) {
      console.error('Error rejecting order:', error);
      showToast('Failed to reject order', 'error');
    } finally {
      setLoading(false);
    }
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
              <label htmlFor="rejection-reason">Rejection Reason (if rejecting):</label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows="3"
                className="rejection-textarea"
              />
            </div>
          )}

          {generatedOTP && (
            <div className="otp-display-section">
              <h4>Order Accepted - OTP Generated</h4>
              <div className="otp-display">
                <label>Share this OTP with the customer:</label>
                <div className="otp-value">{generatedOTP}</div>
                {otpExpiresAt && (
                  <div className="otp-expiry">
                    Expires at: {new Date(otpExpiresAt).toLocaleString()}
                  </div>
                )}
                <div className="otp-instruction">
                  The customer will need to provide this OTP when picking up their order.
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="order-notification-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="btn btn-danger"
            disabled={loading || !showDetails}
          >
            {loading ? 'Processing...' : 'Reject Order'}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="btn btn-success"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Accept Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderNotificationModal;
