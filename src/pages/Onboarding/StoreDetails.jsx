import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import './StoreDetails.css';

export default function StoreDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile, vendorProfile, patchVendorProfile } = useAuth();
  const { showToast } = useToast();

  const countWords = (value) =>
    String(value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

  const truncateToWords = (value, maxWords) => {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return String(value || '');
    return words.slice(0, maxWords).join(' ');
  };

  const onboardingQ = useMemo(
    () => (searchParams.get('onboarding') === '1' ? '?onboarding=1' : ''),
    [searchParams]
  );

  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Prefill if vendor profile already exists (e.g., user went back and forth).
    if (!vendorProfile) return;
    if (!storeName && vendorProfile.title) setStoreName(String(vendorProfile.title));
    if (!storeDescription && vendorProfile.description) setStoreDescription(String(vendorProfile.description));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorProfile]);

  const canContinue =
    !!user
    && !!storeName.trim()
    && !!storeDescription.trim()
    && !saving;

  const handleContinue = async () => {
    if (!user) return;
    const title = truncateToWords(storeName, 20).trim();
    const description = truncateToWords(storeDescription, 200).trim();
    if (!title) {
      showToast('Please enter your store name.', 'error');
      return;
    }
    if (!description) {
      showToast('Please enter your store description.', 'error');
      return;
    }
    if (countWords(title) > 20) {
      showToast('Store name must be 20 words or less.', 'error');
      return;
    }
    if (countWords(description) > 200) {
      showToast('Store description must be 200 words or less.', 'error');
      return;
    }

    setSaving(true);
    try {
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

        await setDoc(
          doc(db, 'users', user.uid),
          { vendorID: vendorId },
          { merge: true }
        );
      }

      await setDoc(
        doc(db, 'vendors', vendorId),
        {
          title,
          description,
          ...(user.email ? { email: user.email } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      patchVendorProfile({
        id: vendorId,
        title,
        description,
      });

      navigate(`/business-category${onboardingQ}`);
    } catch (e) {
      console.error('Failed to save store details:', e);
      showToast(e?.message || 'Failed to save store details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingSplitLayout
      showHelpButton={false}
      faqsTitle="Store Details FAQs"
      faqs={[
        {
          id: 'sd-1',
          q: 'Can I update store details later?',
          a: 'Yes — you can update your store name and description later in Manage Store.',
        },
      ]}
    >
      <div className="store-details-page store-details-page--split">
        <div className="store-details-card">
          <div className="store-details-header store-details-header--inCard">
            <button
              type="button"
              className="store-details-back"
              aria-label="Back"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
                else navigate(`/find-your-store${onboardingQ}`);
              }}
            >
              ←
            </button>
            <div className="store-details-header__titles">
              <h1>Sign up your store</h1>
              <p>Add your store details manually</p>
            </div>
          </div>

          <h2>Store details *</h2>

          <div className="store-details-form">
            <div className="store-details-field">
              <label htmlFor="store-name">Store name</label>
              <input
                id="store-name"
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(truncateToWords(e.target.value, 20))}
                placeholder="Example: Bestby Bites Bakery"
                autoComplete="organization"
              />
              <div className="store-details-counter" aria-live="polite">
                {countWords(storeName)}/20 words
              </div>
            </div>

            <div className="store-details-field">
              <label htmlFor="store-description">Store description</label>
              <textarea
                id="store-description"
                value={storeDescription}
                onChange={(e) => setStoreDescription(truncateToWords(e.target.value, 200))}
                placeholder="Tell customers what you sell and what they can expect in Surprise Bags."
                rows={4}
              />
              <div className="store-details-counter" aria-live="polite">
                {countWords(storeDescription)}/200 words
              </div>
            </div>
          </div>

          <div className="store-details-actions">
            <button
              type="button"
              className="store-details-continue"
              onClick={handleContinue}
              disabled={!canContinue}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </OnboardingSplitLayout>
  );
}
