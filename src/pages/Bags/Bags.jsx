import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToCollection, deleteDocument, updateDocument } from '../../firebase/firestore';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './Bags.css';

const Bags = () => {
  const navigate = useNavigate();
  const { user, vendorProfile } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('drafts');
  const [drafts, setDrafts] = useState([]);
  const [publishedBags, setPublishedBags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, bagId: null });
  const [activatingBagId, setActivatingBagId] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let draftsLoaded = false;
    let publishedLoaded = false;

    const checkLoading = () => {
      if (draftsLoaded && publishedLoaded) {
        setLoading(false);
      }
    };

    // Subscribe to drafts
    const unsubscribeDrafts = subscribeToCollection(
      'merchant_surprise_bag',
      [
        { field: 'merchantId', operator: '==', value: user.uid },
        { field: 'status', operator: '==', value: 'draft' }
      ],
      (documents) => {
        const sortedDrafts = [...documents].sort((a, b) => {
          try {
            let aDate = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            let bDate = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return bDate.getTime() - aDate.getTime(); // Newest first
          } catch (error) {
            return 0;
          }
        });
        setDrafts(sortedDrafts);
        draftsLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error('Error loading drafts:', error);
        showToast('Failed to load drafts', 'error');
        setDrafts([]);
        draftsLoaded = true;
        checkLoading();
      }
    );

    // Subscribe to published bags
    const unsubscribePublished = subscribeToCollection(
      'merchant_surprise_bag',
      [
        { field: 'merchantId', operator: '==', value: user.uid },
        { field: 'status', operator: '==', value: 'published' }
      ],
      (documents) => {
        const sortedPublished = [...documents].sort((a, b) => {
          try {
            let aDate = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            let bDate = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return bDate.getTime() - aDate.getTime(); // Newest first
          } catch (error) {
            return 0;
          }
        });
        setPublishedBags(sortedPublished);
        publishedLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error('Error loading published bags:', error);
        showToast('Failed to load published bags', 'error');
        setPublishedBags([]);
        publishedLoaded = true;
        checkLoading();
      }
    );

    return () => {
      unsubscribeDrafts();
      unsubscribePublished();
    };
  }, [user, showToast]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    
    try {
      let date;
      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        date = new Date(timestamp);
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getFirstBagPhotoUrl = (bag) => {
    const photos = bag?.photos;
    if (!Array.isArray(photos) || photos.length === 0) return null;

    const first = photos[0];
    if (!first) return null;
    if (typeof first === 'string') return first;
    return first.url || first.preview || null;
  };

  const handleEditBag = (bag) => {
    // Navigate to create-bag page with bag data for editing
    // Store bag data in sessionStorage to pass to edit form
    sessionStorage.setItem('editingBag', JSON.stringify(bag));
    navigate('/create-bag');
  };

  const handleDeleteClick = (bagId, e) => {
    e.stopPropagation(); // Prevent card click
    setDeleteConfirm({ isOpen: true, bagId });
  };

  const handleSetActive = async (bagId, e) => {
    e.stopPropagation();
    if (!user?.uid || activatingBagId) return;
    setActivatingBagId(bagId);
    try {
      // Write both snake_case + legacy camelCase to avoid stale `isActive` keeping UI stuck.
      const result = await updateDocument('merchant_surprise_bag', bagId, { is_active: true, isActive: true });
      if (result.success) {
        showToast('Bag is active now', 'success');
      } else {
        showToast(result.error || 'Could not update active bag', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Could not update active bag', 'error');
    } finally {
      setActivatingBagId(null);
    }
  };

  const handleClearActive = async (bagId, e) => {
    e.stopPropagation();
    if (!user?.uid || activatingBagId) return;
    setActivatingBagId(bagId);
    try {
      // Write both snake_case + legacy camelCase to avoid stale `isActive` keeping UI stuck.
      const result = await updateDocument('merchant_surprise_bag', bagId, { is_active: false, isActive: false });
      if (result.success) {
        showToast('Bag is inactive now', 'success');
      } else {
        showToast(result.error || 'Could not update bags', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Could not update bags', 'error');
    } finally {
      setActivatingBagId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    const { bagId } = deleteConfirm;
    if (!bagId) return;

    try {
      const result = await deleteDocument('merchant_surprise_bag', bagId);
      
      if (result.success) {
        showToast('Bag deleted successfully!', 'success');
      } else {
        showToast('Failed to delete bag: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting bag:', error);
      showToast('An error occurred while deleting the bag', 'error');
    } finally {
      setDeleteConfirm({ isOpen: false, bagId: null });
    }
  };

  const currentBags = activeTab === 'drafts' ? drafts : publishedBags;

  const isBagActive = (bag) => bag?.is_active === true || bag?.isActive === true;

  const isModerationPending = (bag) => bag?.moderationStatus === 'pending';
  const isUnsafeBag = (bag) => bag?.isUnsafe === true;

  return (
    <div className="bags-page">
      <div className="bags-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Bags</h1>
      </div>

      <div className="bags-tabs">
        <button
          className={`tab ${activeTab === 'drafts' ? 'active' : ''}`}
          onClick={() => setActiveTab('drafts')}
        >
          Drafts ({drafts.length})
        </button>
        <button
          className={`tab ${activeTab === 'created' ? 'active' : ''}`}
          onClick={() => setActiveTab('created')}
        >
          Created Bags ({publishedBags.length})
        </button>
      </div>

      <div className="bags-content">
        {loading ? (
          <div className="loading-container">
            <p>Loading bags...</p>
          </div>
        ) : currentBags.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p>
              {activeTab === 'drafts' 
                ? 'No draft bags yet. Create your first surprise bag!' 
                : 'No published bags yet. Publish your first surprise bag!'}
            </p>
            {activeTab === 'drafts' && (
              <button className="btn btn-primary" onClick={() => navigate('/create-bag')}>
                Create Surprise Bag
              </button>
            )}
          </div>
        ) : (
          <div className="bags-list">
            {currentBags.map((bag) => {
              const photoUrl = getFirstBagPhotoUrl(bag);
              const pending = isModerationPending(bag);
              const unsafe = isUnsafeBag(bag);
              const blocked = unsafe;

              return (
                <div
                  key={bag.id}
                  className={[
                    'bag-card',
                    unsafe ? 'bag-card--unsafe' : '',
                    pending ? 'bag-card--moderation-pending' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="bag-media">
                    {photoUrl ? (
                      <img src={photoUrl} alt={bag.bagTitle || 'Bag photo'} />
                    ) : (
                      <div className="bag-media-placeholder" aria-hidden="true" />
                    )}
                    {pending && (
                      <div className="bag-moderation-overlay bag-moderation-overlay--pending" role="status">
                        Checking image…
                      </div>
                    )}
                    {unsafe && (
                      <div className="bag-moderation-overlay bag-moderation-overlay--unsafe" role="alert">
                        Unsafe Bag Image
                      </div>
                    )}
                  </div>
                <div
                  className="bag-details"
                  onClick={() => !blocked && handleEditBag(bag)}
                  style={blocked ? { pointerEvents: 'none', opacity: 0.75 } : undefined}
                >
                  <div className="bag-title">{bag.bagTitle || 'Untitled Bag'}</div>
                  <div className="bag-meta">
                    <span className="bag-price">
                      {formatMerchantCurrency(
                        Number(bag.bagPrice) || 0,
                        vendorProfile
                      )}
                    </span>
                    <span className="bag-separator">•</span>
                    <span className="bag-quantity">Qty: {bag.availableQuantity || bag.quantity || 0}</span>
                    {bag.categories && bag.categories.length > 0 && (
                      <>
                        <span className="bag-separator">•</span>
                        <span className="bag-categories">{bag.categories.length} {bag.categories.length === 1 ? 'category' : 'categories'}</span>
                      </>
                    )}
                  </div>
                  <div className="bag-date">
                    Created: {formatDate(bag.createdAt)}
                  </div>
                  {bag.pickupDate && (
                    <div className="bag-pickup">
                      Pickup: {bag.pickupDate} {bag.pickupTime || ''}
                    </div>
                  )}
                </div>
                <div className="bag-actions">
                  {activeTab === 'created' && (
                    <div className="bag-status-row">
                      <span className="status-badge status-published">Published</span>
                      {isBagActive(bag) ? (
                        <button
                          type="button"
                          className="bag-clear-active-btn"
                          disabled={!!activatingBagId || pending || unsafe}
                          onClick={(e) => handleClearActive(bag.id, e)}
                        >
                          {activatingBagId === bag.id ? 'Saving…' : 'Set inactive'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="bag-set-active-btn"
                          disabled={!!activatingBagId || pending || unsafe}
                          onClick={(e) => handleSetActive(bag.id, e)}
                        >
                          {activatingBagId === bag.id ? 'Saving…' : 'Set active'}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="action-buttons">
                    <button
                      className="btn-edit"
                      disabled={blocked}
                      onClick={(e) => {
                        if (blocked) return;
                        handleEditBag(bag);
                      }}
                      title="Edit"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      className="btn-delete"
                      onClick={(e) => handleDeleteClick(bag.id, e)}
                      title="Delete"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, bagId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Bag"
        message="Are you sure you want to delete this bag? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default Bags;
