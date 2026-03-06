import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createDocument } from '../../firebase/firestore';
import { categories, timeSlots } from '../../data/mockData';
import './CreateSurpriseBag.css';

const CreateSurpriseBag = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [uploadProgress, setUploadProgress] = useState(0);

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
      // Only used for toggles like "useCustomPrice"
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
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

  const handleSubmit = async (e, action) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUploadProgress(0);

    // Validate required fields
    if (!formData.bagTitle || !formData.description || !formData.quantity || !formData.pickupDate || !formData.pickupTime) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.categories.length === 0) {
      setError('Please select at least one category');
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

      if (isNaN(finalPrice) || finalPrice <= 0) {
        setError('Please enter a valid price');
        setLoading(false);
        return;
      }

      // NOTE: Skipping image upload + imageUrls storage for now (as requested)
      setUploadProgress(50);

      // Prepare Firestore document data with proper data types
      const bagData = {
        merchantId: user.uid, // string
        categories: formData.categories, // array of strings
        bagTitle: formData.bagTitle, // string
        description: formData.description, // string
        bagPrice: finalPrice, // number
        quantity: parseInt(formData.quantity, 10), // number
        availableQuantity: parseInt(formData.quantity, 10), // number (starts same as quantity)
        pickupDate: formData.pickupDate, // string (ISO date format)
        pickupTime: formData.pickupTime, // string
        status: action === 'Publish' ? 'published' : 'draft', // string
        isActive: action === 'Publish' ? true : false, // boolean
        views: 0, // number
        orders: 0, // number
      };

      setUploadProgress(90);

      // Create document in Firestore
      const result = await createDocument('merchant_surprise_bag', bagData);

      if (result.success) {
        setUploadProgress(100);
        // Show success message and redirect
        if (action === 'Publish') {
          alert('Surprise bag published successfully!');
          navigate('/dashboard');
        } else {
          alert('Draft saved successfully!');
          // Optionally reset form or navigate
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

  return (
    <div className="create-bag">
      <div className="page-header">
        <h1>Create Surprise Bag</h1>
      </div>

      <form className="bag-form">
        <div className="form-grid">
          <div className="form-left-column">
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
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter bag description"
                  rows="3"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-right-column">
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
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message" style={{ 
            padding: '1rem', 
            marginBottom: '1rem', 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            borderRadius: '8px',
            border: '1px solid #ef5350'
          }}>
            {error}
          </div>
        )}

        {loading && uploadProgress > 0 && (
          <div className="upload-progress" style={{ 
            padding: '1rem', 
            marginBottom: '1rem', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '8px'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>Saving... {Math.round(uploadProgress)}%</div>
            <div style={{ 
              width: '100%', 
              height: '8px', 
              backgroundColor: '#e0e0e0', 
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${uploadProgress}%`, 
                height: '100%', 
                backgroundColor: '#4CAF50',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          </div>
        )}

        <div className="form-actions">
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
        </div>
      </form>
    </div>
  );
};

export default CreateSurpriseBag;
