import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { allOrders } from '../../data/mockData';
import './Orders.css';

const Orders = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmationMethod, setConfirmationMethod] = useState('qr');
  const [pin, setPin] = useState('');

  const filteredOrders = filter === 'All' 
    ? allOrders 
    : allOrders.filter(order => {
        if (filter === 'Active') return order.status === 'Active' || order.status === 'Pending' || order.status === 'Confirmed';
        if (filter === 'Complete') return order.status === 'Completed';
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

  const filterOptions = ['All', 'Active', 'Pending', 'Complete'];

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

      <div className="orders-grid">
        {filteredOrders.map((order) => (
          <div key={order.id} className="order-card">
            <div className="order-card-header">
              <h3>Order {order.id}</h3>
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
                disabled={order.status === 'Completed' || order.status === 'Cancelled'}
              >
                Confirm Order
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Order {selectedOrder.id}</h2>
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
