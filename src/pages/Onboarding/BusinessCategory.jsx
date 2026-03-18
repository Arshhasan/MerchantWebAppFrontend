import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import './BusinessCategory.css';

const BusinessCategory = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const catsQ = query(collection(db, 'vendor_categories'), where('publish', '==', true));
        const snap = await getDocs(catsQ);
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .map((c) => ({
            id: c.id,
            title: c.title || c.review_attributes?.title || c.description || c.id,
          }))
          .filter((c) => c.id && c.title);
        list.sort((a, b) => a.title.localeCompare(b.title));
        setCategories(list);

        // If vendor exists, preselect existing categories
        const vendorId = userProfile?.vendorID;
        if (vendorId) {
          const vendorSnap = await getDoc(doc(db, 'vendors', vendorId));
          if (vendorSnap.exists()) {
            const v = vendorSnap.data() || {};
            const existing = Array.isArray(v.categoryID)
              ? v.categoryID
              : (v.categoryID ? [v.categoryID] : []);
            setSelectedIds(existing);
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

  const selectedTitles = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.title]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [categories, selectedIds]);

  const toggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleContinue = async () => {
    if (!user) return;
    if (selectedIds.length === 0) {
      showToast('Please select at least one business category', 'error');
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
        await updateDoc(doc(db, 'users', user.uid), {
          vendorID: vendorId,
        });
      }

      // Save categories onto the same vendors/{vendorId} doc
      await setDoc(
        doc(db, 'vendors', vendorId),
        {
          categoryID: selectedIds,
          categoryTitle: selectedTitles,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Next step: outlet info
      const onboarding = searchParams.get('onboarding') === '1' ? '?onboarding=1' : '';
      navigate(`/outlet-info${onboarding}`, { replace: true });
    } catch (e) {
      console.error('Failed to save categories:', e);
      showToast(e?.message || 'Failed to save categories', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="business-category-page">
      <div className="business-category-header">
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
              <label key={c.id} className={`business-category-item ${selectedIds.includes(c.id) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span>{c.title}</span>
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
  );
};

export default BusinessCategory;

