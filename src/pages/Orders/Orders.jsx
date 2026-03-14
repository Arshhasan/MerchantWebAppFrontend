import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToCollection } from '../../firebase/firestore';
import './Orders.css';

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmationMethod, setConfirmationMethod] = useState('qr');
  const [pin, setPin] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Subscribe to all orders (no filter for now)
    const unsubscribe = subscribeToCollection(
      'restaurant_orders',
      [], // Empty filters array to get all orders
      (documents) => {
        // Each document is an order with vendorID at document level
        // Transform to match UI format
        const transformedOrders = documents.map((order) => {
          const createdAt = order.createdAt?.toDate 
            ? order.createdAt.toDate() 
            : (order.createdAt ? new Date(order.createdAt) : new Date());
          
          // Get customer name from author object
          const customerName = order.author?.firstName && order.author?.lastName
            ? `${order.author.firstName} ${order.author.lastName}`
            : order.author?.firstName || order.author?.email || 'Unknown Customer';
          
          // Get products/bag name
          const products = order.products || [];
          const bagName = products.length > 0 
            ? products[0].name || 'Surprise Bag'
            : 'Surprise Bag';
          
          // Calculate total amount
          const subtotal = products.reduce((sum, p) => {
            const price = parseFloat(p.price || 0);
            const quantity = parseInt(p.quantity || 1);
            return sum + (price * quantity);
          }, 0);
          const deliveryCharge = parseFloat(order.deliveryCharge || 0);
          const discount = parseFloat(order.discount || 0);
          const tipAmount = parseFloat(order.tip_amount || 0);
          const totalAmount = subtotal + deliveryCharge - discount + tipAmount;

          // Format pickup time
          const pickupTime = order.estimatedTimeToPrepare || 'Not specified';
          
          // Map status
          let status = order.status || 'Pending';
          if (status === 'Order Cancelled') status = 'Cancelled';
          if (status === 'Order Completed' || status === 'Completed') status = 'Complete';

          return {
            id: order.orderId || order.id,
            customerName,
            customerPhone: order.author?.phoneNumber || (order.author?.countryCode ? `${order.author.countryCode}${order.author.phoneNumber}` : 'N/A'),
            customerEmail: order.author?.email || 'N/A',
            bagName,
            pickupTime,
            amount: totalAmount.toFixed(2),
            status,
            createdAt,
            // Keep full order data for details
            fullOrderData: order,
          };
        });

        // Sort by date (newest first)
        transformedOrders.sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        setOrders(transformedOrders);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching orders:', error);
        showToast('Failed to load orders', 'error');
        setLoading(false);
        setOrders([]);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, showToast]);

  const filteredOrders = filter === 'All' 
    ? orders 
    : orders.filter(order => {
        if (filter === 'Complete') {
          return order.status === 'Completed' || order.status === 'Complete';
        }
        return order.status.toLowerCase() === filter.toLowerCase();
      });

  const handleConfirmOrder = (order) => {
    setSelectedOrder(order);
  };

  const handleConfirmSubmit = (e) => {
    e.preventDefault();
    if (confirmationMethod === 'pin' && pin.length < 4) {
      showToast('Please enter a valid PIN', 'error');
      return;
    }
    console.log('Order Confirmed:', selectedOrder, { method: confirmationMethod, pin });
    showToast(`Order ${selectedOrder.id} confirmed!`, 'success');
    setSelectedOrder(null);
    setPin('');
  };

  const filterOptions = ['All', 'Pending', 'Complete'];

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Orders</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Orders</h1>
      </div>

      <div className="filter-segmented-control">
        {filterOptions.map((option) => (
          <button
            key={option}
            className={`filter-option ${filter === option ? 'active' : ''}`}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-light)', marginBottom: '1rem' }}>
            No orders found
          </p>
          <p style={{ color: 'var(--text-light)' }}>
            Orders will appear here once customers place them.
          </p>
        </div>
      ) : (
        <div className="orders-grid">
          {filteredOrders.map((order) => (
          <div key={order.id} className="order-card">
            <div className="order-card-header">
              <h3>Order {order.id.substring(0, 8)}...</h3>
              <span className={`status-badge status-${order.status.toLowerCase()}`}>
                {order.status}
              </span>
            </div>
            <div className="order-card-body">
              <div className="order-detail">
                <span className="detail-label">Customer:</span>
                <span className="detail-value">{order.customerName}</span>
              </div>
              <div className="order-detail">
                <span className="detail-label">Bag:</span>
                <span className="detail-value">{order.bagName}</span>
              </div>
              <div className="order-detail">
                <span className="detail-label">Pickup Time:</span>
                <span className="detail-value">{order.pickupTime}</span>
              </div>
              <div className="order-detail">
                <span className="detail-label">Amount:</span>
                <span className="detail-value amount">${order.amount}</span>
              </div>
            </div>
            <div className="order-card-footer">
                <button
                  onClick={() => handleConfirmOrder(order)}
                  className="btn btn-primary btn-sm"
                  disabled={order.status === 'Completed' || order.status === 'Complete' || order.status === 'Cancelled'}
                >
                  Confirm Order
                </button>
            </div>
          </div>
        ))}
        </div>
      )}

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Order {selectedOrder.id.substring(0, 8)}...</h2>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>
                ×
              </button>
            </div>
            <form onSubmit={handleConfirmSubmit}>
              <div className="confirmation-methods">
                <label className={`method-option ${confirmationMethod === 'qr' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    value="qr"
                    checked={confirmationMethod === 'qr'}
                    onChange={(e) => setConfirmationMethod(e.target.value)}
                  />
                  QR Code
                </label>
                <label className={`method-option ${confirmationMethod === 'pin' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    value="pin"
                    checked={confirmationMethod === 'pin'}
                    onChange={(e) => setConfirmationMethod(e.target.value)}
                  />
                  Enter PIN
                </label>
              </div>

              {confirmationMethod === 'qr' ? (
                <div className="qr-placeholder">
                  <div className="qr-code">
                    <div className="qr-pattern"></div>
                    <p>QR Code Scanner Placeholder</p>
                  </div>
                </div>
              ) : (
                <div className="input-group">
                  <label>Enter PIN</label>
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Enter 4-digit PIN"
                    maxLength="4"
                    required
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setSelectedOrder(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
