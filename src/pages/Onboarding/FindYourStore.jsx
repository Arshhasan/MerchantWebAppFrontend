import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import OnboardingSplitLayout from '../../components/OnboardingSplitLayout/OnboardingSplitLayout';
import { publicUrl } from '../../utils/publicUrl';
import {
  placeResultToFirestore,
  vendorFieldsFromSavedPlace,
} from '../../utils/googlePlaceFirestore';
import './FindYourStore.css';

const FindStoreSearchBar = lazy(() => import('../../components/FindStoreSearchBar/FindStoreSearchBar'));

function SearchFallback() {
  return (
    <div className="find-store-search-bar__loading" style={{ marginTop: 8 }}>
      Loading search…
    </div>
  );
}

export default function FindYourStore() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile, patchVendorProfile } = useAuth();
  const { showToast } = useToast();

  const [searchText, setSearchText] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [saving, setSaving] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const howItWorksVideoRef = useRef(null);

  useEffect(() => {
    if (!videoModalOpen && howItWorksVideoRef.current) {
      howItWorksVideoRef.current.pause();
      howItWorksVideoRef.current.currentTime = 0;
    }
  }, [videoModalOpen]);

  useEffect(() => {
    if (!videoModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setVideoModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [videoModalOpen]);

  const onboardingQ = useMemo(
    () => (searchParams.get('onboarding') === '1' ? '?onboarding=1' : ''),
    [searchParams]
  );

  useEffect(() => {
    if (userProfile?.vendorID) {
      navigate(`/business-category${onboardingQ}`, { replace: true });
    }
  }, [userProfile?.vendorID, navigate, onboardingQ]);

  const onPlaceSelected = useCallback((place) => {
    setSelectedPlace(place || null);
    const name = (place?.name || '').toString().trim();
    const formatted = (place?.formatted_address || '').toString().trim();
    // UX: show only the business name in the input (addresses are long + cluttered).
    // Keep full place details in `selectedPlace` for saving to the backend.
    if (name) setSearchText(name);
    else if (formatted) setSearchText(formatted.split(',')[0]?.trim() || formatted);
  }, []);

  const canContinue =
    !!selectedPlace?.place_id
    && !saving
    && !!user;

  const handleContinue = async () => {
    if (!user || !selectedPlace?.place_id) {
      showToast('Please select your store from the search results.', 'error');
      return;
    }

    const raw = placeResultToFirestore(selectedPlace);
    if (!raw) {
      showToast('Could not read place details. Try selecting again.', 'error');
      return;
    }

    const { title, description, latitude, longitude } = vendorFieldsFromSavedPlace(raw);

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
          onboardingGooglePlace: raw,
          title: title || 'Store',
          description: description || title || '',
          ...(latitude != null && longitude != null
            ? { latitude, longitude }
            : {}),
          ...(user.email ? { email: user.email } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      patchVendorProfile({
        id: vendorId,
        onboardingGooglePlace: raw,
        title: title || 'Store',
        description: description || title || '',
        ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
      });

      navigate(`/business-category${onboardingQ}`, { replace: true });
    } catch (e) {
      showToast(e?.message || 'Failed to save your store', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingSplitLayout
      showHelpButton={false}
      faqsTitle="Find Your Store FAQs"
      faqs={[
        {
          id: 'fys-1',
          q: 'Why should I select my store from search results?',
          a: 'Selecting from results helps us capture accurate location details so customers can find you and pickup timings work correctly.',
        },
        {
          id: 'fys-2',
          q: 'My store doesn’t appear in the list. What now?',
          a: 'Try searching with a different spelling, nearby landmark, or your exact address. If it still doesn’t appear, continue with the closest match and update details later in Outlet Information.',
        },
        {
          id: 'fys-3',
          q: 'Will customers see this info?',
          a: 'Yes — store name and location help customers discover your Surprise Bags and navigate to pickup.',
        },
      ]}
    >
      <div className="find-your-store-page">
        <div className="find-your-store-hero">
          <img
            className="find-your-store-hero__img"
            src={publicUrl('loginbg.jpg')}
            alt=""
          />
          <button
            type="button"
            className="find-your-store-hero__video"
            aria-haspopup="dialog"
            aria-expanded={videoModalOpen}
            onClick={() => setVideoModalOpen(true)}
          >
            <span className="find-your-store-hero__video-icon" aria-hidden="true">
              ▶
            </span>
            <span className="find-your-store-hero__video-text">How Bestby Bites works</span>
          </button>
        </div>

        {videoModalOpen ? (
          <div
            className="find-your-store-video-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="find-store-how-it-works-title"
            onClick={() => setVideoModalOpen(false)}
          >
            <div
              className="find-your-store-video-modal__panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="find-your-store-video-modal__head">
                <h2 id="find-store-how-it-works-title" className="find-your-store-video-modal__title">
                  How Bestby Bites works
                </h2>
                <button
                  type="button"
                  className="find-your-store-video-modal__close"
                  aria-label="Close video"
                  onClick={() => setVideoModalOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="find-your-store-video-modal__body">
                <video
                  ref={howItWorksVideoRef}
                  className="find-your-store-video-modal__video"
                  controls
                  playsInline
                  preload="metadata"
                  autoPlay
                >
                  <source src={publicUrl('video.mp4')} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
        ) : null}

        <h2 className="find-your-store-heading">Sign up your business</h2>
        <p className="find-your-store-sub">
          Let&apos;s find your store and get you started. It will only take a few minutes!
        </p>

        <div className="find-your-store-search-wrap">
          <Suspense fallback={<SearchFallback />}>
            <FindStoreSearchBar
              value={searchText}
              onChangeText={(t) => {
                setSearchText(t);
                setSelectedPlace(null);
              }}
              onPlaceSelected={onPlaceSelected}
              placeholder="Search for your store name or address"
              disabled={saving}
            />
          </Suspense>
          {selectedPlace?.name && selectedPlace?.formatted_address ? (
            <div className="find-your-store-selected-address" aria-live="polite">
              <div className="find-your-store-selected-address__name">
                {selectedPlace.name}
              </div>
              <div className="find-your-store-selected-address__full">
                {selectedPlace.formatted_address}
              </div>
            </div>
          ) : selectedPlace?.formatted_address ? (
            <div className="find-your-store-selected-address" aria-live="polite">
              <div className="find-your-store-selected-address__full">
                {selectedPlace.formatted_address}
              </div>
            </div>
          ) : null}
          <p className="find-your-store-hint">
            Pick your business from the Google results so we can save your store details.
          </p>
        </div>

        <button
          type="button"
          className="find-your-store-continue"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </OnboardingSplitLayout>
  );
}
