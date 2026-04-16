import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import './BusinessCategory.css';

const BusinessCategory = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const onboardingQ = useMemo(
    () => (searchParams.get('onboarding') === '1' ? '?onboarding=1' : ''),
    [searchParams]
  );

  /** Onboarding: always return to the Find your store (search) step from this screen. */
  const backPath = `/find-your-store${onboardingQ}`;
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'business_category')));
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .map((c) => ({
            id: String(c.id || ''),
            label: (c.description || c.title || c.name || c.id || '').toString().trim(),
            iconUrl: (c.iconUrl || c.icon || c.image || c.iconURL || '').toString().trim() || null,
            publish: c.publish,
          }))
          .filter((c) => c.id && c.label)
          .filter((c) => c.publish !== false);
        list.sort((a, b) => a.label.localeCompare(b.label));
        setCategories(list);

        // If vendor exists, preselect existing categories
        const vendorId = userProfile?.vendorID;
        if (vendorId) {
          const vendorSnap = await getDoc(doc(db, 'vendors', vendorId));
          if (vendorSnap.exists()) {
            const v = vendorSnap.data() || {};
            setSelectedId(String(v.business_category || ''));
          }
        }
      } catch (e) {
        console.error('Failed to load categories:', e);
        showToast('Failed to load categories', 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, userProfile?.vendorID, showToast]);

  const selected = useMemo(() => categories.find((c) => c.id === selectedId) || null, [categories, selectedId]);

  const canGoForward = !!selectedId && !saving && !loading;

  const handleContinue = async () => {
    if (!user) return;
    if (!selectedId) {
      showToast('Please select a business category', 'error');
      return;
    }

    setSaving(true);
    try {
      // Ensure we have a vendor doc to write to
      let vendorId = userProfile?.vendorID;

      if (!vendorId) {
        vendorId = doc(collection(db, 'vendors')).id;
        await setDoc(
          doc(db, 'vendors', vendorId),
          {
            id: vendorId,
            author: user.uid,
            ...(user.email ? { email: user.email } : {}),
            createdAt: serverTimestamp(),
            hidephotos: false,
            reststatus: false,
          },
          { merge: true }
        );

        // Link user -> vendor
        // Use setDoc so this works even if users/{uid} doc doesn't exist yet.
        await setDoc(
          doc(db, 'users', user.uid),
          { vendorID: vendorId },
          { merge: true }
        );
      }

      // Save business category onto the same vendors/{vendorId} doc
      await setDoc(
        doc(db, 'vendors', vendorId),
        {
          business_category: selectedId,
          business_category_description: selected?.label || '',
          ...(selected?.iconUrl ? { business_category_iconUrl: selected.iconUrl } : {}),
          ...(user.email ? { email: user.email } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Next: outlet location (store name/description come from Google place on Find your store)
      const onboarding = onboardingQ;
      navigate(`/outlet-location${onboarding}`, { replace: true });
    } catch (e) {
      console.error('Failed to save categories:', e);
      showToast(e?.message || 'Failed to save categories', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingSplitLayout
      faqsTitle="Business Category FAQs"
      faqs={[
        {
          id: 'bc-1',
          q: 'Why do I need to choose a business category?',
          a: 'It helps BestByBites show the right Surprise Bags to customers and sets up your store correctly for onboarding.',
        },
        {
          id: 'bc-2',
          q: 'Can I change my category later?',
          a: 'Yes. You can update it later from your store settings if you picked the wrong one.',
        },
        {
          id: 'bc-3',
          q: 'I can’t find my exact category. What should I do?',
          a: 'Pick the closest match for now. You can continue onboarding and adjust later if needed.',
        },
      ]}
    >
      <div className="business-category-page business-category-page--split">
        <div className="business-category-card">
          <div className="business-category-header business-category-header--inCard">
            <button
              type="button"
              className="business-category-back"
              aria-label="Back to find your store"
              onClick={() => navigate(backPath)}
            >
              <ChevronLeft className="business-category-backIcon" strokeWidth={2.25} />
            </button>
            <div className="business-category-header__titles">
              <h1>Sign up your store</h1>
              <p>Which category do you deal with?</p>
            </div>
          </div>

          <h2>Business Category *</h2>

          {loading ? (
            <div className="business-category-loading">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="business-category-loading">No categories available.</div>
          ) : (
            <div className="business-category-list">
              {categories.map((c) => (
                <label key={c.id} className={`business-category-item ${selectedId === c.id ? 'selected' : ''}`}>
                  <span className="business-category-item__icon">
                    {c.iconUrl ? <img src={c.iconUrl} alt="" /> : <span className="business-category-item__iconFallback" />}
                  </span>
                  <span className="business-category-item__label">{c.label}</span>
                  <input
                    type="checkbox"
                    name="businessCategory"
                    checked={selectedId === c.id}
                    onChange={() => setSelectedId((prev) => (prev === c.id ? '' : c.id))}
                    aria-label={`Select ${c.label}`}
                  />
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            className="business-category-continue"
            onClick={handleContinue}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
};

export default BusinessCategory;

