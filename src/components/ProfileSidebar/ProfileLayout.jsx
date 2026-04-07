import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ProfileSidebar from './ProfileSidebar';
import './ProfileSidebar.css';

/** Matches Layout.jsx `hideNavForOnboarding` — no left profile nav during onboarding. */
function useHideProfileSidebarForOnboarding() {
  const location = useLocation();
  const {
    needsCategorySetup,
    needsCategorySelection,
    needsOutletLocationSetup,
    needsStoreDetailsSetup,
    needsFirstBagSetup,
  } = useAuth();

  return (
    needsCategorySetup
    || needsCategorySelection
    || needsOutletLocationSetup
    || needsStoreDetailsSetup
    || needsFirstBagSetup
    || location.search.includes('onboarding=1')
  );
}

export default function ProfileLayout({ children }) {
  const hideSidebar = useHideProfileSidebarForOnboarding();

  return (
    <div
      className={
        hideSidebar
          ? 'profile-layout profile-layout--onboarding'
          : 'profile-layout'
      }
    >
      {!hideSidebar && (
        <aside className="profile-layout__sidebar">
          <ProfileSidebar />
        </aside>
      )}
      <main className="profile-layout__content">{children}</main>
    </div>
  );
}

