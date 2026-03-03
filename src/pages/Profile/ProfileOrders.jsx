import { useState } from 'react';
import { orderHistory, complaints, reviews } from '../../data/mockData';
import './Profile.css';

const ProfileOrders = () => {
  const [activeTab, setActiveTab] = useState('history');

  return (
    <div className="profile-orders">
      <div className="page-header">
        <h1>Orders</h1>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Order History
        </button>
        <button
          className={`tab ${activeTab === 'complaints' ? 'active' : ''}`}
          onClick={() => setActiveTab('complaints')}
        >
          Complaints
        </button>
        <button
          className={`tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
        </button>
      </div>

      {activeTab === 'history' && (
        <div className="card">
          <h2>Order History</h2>
          <div className="orders-table">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Bag Name</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orderHistory.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.date}</td>
                    <td>{order.customerName}</td>
                    <td>{order.bagName}</td>
                    <td>${order.amount}</td>
                    <td>
                      <span className={`status-badge status-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="card">
          <h2>Complaints</h2>
          <div className="complaints-list">
            {complaints.map((complaint) => (
              <div key={complaint.id} className="complaint-item">
                <div className="complaint-header">
                  <h3>Order {complaint.orderId}</h3>
                  <span className={`status-badge status-${complaint.status.toLowerCase()}`}>
                    {complaint.status}
                  </span>
                </div>
                <p className="complaint-customer">Customer: {complaint.customerName}</p>
                <p className="complaint-text">{complaint.complaint}</p>
                <span className="complaint-date">Date: {complaint.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="card">
          <h2>Reviews</h2>
          <div className="reviews-list">
            {reviews.map((review) => (
              <div key={review.id} className="review-item">
                <div className="review-header">
                  <div>
                    <h3>{review.customerName}</h3>
                    <span className="review-date">Order {review.orderId} - {review.date}</span>
                  </div>
                  <div className="rating">
                    {'⭐'.repeat(review.rating)}
                  </div>
                </div>
                <p className="review-comment">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileOrders;
