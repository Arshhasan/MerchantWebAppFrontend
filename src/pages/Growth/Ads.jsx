import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createDocument, deleteDocument, updateDocument, subscribeToCollection, getDocuments } from '../../firebase/firestore';
import { categories } from '../../data/mockData';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import './Growth.css';

const Ads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    budget: '',
    duration: '',
    category: '',
    adTitle: '',
    description: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingAdId, setEditingAdId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, adId: null });

  // Subscribe to real-time updates from Firestore
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAds([]);
      return;
    }
    
    setLoading(true);
    let dataReceived = false;
    let unsubscribe = null;
    
    // Fallback function to fetch ads if real-time listener fails or times out
    const fetchAdsFallback = async () => {
      try {
        console.log('Ads: Using fallback fetch method');
        const result = await getDocuments(
          'merchant_ads',
          [{ field: 'merchantId', operator: '==', value: user.uid }]
        );
        
        if (result.success) {
          // Sort by createdAt descending (newest first)
          const sortedAds = [...(result.data || [])].sort((a, b) => {
            try {
              let aDate;
              let bDate;
              
              if (a.createdAt) {
                aDate = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
              } else {
                aDate = new Date(0);
              }
              
              if (b.createdAt) {
                bDate = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
              } else {
                bDate = new Date(0);
              }
              
              return bDate.getTime() - aDate.getTime();
            } catch (error) {
              console.error('Error sorting ads in fallback:', error);
              return 0;
            }
          });
          console.log('Ads: Fallback fetch successful, count:', sortedAds.length);
          setAds(sortedAds);
          setLoading(false);
        } else {
          console.error('Ads: Fallback fetch failed:', result.error);
          showToast('Failed to load ads: ' + result.error, 'error');
          setAds([]);
          setLoading(false);
        }
      } catch (error) {
        console.error('Ads: Error in fallback fetch:', error);
        showToast('Failed to load ads. Please check your connection.', 'error');
        setAds([]);
        setLoading(false);
      }
    };
    
    // Set up timeout to trigger fallback if real-time listener doesn't respond
    const timeoutId = setTimeout(() => {
      if (!dataReceived) {
        console.log('Ads: Real-time listener timeout, using fallback');
        fetchAdsFallback();
      }
    }, 5000); // 5 second timeout
    
    // Subscribe to real-time updates for merchant ads
    unsubscribe = subscribeToCollection(
      'merchant_ads',
      [{ field: 'merchantId', operator: '==', value: user.uid }],
      (documents) => {
        dataReceived = true;
        clearTimeout(timeoutId);
        console.log('Real-time ads update:', documents);
        // Sort by createdAt descending (newest first)
        const sortedAds = [...documents].sort((a, b) => {
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
            console.error('Error sorting ads:', error);
            return 0;
          }
        });
        setAds(sortedAds);
        setLoading(false);
      },
      (error) => {
        clearTimeout(timeoutId);
        console.error('Error fetching ads:', error);
        console.error('Ads: Error details:', error.code, error.message);
        // Use fallback on error
        fetchAdsFallback();
      }
    );

    // Cleanup subscription on unmount
    return () => {
      clearTimeout(timeoutId);
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

  const handleEdit = (ad) => {
    setFormData({
      adTitle: ad.adTitle || '',
      budget: ad.budget?.toString() || '',
      duration: ad.duration?.toString() || '',
      category: ad.category || '',
      description: ad.description || '',
    });
    setEditingAdId(ad.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setFormData({ budget: '', duration: '', category: '', adTitle: '', description: '' });
    setEditingAdId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Please log in to create ads', 'error');
      return;
    }

    try {
      setSubmitting(true);
      
      const adData = {
        budget: parseFloat(formData.budget),
        duration: parseInt(formData.duration, 10),
        category: formData.category,
        adTitle: formData.adTitle || `$${formData.budget} Ad Campaign`,
        description: formData.description || '',
        isActive: true,
      };

      let result;
      if (editingAdId) {
        // Update existing ad
        result = await updateDocument('merchant_ads', editingAdId, adData);
        if (result.success) {
          showToast('Ad campaign updated successfully!', 'success');
          handleCancel();
        } else {
          showToast('Failed to update ad: ' + result.error, 'error');
        }
      } else {
        // Create new ad
        adData.merchantId = user.uid;
        result = await createDocument('merchant_ads', adData);
        if (result.success) {
          showToast('Ad campaign created successfully!', 'success');
          handleCancel();
          console.log('Ad created with ID:', result.id);
        } else {
          showToast('Failed to create ad: ' + result.error, 'error');
        }
      }
    } catch (error) {
      console.error('Error saving ad:', error);
      showToast('An error occurred while saving the ad', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm({ isOpen: true, adId: id });
  };

  const handleDeleteConfirm = async () => {
    const { adId } = deleteConfirm;
    if (!adId) return;

    try {
      const result = await deleteDocument('merchant_ads', adId);
      
      if (result.success) {
        setAds(ads.filter((ad) => ad.id !== adId));
        showToast('Ad campaign deleted successfully!', 'success');
      } else {
        showToast('Failed to delete ad: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting ad:', error);
      showToast('An error occurred while deleting the ad', 'error');
    } finally {
      setDeleteConfirm({ isOpen: false, adId: null });
    }
  };

  return (
    <div className="ads-page">
      <div className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/growth')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Ads</h1>
        </div>
        <button onClick={() => {
          if (showForm) {
            handleCancel();
          } else {
            setShowForm(true);
            setEditingAdId(null);
          }
        }} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Run Ad'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>{editingAdId ? 'Edit Ad Campaign' : 'Create New Ad Campaign'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Ad Title</label>
              <input
                type="text"
                name="adTitle"
                value={formData.adTitle}
                onChange={handleChange}
                placeholder="e.g., Summer Promotion, Flash Sale"
              />
            </div>
            <div className="input-group">
              <label>Budget</label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="Enter budget amount"
                min="1"
                step="0.01"
                required
              />
            </div>
            <div className="input-group">
              <label>Duration (Days)</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                placeholder="Enter duration in days"
                min="1"
                required
              />
            </div>
            <div className="input-group">
              <label>Category Selection</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Description (Optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add a description for this ad campaign"
                rows="3"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting 
                  ? (editingAdId ? 'Updating...' : 'Creating...') 
                  : (editingAdId ? 'Update Ad Campaign' : 'Create Ad Campaign')}
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary" disabled={submitting}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Active Ad Campaigns</h2>
        {user && (
          <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
            Debug – Your UID: <strong>{user.uid}</strong>
          </p>
        )}
        {loading ? (
          <p className="empty-state">Loading ad campaigns...</p>
        ) : ads.length === 0 ? (
          <p className="empty-state">No ad campaigns created yet. Create your first ad above.</p>
        ) : (
          <div className="ads-grid">
            {ads.map((ad) => {
              // Handle created date formatting
              let createdAt = 'Unknown';
              if (ad.createdAt) {
                try {
                  if (ad.createdAt.toDate) {
                    createdAt = ad.createdAt.toDate().toLocaleDateString();
                  } else if (typeof ad.createdAt === 'string') {
                    createdAt = new Date(ad.createdAt).toLocaleDateString();
                  } else {
                    createdAt = ad.createdAt.toString();
                  }
                } catch (e) {
                  createdAt = 'Unknown';
                }
              }
              
              return (
                <div key={ad.id} className="ad-card">
                  <div className="ad-card-header">
                    <h3>{ad.adTitle || `$${ad.budget} Ad Campaign`}</h3>
                    <span className="ad-budget">${ad.budget}</span>
                  </div>
                  {ad.description && (
                    <p className="ad-description">{ad.description}</p>
                  )}
                  <div className="ad-card-details">
                    <div className="ad-detail-item">
                      <span className="ad-detail-label">Duration:</span>
                      <span className="ad-detail-value">{ad.duration} days</span>
                    </div>
                    <div className="ad-detail-item">
                      <span className="ad-detail-label">Category:</span>
                      <span className="ad-detail-value">{ad.category}</span>
                    </div>
                    <div className="ad-detail-item">
                      <span className="ad-detail-label">Created:</span>
                      <span className="ad-detail-value">{createdAt}</span>
                    </div>
                  </div>
                  <div className="ad-card-actions">
                    <button
                      onClick={() => handleEdit(ad)}
                      className="btn btn-outline btn-sm ad-edit-btn"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(ad.id)}
                      className="btn btn-danger btn-sm ad-delete-btn"
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

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, adId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Ad Campaign"
        message="Are you sure you want to delete this ad campaign? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default Ads;
