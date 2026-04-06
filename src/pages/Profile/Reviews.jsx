import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToMerchantReviewsByProductId } from '../../services/merchantReviews';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './Reviews.css';

function transformReviewDocs(documents) {
  const transformedReviews = documents.map((doc) => {
    const createdAt = doc.createdAt?.toDate
      ? doc.createdAt.toDate()
      : doc.createdAt
        ? new Date(doc.createdAt)
        : new Date();

    const attrs = doc.reviewAttributes && typeof doc.reviewAttributes === 'object' ? doc.reviewAttributes : {};
    const displayName =
      (typeof attrs.uname === 'string' && attrs.uname.trim()) ||
      (typeof doc.CustomerId === 'string' && doc.CustomerId.length > 20 ? 'Customer' : doc.CustomerId) ||
      'Customer';

    return {
      id: doc.id || doc.Id || '',
      productId: String(doc.productId ?? doc.product_id ?? ''),
      orderId: doc.orderid || doc.orderId || 'N/A',
      date: createdAt.toISOString().split('T')[0],
      time: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      customerName: displayName,
      customerPhone: doc.customerPhone || 'N/A',
      rating: doc.rating || 0,
      comment: doc.comment || 'No comment provided',
      orderDetails: {
        bagName: doc._bagTitleFromJoin || doc.productName || doc.productId || 'Product',
        amount: doc.amount || 0,
        pickupDate: createdAt.toISOString().split('T')[0],
        items: doc.items || [],
      },
      helpful: doc.helpful || 0,
      verified: true,
      photos: doc.photos || [],
      reviewAttributes: doc.reviewAttributes || {},
      createdAt,
      _bagImageUrl: doc._bagImageUrl,
      _bagOfferPrice: doc._bagOfferPrice,
      _bagPrice: doc._bagPrice,
    };
  });

  transformedReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return transformedReviews;
}

