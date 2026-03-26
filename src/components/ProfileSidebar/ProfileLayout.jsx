import ProfileSidebar from './ProfileSidebar';
import './ProfileSidebar.css';

export default function ProfileLayout({ children }) {
  return (
    <div className="profile-layout">
      <aside className="profile-layout__sidebar">
        <ProfileSidebar />
      </aside>
      <main className="profile-layout__content">{children}</main>
    </div>
  );
}

