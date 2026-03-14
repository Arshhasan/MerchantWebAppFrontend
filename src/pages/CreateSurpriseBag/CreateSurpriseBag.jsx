import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createDocument, updateDocument } from '../../firebase/firestore';
import { uploadFile } from '../../firebase/storage';
import { timeSlots, categories } from '../../data/mockData';
import './CreateSurpriseBag.css';

const CreateSurpriseBag = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [editingBagId, setEditingBagId] = useState(null);
  const [formData, setFormData] = useState({
    categories: [],
    bagTitle: '',
    description: '',
    bagPrice: '',
    customPrice: '',
    useCustomPrice: false,
    quantity: '',
    pickupDate: '',
    pickupTime: '',
    photos: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load editing bag data from sessionStorage on component mount
  useEffect(() => {
    const editingBagStr = sessionStorage.getItem('editingBag');
    if (editingBagStr) {
      try {
        const editingBag = JSON.parse(editingBagStr);
        setEditingBagId(editingBag.id);
        
        // Handle photos - if they exist as URLs, convert them to preview format
        let photos = [];
        if (editingBag.photos && Array.isArray(editingBag.photos)) {
          photos = editingBag.photos.map((photo, index) => {
            // If photo is a URL string, create preview object
            if (typeof photo === 'string') {
              return {
                id: Date.now() + index,
                preview: photo,
                url: photo,
                isUrl: true, // Mark as URL so we know it's already uploaded
              };
            }
            // If photo is already an object with preview/url
            return {
              id: photo.id || Date.now() + index,
              preview: photo.preview || photo.url || '',
              url: photo.url || photo.preview || '',
              isUrl: true,
            };
          });
        }
        
        // Pre-fill form data with bag data
        setFormData({
          categories: editingBag.categories || [],
          bagTitle: editingBag.bagTitle || '',
          description: editingBag.description || '',
          bagPrice: editingBag.bagPrice?.toString() || '',
          customPrice: editingBag.bagPrice?.toString() || '',
          useCustomPrice: false, // Default to false, can be changed if needed
          quantity: editingBag.quantity?.toString() || editingBag.availableQuantity?.toString() || '',
          pickupDate: editingBag.pickupDate || '',
          pickupTime: editingBag.pickupTime || '',
          photos: photos,
        });
        
        // Clear sessionStorage after loading
        sessionStorage.removeItem('editingBag');
      } catch (error) {
        console.error('Error parsing editing bag data:', error);
        showToast('Error loading bag data for editing', 'error');
      }
    }
  }, [showToast]);

  const totalSteps = 4;
  const stepTitles = [
    'Bag Details',
    'Availability',
    'Photos',
    'Submit',
  ];

  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      'Food & Beverages': '🍔',
      'Electronics': '💻',
      'Clothing': '👕',
      'Books': '📚',
      'Home & Garden': '🏠',
      'Sports': '⚽',
      'Beauty': '💄',
      'Toys': '🧸',
    };
    return iconMap[categoryName] || '🏷️';
  };

  const toggleCategory = (category) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
        setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    // Clear step error when user makes changes
    if (stepError) setStepError('');
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map((file) => ({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file),
      isUrl: false, // Mark as new file that needs upload
    }));
    setFormData({ ...formData, photos: [...formData.photos, ...newPhotos] });
    // Reset input
    e.target.value = '';
  };

  const removePhoto = (id) => {
    setFormData({
      ...formData,
      photos: formData.photos.filter((photo) => {
        // Revoke object URL to free memory if it's a new file
        if (photo.id === id && photo.preview && !photo.isUrl) {
          URL.revokeObjectURL(photo.preview);
        }
        return photo.id !== id;
      }),
    });
  };

  // Step validation functions
  const validateStep1 = () => {
    if (formData.categories.length === 0) {
      setStepError('Please select at least one category');
      return false;
    }
    if (!formData.bagTitle.trim()) {
      setStepError('Please enter a bag title');
      return false;
    }
    if (!formData.description.trim()) {
      setStepError('Please enter a description');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const finalPrice = formData.useCustomPrice
      ? parseFloat(formData.customPrice)
      : parseFloat(formData.bagPrice);

    if (isNaN(finalPrice) || finalPrice <= 0) {
      setStepError('Please enter a valid price');
      return false;
    }
    if (!formData.quantity || parseInt(formData.quantity, 10) <= 0) {
      setStepError('Please enter a valid quantity');
      return false;
    }
    if (!formData.pickupDate) {
      setStepError('Please select a pickup date');
      return false;
    }
    if (!formData.pickupTime) {
      setStepError('Please select a pickup time');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (formData.photos.length === 0) {
      setStepError('Please upload at least one photo');
      return false;
    }
    return true;
  };

  const validateCurrentStep = () => {
    setStepError('');
    switch (currentStep) {
      case 1:
        return validateStep1();
      case 2:
        return validateStep2();
      case 3:
        return validateStep3();
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
        setStepError('');
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setStepError('');
    }
  };

  const handleSubmit = async (e, action) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStepError('');
    setUploadProgress(0);

    // Final validation
    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      setError('Please complete all required fields');
      setLoading(false);
      return;
    }

    if (!user) {
      setError('You must be logged in to create a surprise bag');
      setLoading(false);
      return;
    }

    try {
      // Determine final price
      const finalPrice = formData.useCustomPrice
        ? parseFloat(formData.customPrice)
        : parseFloat(formData.bagPrice);

      setUploadProgress(10);

      // Determine status based on action
      // Status must be explicitly set: 'draft' for saved drafts, 'published' for published bags
      const bagStatus = action === 'Publish' ? 'published' : 'draft';
      
      // Upload photos first if there are new files to upload
      let photoUrls = [];
      if (formData.photos.length > 0) {
        setUploadProgress(20);
        
        try {
          // Get bag ID for file path (use editingBagId if updating, or generate temp ID for new)
          const bagId = editingBagId || `temp-${Date.now()}`;
          
          const uploadPromises = formData.photos.map(async (photo, index) => {
            // If photo is already uploaded (has URL), use it
            if (photo.isUrl && photo.url && photo.url.startsWith('http')) {
              return photo.url;
            }
            // If photo has a URL property that's already a URL
            if (photo.url && photo.url.startsWith('http')) {
              return photo.url;
            }
            // If photo is a string URL
            if (typeof photo === 'string' && photo.startsWith('http')) {
              return photo;
            }
            // Upload new file
            if (photo.file) {
              const timestamp = Date.now();
              const fileName = `surprise-bags/${user.uid}/${bagId}/photos/${timestamp}-${index}-${photo.file.name}`;
              
              // Upload file (progress tracking handled by showing "Uploading..." state)
              const uploadResult = await uploadFile(photo.file, fileName);
              
              if (uploadResult.success) {
                return uploadResult.url;
              } else {
                throw new Error(`Failed to upload image: ${uploadResult.error}`);
              }
            }
            return null;
          });
          
          // Show progress while uploading
          setUploadProgress(40);
          
          photoUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
          
          if (photoUrls.length === 0 && formData.photos.length > 0) {
            throw new Error('Failed to upload photos. Please try again.');
          }
        } catch (error) {
          console.error('Error uploading photos:', error);
          throw new Error(`Image upload failed: ${error.message}`);
        }
      }

      setUploadProgress(85);
      
      // Prepare Firestore document data
      const bagData = {
        merchantId: user.uid,
        categories: formData.categories,
        bagTitle: formData.bagTitle,
        description: formData.description,
        bagPrice: finalPrice,
        quantity: parseInt(formData.quantity, 10),
        availableQuantity: parseInt(formData.quantity, 10),
        pickupDate: formData.pickupDate,
        pickupTime: formData.pickupTime,
        status: bagStatus, // Always set: 'draft' or 'published'
        isActive: bagStatus === 'published', // Active only when published
        photos: photoUrls, // Add photos array
      };

      setUploadProgress(90);

      let result;
      if (editingBagId) {
        // Update existing document
        // Don't overwrite views and orders when updating
        const updateData = { ...bagData };
        
        result = await updateDocument('merchant_surprise_bag', editingBagId, updateData);
        
        if (result.success) {
          setUploadProgress(100);
          if (action === 'Publish') {
            showToast('Surprise bag updated and published successfully!', 'success');
          } else {
            showToast('Draft updated successfully!', 'success');
          }
          navigate('/bags');
        } else {
          throw new Error(result.error || 'Failed to update surprise bag');
        }
      } else {
        // Create new document
        // Add views and orders for new bags
        bagData.views = 0;
        bagData.orders = 0;
        
        result = await createDocument('merchant_surprise_bag', bagData);

        if (result.success) {
          setUploadProgress(100);
          if (action === 'Publish') {
            showToast('Surprise bag published successfully!', 'success');
            navigate('/dashboard');
          } else {
            showToast('Draft saved successfully!', 'success');
            navigate('/dashboard');
          }
        } else {
          throw new Error(result.error || 'Failed to save surprise bag');
        }
      }
    } catch (err) {
      console.error('Error creating surprise bag:', err);
      setError(err.message || 'An error occurred while creating the surprise bag');
      setLoading(false);
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
  return (
            <div className="card">
              <h2>Bag Details</h2>
              
              <div className="input-group">
                <label>Category (Multi-select)</label>
                <div className="category-chips" role="group" aria-label="Categories">
                  {categories.map((category) => {
                    const categoryName = typeof category === 'string' ? category : category.name || category;
                    const selected = formData.categories.includes(categoryName);
                    return (
                      <button
                        key={categoryName}
                        type="button"
                        className={`category-chip ${selected ? 'selected' : ''}`}
                        onClick={() => toggleCategory(categoryName)}
                        aria-pressed={selected}
                      >
                        <span className="category-chip-icon" aria-hidden="true">
                          {getCategoryIcon(categoryName)}
                        </span>
                        <span className="category-chip-label">{categoryName}</span>
                        {selected && (
                          <span className="category-chip-check" aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="input-group">
                <label>Bag Title</label>
                <input
                  type="text"
                  name="bagTitle"
                  value={formData.bagTitle}
                  onChange={handleChange}
                  placeholder="Enter bag title"
                  required
                />
              </div>

              <div className="input-group">
              <label>Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter bag description"
                rows="4"
                  required
                />
              </div>
            </div>
        );

      case 2:
        return (
            <div className="card">
              <h2>Pricing & Availability</h2>
              
              <div className="input-group">
                <label>Bag Price</label>
                <div className="price-options">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      name="useCustomPrice"
                      checked={formData.useCustomPrice}
                      onChange={handleChange}
                    />
                    Use Custom Price
                  </label>
                  {formData.useCustomPrice ? (
                    <input
                      type="number"
                      name="customPrice"
                      value={formData.customPrice}
                      onChange={handleChange}
                      placeholder="Enter custom price"
                      min="0"
                      step="0.01"
                      required
                    />
                  ) : (
                    <select
                      name="bagPrice"
                      value={formData.bagPrice}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Price</option>
                      <option value="10">$10</option>
                      <option value="15">$15</option>
                      <option value="20">$20</option>
                      <option value="25">$25</option>
                      <option value="30">$30</option>
                      <option value="35">$35</option>
                      <option value="40">$40</option>
                      <option value="50">$50</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    placeholder="Enter quantity"
                    min="1"
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Pickup Date</label>
                  <input
                    type="date"
                    name="pickupDate"
                    value={formData.pickupDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Pickup Time</label>
                <select
                  name="pickupTime"
                  value={formData.pickupTime}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Time Slot</option>
                  {timeSlots.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>
        );

      case 3:
        return (
            <div className="card">
              <h2>Photos</h2>
              <div className="input-group">
              <label>Add Photos *</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="file-input"
                  required={formData.photos.length === 0}
                />
                {formData.photos.length > 0 && (
                  <div className="photo-preview">
                    {formData.photos.map((photo) => (
                      <div key={photo.id} className="photo-item">
                        <img src={photo.preview || photo.url} alt="Preview" />
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          className="remove-photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        );

      case 4:
        const finalPrice = formData.useCustomPrice
          ? parseFloat(formData.customPrice)
          : parseFloat(formData.bagPrice);
        
        return (
          <div className="card">
            <h2>Review & Submit</h2>
            <div className="review-section">
              <div className="review-item">
                <label>Categories:</label>
                <div className="review-value">
                  {formData.categories.length > 0 ? (
                    <div className="review-categories">
                      {formData.categories.map((cat) => (
                        <span key={cat} className="review-chip">
                          {getCategoryIcon(cat)} {cat}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="review-empty">Not set</span>
                  )}
                </div>
              </div>

              <div className="review-item">
                <label>Bag Title:</label>
                <div className="review-value">{formData.bagTitle || <span className="review-empty">Not set</span>}</div>
              </div>

              <div className="review-item">
                <label>Description:</label>
                <div className="review-value">{formData.description || <span className="review-empty">Not set</span>}</div>
              </div>

              <div className="review-item">
                <label>Price:</label>
                <div className="review-value">${finalPrice || <span className="review-empty">Not set</span>}</div>
              </div>

              <div className="review-item">
                <label>Quantity:</label>
                <div className="review-value">{formData.quantity || <span className="review-empty">Not set</span>}</div>
              </div>

              <div className="review-item">
                <label>Pickup Date:</label>
                <div className="review-value">{formData.pickupDate || <span className="review-empty">Not set</span>}</div>
              </div>

              <div className="review-item">
                <label>Pickup Time:</label>
                <div className="review-value">{formData.pickupTime || <span className="review-empty">Not set</span>}</div>
              </div>

              <div className="review-item">
                <label>Photos:</label>
                <div className="review-value">
                  {formData.photos.length > 0 ? (
                    <span>{formData.photos.length} photo(s) added</span>
                  ) : (
                    <span className="review-empty">No photos added</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="create-bag">
      <div className="page-header">
        <h1>{editingBagId ? 'Edit Surprise Bag' : 'Create Surprise Bag'}</h1>
      </div>

      {/* Progress Indicator */}
      <div className="step-progress">
        <div className="step-progress-bar">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <div
              key={step}
              className={`step-indicator ${step <= currentStep ? 'active' : ''} ${step === currentStep ? 'current' : ''}`}
            >
              <div className="step-number">{step}</div>
              <div className="step-label">{stepTitles[step - 1]}</div>
            </div>
          ))}
          </div>
        </div>

      {/* Navigation Buttons */}
      <div className="form-actions-top">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handlePrevious}
            className="btn btn-secondary"
            disabled={loading}
          >
            Previous
          </button>
        )}
        {currentStep < totalSteps && (
          <button
            type="button"
            onClick={handleNext}
            className="btn btn-primary"
            disabled={loading}
          >
            Next
          </button>
        )}
      </div>

      <form className="bag-form">
        <div className="step-content">
          {renderStepContent()}
        </div>

        {(error || stepError) && (
          <div className="error-message">
            {stepError || error}
          </div>
        )}

        {loading && uploadProgress > 0 && (
          <div className="upload-progress">
            <div>Saving... {Math.round(uploadProgress)}%</div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="form-actions">
          {currentStep === totalSteps && (
            <>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'Save Draft')}
                className="btn btn-secondary"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'Publish')}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Publishing...' : 'Publish'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default CreateSurpriseBag;
