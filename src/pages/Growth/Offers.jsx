import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createDocument, getDocuments, deleteDocument, updateDocument, subscribeToCollection } from '../../firebase/firestore';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import './Growth.css';

const Offers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    discountPercentage: '',
    validityDate: '',
    offerTitle: '',
    description: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, offerId: null });

  // Subscribe to real-time updates from Firestore
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setOffers([]);
      return;
    }
    
    setLoading(true);
    
    // Subscribe to real-time updates for merchant offers
    const unsubscribe = subscribeToCollection(
      'merchant_offers',
      [{ field: 'merchantId', operator: '==', value: user.uid }],
      (documents) => {
        console.log('Real-time offers update:', documents);
        // Sort by createdAt descending (newest first)
        const sortedOffers = [...documents].sort((a, b) => {
          try {
            let aDate;
            let bDate;
            
            if (a.createdAt) {
              aDate = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            } else {
              aDate = new Date(0); // Fallback to epoch if no date
            }
            
            if (b.createdAt) {
              bDate = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            } else {
              bDate = new Date(0); // Fallback to epoch if no date
            }
            
            return bDate.getTime() - aDate.getTime(); // Descending order (newest first)
          } catch (error) {
            console.error('Error sorting offers:', error);
            return 0;
          }
        });
        setOffers(sortedOffers);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching offers:', error);
        showToast('Failed to load offers. Please refresh the page.', 'error');
        setOffers([]);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, showToast]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleEdit = (offer) => {
    // Format validity date for input field (YYYY-MM-DD)
    let validityDateStr = '';
    if (offer.validityDate) {
      try {
        if (typeof offer.validityDate === 'string') {
          validityDateStr = offer.validityDate;
        } else if (offer.validityDate.toDate) {
          const date = offer.validityDate.toDate();
          validityDateStr = date.toISOString().split('T')[0];
        }
      } catch (e) {
        validityDateStr = offer.validityDate;
      }
    }
    
    setFormData({
      offerTitle: offer.offerTitle || '',
      discountPercentage: offer.discountPercentage?.toString() || '',
      description: offer.description || '',
      validityDate: validityDateStr,
    });
    setEditingOfferId(offer.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setFormData({ discountPercentage: '', validityDate: '', offerTitle: '', description: '' });
    setEditingOfferId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Please log in to create offers', 'error');
      return;
    }

    try {
      setSubmitting(true);
      
      const offerData = {
        discountPercentage: parseInt(formData.discountPercentage, 10),
        validityDate: formData.validityDate,
        offerTitle: formData.offerTitle || `${formData.discountPercentage}% Off`,
        description: formData.description || '',
        isActive: true,
      };

      let result;
      if (editingOfferId) {
        // Update existing offer
        result = await updateDocument('merchant_offers', editingOfferId, offerData);
        if (result.success) {
          showToast('Offer updated successfully!', 'success');
          handleCancel();
        } else {
          showToast('Failed to update offer: ' + result.error, 'error');
        }
      } else {
        // Create new offer
        offerData.merchantId = user.uid;
        result = await createDocument('merchant_offers', offerData);
        if (result.success) {
          showToast('Offer created successfully!', 'success');
          handleCancel();
          console.log('Offer created with ID:', result.id);
        } else {
          showToast('Failed to create offer: ' + result.error, 'error');
        }
      }
    } catch (error) {
      console.error('Error saving offer:', error);
      showToast('An error occurred while saving the offer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm({ isOpen: true, offerId: id });
  };

  const handleDeleteConfirm = async () => {
    const { offerId } = deleteConfirm;
    if (!offerId) return;

    try {
      const result = await deleteDocument('merchant_offers', offerId);
      
      if (result.success) {
        setOffers(offers.filter((offer) => offer.id !== offerId));
        showToast('Offer deleted successfully!', 'success');
      } else {
        showToast('Failed to delete offer: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting offer:', error);
      showToast('An error occurred while deleting the offer', 'error');
    } finally {
      setDeleteConfirm({ isOpen: false, offerId: null });
    }
  };

  return (
    <div className="offers-page">
      <div className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/growth')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Offers</h1>
        </div>
        <button onClick={() => {
          if (showForm) {
            handleCancel();
          } else {
            setShowForm(true);
            setEditingOfferId(null);
          }
        }} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Create Offer'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>{editingOfferId ? 'Edit Offer' : 'Create New Offer'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Offer Title</label>
              <input
                type="text"
                name="offerTitle"
                value={formData.offerTitle}
                onChange={handleChange}
                placeholder="e.g., Summer Sale, Flash Deal"
              />
            </div>
            <div className="input-group">
              <label>Discount Percentage</label>
              <input
                type="number"
                name="discountPercentage"
                value={formData.discountPercentage}
                onChange={handleChange}
                placeholder="Enter discount percentage"
                min="1"
                max="100"
                required
              />
            </div>
            <div className="input-group">
              <label>Description (Optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add a description for this offer"
                rows="3"
              />
            </div>
            <div className="input-group">
              <label>Offer Validity Date</label>
              <input
                type="date"
                name="validityDate"
                value={formData.validityDate}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting 
                  ? (editingOfferId ? 'Updating...' : 'Creating...') 
                  : (editingOfferId ? 'Update Offer' : 'Save Offer')}
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary" disabled={submitting}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Active Offers</h2>
        {loading ? (
          <p className="empty-state">Loading offers...</p>
        ) : offers.length === 0 ? (
          <p className="empty-state">No offers created yet. Create your first offer above.</p>
        ) : (
          <div className="offers-grid">
            {offers.map((offer) => {
              // Handle validity date formatting
              let validityDate = 'Not set';
              if (offer.validityDate) {
                try {
                  // If it's a string, parse it
                  if (typeof offer.validityDate === 'string') {
                    validityDate = new Date(offer.validityDate).toLocaleDateString();
                  } else if (offer.validityDate.toDate) {
                    // If it's a Firestore timestamp
                    validityDate = offer.validityDate.toDate().toLocaleDateString();
                  }
                } catch (e) {
                  validityDate = offer.validityDate;
                }
              }
              
              // Handle created date formatting
              let createdAt = 'Unknown';
              if (offer.createdAt) {
                try {
                  if (offer.createdAt.toDate) {
                    // Firestore timestamp
                    createdAt = offer.createdAt.toDate().toLocaleDateString();
                  } else if (typeof offer.createdAt === 'string') {
                    createdAt = new Date(offer.createdAt).toLocaleDateString();
                  } else {
                    createdAt = offer.createdAt.toString();
                  }
                } catch (e) {
                  createdAt = 'Unknown';
                }
              }
              
              return (
                <div key={offer.id} className="offer-card">
                  <div className="offer-card-header">
                    <h3>{offer.offerTitle || `${offer.discountPercentage}% Off`}</h3>
                    <span className="offer-discount">{offer.discountPercentage}% OFF</span>
                  </div>
                  {offer.description && (
                    <p className="offer-description">{offer.description}</p>
                  )}
                  <div className="offer-card-details">
                    <div className="offer-detail-item">
                      <span className="offer-detail-label">Valid until:</span>
                      <span className="offer-detail-value">{validityDate}</span>
                    </div>
                    <div className="offer-detail-item">
                      <span className="offer-detail-label">Created:</span>
                      <span className="offer-detail-value">{createdAt}</span>
                    </div>
                  </div>
                  <div className="offer-card-actions">
                    <button
                      onClick={() => handleEdit(offer)}
                      className="btn btn-outline btn-sm offer-edit-btn"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(offer.id)}
                      className="btn btn-danger btn-sm offer-delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Offers;
