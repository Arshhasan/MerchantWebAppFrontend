import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Reviews.css';

const Reviews = () => {
  const navigate = useNavigate();
  const [selectedReview, setSelectedReview] = useState(null);
  const [filter, setFilter] = useState('All');

  // Dummy reviews data with detailed information
  const reviews = [
    {
      id: 1,
      orderId: 'ORD001',
      date: '2024-01-15',
      time: '3:45 PM',
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      rating: 5,
      comment: 'Great surprise bag! The items were fresh and the value was excellent. Will definitely order again.',
      orderDetails: {
        bagName: 'Surprise Bag #1',
        amount: 25.99,
        pickupDate: '2024-01-15',
        items: ['Mixed Vegetables', 'Fresh Fruits', 'Bakery Items'],
      },
      helpful: 12,
      verified: true,
    },
    {
      id: 2,
      orderId: 'ORD002',
      date: '2024-01-14',
      time: '1:20 PM',
      customerName: 'Jane Smith',
      customerPhone: '+1234567891',
      rating: 4,
      comment: 'Good value for money. The bag had a nice variety of items. Some items could have been fresher, but overall satisfied.',
      orderDetails: {
        bagName: 'Surprise Bag #2',
        amount: 30.50,
        pickupDate: '2024-01-14',
        items: ['Fresh Produce', 'Dairy Products', 'Beverages'],
      },
      helpful: 8,
      verified: true,
    },
    {
      id: 3,
      orderId: 'ORD003',
      date: '2024-01-13',
      time: '5:10 PM',
      customerName: 'Bob Johnson',
      customerPhone: '+1234567892',
      rating: 5,
      comment: 'Amazing! Everything was perfect. The packaging was great and all items were in excellent condition. Highly recommend!',
      orderDetails: {
        bagName: 'Surprise Bag #3',
        amount: 18.75,
        pickupDate: '2024-01-13',
        items: ['Meat & Seafood', 'Snacks'],
      },
      helpful: 15,
      verified: true,
    },
    {
      id: 4,
      orderId: 'ORD004',
      date: '2024-01-12',
      time: '10:30 AM',
      customerName: 'Alice Williams',
      customerPhone: '+1234567893',
      rating: 3,
      comment: 'Decent bag but expected more variety. Some items were good, others not so much. Average experience.',
      orderDetails: {
        bagName: 'Surprise Bag #4',
        amount: 22.00,
        pickupDate: '2024-01-12',
        items: ['Organic Vegetables', 'Fresh Bread'],
      },
      helpful: 3,
      verified: true,
    },
    {
      id: 5,
      orderId: 'ORD005',
      date: '2024-01-11',
      time: '2:15 PM',
      customerName: 'Charlie Brown',
      customerPhone: '+1234567894',
      rating: 5,
      comment: 'Outstanding service and quality! The surprise bag exceeded my expectations. Great selection of items.',
      orderDetails: {
        bagName: 'Surprise Bag #5',
        amount: 28.00,
        pickupDate: '2024-01-11',
        items: ['Premium Items', 'Specialty Products'],
      },
      helpful: 20,
      verified: true,
    },
    {
      id: 6,
      orderId: 'ORD006',
      date: '2024-01-10',
      time: '4:00 PM',
      customerName: 'Diana Prince',
      customerPhone: '+1234567895',
      rating: 2,
      comment: 'Not satisfied with the quality. Some items were not fresh and the overall value was not as expected.',
      orderDetails: {
        bagName: 'Surprise Bag #6',
        amount: 22.50,
        pickupDate: '2024-01-10',
        items: ['Mixed Items', 'Daily Essentials'],
      },
      helpful: 1,
      verified: true,
    },
  ];

  const filteredReviews = filter === 'All' 
    ? reviews 
    : filter === '5 Stars'
    ? reviews.filter(r => r.rating === 5)
    : filter === '4 Stars'
    ? reviews.filter(r => r.rating === 4)
    : filter === '3 Stars'
    ? reviews.filter(r => r.rating === 3)
    : filter === '2 Stars'
    ? reviews.filter(r => r.rating === 2)
    : reviews.filter(r => r.rating === 1);

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'star filled' : 'star empty'}>
        ★
      </span>
    ));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return '#4CAF50';
    if (rating >= 3) return '#FF9800';
    return '#F44336';
  };

  return (
    <div className="reviews-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Reviews</h1>
      </div>

      <div className="reviews-content">
        {!selectedReview ? (
          <>
            <div className="filter-tabs">
              {['All', '5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'].map((filterOption) => (
                <button
                  key={filterOption}
                  className={`filter-tab ${filter === filterOption ? 'active' : ''}`}
                  onClick={() => setFilter(filterOption)}
                >
                  {filterOption}
                </button>
              ))}
            </div>

            <div className="reviews-list">
              {filteredReviews.map((review) => (
                <div 
                  key={review.id} 
                  className="review-card"
                  onClick={() => setSelectedReview(review)}
                >
                  <div className="review-header">
                    <div className="customer-info">
                      <div className="customer-name">{review.customerName}</div>
                      {review.verified && (
                        <span className="verified-badge">Verified Purchase</span>
                      )}
                    </div>
                    <div className="rating-display">
                      <div className="stars">{renderStars(review.rating)}</div>
                      <span className="rating-number" style={{ color: getRatingColor(review.rating) }}>
                        {review.rating}.0
                      </span>
                    </div>
                  </div>
                  <div className="review-comment">
                    {review.comment.length > 150 
                      ? `${review.comment.substring(0, 150)}...` 
                      : review.comment}
                  </div>
                  <div className="review-footer">
                    <div className="review-meta">
                      <span>Order #{review.orderId}</span>
                      <span>•</span>
                      <span>{formatDate(review.date)}</span>
                    </div>
                    <div className="view-details">
                      View Details →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="review-details">
            <button className="back-to-list" onClick={() => setSelectedReview(null)}>
              ← Back to Reviews
            </button>
            <div className="details-card">
              <div className="details-header">
                <div>
                  <h2>Review #{selectedReview.id}</h2>
                  <div className="customer-info">
                    <span className="customer-name">{selectedReview.customerName}</span>
                    {selectedReview.verified && (
                      <span className="verified-badge">Verified Purchase</span>
                    )}
                  </div>
                </div>
                <div className="rating-display-large">
                  <div className="stars-large">{renderStars(selectedReview.rating)}</div>
                  <span className="rating-number-large" style={{ color: getRatingColor(selectedReview.rating) }}>
                    {selectedReview.rating}.0
                  </span>
                </div>
              </div>

              <div className="details-section">
                <h3>Review</h3>
                <div className="review-comment-full">
                  {selectedReview.comment}
                </div>
                <div className="review-meta-full">
                  <div className="meta-item">
                    <span className="meta-label">Date:</span>
                    <span className="meta-value">{formatDate(selectedReview.date)} at {selectedReview.time}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Helpful:</span>
                    <span className="meta-value">{selectedReview.helpful} people found this helpful</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Customer Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name</span>
                    <span className="detail-value">{selectedReview.customerName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{selectedReview.customerPhone}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Related Order</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Order ID</span>
                    <span className="detail-value">#{selectedReview.orderId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Bag Name</span>
                    <span className="detail-value">{selectedReview.orderDetails.bagName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Amount</span>
                    <span className="detail-value">${selectedReview.orderDetails.amount.toFixed(2)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pickup Date</span>
                    <span className="detail-value">{formatDate(selectedReview.orderDetails.pickupDate)}</span>
                  </div>
                </div>
                <div className="items-box">
                  <span className="detail-label">Items</span>
                  <div className="items-list">
                    {selectedReview.orderDetails.items.map((item, index) => (
                      <span key={index} className="item-tag">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviews;
