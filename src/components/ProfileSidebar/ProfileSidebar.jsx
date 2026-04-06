import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signOutUser } from '../../firebase/auth';
import { profileNavSections } from './profileNavConfig';
import { getProfileIcon } from './profileIcons';
import './ProfileSidebar.css';

function isActivePath(pathname, item) {
  if (pathname === item.path) return true;
  if (item.aliases?.some((p) => p === pathname)) return true;
  // Also treat nested routes as active if they start with the item path.
  if (item.path !== '/' && pathname.startsWith(item.path)) return true;
  return false;
}

/**
 * @param {{ onItemSelect?: () => void, variant?: 'default' | 'drawer' }} props
 */
export default function ProfileSidebar({ onItemSelect, variant = 'default' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDrawer = variant === 'drawer';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const collapsed = isDrawer ? false : isSidebarCollapsed;
  const [openSectionKey, setOpenSectionKey] = useState(
    profileNavSections[0]?.title || 'Manage Store'
  );

  const allItems = useMemo(
    () => profileNavSections.flatMap((section) => section.items),
    []
  );

  const goTo = (path) => {
    navigate(path);
    onItemSelect?.();
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      onItemSelect?.();
      navigate('/login');
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  return (
    <nav
      className={`profile-sidebar ${collapsed ? 'is-collapsed' : ''}${isDrawer ? ' profile-sidebar--drawer' : ''}`}
      aria-label="Profile navigation"
    >
      {!isDrawer ? (
        <div className="profile-sidebar__brand">
          <button
            type="button"
            className="profile-sidebar__toggle"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}

      <div className="profile-sidebar__sections">
        {collapsed ? (
          <div className="profile-sidebar__items is-open">
            {allItems.map((item) => {
              const active = isActivePath(location.pathname, item);
              return (
                <button
                  key={item.path}
                  type="button"
                  className={`profile-sidebar__item ${active ? 'is-active' : ''}`}
                  onClick={() => goTo(item.path)}
                >
                  <span className="profile-sidebar__icon" aria-hidden="true">
                    {getProfileIcon(item.icon)}
                  </span>
                  <span className="profile-sidebar__label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          profileNavSections.map((section) => {
            const isOpen = openSectionKey === section.title;
            return (
              <div key={section.title} className={`profile-sidebar__section ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="profile-sidebar__sectionHeader"
                  onClick={() =>
                    setOpenSectionKey((prev) =>
                      prev === section.title ? null : section.title
                    )
                  }
                  aria-expanded={isOpen}
                >
                  <span className="profile-sidebar__sectionTitle">{section.title}</span>
                  <span className="profile-sidebar__sectionChevron" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                <div className={`profile-sidebar__items ${isOpen ? 'is-open' : ''}`}>
                  {section.items.map((item) => {
                    const itemKey = `${section.title}-${item.path}`;
                    const active = isActivePath(location.pathname, item);
                    return (
                      <button
                        key={itemKey}
                        type="button"
                        className={`profile-sidebar__item ${active ? 'is-active' : ''}`}
                        onClick={() => goTo(item.path)}
                      >
                        <span className="profile-sidebar__icon" aria-hidden="true">
                          {getProfileIcon(item.icon)}
                        </span>
                        <span className="profile-sidebar__label">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="profile-sidebar__footer">
        <button
          type="button"
          className="profile-sidebar__logout"
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </nav>
  );
}

