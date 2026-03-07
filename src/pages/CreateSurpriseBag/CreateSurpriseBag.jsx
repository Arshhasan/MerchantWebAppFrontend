import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createDocument } from '../../firebase/firestore';
import { categories, timeSlots } from '../../data/mockData';
import './CreateSurpriseBag.css';

const CreateSurpriseBag = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
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

  const totalSteps = 4;
  const stepTitles = [
    'Bag Details',
    'Availability',
    'Photos',
    'Submit',
  ];

  const categoryIcons = {
    'Food & Beverages': '🍔',
    Electronics: '💻',
    Clothing: '👕',
    Books: '📚',
    'Home & Garden': '🏡',
    Sports: '⚽',
    Beauty: '💄',
    Toys: '🧸',
  };

  const getCategoryIcon = (category) => categoryIcons[category] || '🏷️';

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
    }));
    setFormData({ ...formData, photos: [...formData.photos, ...newPhotos] });
  };

  const removePhoto = (id) => {
    setFormData({
      ...formData,
      photos: formData.photos.filter((photo) => photo.id !== id),
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
    // Description is optional, so no validation needed
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
    // Photos are optional, so step 3 always passes
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
    if (!validateStep1() || !validateStep2()) {
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

      setUploadProgress(50);

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
        status: action === 'Publish' ? 'published' : 'draft',
        isActive: action === 'Publish' ? true : false,
        views: 0,
        orders: 0,
      };

      setUploadProgress(90);

      // Create document in Firestore
      const result = await createDocument('merchant_surprise_bag', bagData);

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
                  const selected = formData.categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      className={`category-chip ${selected ? 'selected' : ''}`}
                      onClick={() => toggleCategory(category)}
                      aria-pressed={selected}
                    >
                      <span className="category-chip-icon" aria-hidden="true">
                        {getCategoryIcon(category)}
                      </span>
                      <span className="category-chip-label">{category}</span>
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
              <label>Description (Optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter bag description (optional)"
                rows="4"
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
              <label>Add Photos</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="file-input"
              />
              {formData.photos.length > 0 && (
                <div className="photo-preview">
                  {formData.photos.map((photo) => (
                    <div key={photo.id} className="photo-item">
                      <img src={photo.preview} alt="Preview" />
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
              <p className="helper-text">You can add photos later. This step is optional.</p>
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
        <h1>Create Surprise Bag</h1>
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
          
          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              className="btn btn-primary"
              disabled={loading}
            >
              Next
            </button>
          ) : (
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
