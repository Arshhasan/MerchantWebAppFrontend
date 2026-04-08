import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import './StoreDetails.css';

export default function StoreDetails() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const vendorId = userProfile?.vendorID || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const descriptionMax = 200;

  const canGoForward = !!vendorId && !!storeName.trim() && !!description.trim() && !saving && !loading;

  useEffect(() => {
    const load = async () => {
      if (!vendorId) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'vendors', vendorId));
        if (snap.exists()) {
          const v = snap.data() || {};
          setStoreName((v.title || '').toString());
          setDescription((v.description || '').toString());
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vendorId]);

  const handleContinue = async () => {
    if (!user) return;
    if (!vendorId) {
      showToast('Vendor profile not ready yet. Please try again in a moment.', 'error');
      return;
    }
    if (!storeName.trim()) {
      showToast('Store name is required', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Description is required', 'error');
      return;
    }
    if (description.trim().length > descriptionMax) {
      showToast(`Description must be ${descriptionMax} characters or less`, 'error');
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'vendors', vendorId),
        {
          title: storeName.trim(),
          description: description.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Continue onboarding: outlet location next
      navigate('/outlet-location?onboarding=1', { replace: true });
    } catch (e) {
      showToast(e?.message || 'Failed to save store details', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingSplitLayout>
      <div className="store-details-page store-details-page--split">
        <div className="store-details-header">
          <button
            type="button"
            className="store-details-back"
            onClick={() => navigate('/business-category?onboarding=1', { replace: true })}
            aria-label="Back to business category"
          >
            ←
          </button>
          {/* Forward arrow removed per onboarding UX */}
          <h1>Sign up your store</h1>
          <p>Add your store details</p>
        </div>

        <div className="store-details-card">
          <h2>Store details *</h2>

          {loading ? (
            <div className="store-details-loading">Loading…</div>
          ) : (
            <div className="store-details-form">
              <div className="store-details-field">
                <label htmlFor="storeName">Store name *</label>
                <input
                  id="storeName"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Enter store name"
                />
              </div>

              <div className="store-details-field">
                <label htmlFor="storeDescription">Description *</label>
                <textarea
                  id="storeDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, descriptionMax))}
                  placeholder="Tell customers about your store"
                  rows={5}
                  maxLength={descriptionMax}
                />
                <div className="store-details-counter" aria-live="polite">
                  {description.length}/{descriptionMax}
                </div>
              </div>
            </div>
          )}

          <div className="store-details-actions">
            <button
              type="button"
              className="store-details-continue"
              onClick={handleContinue}
              disabled={saving || loading}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
}

