import { createContext, useContext, useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let unsubscribeProfile = null;

    // Listen to authentication state changes
    const unsubscribeAuth = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setUserProfile(null);
        setProfileLoading(false);
        setLoading(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
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
              setUserProfile({ id: snap.id, ...snap.data() });
            } else {
              setUserProfile(null);
            }
            setProfileLoading(false);
          },
          () => {
            setUserProfile(null);
            setProfileLoading(false);
          }
        );
      } catch {
        setUserProfile(null);
        setLoading(false);
        setProfileLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = {
    user,
    loading,
    profileLoading,
    userProfile,
    isAuthenticated: !!user,
    // Onboarding requirement: force Outlet Info until vendorID is set
    needsOutletSetup: !!user && !profileLoading && !(userProfile && userProfile.vendorID),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
