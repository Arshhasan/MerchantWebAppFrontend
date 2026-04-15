import { useState, useEffect, useRef } from 'react';

/** Primary image URL for moderation (matches Cloud Function + Firestore shape). */
function getPrimaryPhotoUrlFromFirestoreBag(bag) {
  if (!bag || typeof bag !== 'object') return '';
  if (typeof bag.imageUrl === 'string' && bag.imageUrl.trim().startsWith('http')) {
    return bag.imageUrl.trim();
  }
  const photos = bag.photos;
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const first = photos[0];
  if (typeof first === 'string' && first.trim().startsWith('http')) return first.trim();
  if (first && typeof first === 'object') {
    const u = first.url || first.preview;
    if (typeof u === 'string' && u.trim().startsWith('http')) return u.trim();
  }
  return '';
}
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createDocument, updateDocument, getDocuments, getDocument } from '../../firebase/firestore';
import { uploadFile } from '../../firebase/storage';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './CreateSurpriseBag.css';

const DEFAULT_OUTLET_TIMINGS = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '10:00', close: '16:00', closed: false },
  sunday: { open: '10:00', close: '16:00', closed: true },
};

const DAY_END_MINUTES = 23 * 60 + 45; // 23:45 last selectable slot

const FALLBACK_BAG_PRICING = [
  { id: 'small', name: 'Small', regularPrice: 18.0, offerPrice: 5.99, isActive: true, order: 1 },
  { id: 'medium', name: 'Medium', regularPrice: 24.0, offerPrice: 7.99, isActive: true, order: 2 },
  { id: 'large', name: 'Large', regularPrice: 30.0, offerPrice: 9.99, isActive: true, order: 3 },
];

function parseTimeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function formatHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime12hLabel(hhmm) {
  const mins = parseTimeToMinutes(hhmm);
  if (mins === null) return hhmm;
  let h = Math.floor(mins / 60) % 24;
  const mi = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} ${suffix}`;
}

function getStoreSlotBounds(storeDay) {
  if (!storeDay || storeDay.closed) {
    return { minOpen: 0, minClose: DAY_END_MINUTES };
  }
  const o = parseTimeToMinutes(storeDay.open);
  const c = parseTimeToMinutes(storeDay.close);
  if (o === null || c === null) {
    return { minOpen: 0, minClose: DAY_END_MINUTES };
  }
  if (c > o) return { minOpen: o, minClose: c };
  return { minOpen: 0, minClose: DAY_END_MINUTES };
}

/** 15-minute slots from minOpen through minClose (aligned to quarter hours). */
function quarterHourSlotsInRange(minOpen, minClose) {
  const slots = [];
  const start = Math.ceil(minOpen / 15) * 15;
  for (let t = start; t <= minClose; t += 15) {
    slots.push(formatHHMM(t));
  }
  return slots;
}

function mergeTimingsFromStore(timings) {
  const next = { ...DEFAULT_OUTLET_TIMINGS };
  if (!timings || typeof timings !== 'object') return next;
  for (const key of Object.keys(DEFAULT_OUTLET_TIMINGS)) {
    const d = timings[key];
    if (d && typeof d === 'object') {
      next[key] = {
        open: typeof d.open === 'string' ? d.open : next[key].open,
        close: typeof d.close === 'string' ? d.close : next[key].close,
        closed: Boolean(d.closed),
      };
    }
  }
  return next;
}

/** Custom time picker: native select menus cannot limit height; list shows ~5 rows + scroll. */
function PickupTimeDropdown({ labelId, value, options, onSelect, disabled = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selectedBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && selectedBtnRef.current) {
      selectedBtnRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [open, value]);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value ? formatTime12hLabel(value) : '—');
  const empty = options.length === 0;

  return (
    <div
      className={`bag-time-dropdown${open ? ' bag-time-dropdown--open' : ''}`}
      ref={wrapRef}
    >
      <button
        type="button"
        className="bag-time-dropdown__trigger"
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled || empty}
        onClick={() => {
          if (disabled || empty) return;
          setOpen((v) => !v);
        }}
      >
        <span className="bag-time-dropdown__value">{displayLabel}</span>
      </button>
      {open && !empty ? (
        <ul className="bag-time-dropdown__list" role="listbox" aria-labelledby={labelId}>
          {options.map((opt) => (
            <li key={opt.value} role="none">
              <button
                type="button"
                ref={opt.value === value ? selectedBtnRef : undefined}
                role="option"
                className={`bag-time-dropdown__option${opt.value === value ? ' bag-time-dropdown__option--selected' : ''}`}
                aria-selected={opt.value === value}
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const CreateSurpriseBag = () => {
  const { user, vendorProfile, patchVendorProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFirstBagOnboarding =
    ['1', 'true'].includes(String(searchParams.get('firstBag') ?? '').toLowerCase());
  const [skipOnboardingLoading, setSkipOnboardingLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingBagId, setEditingBagId] = useState(null);
  /** Snapshot of the bag when opening the edit form (for moderation field updates). */
  const originalEditingBagRef = useRef(null);
  const didLoadFromEditingBagRef = useRef(false);
  const [formData, setFormData] = useState({
    categories: [],
    /** Pickup slot selections for Today/Tomorrow (3-hour slots). */
    pickupSlots: {
      today: [],
      tomorrow: [],
    },
    bagTitle: '',
    description: '',
    bagSize: '',
    selectedPricing: null,
    bagPrice: '',
    offerPrice: '',
    quantity: '5',
    outletTimings: { ...DEFAULT_OUTLET_TIMINGS },
    photos: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const categoriesErrorShownRef = useRef(false);

  const [bagPricingOptions, setBagPricingOptions] = useState([]);
  // Keep default false to avoid “stuck loading” during React Fast Refresh.
  const [bagPricingLoading, setBagPricingLoading] = useState(false);
  const [bagPricingMeta, setBagPricingMeta] = useState({ source: 'idle', message: '', fetchedCount: 0, activeCount: 0 });
  // Note: avoid ref-based “already loaded” guards here; Fast Refresh can preserve refs
  // and prevent re-fetching, making it look like Firestore isn't working.

  const formatLocalDateYYYYMMDD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const addDays = (d, days) => {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
  };

  const todayDate = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  })();
  const todayISO = formatLocalDateYYYYMMDD(todayDate);
  const tomorrowISO = formatLocalDateYYYYMMDD(addDays(todayDate, 1));

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
            const rawIcon =
              cat.iconUrl
              || cat.review_attributes?.iconUrl
              || cat.icon
              || cat.image
              || cat.iconURL
              || '';
            const iconUrl = String(rawIcon || '').trim() || null;
            return {
              id: cat.id || '',
              name: categoryName,
              description: cat.description || '',
              iconUrl,
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
        originalEditingBagRef.current = editingBag;
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
        
        const pickupSlots =
          (editingBag.pickupSlots && typeof editingBag.pickupSlots === 'object')
            ? {
              today: Array.isArray(editingBag.pickupSlots.today) ? editingBag.pickupSlots.today : [],
              tomorrow: Array.isArray(editingBag.pickupSlots.tomorrow) ? editingBag.pickupSlots.tomorrow : [],
            }
            : { today: [], tomorrow: [] };

        // Pre-fill form data with bag data
        setFormData({
          categories: editingBag.categories || [],
          pickupSlots,
          bagTitle: editingBag.bagTitle || '',
          description: editingBag.description || '',
          bagSize: editingBag.bagSize || '',
          bagPrice: (editingBag.bagPrice ?? editingBag.regularPrice)?.toString() || '',
          offerPrice: (editingBag.offerPrice ?? editingBag.discountPrice ?? editingBag.restaurantDiscountPrice)?.toString() || '',
          quantity: editingBag.quantity?.toString() || editingBag.availableQuantity?.toString() || '',
          outletTimings: editingBag.outletTimings || { ...DEFAULT_OUTLET_TIMINGS },
          photos: photos,
        });

        didLoadFromEditingBagRef.current = true;

        // Clear sessionStorage after loading
        sessionStorage.removeItem('editingBag');
      } catch (error) {
        console.error('Error parsing editing bag data:', error);
        showToast('Error loading bag data for editing', 'error');
      }
    }
  }, [showToast]);

  const [storeTimings, setStoreTimings] = useState(() => ({ ...DEFAULT_OUTLET_TIMINGS }));

  useEffect(() => {
    let cancelled = false;
    const loadStoreTimings = async () => {
      if (!user) return;
      const result = await getDocument('merchant_outlet_info', user.uid);
      if (cancelled) return;
      const merged = mergeTimingsFromStore(
        result.success && result.data?.timings ? result.data.timings : null,
      );
      setStoreTimings(merged);
      if (!didLoadFromEditingBagRef.current) {
        setFormData((prev) => ({ ...prev, outletTimings: merged }));
      }
    };
    loadStoreTimings();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalSteps = 4;

  const outletDays = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  const handlePickupStartChange = (dayKey, newOpen) => {
    setFormData((prev) => {
      const day = prev.outletTimings?.[dayKey];
      // Start options should cover the whole day (00:00 → 23:45).
      const allSlots = quarterHourSlotsInRange(0, DAY_END_MINUTES);
      const openM = parseTimeToMinutes(newOpen);
      let close = day?.close;
      const endSlots = allSlots.filter(
        (hhmm) => parseTimeToMinutes(hhmm) > (openM ?? -1),
      );
      if (close == null || !endSlots.includes(close)) {
        close = endSlots[0] ?? newOpen;
      }
      return {
        ...prev,
        outletTimings: {
          ...prev.outletTimings,
          [dayKey]: {
            ...(day || { open: '09:00', close: '18:00', closed: false }),
            open: newOpen,
            close,
          },
        },
      };
    });
    if (stepError) setStepError('');
  };

  const handlePickupEndChange = (dayKey, newClose) => {
    setFormData((prev) => ({
      ...prev,
      outletTimings: {
        ...prev.outletTimings,
        [dayKey]: {
          ...prev.outletTimings[dayKey],
          close: newClose,
        },
      },
    }));
    if (stepError) setStepError('');
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

  // const handleToggleAllCategories = () => {
  //   setFormData((prev) => {
  //     if (categories.length === 0) return prev;
  //     const allCategoryIds = categories.map((c) => c.id);
  //     const areAllSelected =
  //       prev.categories.length > 0
  //       && allCategoryIds.every((id) => prev.categories.includes(id));
  //     return {
  //       ...prev,
  //       categories: areAllSelected ? [] : allCategoryIds,
  //     };
  //   });
  // };

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

  // Fetch Surprise Bag pricing options (dynamic sizes)
  useEffect(() => {
    let cancelled = false;

    const fetchPricing = async () => {
      setBagPricingLoading(true);
      setBagPricingMeta({ source: 'loading', message: '', fetchedCount: 0, activeCount: 0 });
      try {
        // Read all docs and filter/sort client-side to avoid index requirements and
        // reduce the chance of “empty” results due to query constraints.
        const result = await getDocuments('merchant_surprise_bag_pricing');
        console.log('[CreateSurpriseBag] merchant_surprise_bag_pricing fetch result', result);
        if (cancelled) return;
        const rows = (result.success && Array.isArray(result.data)) ? result.data : [];
        const normalizedAll = rows
          .map((r) => ({
            id: r.id || '',
            name: String(r.name || '').trim(),
            regularPrice: Number(
              typeof (r.regularPrice ?? r.minPrice) === 'string'
                ? String(r.regularPrice ?? r.minPrice).trim()
                : (r.regularPrice ?? r.minPrice)
            ),
            offerPrice: Number(
              typeof (r.offerPrice ?? r.appPrice) === 'string'
                ? String(r.offerPrice ?? r.appPrice).trim()
                : (r.offerPrice ?? r.appPrice)
            ),
            isActive: r.isActive === true,
            order: Number(typeof r.order === 'string' ? r.order.trim() : r.order),
          }))
          .filter((r) => r.name && Number.isFinite(r.regularPrice) && Number.isFinite(r.offerPrice));

        const normalizedActive = normalizedAll
          .filter((r) => r.isActive)
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

        if (normalizedActive.length > 0) {
          setBagPricingOptions(normalizedActive);
          setBagPricingMeta({
            source: 'firestore',
            message: '',
            fetchedCount: rows.length,
            activeCount: normalizedActive.length,
          });
        } else {
          setBagPricingOptions(FALLBACK_BAG_PRICING);
          if (normalizedAll.length > 0) {
            setBagPricingMeta({
              source: 'fallback',
              message: 'No active pricing found in Firestore (isActive must be true). Using default pricing.',
              fetchedCount: rows.length,
              activeCount: 0,
            });
          } else {
            setBagPricingMeta({
              source: 'fallback',
              message: 'No pricing documents found. Using default pricing.',
              fetchedCount: rows.length,
              activeCount: 0,
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching merchant_surprise_bag_pricing:', err);
          setBagPricingOptions(FALLBACK_BAG_PRICING);
          setBagPricingMeta({
            source: 'fallback',
            message: 'Could not load pricing from Firestore (permissions/network). Using default pricing.',
            fetchedCount: 0,
            activeCount: 0,
          });
        }
      } finally {
        if (!cancelled) setBagPricingLoading(false);
      }
    };

    fetchPricing();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'bagSize') {
      const opts = bagPricingOptions.length > 0 ? bagPricingOptions : FALLBACK_BAG_PRICING;
      const selected = opts.find((o) => String(o.id) === String(value));
      if (!selected) {
        setFormData({ ...formData, bagSize: '', selectedPricing: null, bagPrice: '', offerPrice: '' });
      } else {
        setFormData({
          ...formData,
          bagSize: selected.name,
          selectedPricing: selected,
          bagPrice: String(selected.regularPrice),
          offerPrice: String(selected.offerPrice),
        });
      }
    } else if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else if (name === 'bagTitle') {
      const words = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const trimmed = words.length > 20 ? words.slice(0, 20).join(' ') : value;
      setFormData({ ...formData, [name]: trimmed });
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
    if (!formData.bagSize || !formData.selectedPricing) {
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
      const bounds = getStoreSlotBounds(storeTimings[d.key]);
      const slots = quarterHourSlotsInRange(bounds.minOpen, bounds.minClose);
      if (slots.length < 2) {
        setStepError(
          `${d.label}: store hours that day need at least 30 minutes so you can set a pickup start and end.`,
        );
        return false;
      }
      if (!day.open || !day.close) {
        setStepError(`Please set start and end time for ${d.label}`);
        return false;
      }
      const openM = parseTimeToMinutes(day.open);
      const closeM = parseTimeToMinutes(day.close);
      if (openM === null || closeM === null) {
        setStepError(`Please set valid times for ${d.label}`);
        return false;
      }
      if (openM >= closeM) {
        setStepError(`${d.label}: end time must be after start time`);
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

  /** Name, description, and photos (merged step). */
  const validateNameDescPhotosStep = () => {
    if (!validateStep2()) return false;
    if (!validateStep7()) return false;
    return true;
  };

  const validateCurrentStep = () => {
    setStepError('');
    switch (currentStep) {
      case 1:
        return validateStep1();
      case 2:
        return validateNameDescPhotosStep();
      case 3:
        return validateStep6();
      case 4:
        return validateStep3() && validateStep4();
      default:
        return true;
    }
  };

  const isStepComplete = (step) => {
    switch (step) {
      case 1:
        return Array.isArray(formData.categories) && formData.categories.length > 0;
      case 2:
        return (
          !!formData.bagTitle?.trim()
          && !!formData.description?.trim()
          && Array.isArray(formData.photos)
          && formData.photos.length > 0
        );
      case 3:
        return (() => {
          const t = formData.outletTimings || {};
          const hasOpenDay = outletDays.some((d) => t?.[d.key] && !t[d.key].closed);
          if (!hasOpenDay) return false;
          for (const d of outletDays) {
            const day = t?.[d.key];
            if (!day || day.closed) continue;
            const b = getStoreSlotBounds(storeTimings[d.key]);
            const sl = quarterHourSlotsInRange(b.minOpen, b.minClose);
            if (sl.length < 2) return false;
            if (!day.open || !day.close) return false;
            const om = parseTimeToMinutes(day.open);
            const cm = parseTimeToMinutes(day.close);
            if (om === null || cm === null || om >= cm) return false;
          }
          return true;
        })();
      case 4: {
        if (!formData.bagSize) return false;
        const regularPrice = parseFloat(formData.bagPrice);
        const offerPrice = parseFloat(formData.offerPrice);
        const pricingOk = (
          Number.isFinite(regularPrice)
          && regularPrice > 0
          && Number.isFinite(offerPrice)
          && offerPrice > 0
          && offerPrice < regularPrice
        );
        const q = parseInt(formData.quantity, 10);
        const qtyOk = Number.isFinite(q) && q > 0;
        return pricingOk && qtyOk;
      }
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

  /** Skip first-bag onboarding: mark vendor complete and go to dashboard (no bag created). */
  const handleSkipFirstBagOnboarding = async () => {
    const vendor = vendorProfile;
    if (!vendor?.id) {
      showToast('Store profile not loaded. Please refresh and try again.', 'error');
      return;
    }
    setSkipOnboardingLoading(true);
    try {
      if (vendor.hasCreatedFirstBag !== true) {
        const vUp = await updateDocument('vendors', vendor.id, { hasCreatedFirstBag: true });
        if (vUp.success) {
          patchVendorProfile({ hasCreatedFirstBag: true });
        } else {
          throw new Error(vUp.error || 'Could not update your store profile.');
        }
      } else {
        patchVendorProfile({ hasCreatedFirstBag: true });
      }
      showToast('You can create a surprise bag anytime from the menu.', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Could not skip this step.', 'error');
    } finally {
      setSkipOnboardingLoading(false);
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
      || !validateStep6()
      || !validateStep2()
      || !validateStep3()
      || !validateStep4()
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
      const isFirstBagFlow =
        typeof window !== 'undefined' && window.location.search.includes('firstBag=1');

      // Determine prices (bagPrice is the regular price; offerPrice is the discounted price)
      const regularPrice = parseFloat(formData.bagPrice);
      const offerPrice = parseFloat(formData.offerPrice);
      const finalPrice = regularPrice; // Backward compatible variable name

      setUploadProgress(10);

      // Status: onboarding first bag is always published + becomes the active listing (see is_active below).
      // Otherwise: draft vs published follows the user's action.
      const bagStatus = isFirstBagFlow
        ? 'published'
        : action === 'Publish'
          ? 'published'
          : 'draft';
      
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

      const selectedPickupDates = {
        todayDate: todayISO,
        tomorrowDate: tomorrowISO,
        todaySlots: Array.isArray(formData.pickupSlots?.today) ? formData.pickupSlots.today : [],
        tomorrowSlots: Array.isArray(formData.pickupSlots?.tomorrow) ? formData.pickupSlots.tomorrow : [],
      };

      const publishedOrFirstFlow = isFirstBagFlow ? true : bagStatus === 'published';
      const newPrimaryImageUrl = photoUrls[0] || '';
      const bagData = {
        merchantId: user.uid,
        categories: formData.categories,
        tagIds: [],
        pickupSlots: selectedPickupDates,
        bagTitle: formData.bagTitle,
        description: formData.description,
        bagSize: formData.bagSize,
        selectedPricing: formData.selectedPricing || null,
        bagPrice: finalPrice,
        offerPrice: offerPrice,
        quantity: parseInt(formData.quantity, 10),
        availableQuantity: parseInt(formData.quantity, 10),
        status: bagStatus, // Always set: 'draft' or 'published'
        // Bags UI + customer listing use `is_active` (snake_case), not `isActive`.
        is_active: publishedOrFirstFlow,
        isActive: publishedOrFirstFlow,
        imageUrl: newPrimaryImageUrl,
        photos: photoUrls, // Add photos array
        moderationStatus: photoUrls.length > 0 ? 'pending' : 'approved',
        isUnsafe: false,
        lastModeratedAt: null,
        outletTimings: formData.outletTimings,

        // Vendor meta copied at creation time for convenience
        workingHours: vendor?.workingHours || [],
        location: vendor?.location || '',
        latitude: vendorLatitude,
        longitude: vendorLongitude,
      };

      if (
        editingBagId
        && originalEditingBagRef.current
        && getPrimaryPhotoUrlFromFirestoreBag(originalEditingBagRef.current) === newPrimaryImageUrl
      ) {
        delete bagData.moderationStatus;
        delete bagData.lastModeratedAt;
        delete bagData.isUnsafe;
      }

      setUploadProgress(90);

      let result;
      if (editingBagId) {
        // Update existing document
        // Don't overwrite views and orders when updating
        const updateData = { ...bagData };
        
        result = await updateDocument('merchant_surprise_bag', editingBagId, updateData);
        
        if (result.success) {
          setUploadProgress(100);
          if (action === 'Publish' || isFirstBagFlow) {
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
          // Mark first bag complete on vendor so onboarding gate clears. Patch in-memory
          // immediately — Firestore onSnapshot can lag one tick behind navigate('/dashboard'),
          // which previously sent users back to /first-bag.
          if (vendor?.id) {
            if (vendor.hasCreatedFirstBag !== true) {
              const vUp = await updateDocument('vendors', vendor.id, { hasCreatedFirstBag: true });
              if (vUp.success) {
                patchVendorProfile({ hasCreatedFirstBag: true });
              }
            } else {
              patchVendorProfile({ hasCreatedFirstBag: true });
            }
          }
          if (isFirstBagFlow || action === 'Publish') {
            showToast('Surprise bag published successfully!', 'success');
            navigate('/dashboard', { replace: true });
          } else {
            showToast('Draft saved successfully!', 'success');
            navigate('/dashboard', { replace: true });
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
          <div className="card card--category-step">
            <h2>Select the category that best describes your surplus food</h2>
            <div className="step-subtitle">
              Let customers know what they can expect in their Surprise Bags.
            </div>

            <div className="category-card-list" role="list" aria-label="Categories">
              {categoriesLoading ? (
                <div className="category-loading">Loading categories…</div>
              ) : categories.length === 0 ? (
                <div className="category-empty">No categories available</div>
              ) : (
                categories.map((category) => {
                  const selected = formData.categories.includes(category.id);
                  const displayName = category.name || category.id;
                  const displayDesc =
                    category.description && category.description !== displayName
                      ? category.description
                      : '';
                  return (
                    <label
                      key={category.id}
                      className={`category-card ${selected ? 'selected' : ''}`}
                    >
                      <span className="category-card-icon">
                        {category.iconUrl ? (
                          <img src={category.iconUrl} alt="" />
                        ) : (
                          <span className="category-card-iconFallback" aria-hidden="true" />
                        )}
                      </span>
                      <div className="category-card-body">
                        <span className="category-card-label">{displayName}</span>
                        {displayDesc ? (
                          <span className="category-card-desc">{displayDesc}</span>
                        ) : null}
                      </div>
                      <input
                        type="checkbox"
                        className="category-card-checkbox"
                        checked={selected}
                        onChange={() => handleCategorySelect(category.id)}
                        aria-label={`${displayName}${selected ? ', selected' : ''}`}
                      />
                    </label>
                  );
                })
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="card card--bag-details">
            <h2>Add Bag Title, Bag Description and Bag Image.</h2>
            <div className="step-subtitle">
              We&apos;ve made it easy! Here&apos;s what we suggest. You can always make changes.
            </div>

            <div className="input-group">
              <label>Bag Title *</label>
              <input
                type="text"
                name="bagTitle"
                value={formData.bagTitle}
                onChange={handleChange}
                placeholder="Example: Dinner Bag"
                maxLength={200}
                required
              />
              <div className="field-counter" aria-live="polite">
                {(String(formData.bagTitle || '').trim().split(/\s+/).filter(Boolean).length)}/20 words
              </div>
            </div>

            <div className="input-group">
              <label>Bag Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Example: A dinner surprise bag with assorted mains and sides. Contents vary daily based on what’s fresh."
                rows="3"
                maxLength={200}
                required
              />
              <div className="field-counter" aria-live="polite">
                {(formData.description || '').length}/200
              </div>
            </div>

            <div className="input-group">
              <label>Add Bag Photos *</label>
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

      /*
       * Pickup date & slots step removed from the wizard (was step 2).
       * Payload still sends empty pickupSlots arrays in bagData for compatibility.
       */

      case 3:
        return (
            <div className="card card--pickup-timings">
              <h2>Pickup timings</h2>
              <div className="step-subtitle">
                Set the pickup window for this Surprise Bag (15-minute steps, within your store hours). This won&apos;t change your saved outlet timings.
              </div>

              <div className="bag-timings-list">
                {outletDays.map((day) => {
                  const value = formData.outletTimings?.[day.key];
                  const isOpen = value && !value.closed;
                  const allStartSlots = quarterHourSlotsInRange(0, DAY_END_MINUTES);
                  const allEndSlots = quarterHourSlotsInRange(0, DAY_END_MINUTES);
                  const startOptions =
                    allStartSlots.length >= 2 ? allStartSlots.slice(0, -1) : [];
                  const startM = parseTimeToMinutes(value?.open);
                  const endSlots = allEndSlots.filter(
                    (hhmm) => parseTimeToMinutes(hhmm) > (startM ?? -1),
                  );
                  const startSelectOptions =
                    value?.open && !startOptions.includes(value.open)
                      ? [value.open, ...startOptions].sort(
                        (a, b) => (parseTimeToMinutes(a) ?? 0) - (parseTimeToMinutes(b) ?? 0),
                      )
                      : startOptions;
                  const endSelectOptions =
                    value?.close && !endSlots.includes(value.close)
                      ? [value.close, ...endSlots].sort(
                        (a, b) => (parseTimeToMinutes(a) ?? 0) - (parseTimeToMinutes(b) ?? 0),
                      )
                      : endSlots;

                  return (
                    <div key={day.key} className="bag-timing-row">
                      <label className="bag-day-checkbox">
                        <input
                          type="checkbox"
                          checked={!!isOpen}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData((prev) => {
                              const b = getStoreSlotBounds(storeTimings[day.key]);
                              const slots = quarterHourSlotsInRange(b.minOpen, b.minClose);
                              const base = prev.outletTimings?.[day.key] || {
                                open: '09:00',
                                close: '18:00',
                                closed: false,
                              };
                              if (!checked) {
                                return {
                                  ...prev,
                                  outletTimings: {
                                    ...(prev.outletTimings || {}),
                                    [day.key]: { ...base, closed: true },
                                  },
                                };
                              }
                              const open = slots.length >= 2 ? slots[0] : base.open;
                              const close = slots.length >= 2 ? slots[1] : base.close;
                              return {
                                ...prev,
                                outletTimings: {
                                  ...(prev.outletTimings || {}),
                                  [day.key]: {
                                    ...base,
                                    closed: false,
                                    open,
                                    close,
                                  },
                                },
                              };
                            });
                            if (stepError) setStepError('');
                          }}
                        />
                        <span className="bag-day-name">{day.label}</span>
                      </label>

                      {isOpen ? (
                        <div className="bag-time-inputs bag-pickup-time-inputs">
                          <div className="bag-time-field">
                            <span className="bag-time-field-label" id={`pickup-start-label-${day.key}`}>
                              Start
                            </span>
                            <PickupTimeDropdown
                              labelId={`pickup-start-label-${day.key}`}
                              value={value.open}
                              options={startSelectOptions.map((hhmm) => ({
                                value: hhmm,
                                label: formatTime12hLabel(hhmm),
                              }))}
                              onSelect={(v) => handlePickupStartChange(day.key, v)}
                              disabled={startSelectOptions.length === 0}
                            />
                          </div>
                          <span className="bag-time-separator" aria-hidden="true">
                            –
                          </span>
                          <div className="bag-time-field">
                            <span className="bag-time-field-label" id={`pickup-end-label-${day.key}`}>
                              End
                            </span>
                            <PickupTimeDropdown
                              labelId={`pickup-end-label-${day.key}`}
                              value={value.close}
                              options={endSelectOptions.map((hhmm) => ({
                                value: hhmm,
                                label: formatTime12hLabel(hhmm),
                              }))}
                              onSelect={(v) => handlePickupEndChange(day.key, v)}
                              disabled={endSelectOptions.length === 0}
                            />
                          </div>
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

      case 4: {
        const quantityQuickOptions = [3, 4, 5, 6];
        const parsedQty = parseInt(formData.quantity, 10);
        const selectedQty = Number.isFinite(parsedQty) ? parsedQty : NaN;
        const displayQty = Number.isFinite(parsedQty) && parsedQty >= 0 ? parsedQty : 0;

        const setQuantityValue = (n) => {
          const clamped = Math.max(0, Math.min(99, n));
          setFormData((prev) => ({
            ...prev,
            quantity: String(clamped),
          }));
          if (stepError) setStepError('');
        };

        return (
            <div className="card">
              <h2>Pricing</h2>

              <div className="bag-size-section-wrap">
                <div className="input-group bag-size-input-group">
                  <label>Choose your Surprise Bag size *</label>
                  <div className="bag-size-options" role="radiogroup" aria-label="Surprise bag size">
                    {(bagPricingOptions.length > 0 ? bagPricingOptions : FALLBACK_BAG_PRICING).map((opt) => {
                      const selected = formData.selectedPricing?.id
                        ? formData.selectedPricing.id === opt.id
                        : formData.bagSize === opt.name;
                      return (
                        <button
                          key={opt.id || opt.name}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`bag-size-option ${selected ? 'selected' : ''}`}
                          onClick={() =>
                            handleChange({ target: { name: 'bagSize', value: opt.id } })
                          }
                        >
                          <div className="bag-size-option-left">
                            <div className="bag-size-option-title">{opt.name}</div>
                          </div>
                          <div className="bag-size-option-right">
                            <div className="bag-size-option-regular">
                              {formatMerchantCurrency(opt.regularPrice, vendorProfile)}
                            </div>
                            <div className="bag-size-option-sub">regular price</div>
                            <div className="bag-size-option-offer">
                              {formatMerchantCurrency(opt.offerPrice, vendorProfile)} offer price
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="step-subtitle" style={{ marginTop: 8 }}>
                    {bagPricingLoading
                      ? 'Loading pricing…'
                      : bagPricingMeta.source === 'firestore'
                        ? `Pricing loaded from Firestore (${bagPricingMeta.activeCount} active of ${bagPricingMeta.fetchedCount}).`
                        : bagPricingMeta.message
                          ? bagPricingMeta.message
                          : 'Pricing status: unknown (refresh the page).'}
                  </div>
                </div>
              </div>

              <div className="quantity-combined">
                <h3 className="quantity-combined__title">Set the daily number of Surprise Bags</h3>
                <div className="quantity-subtitle">Set your daily available quantity</div>

                <div className="quantity-options" role="group" aria-label="Quick quantity options">
                  {quantityQuickOptions.map((qty) => {
                    const active = Number.isFinite(selectedQty) && selectedQty === qty;
                    return (
                      <button
                        key={qty}
                        type="button"
                        className={`quantity-option ${active ? 'selected' : ''}`}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, quantity: String(qty) }));
                          if (stepError) setStepError('');
                        }}
                      >
                        {qty}
                      </button>
                    );
                  })}
                </div>

                {/* First-time onboarding (firstBag=1): presets only — no +/- stepper */}
                {!isFirstBagOnboarding ? (
                  <div className="input-group quantity-stepper-group">
                    <label htmlFor="quantity-stepper-value">Quantity</label>
                    <div
                      id="quantity-stepper-value"
                      className="quantity-stepper"
                      role="group"
                      aria-label="Number of bags"
                    >
                      <button
                        type="button"
                        className="quantity-stepper__btn"
                        onClick={() => setQuantityValue(displayQty - 1)}
                        disabled={displayQty <= 0}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="quantity-stepper__value" aria-live="polite">
                        {displayQty}
                      </span>
                      <button
                        type="button"
                        className="quantity-stepper__btn"
                        onClick={() => setQuantityValue(displayQty + 1)}
                        disabled={displayQty >= 99}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

            <div className="bag-details-submit">
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
            </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="create-bag">
      <div className="create-bag__layout">
        <header
          className={`create-bag__page-title ${
            isFirstBagOnboarding && !editingBagId ? 'create-bag__page-title--with-skip' : ''
          }`}
        >
          {isFirstBagOnboarding && !editingBagId ? (
            <>
              <span className="create-bag__page-title-spacer" aria-hidden="true" />
              <h1>Create Surprise Bag</h1>
              <div className="create-bag__page-title-actions">
                <button
                  type="button"
                  className="btn btn-skip-onboarding"
                  onClick={handleSkipFirstBagOnboarding}
                  disabled={skipOnboardingLoading}
                >
                  {skipOnboardingLoading ? 'Skipping…' : 'Skip for now'}
                </button>
              </div>
            </>
          ) : (
            <h1>{editingBagId ? 'Edit Surprise Bag' : 'Create Surprise Bag'}</h1>
          )}
        </header>

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
                null
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSurpriseBag;
