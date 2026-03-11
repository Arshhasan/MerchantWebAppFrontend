import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './OrderHistory.css';

const OrderHistory = () => {
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Dummy order history data with detailed information
  const orderHistory = [
    {
      id: 'ORD001',
      date: '2024-01-15',
      time: '10:30 AM',
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      customerEmail: 'john.doe@example.com',
      bagName: 'Surprise Bag #1',
      bagId: 'BAG001',
      amount: 25.99,
      status: 'Completed',
      pickupTime: '12:00 PM',
      pickupDate: '2024-01-15',
      paymentMethod: 'Credit Card',
      items: [
        { name: 'Mixed Vegetables', quantity: 1, price: 10.99 },
        { name: 'Fresh Fruits', quantity: 1, price: 8.50 },
        { name: 'Bakery Items', quantity: 1, price: 6.50 },
      ],
      address: '123 Main Street, City, State 12345',
      notes: 'Customer requested early pickup',
    },
    {
      id: 'ORD002',
      date: '2024-01-14',
      time: '2:15 PM',
      customerName: 'Jane Smith',
      customerPhone: '+1234567891',
      customerEmail: 'jane.smith@example.com',
      bagName: 'Surprise Bag #2',
      bagId: 'BAG002',
      amount: 30.50,
      status: 'Completed',
      pickupTime: '4:00 PM',
      pickupDate: '2024-01-14',
      paymentMethod: 'Cash',
      items: [
        { name: 'Fresh Produce', quantity: 2, price: 15.25 },
        { name: 'Dairy Products', quantity: 1, price: 8.00 },
        { name: 'Beverages', quantity: 1, price: 7.25 },
      ],
      address: '456 Oak Avenue, City, State 12346',
      notes: '',
    },
    {
      id: 'ORD003',
      date: '2024-01-13',
      time: '9:45 AM',
      customerName: 'Bob Johnson',
      customerPhone: '+1234567892',
      customerEmail: 'bob.johnson@example.com',
      bagName: 'Surprise Bag #3',
      bagId: 'BAG003',
      amount: 18.75,
      status: 'Completed',
      pickupTime: '11:30 AM',
      pickupDate: '2024-01-13',
      paymentMethod: 'Debit Card',
      items: [
        { name: 'Meat & Seafood', quantity: 1, price: 12.50 },
        { name: 'Snacks', quantity: 1, price: 6.25 },
      ],
      address: '789 Pine Road, City, State 12347',
      notes: 'Customer preferred contactless pickup',
    },
    {
      id: 'ORD004',
      date: '2024-01-12',
      time: '3:20 PM',
      customerName: 'Alice Williams',
      customerPhone: '+1234567893',
      customerEmail: 'alice.williams@example.com',
      bagName: 'Surprise Bag #4',
      bagId: 'BAG004',
      amount: 22.00,
      status: 'Completed',
      pickupTime: '5:00 PM',
      pickupDate: '2024-01-12',
      paymentMethod: 'Credit Card',
      items: [
        { name: 'Organic Vegetables', quantity: 1, price: 14.00 },
        { name: 'Fresh Bread', quantity: 1, price: 8.00 },
      ],
      address: '321 Elm Street, City, State 12348',
      notes: '',
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return '#4CAF50';
      case 'Pending':
        return '#FF9800';
      case 'Cancelled':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="order-history-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Order History</h1>
      </div>

      <div className="order-history-content">
        {!selectedOrder ? (
          <div className="orders-list">
            {orderHistory.map((order) => (
              <div 
                key={order.id} 
                className="order-card"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="order-header">
                  <div className="order-id">Order #{order.id}</div>
                  <div 
                    className="order-status"
                    style={{ color: getStatusColor(order.status) }}
                  >
                    {order.status}
                  </div>
                </div>
                <div className="order-info">
                  <div className="info-row">
                    <span className="label">Customer:</span>
                    <span className="value">{order.customerName}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Bag:</span>
                    <span className="value">{order.bagName}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Date:</span>
                    <span className="value">{formatDate(order.date)} at {order.time}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Amount:</span>
                    <span className="value amount">${order.amount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="view-details">
                  View Details →
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="order-details">
            <button className="back-to-list" onClick={() => setSelectedOrder(null)}>
              ← Back to Orders
            </button>
            <div className="details-card">
              <div className="details-header">
                <h2>Order #{selectedOrder.id}</h2>
                <div 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(selectedOrder.status) + '20', color: getStatusColor(selectedOrder.status) }}
                >
                  {selectedOrder.status}
                </div>
              </div>

              <div className="details-section">
                <h3>Order Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Order Date</span>
                    <span className="detail-value">{formatDate(selectedOrder.date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Order Time</span>
                    <span className="detail-value">{selectedOrder.time}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pickup Date</span>
                    <span className="detail-value">{formatDate(selectedOrder.pickupDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pickup Time</span>
                    <span className="detail-value">{selectedOrder.pickupTime}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Payment Method</span>
                    <span className="detail-value">{selectedOrder.paymentMethod}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total Amount</span>
                    <span className="detail-value amount">${selectedOrder.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Customer Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name</span>
                    <span className="detail-value">{selectedOrder.customerName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{selectedOrder.customerPhone}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{selectedOrder.customerEmail}</span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{selectedOrder.address}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Bag Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Bag Name</span>
                    <span className="detail-value">{selectedOrder.bagName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Bag ID</span>
                    <span className="detail-value">{selectedOrder.bagId}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Items</h3>
                <div className="items-list">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="item-row">
                      <div className="item-name">{item.name}</div>
                      <div className="item-quantity">Qty: {item.quantity}</div>
                      <div className="item-price">${item.price.toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="item-total">
                    <span>Total:</span>
                    <span>${selectedOrder.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="details-section">
                  <h3>Notes</h3>
                  <p className="notes-text">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
