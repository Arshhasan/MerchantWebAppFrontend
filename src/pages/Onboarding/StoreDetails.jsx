import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import './StoreDetails.css';

export default function StoreDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const vendorId = userProfile?.vendorID || '';
  const isOnboarding = searchParams.get('onboarding') === '1';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');

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

      // Continue onboarding: go to first-bag choice page.
      navigate('/first-bag?onboarding=1', { replace: true });
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
            onClick={() => navigate('/outlet-location?onboarding=1', { replace: true })}
            aria-label="Back to outlet location"
          >
            ←
          </button>
          <button
            type="button"
            className="store-details-forward"
            onClick={handleContinue}
            disabled={!canGoForward}
            aria-label="Next"
          >
            →
          </button>
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
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell customers about your store"
                  rows={5}
                />
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
              {saving ? 'Saving…' : 'Finish'}
            </button>
          </div>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
}

