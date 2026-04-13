import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { resolveMerchantCurrencyCode } from '../utils/countryCurrency';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeProfile = null;
    let unsubscribeVendor = null;
    let unsubscribeAuth = () => {};

    /** Defer Firebase so auth entry routes (login/register) can parse React + route chunks first. */
    (async () => {
      try {
        const [{ onAuthChange }, { doc, onSnapshot }, { db }] = await Promise.all([
          import('../firebase/auth'),
          import('firebase/firestore'),
          import('../firebase/config'),
        ]);
        if (cancelled) return;

        unsubscribeAuth = onAuthChange(async (firebaseUser) => {
          setUser(firebaseUser);

          if (!firebaseUser) {
            setUserProfile(null);
            setVendorProfile(null);
            setProfileLoading(false);
            setVendorLoading(false);
            setLoading(false);
            if (unsubscribeProfile) {
              unsubscribeProfile();
              unsubscribeProfile = null;
            }
            if (unsubscribeVendor) {
              unsubscribeVendor();
              unsubscribeVendor = null;
            }
            return;
          }

          try {
            setProfileLoading(true);

            if (unsubscribeProfile) {
              unsubscribeProfile();
              unsubscribeProfile = null;
            }

            const userDocRef = doc(db, 'users', firebaseUser.uid);
            unsubscribeProfile = onSnapshot(
              userDocRef,
              (snap) => {
                if (snap.exists()) {
                  const nextProfile = { id: snap.id, ...snap.data() };
                  setUserProfile(nextProfile);

                  const vendorId = nextProfile.vendorID;
                  if (unsubscribeVendor) {
                    unsubscribeVendor();
                    unsubscribeVendor = null;
                  }

                  if (vendorId) {
                    setVendorLoading(true);
                    const vendorDocRef = doc(db, 'vendors', vendorId);
                    unsubscribeVendor = onSnapshot(
                      vendorDocRef,
                      (vendorSnap) => {
                        if (vendorSnap.exists()) {
                          setVendorProfile({ id: vendorSnap.id, ...vendorSnap.data() });
                        } else {
                          setVendorProfile(null);
                        }
                        setVendorLoading(false);
                      },
                      () => {
                        setVendorProfile(null);
                        setVendorLoading(false);
                      }
                    );
                  } else {
                    setVendorProfile(null);
                    setVendorLoading(false);
                  }
                } else {
                  setUserProfile(null);
                  setVendorProfile(null);
                }
                setProfileLoading(false);
              },
              () => {
                setUserProfile(null);
                setVendorProfile(null);
                setProfileLoading(false);
              }
            );
          } catch {
            setUserProfile(null);
            setVendorProfile(null);
            setLoading(false);
            setProfileLoading(false);
            setVendorLoading(false);
            return;
          } finally {
            setLoading(false);
          }
        });
      } catch {
        setLoading(false);
        setProfileLoading(false);
        setVendorLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeVendor) unsubscribeVendor();
    };
  }, []);

  const isOutletComplete = useMemo(() => {
    if (!vendorProfile) return false;
    return !!(
      vendorProfile.title &&
      vendorProfile.description &&
      vendorProfile.email &&
      vendorProfile.phonenumber &&
      vendorProfile.location &&
      typeof vendorProfile.latitude === 'number' &&
      typeof vendorProfile.longitude === 'number'
    );
  }, [vendorProfile]);

  const hasStoreDetails = useMemo(() => {
    if (!vendorProfile) return false;
    return !!(vendorProfile.title && vendorProfile.description);
  }, [vendorProfile]);

  const hasCreatedFirstBag = useMemo(() => {
    if (!vendorProfile) return false;
    return vendorProfile.hasCreatedFirstBag === true;
  }, [vendorProfile]);

  const hasOutletLocation = useMemo(() => {
    if (!vendorProfile) return false;
    return !!(
      typeof vendorProfile.latitude === 'number' &&
      typeof vendorProfile.longitude === 'number'
    );
  }, [vendorProfile]);

  const hasCategory = useMemo(() => {
    if (!vendorProfile) return false;
    if (vendorProfile.business_category) return true;
    // Back-compat for older vendors (pre-migration)
    const ids = Array.isArray(vendorProfile.categoryID)
      ? vendorProfile.categoryID
      : (vendorProfile.categoryID ? [vendorProfile.categoryID] : []);
    return ids.length > 0;
  }, [vendorProfile]);

  /** Merge into in-memory vendor so onboarding flags update before the next Firestore snapshot (avoids redirect race). */
  const patchVendorProfile = useCallback((partial) => {
    setVendorProfile((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const merchantCurrencyCode = useMemo(
    () => resolveMerchantCurrencyCode(vendorProfile),
    [vendorProfile]
  );

  const value = {
    user,
    loading,
    profileLoading,
    vendorLoading,
    userProfile,
    vendorProfile,
    merchantCurrencyCode,
    patchVendorProfile,
    isAuthenticated: !!user,
    // Onboarding steps:
    // 1) Need vendorID -> Business Category
    needsCategorySetup: !!user && !profileLoading && !(userProfile && userProfile.vendorID),
    // 2) Have vendorID but no category selected yet -> Business Category
    needsCategorySelection: !!user && !profileLoading && !vendorLoading && !!(userProfile && userProfile.vendorID) && !hasCategory,
    // 3) Have vendorID + category but missing store name/description -> Store Details
    needsStoreDetailsSetup: !!user && !profileLoading && !vendorLoading && !!(userProfile && userProfile.vendorID) && hasCategory && !hasStoreDetails,
    // 4) Have vendorID + category + store details but no outlet location yet -> Outlet Location
    needsOutletLocationSetup: !!user && !profileLoading && !vendorLoading && !!(userProfile && userProfile.vendorID) && hasCategory && hasStoreDetails && !hasOutletLocation,
    // 5) After store details, guide user to create first bag (one-time)
    needsFirstBagSetup: !!user && !profileLoading && !vendorLoading && !!(userProfile && userProfile.vendorID) && hasCategory && hasOutletLocation && hasStoreDetails && !hasCreatedFirstBag,
    // Legacy: outlet info completion (still used for Manage Store screens, not onboarding routing)
    needsOutletSetup: !!user && !profileLoading && !vendorLoading && !!(userProfile && userProfile.vendorID) && hasCategory && hasOutletLocation && !isOutletComplete,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
