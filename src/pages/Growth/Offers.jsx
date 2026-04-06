import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createDocument, getDocuments, deleteDocument, updateDocument, subscribeToCollection, getDocument } from '../../firebase/firestore';
import { uploadFile } from '../../firebase/storage';
import { Timestamp } from 'firebase/firestore';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './Growth.css';

const Offers = () => {
  const navigate = useNavigate();
  const { user, vendorProfile } = useAuth();
  const { showToast } = useToast();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount: '',
    discountType: 'Percentage',
    expiresAt: '',
    image: null,
    imagePreview: null,
    isEnabled: true,
    isPublic: true,
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, offerId: null });

  // Load vendor ID and subscribe to coupons
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setOffers([]);
      return;
    }
    
    const loadVendorId = async () => {
      try {
        const userDoc = await getDocument('users', user.uid);
        if (userDoc.success && userDoc.data && userDoc.data.vendorID) {
          setVendorId(userDoc.data.vendorID);
        }
      } catch (error) {
        console.error('Error loading vendor ID:', error);
      }
    };
    
    loadVendorId();
  }, [user]);

  // Subscribe to real-time updates from Firestore
  useEffect(() => {
    if (!user || !vendorId) {
      setLoading(false);
      setOffers([]);
      return;
    }
    
    setLoading(true);
    
    // Subscribe to real-time updates for coupons
    const unsubscribe = subscribeToCollection(
      'coupons',
      [{ field: 'resturant_id', operator: '==', value: vendorId }],
      (documents) => {
        console.log('Real-time coupons update:', documents);
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
            console.error('Error sorting coupons:', error);
            return 0;
          }
        });
        setOffers(sortedOffers);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching coupons:', error);
        showToast('Failed to load coupons. Please refresh the page.', 'error');
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
  }, [user, vendorId, showToast]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        image: file,
        imagePreview: URL.createObjectURL(file),
      });
    }
    e.target.value = '';
  };

  const removeImage = () => {
    if (formData.imagePreview && !formData.image) {
      URL.revokeObjectURL(formData.imagePreview);
    }
    setFormData({
      ...formData,
      image: null,
      imagePreview: null,
    });
  };

  const handleEdit = (coupon) => {
    // Format expiresAt date for input field (YYYY-MM-DD)
    let expiresAtStr = '';
    if (coupon.expiresAt) {
      try {
        if (typeof coupon.expiresAt === 'string') {
          expiresAtStr = coupon.expiresAt;
        } else if (coupon.expiresAt.toDate) {
          const date = coupon.expiresAt.toDate();
          expiresAtStr = date.toISOString().split('T')[0];
        }
      } catch (e) {
        expiresAtStr = coupon.expiresAt;
      }
    }
    
    setFormData({
      code: coupon.code || '',
      description: coupon.description || '',
      discount: coupon.discount?.toString() || '',
      discountType: coupon.discountType || 'Percentage',
      expiresAt: expiresAtStr,
      image: null,
      imagePreview: coupon.image || null,
      isEnabled: coupon.isEnabled !== undefined ? coupon.isEnabled : true,
      isPublic: coupon.isPublic !== undefined ? coupon.isPublic : true,
    });
    setEditingOfferId(coupon.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    if (formData.imagePreview && formData.image) {
      URL.revokeObjectURL(formData.imagePreview);
    }
    setFormData({ 
      code: '',
      description: '',
      discount: '',
      discountType: 'Percentage',
      expiresAt: '',
      image: null,
      imagePreview: null,
      isEnabled: true,
      isPublic: true,
    });
    setEditingOfferId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !vendorId) {
      showToast('Please ensure your store is set up before creating coupons', 'error');
      return;
    }

    // Validation
    if (!formData.code.trim()) {
      showToast('Coupon code is required', 'error');
      return;
    }
    if (!formData.discount.trim()) {
      showToast('Discount amount is required', 'error');
      return;
    }
    if (!formData.expiresAt) {
      showToast('Expiration date is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      
      // Upload image if new image is selected
      let imageUrl = formData.imagePreview;
      if (formData.image) {
        setUploadingImage(true);
        const timestamp = Date.now();
        const fileName = `coupons/${vendorId}/${timestamp}-${formData.image.name}`;
        const uploadResult = await uploadFile(formData.image, fileName);
        if (uploadResult.success) {
          imageUrl = uploadResult.url;
        } else {
          throw new Error(`Failed to upload image: ${uploadResult.error}`);
        }
        setUploadingImage(false);
      }

      // Convert expiresAt to Firestore Timestamp
      const expiresAtDate = new Date(formData.expiresAt);
      expiresAtDate.setHours(23, 59, 59, 999); // Set to end of day
      const expiresAtTimestamp = Timestamp.fromDate(expiresAtDate);

      const couponData = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || '',
        discount: formData.discount.toString(),
        discountType: formData.discountType,
        expiresAt: expiresAtTimestamp,
        image: imageUrl || '',
        isEnabled: formData.isEnabled,
        isPublic: formData.isPublic,
        resturant_id: vendorId,
      };

      let result;
      if (editingOfferId) {
        // Update existing coupon
        result = await updateDocument('coupons', editingOfferId, couponData);
        if (result.success) {
          showToast('Coupon updated successfully!', 'success');
          handleCancel();
        } else {
          showToast('Failed to update coupon: ' + result.error, 'error');
        }
      } else {
        // Create new coupon
        result = await createDocument('coupons', couponData);
        if (result.success) {
          showToast('Coupon created successfully!', 'success');
          handleCancel();
          console.log('Coupon created with ID:', result.id);
        } else {
          showToast('Failed to create coupon: ' + result.error, 'error');
        }
      }
    } catch (error) {
      console.error('Error saving coupon:', error);
      showToast(error.message || 'An error occurred while saving the coupon', 'error');
      setUploadingImage(false);
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
      const result = await deleteDocument('coupons', offerId);
      
      if (result.success) {
        setOffers(offers.filter((offer) => offer.id !== offerId));
        showToast('Coupon deleted successfully!', 'success');
      } else {
        showToast('Failed to delete coupon: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting coupon:', error);
      showToast('An error occurred while deleting the coupon', 'error');
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
          setShowForm(true);
          setEditingOfferId(null);
        }} className="btn btn-primary" disabled={showForm}>
          Create Coupon
        </button>
      </div>

      {showForm && (
        <div className="form-modal-overlay" onClick={(e) => {
          if (e.target.classList.contains('form-modal-overlay')) {
            handleCancel();
          }
        }}>
          <div className="form-modal-content">
            <div className="form-modal-header">
              <h2>{editingOfferId ? 'Edit Coupon' : 'Create New Coupon'}</h2>
              <button
                type="button"
                onClick={handleCancel}
                className="form-modal-close"
                disabled={submitting || uploadingImage}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="form-modal-form">
            <div className="input-group">
              <label>Coupon Code *</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="e.g., TOT10, SAVE20"
                required
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="input-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="e.g., 10% DISCOUNT"
                rows="3"
              />
            </div>
            <div className="form-row">
              <div className="input-group">
                <label>Discount Amount *</label>
                <input
                  type="text"
                  name="discount"
                  value={formData.discount}
                  onChange={handleChange}
                  placeholder={formData.discountType === 'Percentage' ? 'e.g., 10' : 'e.g., 5.00'}
                  required
                />
              </div>
              <div className="input-group">
                <label>Discount Type *</label>
                <select
                  name="discountType"
                  value={formData.discountType}
                  onChange={handleChange}
                  required
                >
                  <option value="Percentage">Percentage (%)</option>
                  <option value="Fixed">Fixed Amount</option>
                </select>
              </div>
            </div>
            <div className="input-group">
              <label>Expiration Date *</label>
              <input
                type="date"
                name="expiresAt"
                value={formData.expiresAt}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="input-group">
              <label>Coupon Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="file-input"
              />
              {formData.imagePreview && (
                <div className="image-preview-container" style={{ marginTop: '1rem' }}>
                  <img 
                    src={formData.imagePreview} 
                    alt="Coupon preview" 
                    style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="btn btn-danger btn-sm"
                    style={{ marginTop: '0.5rem' }}
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="input-group">
                <label className="toggle-label">
                  <span>Enabled</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="isEnabled"
                      checked={formData.isEnabled}
                      onChange={handleChange}
                      className="toggle-input"
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
              <div className="input-group">
                <label className="toggle-label">
                  <span>Public</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="isPublic"
                      checked={formData.isPublic}
                      onChange={handleChange}
                      className="toggle-input"
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
            </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting || uploadingImage}>
                  {uploadingImage ? 'Uploading Image...' : submitting 
                    ? (editingOfferId ? 'Updating...' : 'Creating...') 
                    : (editingOfferId ? 'Update Coupon' : 'Save Coupon')}
                </button>
                <button type="button" onClick={handleCancel} className="btn btn-secondary" disabled={submitting || uploadingImage}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Active Coupons</h2>
        {loading ? (
          <p className="empty-state">Loading coupons...</p>
        ) : offers.length === 0 ? (
          <p className="empty-state">No coupons created yet. Create your first coupon above.</p>
        ) : (
          <div className="offers-grid">
            {offers.map((coupon) => {
              // Handle expiresAt date formatting
              let expiresAt = 'Not set';
              if (coupon.expiresAt) {
                try {
                  if (typeof coupon.expiresAt === 'string') {
                    expiresAt = new Date(coupon.expiresAt).toLocaleDateString();
                  } else if (coupon.expiresAt.toDate) {
                    expiresAt = coupon.expiresAt.toDate().toLocaleDateString();
                  }
                } catch (e) {
                  expiresAt = coupon.expiresAt;
                }
              }
              
              // Handle created date formatting
              let createdAt = 'Unknown';
              if (coupon.createdAt) {
                try {
                  if (coupon.createdAt.toDate) {
                    createdAt = coupon.createdAt.toDate().toLocaleDateString();
                  } else if (typeof coupon.createdAt === 'string') {
                    createdAt = new Date(coupon.createdAt).toLocaleDateString();
                  }
                } catch (e) {
                  createdAt = 'Unknown';
                }
              }
              
              return (
                <div key={coupon.id} className="offer-card">
                  {coupon.image && (
                    <div className="offer-card-image">
                      <img src={coupon.image} alt={coupon.code} />
                    </div>
                  )}
                  <div className="offer-card-header">
                    <h3>{coupon.code}</h3>
                    <span className="offer-discount">
                      {coupon.discountType === 'Percentage'
                        ? `${coupon.discount}% OFF`
                        : `${formatMerchantCurrency(Number(coupon.discount), vendorProfile)} OFF`}
                    </span>
                  </div>
                  {coupon.description && (
                    <p className="offer-description">{coupon.description}</p>
                  )}
                  <div className="offer-card-details">
                    <div className="offer-detail-item">
                      <span className="offer-detail-label">Type:</span>
                      <span className="offer-detail-value">{coupon.discountType}</span>
                    </div>
                    <div className="offer-detail-item">
                      <span className="offer-detail-label">Expires:</span>
                      <span className="offer-detail-value">{expiresAt}</span>
                    </div>
                    <div className="offer-detail-item">
                      <span className="offer-detail-label">Status:</span>
                      <span className={`offer-detail-value ${coupon.isEnabled ? 'status-active' : 'status-inactive'}`}>
                        {coupon.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="offer-detail-item">
                      <span className="offer-detail-label">Visibility:</span>
                      <span className="offer-detail-value">
                        {coupon.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                  <div className="offer-card-actions">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="btn btn-outline btn-sm offer-edit-btn"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(coupon.id)}
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

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, offerId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Coupon"
        message="Are you sure you want to delete this coupon? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default Offers;
