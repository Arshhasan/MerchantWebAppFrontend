import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToCollection } from '../../firebase/firestore';
import './Reviews.css';

const Reviews = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedReview, setSelectedReview] = useState(null);
  const [filter, setFilter] = useState('All');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Subscribe to all reviews in the database
    const unsubscribe = subscribeToCollection(
      'foods_review', // Collection name
      [], // Empty filters array to get all reviews
      (documents) => {
        // Transform Firebase documents to component format
        const transformedReviews = documents.map((doc) => {
          const createdAt = doc.createdAt?.toDate ? doc.createdAt.toDate() : (doc.createdAt ? new Date(doc.createdAt) : new Date());
          
          return {
            id: doc.id || doc.Id || '',
            orderId: doc.orderid || doc.orderId || 'N/A',
            date: createdAt.toISOString().split('T')[0],
            time: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            customerName: doc.CustomerId || 'Anonymous', // You might want to fetch customer name separately
            customerPhone: doc.customerPhone || 'N/A',
            rating: doc.rating || 0,
            comment: doc.comment || 'No comment provided',
            orderDetails: {
              bagName: doc.productId || 'Product',
              amount: doc.amount || 0,
              pickupDate: createdAt.toISOString().split('T')[0],
              items: doc.items || [],
            },
            helpful: doc.helpful || 0,
            verified: true,
            photos: doc.photos || [],
            reviewAttributes: doc.reviewAttributes || {},
            createdAt: createdAt,
          };
        });

        // Sort by date (newest first)
        transformedReviews.sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        setReviews(transformedReviews);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching reviews:', error);
        showToast('Failed to load reviews', 'error');
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, showToast]);

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
        {loading ? (
          <div className="loading-container" style={{ textAlign: 'center', padding: '3rem' }}>
            <p>Loading reviews...</p>
          </div>
        ) : !selectedReview ? (
          <>
            {reviews.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '1.1rem', color: 'var(--text-light)', marginBottom: '1rem' }}>
                  No reviews found
                </p>
                <p style={{ color: 'var(--text-light)' }}>
                  Reviews from customers will appear here once they submit feedback.
                </p>
              </div>
            ) : (
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
            )}
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
                {selectedReview.photos && selectedReview.photos.length > 0 && (
                  <div className="review-photos" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                    {selectedReview.photos.map((photo, index) => (
                      <img 
                        key={index} 
                        src={photo} 
                        alt={`Review photo ${index + 1}`}
                        style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }}
                        onClick={() => window.open(photo, '_blank')}
                      />
                    ))}
                  </div>
                )}
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
                    <span className="detail-value">${(selectedReview.orderDetails.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pickup Date</span>
                    <span className="detail-value">{formatDate(selectedReview.orderDetails.pickupDate)}</span>
                  </div>
                </div>
                {selectedReview.orderDetails.items && selectedReview.orderDetails.items.length > 0 && (
                  <div className="items-box">
                    <span className="detail-label">Items</span>
                    <div className="items-list">
                      {selectedReview.orderDetails.items.map((item, index) => (
                        <span key={index} className="item-tag">{item}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviews;
