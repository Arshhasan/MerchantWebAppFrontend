import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import './BusinessCategory.css';

const BusinessCategory = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Next step: store name and description
      const onboarding = searchParams.get('onboarding') === '1' ? '?onboarding=1' : '';
      navigate(`/store-details${onboarding}`, { replace: true });
    } catch (e) {
      console.error('Failed to save categories:', e);
      showToast(e?.message || 'Failed to save categories', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingSplitLayout>
      <div className="business-category-page business-category-page--split">
        <div className="business-category-header">
          <button
            type="button"
            className="business-category-back"
            disabled
            aria-label="Back (disabled)"
          >
            ←
          </button>
          <button
            type="button"
            className="business-category-forward"
            onClick={handleContinue}
            disabled={!canGoForward}
            aria-label="Next"
          >
            →
          </button>
          <h1>Sign up your store</h1>
          <p>Which category do you deal with?</p>
        </div>

        <div className="business-category-card">
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

