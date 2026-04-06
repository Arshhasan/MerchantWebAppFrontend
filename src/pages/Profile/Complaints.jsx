import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './Complaints.css';

const Complaints = () => {
  const navigate = useNavigate();
  const { vendorProfile } = useAuth();
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  // Dummy complaints data with detailed information
  const complaints = [
    {
      id: 1,
      orderId: 'ORD001',
      date: '2024-01-15',
      time: '2:30 PM',
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      customerEmail: 'john.doe@example.com',
      complaint: 'Bag was damaged during delivery',
      description: 'The surprise bag I received had a torn corner and some items were exposed. The packaging was not secure enough.',
      status: 'Pending',
      priority: 'High',
      orderDetails: {
        bagName: 'Surprise Bag #1',
        amount: 25.99,
        pickupDate: '2024-01-15',
        items: ['Mixed Vegetables', 'Fresh Fruits', 'Bakery Items'],
      },
      resolution: '',
      resolvedDate: null,
    },
    {
      id: 2,
      orderId: 'ORD002',
      date: '2024-01-14',
      time: '11:15 AM',
      customerName: 'Jane Smith',
      customerPhone: '+1234567891',
      customerEmail: 'jane.smith@example.com',
      complaint: 'Wrong items in bag',
      description: 'I ordered Surprise Bag #2 but received items that were different from what was described. Some items were missing.',
      status: 'Resolved',
      priority: 'Medium',
      orderDetails: {
        bagName: 'Surprise Bag #2',
        amount: 30.50,
        pickupDate: '2024-01-14',
        items: ['Fresh Produce', 'Dairy Products', 'Beverages'],
      },
      resolution: 'Refunded the amount and provided a replacement bag with correct items.',
      resolvedDate: '2024-01-14',
    },
    {
      id: 3,
      orderId: 'ORD003',
      date: '2024-01-13',
      time: '4:45 PM',
      customerName: 'Bob Johnson',
      customerPhone: '+1234567892',
      customerEmail: 'bob.johnson@example.com',
      complaint: 'Late delivery',
      description: 'The order was supposed to be ready for pickup at 11:30 AM but was not ready until 12:15 PM. This caused inconvenience.',
      status: 'In Progress',
      priority: 'Medium',
      orderDetails: {
        bagName: 'Surprise Bag #3',
        amount: 18.75,
        pickupDate: '2024-01-13',
        items: ['Meat & Seafood', 'Snacks'],
      },
      resolution: 'Apologized to customer and provided a discount coupon for next order.',
      resolvedDate: null,
    },
    {
      id: 4,
      orderId: 'ORD004',
      date: '2024-01-12',
      time: '9:20 AM',
      customerName: 'Alice Williams',
      customerPhone: '+1234567893',
      customerEmail: 'alice.williams@example.com',
      complaint: 'Poor quality items',
      description: 'Some fruits in the bag were overripe and vegetables were not fresh. Expected better quality for the price paid.',
      status: 'Pending',
      priority: 'High',
      orderDetails: {
        bagName: 'Surprise Bag #4',
        amount: 22.00,
        pickupDate: '2024-01-12',
        items: ['Organic Vegetables', 'Fresh Bread'],
      },
      resolution: '',
      resolvedDate: null,
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Resolved':
        return '#4CAF50';
      case 'In Progress':
        return '#FF9800';
      case 'Pending':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return '#F44336';
      case 'Medium':
        return '#FF9800';
      case 'Low':
        return '#4CAF50';
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
    <div className="complaints-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Complaints</h1>
      </div>

      <div className="complaints-content">
        {!selectedComplaint ? (
          <div className="complaints-list">
            {complaints.map((complaint) => (
              <div 
                key={complaint.id} 
                className="complaint-card"
                onClick={() => setSelectedComplaint(complaint)}
              >
                <div className="complaint-header">
                  <div className="complaint-id">Complaint #{complaint.id}</div>
                  <div className="badges">
                    <div 
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(complaint.priority) + '20', color: getPriorityColor(complaint.priority) }}
                    >
                      {complaint.priority}
                    </div>
                    <div 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(complaint.status) + '20', color: getStatusColor(complaint.status) }}
                    >
                      {complaint.status}
                    </div>
                  </div>
                </div>
                <div className="complaint-info">
                  <div className="info-row">
                    <span className="label">Order ID:</span>
                    <span className="value">#{complaint.orderId}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Customer:</span>
                    <span className="value">{complaint.customerName}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Complaint:</span>
                    <span className="value">{complaint.complaint}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Date:</span>
                    <span className="value">{formatDate(complaint.date)} at {complaint.time}</span>
                  </div>
                </div>
                <div className="view-details">
                  View Details →
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="complaint-details">
            <button className="back-to-list" onClick={() => setSelectedComplaint(null)}>
              ← Back to Complaints
            </button>
            <div className="details-card">
              <div className="details-header">
                <h2>Complaint #{selectedComplaint.id}</h2>
                <div className="badges">
                  <div 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(selectedComplaint.priority) + '20', color: getPriorityColor(selectedComplaint.priority) }}
                  >
                    {selectedComplaint.priority} Priority
                  </div>
                  <div 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(selectedComplaint.status) + '20', color: getStatusColor(selectedComplaint.status) }}
                  >
                    {selectedComplaint.status}
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Complaint Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Complaint Type</span>
                    <span className="detail-value">{selectedComplaint.complaint}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Date</span>
                    <span className="detail-value">{formatDate(selectedComplaint.date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Time</span>
                    <span className="detail-value">{selectedComplaint.time}</span>
                  </div>
                </div>
                <div className="description-box">
                  <span className="detail-label">Description</span>
                  <p className="description-text">{selectedComplaint.description}</p>
                </div>
              </div>

              <div className="details-section">
                <h3>Customer Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name</span>
                    <span className="detail-value">{selectedComplaint.customerName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{selectedComplaint.customerPhone}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{selectedComplaint.customerEmail}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Related Order</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Order ID</span>
                    <span className="detail-value">#{selectedComplaint.orderId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Bag Name</span>
                    <span className="detail-value">{selectedComplaint.orderDetails.bagName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Amount</span>
                    <span className="detail-value">
                      {formatMerchantCurrency(
                        selectedComplaint.orderDetails.amount,
                        vendorProfile
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pickup Date</span>
                    <span className="detail-value">{formatDate(selectedComplaint.orderDetails.pickupDate)}</span>
                  </div>
                </div>
                <div className="items-box">
                  <span className="detail-label">Items</span>
                  <div className="items-list">
                    {selectedComplaint.orderDetails.items.map((item, index) => (
                      <span key={index} className="item-tag">{item}</span>
                    ))}
                  </div>
                </div>
              </div>

              {selectedComplaint.resolution && (
                <div className="details-section">
                  <h3>Resolution</h3>
                  <div className="resolution-box">
                    <p className="resolution-text">{selectedComplaint.resolution}</p>
                    {selectedComplaint.resolvedDate && (
                      <div className="resolved-date">
                        Resolved on: {formatDate(selectedComplaint.resolvedDate)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!selectedComplaint.resolution && (
                <div className="details-section">
                  <h3>Resolution</h3>
                  <div className="resolution-box pending">
                    <p className="resolution-text">No resolution provided yet.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Complaints;