function formatListDate(createdAt) {
  try {
    const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
    return d.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function averageRating(reviews) {
  if (!reviews.length) return 0;
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

const Reviews = () => {
  const navigate = useNavigate();
  const { user, vendorProfile } = useAuth();
  const { showToast } = useToast();
  const [selectedReview, setSelectedReview] = useState(null);
  const [filter, setFilter] = useState('All');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setReviews([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = subscribeToMerchantReviewsByProductId(
      user.uid,
      (docs) => {
        setReviews(transformReviewDocs(docs));
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

  const filteredReviews =
    filter === 'All'
      ? reviews
      : filter === '5 Stars'
        ? reviews.filter((r) => r.rating === 5)
        : filter === '4 Stars'
          ? reviews.filter((r) => r.rating === 4)
          : filter === '3 Stars'
            ? reviews.filter((r) => r.rating === 3)
            : filter === '2 Stars'
              ? reviews.filter((r) => r.rating === 2)
              : reviews.filter((r) => r.rating === 1);

  /** One card per surprise bag; reviews nested (Blinkit-style order cards). */
  const bagReviewGroups = useMemo(() => {
    const m = new Map();
    for (const r of filteredReviews) {
      const key = r.productId || 'unknown';
      if (!m.has(key)) {
        m.set(key, {
          productId: key,
          bagTitle: r.orderDetails.bagName,
          bagImage: r._bagImageUrl || null,
          offerPrice: r._bagOfferPrice ?? null,
          bagPrice: r._bagPrice ?? null,
          reviews: [],
        });
      }
      const g = m.get(key);
      g.reviews.push(r);
      if (!g.bagImage && r._bagImageUrl) g.bagImage = r._bagImageUrl;
      if ((!g.bagTitle || g.bagTitle === 'Product') && r.orderDetails.bagName) {
        g.bagTitle = r.orderDetails.bagName;
      }
    }
    const groups = [...m.values()];
    for (const g of groups) {
      g.reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      g.avgRating = averageRating(g.reviews);
      g.latestReview = g.reviews[0];
    }
    groups.sort((a, b) => {
      const ta = a.latestReview?.createdAt ? new Date(a.latestReview.createdAt).getTime() : 0;
      const tb = b.latestReview?.createdAt ? new Date(b.latestReview.createdAt).getTime() : 0;
      return tb - ta;
    });
    return groups;
  }, [filteredReviews]);

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
                  Reviews from customers will appear here once they submit feedback on your surprise bags.
                </p>
              </div>
            ) : (
              <>
                <div className="filter-tabs">
                  {['All', '5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'].map((filterOption) => (
                    <button
                      key={filterOption}
                      type="button"
                      className={`filter-tab ${filter === filterOption ? 'active' : ''}`}
                      onClick={() => setFilter(filterOption)}
                    >
                      {filterOption}
                    </button>
                  ))}
                </div>

                <div className="reviews-bag-list">
                  {bagReviewGroups.map((bag) => {
                    const subtitleParts = [];
                    if (bag.avgRating > 0) subtitleParts.push(`${bag.avgRating} avg rating`);
                    const price =
                      bag.offerPrice != null && Number.isFinite(bag.offerPrice)
                        ? bag.offerPrice
                        : bag.bagPrice != null && Number.isFinite(bag.bagPrice)
                          ? bag.bagPrice
                          : null;
                    if (price != null) {
                      subtitleParts.push(formatMerchantCurrency(price, vendorProfile));
                    }
                    if (bag.latestReview?.createdAt) {
                      subtitleParts.push(formatListDate(bag.latestReview.createdAt));
                    }
                    const subtitle = subtitleParts.join(' • ');

                    return (
                      <article key={bag.productId} className="reviews-bag-card">
                        <div className="reviews-bag-card__header">
                          <div className="reviews-bag-card__status" aria-hidden>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" fill="#E8F5E9" stroke="#4CAF50" strokeWidth="1.5" />
                              <path
                                d="M8 12.5L10.5 15L16 9"
                                stroke="#2E7D32"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div className="reviews-bag-card__header-main">
                            <h2 className="reviews-bag-card__title">{bag.bagTitle}</h2>
                            <p className="reviews-bag-card__subtitle">{subtitle}</p>
                          </div>
                          <span className="reviews-bag-card__chevron" aria-hidden>
                            ›
                          </span>
                        </div>

                        <div className="reviews-bag-card__media">
                          {bag.bagImage ? (
                            <div className="reviews-bag-card__thumb-wrap">
                              <img src={bag.bagImage} alt="" className="reviews-bag-card__thumb" />
                            </div>
                          ) : (
                            <div
                              className="reviews-bag-card__thumb-wrap reviews-bag-card__thumb-wrap--placeholder"
                              aria-hidden
                            />
                          )}
                          <p className="reviews-bag-card__media-caption">
                            {bag.reviews.length} review{bag.reviews.length === 1 ? '' : 's'}
                          </p>
                        </div>

                        <div className="reviews-bag-card__reviews">
                          {bag.reviews.map((review) => (
                            <button
                              key={review.id}
                              type="button"
                              className="reviews-bag-card__review-row"
                              onClick={() => setSelectedReview(review)}
                            >
                              <div className="reviews-bag-card__review-top">
                                <span className="reviews-bag-card__review-name">{review.customerName}</span>
                                <span className="reviews-bag-card__review-time">
                                  {formatListDate(review.createdAt)}
                                </span>
                              </div>
                              <div className="reviews-bag-card__review-stars">
                                {renderStars(review.rating)}
                                <span className="reviews-bag-card__review-rating-num">{review.rating}</span>
                              </div>
                              <p className="reviews-bag-card__review-text">
                                {review.comment.length > 220
                                  ? `${review.comment.substring(0, 220)}…`
                                  : review.comment}
                              </p>
                              <span className="reviews-bag-card__review-cta">View details</span>
                            </button>
                          ))}
                        </div>
                      </article>
                    );
                  })}
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
                <div className="details-header__left">
                  {selectedReview._bagImageUrl ? (
                    <div className="details-bag-thumb">
                      <img src={selectedReview._bagImageUrl} alt="" />
                    </div>
                  ) : null}
                  <div>
                    <h2>{selectedReview.orderDetails.bagName}</h2>
                    <p className="details-review-id">Review #{selectedReview.id}</p>
                    <div className="customer-info">
                      <span className="customer-name">{selectedReview.customerName}</span>
                      {selectedReview.verified && (
                        <span className="verified-badge">Verified Purchase</span>
                      )}
                    </div>
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
                    <span className="detail-value">
                      {formatMerchantCurrency(
                        selectedReview.orderDetails.amount || 0,
                        vendorProfile
                      )}
                    </span>
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
