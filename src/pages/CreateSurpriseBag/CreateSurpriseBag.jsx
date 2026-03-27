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
    pickupDateTimeFrom: '',
    pickupDateTimeTo: '',
    outletTimings: {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '10:00', close: '16:00', closed: false },
      sunday: { open: '10:00', close: '16:00', closed: true },
    },
    photos: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const categoriesErrorShownRef = useRef(false);

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
          pickupDateTimeFrom:
            editingBag.pickupDateTimeFrom
            || toDateTimeLocalValue(
              editingBag.pickupDate || '',
              editingBag.pickupTimeFrom || editingBag.pickupTime?.split(' - ')[0] || ''
            ),
          pickupDateTimeTo:
            editingBag.pickupDateTimeTo
            || toDateTimeLocalValue(
              editingBag.pickupDate || '',
              editingBag.pickupTimeTo || editingBag.pickupTime?.split(' - ')[1] || ''
            ),
          outletTimings: editingBag.outletTimings || {
            monday: { open: '09:00', close: '18:00', closed: false },
            tuesday: { open: '09:00', close: '18:00', closed: false },
            wednesday: { open: '09:00', close: '18:00', closed: false },
            thursday: { open: '09:00', close: '18:00', closed: false },
            friday: { open: '09:00', close: '18:00', closed: false },
            saturday: { open: '10:00', close: '16:00', closed: false },
            sunday: { open: '10:00', close: '16:00', closed: true },
          },
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

  const totalSteps = 7;

  const outletDays = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  const toDateTimeLocalValue = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return '';
    return `${dateStr}T${timeStr}`;
  };

  const getNowDateTimeLocal = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  };

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

  const handleToggleAllCategories = () => {
    setFormData((prev) => {
      if (categories.length === 0) return prev;
      const allCategoryIds = categories.map((c) => c.id);
      const areAllSelected =
        prev.categories.length > 0
        && allCategoryIds.every((id) => prev.categories.includes(id));
      return {
        ...prev,
        categories: areAllSelected ? [] : allCategoryIds,
      };
    });
  };

  const getCategoryNameById = (categoryId) => {
    return categories.find((c) => c.id === categoryId)?.name || categoryId;
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
    } else if (name === 'pickupDateTimeFrom' || name === 'pickupDateTimeTo') {
      const [datePart = '', timePart = ''] = value.split('T');
      if (name === 'pickupDateTimeFrom') {
        setFormData({
          ...formData,
          pickupDateTimeFrom: value,
          pickupDate: datePart || formData.pickupDate,
          pickupTimeFrom: timePart,
        });
      } else {
        setFormData({
          ...formData,
          pickupDateTimeTo: value,
          pickupDate: datePart || formData.pickupDate,
          pickupTimeTo: timePart,
        });
      }
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
    return true;
  };

  const validateStep2 = () => {
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

  const validateStep3 = () => {
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
    return true;
  };

  const validateStep4 = () => {
    if (!formData.quantity || parseInt(formData.quantity, 10) <= 0) {
      setStepError('Please enter a valid quantity');
      return false;
    }
    return true;
  };

  const validateStep5 = () => {
    const nowDateTime = getNowDateTimeLocal();
    if (!formData.pickupDateTimeFrom) {
      setStepError('Please select pickup date time from');
      return false;
    }
    if (!formData.pickupDateTimeTo) {
      setStepError('Please select pickup date time to');
      return false;
    }
    if (formData.pickupDateTimeFrom < nowDateTime) {
      setStepError('Pickup date time from cannot be in the past');
      return false;
    }
    if (formData.pickupDateTimeFrom >= formData.pickupDateTimeTo) {
      setStepError('Pickup date time "To" must be after "From"');
      return false;
    }
    return true;
  };

  const validateStep6 = () => {
    const t = formData.outletTimings || {};
    const hasOpenDay = outletDays.some((d) => t?.[d.key] && !t[d.key].closed);
    if (!hasOpenDay) {
      setStepError('Please set timings for at least one day');
      return false;
    }
    for (const d of outletDays) {
      const day = t?.[d.key];
      if (!day || day.closed) continue;
      if (!day.open || !day.close) {
        setStepError(`Please set open and close time for ${d.label}`);
        return false;
      }
      if (day.open >= day.close) {
        setStepError(`${d.label}: close time must be after open time`);
        return false;
      }
    }
    return true;
  };

  const validateStep7 = () => {
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
      case 4:
        return validateStep4();
      case 5:
        return validateStep5();
      case 6:
        return validateStep6();
      case 7:
        return validateStep7();
      default:
        return true;
    }
  };

  const isStepComplete = (step) => {
    switch (step) {
      case 1:
        return Array.isArray(formData.categories) && formData.categories.length > 0;
      case 2:
        return !!formData.bagTitle?.trim() && !!formData.description?.trim();
      case 3: {
        if (!formData.bagSize) return false;
        const regularPrice = parseFloat(formData.bagPrice);
        const offerPrice = parseFloat(formData.offerPrice);
        return (
          Number.isFinite(regularPrice)
          && regularPrice > 0
          && Number.isFinite(offerPrice)
          && offerPrice > 0
          && offerPrice < regularPrice
        );
      }
      case 4: {
        const q = parseInt(formData.quantity, 10);
        return Number.isFinite(q) && q > 0;
      }
      case 5:
        return (
          !!formData.pickupDate
          && !!formData.pickupDateTimeFrom
          && !!formData.pickupDateTimeTo
          && formData.pickupDateTimeFrom < formData.pickupDateTimeTo
        );
      case 6:
        return (() => {
          const t = formData.outletTimings || {};
          const hasOpenDay = outletDays.some((d) => t?.[d.key] && !t[d.key].closed);
          if (!hasOpenDay) return false;
          for (const d of outletDays) {
            const day = t?.[d.key];
            if (!day || day.closed) continue;
            if (!day.open || !day.close) return false;
            if (day.open >= day.close) return false;
          }
          return true;
        })();
      case 7:
        return Array.isArray(formData.photos) && formData.photos.length > 0;
      default:
        return false;
    }
  };

  const canContinue = isStepComplete(currentStep);

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
    if (
      !validateStep1()
      || !validateStep2()
      || !validateStep3()
      || !validateStep4()
      || !validateStep5()
      || !validateStep6()
      || !validateStep7()
    ) {
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
        pickupDateTimeFrom: formData.pickupDateTimeFrom,
        pickupDateTimeTo: formData.pickupDateTimeTo,
        pickupTime: `${formData.pickupTimeFrom} - ${formData.pickupTimeTo}`, // Keep for backward compatibility
        status: bagStatus, // Always set: 'draft' or 'published'
        isActive: bagStatus === 'published', // Active only when published
        photos: photoUrls, // Add photos array
        outletTimings: formData.outletTimings,

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
        const totalCategories = categories.length;
        const selectedCategories = formData.categories.length;
        const areAllCategoriesSelected =
          totalCategories > 0
          && selectedCategories > 0
          && categories.every((c) => formData.categories.includes(c.id));
        return (
            <div className="card">
              <h2>Select the category that best describes your surplus food</h2>
              <div className="step-subtitle">
                Let customers know what they can expect in their Surprise Bags.
              </div>

              {!categoriesLoading && categories.length > 0 && (
                <div className="category-select-all-row">
                  <button
                    type="button"
                    className={`category-select-all-btn ${areAllCategoriesSelected ? 'selected' : ''}`}
                    onClick={handleToggleAllCategories}
                  >
                    {areAllCategoriesSelected ? 'Deselect all categories' : 'Select all categories'}
                  </button>
                </div>
              )}
              
              <div className="category-card-list" role="list" aria-label="Categories">
                {categoriesLoading ? (
                  <div className="category-loading">Loading categories…</div>
                ) : categories.length === 0 ? (
                  <div className="category-empty">No categories available</div>
                ) : (
                  categories.map((category) => {
                    const selected = formData.categories.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`category-card ${selected ? 'selected' : ''}`}
                        onClick={() => handleCategorySelect(category.id)}
                      >
                        <span className={`category-card-dot ${selected ? 'selected' : ''}`} aria-hidden="true" />
                        <span className="category-card-label">{category.name || category.id}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
        );

      case 2:
        return (
            <div className="card">
              <h2>Add a name and a description</h2>
              <div className="step-subtitle">
                We&apos;ve made it easy! Here&apos;s what we suggest. You can always make changes.
              </div>

              <div className="input-group">
                <label>Name</label>
                <input
                  type="text"
                  name="bagTitle"
                  value={formData.bagTitle}
                  onChange={handleChange}
                  placeholder="Enter bag title"
                  maxLength={200}
                  required
                />
                <div className="field-counter" aria-live="polite">
                  {(formData.bagTitle || '').length}/200
                </div>
              </div>

              <div className="input-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter bag description"
                  rows="3"
                  maxLength={200}
                  required
                />
                <div className="field-counter" aria-live="polite">
                  {(formData.description || '').length}/200
                </div>
              </div>

            </div>
        );

      case 3:
        return (
            <div className="card">
              <h2>Pricing</h2>

              <div className="bag-size-section-wrap">
                <div className="input-group bag-size-input-group">
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
                            <div className="bag-size-option-regular">
                              CAD {opt.regular.toFixed(2)}
                            </div>
                            <div className="bag-size-option-sub">minimum value</div>
                            <div className="bag-size-option-offer">
                              CAD {opt.offer.toFixed(2)} price in app
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
        );

      case 4:
        const quantityQuickOptions = [3, 4, 5, 6];
        const selectedQty = parseInt(formData.quantity, 10);
        return (
            <div className="card">
              <h2>Set the daily number of Surprise Bags</h2>

              <div className="quantity-options" role="group" aria-label="Quick quantity options">
                {quantityQuickOptions.map((qty) => {
                  const active = Number.isFinite(selectedQty) && selectedQty === qty;
                  return (
                    <button
                      key={qty}
                      type="button"
                      className={`quantity-option ${active ? 'selected' : ''}`}
                      onClick={() => setFormData((prev) => ({ ...prev, quantity: String(qty) }))}
                    >
                      {qty}
                    </button>
                  );
                })}
              </div>

              <div className="quantity-recommendation" role="note" aria-label="Recommendation">
                <div className="quantity-recommendation__title">Recommended for you</div>
                <div className="quantity-recommendation__text">
                  We recommend starting with 3-4 Surprise Bags per day. You can always change this later.
                </div>
              </div>

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

            </div>
        );

      case 5:
        const minDateTime = getNowDateTimeLocal();
        return (
            <div className="card">
              <h2>Pickup Date & Time</h2>

              <div className="form-row">
                <div className="input-group">
                  <label>Pickup Date Time From *</label>
                  <input
                    type="datetime-local"
                    name="pickupDateTimeFrom"
                    value={formData.pickupDateTimeFrom}
                    onChange={handleChange}
                    min={minDateTime}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Pickup Date Time To *</label>
                  <input
                    type="datetime-local"
                    name="pickupDateTimeTo"
                    value={formData.pickupDateTimeTo}
                    onChange={handleChange}
                    min={formData.pickupDateTimeFrom || minDateTime}
                    required
                  />
                </div>
              </div>

            </div>
        );

      case 6:
        return (
            <div className="card">
              <h2>Outlet Timings</h2>
              <div className="step-subtitle">
                Set the opening hours for this specific Surprise Bag. This won&apos;t change your store timings.
              </div>

              <div className="bag-timings-list">
                {outletDays.map((day) => {
                  const value = formData.outletTimings?.[day.key];
                  const isOpen = value && !value.closed;
                  return (
                    <div key={day.key} className="bag-timing-row">
                      <label className="bag-day-checkbox">
                        <input
                          type="checkbox"
                          checked={!!isOpen}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData((prev) => ({
                              ...prev,
                              outletTimings: {
                                ...(prev.outletTimings || {}),
                                [day.key]: {
                                  ...(prev.outletTimings?.[day.key] || { open: '09:00', close: '18:00' }),
                                  closed: !checked,
                                },
                              },
                            }));
                          }}
                        />
                        <span className="bag-day-name">{day.label}</span>
                      </label>

                      {isOpen ? (
                        <div className="bag-time-inputs">
                          <input
                            type="time"
                            value={value.open}
                            onChange={(e) => {
                              const next = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                outletTimings: {
                                  ...(prev.outletTimings || {}),
                                  [day.key]: { ...prev.outletTimings[day.key], open: next },
                                },
                              }));
                            }}
                            required
                          />
                          <span className="bag-time-separator">to</span>
                          <input
                            type="time"
                            value={value.close}
                            onChange={(e) => {
                              const next = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                outletTimings: {
                                  ...(prev.outletTimings || {}),
                                  [day.key]: { ...prev.outletTimings[day.key], close: next },
                                },
                              }));
                            }}
                            required
                          />
                        </div>
                      ) : (
                        <span className="bag-closed-label">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
        );

      case 7:
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

        <div className="flow-footer">
          <div className="flow-progress" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div
                key={step}
                className={`flow-seg ${
                  step <= currentStep && isStepComplete(step) ? 'done' : ''
                }`}
              />
            ))}
          </div>

          <div className="flow-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrevious}
              disabled={loading || currentStep === 1}
            >
              Back
            </button>

            {currentStep < totalSteps ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
                disabled={loading || !canContinue}
              >
                Continue
              </button>
            ) : (
              <div className="flow-actions__submit">
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
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateSurpriseBag;
