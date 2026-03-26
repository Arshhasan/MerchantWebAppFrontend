import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createDocument, updateDocument, getDocuments } from '../../firebase/firestore';
import { uploadFile } from '../../firebase/storage';
import { timeSlots } from '../../data/mockData';
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
    bagSize: '',
    bagPrice: '',
    offerPrice: '',
    quantity: '',
    pickupDate: '',
    pickupTimeFrom: '',
    pickupTimeTo: '',
    photos: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoriesErrorShownRef = useRef(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCategoryDropdown && !event.target.closest('.category-dropdown-wrapper')) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCategoryDropdown]);

  // Fetch categories from vendor_categories collection
  useEffect(() => {
    let isMounted = true;
    let hasFetched = false;
    
    const fetchCategories = async () => {
      // Prevent multiple simultaneous fetches
      if (hasFetched || categoriesErrorShownRef.current) return;
      hasFetched = true;
      
      try {
        setCategoriesLoading(true);
        console.log('Fetching categories from vendor_categories collection...');
        
        // Fetch from vendor_categories collection with publish filter
        // Note: No ordering to avoid requiring a composite index - sorting done client-side
        const result = await getDocuments(
          'vendor_categories',
          [{ field: 'publish', operator: '==', value: true }],
          null, // No orderBy field - explicitly null to avoid index requirement
          'asc', // Not used but required parameter
          null // No limit
        );
        
        if (!isMounted) return;
        
        console.log('Categories fetch result:', result);
        
        if (result.success && result.data && Array.isArray(result.data)) {
          // Map categories to array, using review_attributes.title or description as name
          const categoryList = result.data.map((cat) => {
            // Get title from review_attributes.title if available, otherwise use description
            const categoryName = cat.review_attributes?.title || cat.description || cat.id || 'Unknown Category';
            return {
              id: cat.id || '',
              name: categoryName,
              description: cat.description || '',
            };
          }).filter(cat => cat.name && cat.id);
          
          // Sort client-side by name (alphabetically)
          categoryList.sort((a, b) => {
            return a.name.localeCompare(b.name);
          });
          
          console.log('Processed categories:', categoryList);
          setCategories(categoryList);
          
          if (categoryList.length === 0 && isMounted && !categoriesErrorShownRef.current) {
            console.warn('No categories found after filtering');
            showToast('No categories available. Please ensure categories are published in Firebase.', 'warning', 4000);
            categoriesErrorShownRef.current = true;
          }
        } else {
          if (isMounted && !categoriesErrorShownRef.current) {
            console.error('Failed to fetch categories:', result.error);
            // Show error only once and auto-dismiss after 5 seconds
            showToast('Failed to load categories. Please check your connection.', 'error', 5000);
            categoriesErrorShownRef.current = true;
            setCategories([]);
          }
        }
      } catch (error) {
        if (isMounted && !categoriesErrorShownRef.current) {
          console.error('Error fetching categories:', error);
          // Show error only once and auto-dismiss after 5 seconds
          showToast('Error loading categories. Please try again later.', 'error', 5000);
          categoriesErrorShownRef.current = true;
          setCategories([]);
        }
      } finally {
        if (isMounted) {
          setCategoriesLoading(false);
        }
      }
    };

    if (user && !categoriesErrorShownRef.current) {
      fetchCategories();
    } else if (!user) {
      setCategoriesLoading(false);
      setCategories([]);
    }

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user - use ref for error tracking to avoid dependency issues

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
          bagSize: editingBag.bagSize || '',
          bagPrice: (editingBag.bagPrice ?? editingBag.regularPrice)?.toString() || '',
          offerPrice: (editingBag.offerPrice ?? editingBag.discountPrice ?? editingBag.restaurantDiscountPrice)?.toString() || '',
          quantity: editingBag.quantity?.toString() || editingBag.availableQuantity?.toString() || '',
          pickupDate: editingBag.pickupDate || '',
          pickupTimeFrom: editingBag.pickupTimeFrom || editingBag.pickupTime?.split(' - ')[0] || '',
          pickupTimeTo: editingBag.pickupTimeTo || editingBag.pickupTime?.split(' - ')[1] || '',
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

  // Fetch vendor document by author UID (merchant user id)
  const getVendorByAuthorUid = async (uid) => {
    try {
      const result = await getDocuments(
        'vendors',
        [{ field: 'author', operator: '==', value: uid }],
        null,
        'asc',
        1
      );
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        return result.data[0];
      }
      return null;
    } catch (err) {
      console.error('Error fetching vendor by author uid:', err);
      return null;
    }
  };
  // Bag size options (edit prices as needed)
  const bagSizeOptions = [
    { key: 'small', label: 'Small', regular: 18.0, offer: 5.99 },
    { key: 'medium', label: 'Medium', regular: 24.0, offer: 7.99 },
    { key: 'large', label: 'Large', regular: 30.0, offer: 9.99 },
  ];

  const toggleCategory = (categoryId) => {
    setFormData((prev) => {
      const isSelected = prev.categories.includes(categoryId);
      return {
        ...prev,
        categories: isSelected
          ? prev.categories.filter((c) => c !== categoryId)
          : [...prev.categories, categoryId],
      };
    });
  };

  const handleCategorySelect = (categoryId) => toggleCategory(categoryId);

  const getCategoryNameById = (categoryId) => {
    return categories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  const getSelectedCategoriesText = () => {
    if (formData.categories.length === 0) {
      return 'Select categories...';
    }
    if (formData.categories.length === 1) {
      return getCategoryNameById(formData.categories[0]);
    }
    return `${formData.categories.length} categories selected`;
  };

  // Normalize old/edit data that may have category names stored instead of ids.
  useEffect(() => {
    if (categoriesLoading || categories.length === 0 || formData.categories.length === 0) return;

    const categoryIds = new Set(categories.map((c) => c.id));
    const allIds = formData.categories.every((value) => categoryIds.has(value));
    if (allIds) return;

    const normalized = formData.categories
      .map((value) => {
        if (categoryIds.has(value)) return value;
        const match = categories.find((c) => c.name === value);
        return match?.id || null;
      })
      .filter(Boolean);

    if (normalized.length > 0) {
      setFormData((prev) => ({ ...prev, categories: normalized }));
    }
  }, [categories, categoriesLoading, formData.categories]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'bagSize') {
      const selected = bagSizeOptions.find((o) => o.key === value);
      if (!selected) {
        setFormData({ ...formData, bagSize: '', bagPrice: '', offerPrice: '' });
      } else {
        setFormData({
          ...formData,
          bagSize: selected.key,
          bagPrice: String(selected.regular),
          offerPrice: String(selected.offer),
        });
      }
    } else if (type === 'checkbox') {
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
    if (!formData.bagSize) {
      setStepError('Please select a bag size');
      return false;
    }
    const regularPrice = parseFloat(formData.bagPrice);
    const offerPrice = parseFloat(formData.offerPrice);

    if (isNaN(regularPrice) || regularPrice <= 0) {
      setStepError('Please enter a valid regular price');
      return false;
    }

    if (isNaN(offerPrice) || offerPrice <= 0) {
      setStepError('Please enter a valid offer price');
      return false;
    }

    if (offerPrice >= regularPrice) {
      setStepError('Offer price must be less than regular price');
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
    if (!formData.pickupTimeFrom) {
      setStepError('Please select a pickup time from');
      return false;
    }
    if (!formData.pickupTimeTo) {
      setStepError('Please select a pickup time to');
      return false;
    }
    if (formData.pickupTimeFrom >= formData.pickupTimeTo) {
      setStepError('Pickup time "To" must be after "From" time');
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
      // Determine prices (bagPrice is the regular price; offerPrice is the discounted price)
      const regularPrice = parseFloat(formData.bagPrice);
      const offerPrice = parseFloat(formData.offerPrice);
      const finalPrice = regularPrice; // Backward compatible variable name

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
      // Fetch vendor meta (workingHours, location, lat/lng) using author == user.uid
      const vendor = await getVendorByAuthorUid(user.uid);
      const vendorLatitude = vendor?.latitude ?? vendor?.geo?.geopoint?.latitude ?? null;
      const vendorLongitude = vendor?.longitude ?? vendor?.geo?.geopoint?.longitude ?? null;

      const bagData = {
        merchantId: user.uid,
        categories: formData.categories,
        bagTitle: formData.bagTitle,
        description: formData.description,
        bagSize: formData.bagSize,
        bagPrice: finalPrice,
        offerPrice: offerPrice,
        quantity: parseInt(formData.quantity, 10),
        availableQuantity: parseInt(formData.quantity, 10),
        pickupDate: formData.pickupDate,
        pickupTimeFrom: formData.pickupTimeFrom,
        pickupTimeTo: formData.pickupTimeTo,
        pickupTime: `${formData.pickupTimeFrom} - ${formData.pickupTimeTo}`, // Keep for backward compatibility
        status: bagStatus, // Always set: 'draft' or 'published'
        isActive: bagStatus === 'published', // Active only when published
        photos: photoUrls, // Add photos array

        // Vendor meta copied at creation time for convenience
        workingHours: vendor?.workingHours || [],
        location: vendor?.location || '',
        latitude: vendorLatitude,
        longitude: vendorLongitude,
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
                <div className="category-dropdown-wrapper">
                  <button
                    type="button"
                    className="category-dropdown-toggle"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    aria-expanded={showCategoryDropdown}
                    aria-haspopup="listbox"
                  >
                    <span className="category-dropdown-text">
                      {categoriesLoading ? 'Loading categories...' : getSelectedCategoriesText()}
                    </span>
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className={`category-dropdown-arrow ${showCategoryDropdown ? 'open' : ''}`}
                    >
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {showCategoryDropdown && !categoriesLoading && (
                    <div className="category-dropdown-list" role="listbox">
                      {categories.length === 0 ? (
                        <div className="category-dropdown-empty">No categories available</div>
                      ) : (
                        categories.map((category) => {
                          const selected = formData.categories.includes(category.id);
                          return (
                            <div
                              key={category.id}
                              className={`category-dropdown-item ${selected ? 'selected' : ''}`}
                              onClick={() => handleCategorySelect(category.id)}
                              role="option"
                              aria-selected={selected}
                            >
                              <span className="category-dropdown-checkbox">
                                {selected && <span className="category-checkmark">✓</span>}
                              </span>
                              <span className="category-dropdown-label">{category.name || category.id}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {formData.categories.length > 0 && (
                  <div className="selected-categories-tags">
                    {formData.categories.map((cat) => (
                      <span key={cat} className="selected-category-tag">
                        {getCategoryNameById(cat)}
                        <button
                          type="button"
                          className="remove-category-tag"
                          onClick={() => toggleCategory(cat)}
                          aria-label={`Remove ${getCategoryNameById(cat)}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
                rows="3"
                  required
                />
              </div>

              {/* Step Navigation Buttons */}
              <div className="step-navigation">
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
            </div>
        );

      case 2:
        return (
            <div className="card">
              <h2>Pricing & Availability</h2>
              
              <div className="form-row">
                <div className="input-group">
                  <label>Choose your Surprise Bag size *</label>
                  <div className="bag-size-options" role="radiogroup" aria-label="Surprise bag size">
                    {bagSizeOptions.map((opt) => {
                      const selected = formData.bagSize === opt.key;
                      return (
                        <label
                          key={opt.key}
                          className={`bag-size-option ${selected ? 'selected' : ''}`}
                        >
                          <div className="bag-size-option-left">
                            <input
                              type="radio"
                              name="bagSize"
                              value={opt.key}
                              checked={selected}
                              onChange={handleChange}
                              required
                            />
                            <div className="bag-size-option-title">{opt.label}</div>
                          </div>
                          <div className="bag-size-option-right">
                            <div className="bag-size-option-regular">CAD {opt.regular.toFixed(2)}</div>
                            <div className="bag-size-option-sub">minimum value</div>
                            <div className="bag-size-option-offer">CAD {opt.offer.toFixed(2)} price in app</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* keep schema/validation the same (stored as bagPrice + offerPrice) */}
                  <input type="hidden" name="bagPrice" value={formData.bagPrice} />
                  <input type="hidden" name="offerPrice" value={formData.offerPrice} />
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

              <div className="form-row">
                <div className="input-group">
                  <label>Pickup Time From *</label>
                  <input
                    type="time"
                    name="pickupTimeFrom"
                    value={formData.pickupTimeFrom}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Pickup Time To *</label>
                  <input
                    type="time"
                    name="pickupTimeTo"
                    value={formData.pickupTimeTo}
                    onChange={handleChange}
                    min={formData.pickupTimeFrom || undefined}
                    required
                  />
                </div>
              </div>

              {/* Step Navigation Buttons */}
              <div className="step-navigation">
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
                  title="Select one or more images"
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

              {/* Step Navigation Buttons */}
              <div className="step-navigation">
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
            </div>
        );

      case 4:
        const finalPrice = parseFloat(formData.bagPrice);
        const offerPrice = parseFloat(formData.offerPrice);
        
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
                          {getCategoryNameById(cat)}
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
                <div className="review-value">
                  {isNaN(finalPrice) ? (
                    <span className="review-empty">Not set</span>
                  ) : (
                    <>
                      ${!isNaN(offerPrice) && offerPrice > 0 ? offerPrice : finalPrice}{' '}
                      {!isNaN(offerPrice) && offerPrice > 0 && offerPrice < finalPrice ? (
                        <span style={{ color: '#4CAF50', fontWeight: 600 }}>
                          (Regular: ${finalPrice})
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
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
                <div className="review-value">
                  {formData.pickupTimeFrom && formData.pickupTimeTo 
                    ? `${formData.pickupTimeFrom} - ${formData.pickupTimeTo}`
                    : <span className="review-empty">Not set</span>}
                </div>
              </div>

              <div className="review-item">
                <label>Photos:</label>
                <div className="review-value">
                  {formData.photos.length > 0 ? (
                    <div className="review-photos">
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
                      <div className="review-photos-count">
                        {formData.photos.length} photo{formData.photos.length > 1 ? 's' : ''} added
                      </div>
                    </div>
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
