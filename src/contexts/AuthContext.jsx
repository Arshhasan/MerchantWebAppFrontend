import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthChange } from '../firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

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
    let unsubscribeProfile = null;
    let unsubscribeVendor = null;

    // Listen to authentication state changes
    const unsubscribeAuth = onAuthChange(async (firebaseUser) => {
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

        // Subscribe to user profile changes so onboarding state updates immediately
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

              // Subscribe to vendor profile whenever vendorID changes
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

    // Cleanup subscription on unmount
    return () => {
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
      typeof vendorProfile.longitude === 'number' &&
      vendorProfile.zoneId
    );
  }, [vendorProfile]);

  const hasCategory = useMemo(() => {
    if (!vendorProfile) return false;
    const ids = Array.isArray(vendorProfile.categoryID)
      ? vendorProfile.categoryID
      : (vendorProfile.categoryID ? [vendorProfile.categoryID] : []);
    return ids.length > 0;
  }, [vendorProfile]);

  const value = {
    user,
    loading,
    profileLoading,
    vendorLoading,
    userProfile,
    vendorProfile,
    isAuthenticated: !!user,
    // Onboarding steps:
    // 1) Need vendorID -> Business Category
    needsCategorySetup: !!user && !profileLoading && !(userProfile && userProfile.vendorID),
    // 2) Have vendorID but no category selected yet -> Business Category
    needsCategorySelection: !!user && !profileLoading && !vendorLoading && !!(userProfile && userProfile.vendorID) && !hasCategory,
    // 3) Have vendorID + category but outlet details not completed -> Outlet Info
    needsOutletSetup: !!user && !profileLoading && !vendorLoading && !!(userProfile && userProfile.vendorID) && hasCategory && !isOutletComplete,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
