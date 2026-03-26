import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { profileNavSections } from '../../components/ProfileSidebar/profileNavConfig';
import { getProfileIcon } from '../../components/ProfileSidebar/profileIcons';

const Profile = ({ onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      if (onLogout) {
        onLogout();
      } else {
        localStorage.removeItem('isAuthenticated');
      }
      navigate('/');
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Profile</h1>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="profile-sections">
        {profileNavSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="profile-section">
            <h3 className="section-title">{section.title}</h3>
            <div className="section-items">
              {section.items.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="profile-item"
                  onClick={() => {
                    if (item.action === 'logout') {
                      handleLogout();
                    } else if (item.path !== '#') {
                      navigate(item.path);
                    }
                  }}
                >
                  <div className="profile-icon">{getProfileIcon(item.icon)}</div>
                  <span className="profile-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="profile-bottom-logo">
        <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png" alt="BestBy Bites Merchant Logo" />
      </div>
    </div>
  );
};

export default Profile;
