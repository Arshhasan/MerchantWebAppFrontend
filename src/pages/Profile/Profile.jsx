import { useNavigate } from 'react-router-dom';
import './Profile.css';

const Profile = ({ onLogout }) => {
  const navigate = useNavigate();

  const menuSections = [
    {
      title: 'Manage Store',
      items: [
        { label: 'Outlet info', icon: 'info', path: '/manage-store' },
        { label: 'Outlet timings', icon: 'clock', path: '/manage-store' },
        { label: 'Phone numbers', icon: 'phone', path: '/manage-store' },
        { label: 'Manage staff', icon: 'staff', path: '/manage-store' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'Settings', icon: 'settings', path: '/settings' },
        { label: 'Manage Communication', icon: 'bell', path: '/settings' },
        { label: 'Schedule off', icon: 'schedule', path: '/settings' },
        { label: 'Logout', icon: 'logout', path: 'logout', action: 'logout' },
      ],
    },
    {
      title: 'Orders',
      items: [
        { label: 'Order history', icon: 'history', path: '/profile-orders' },
        { label: 'Complaints', icon: 'complaint', path: '/profile-orders' },
        { label: 'Reviews', icon: 'review', path: '/profile-orders' },
      ],
    },
    {
      title: 'Accounting',
      items: [
        { label: 'Payout', icon: 'payout', path: '/payout' },
        { label: 'Invoices', icon: 'invoice', path: '/invoice-taxes' },
        { label: 'Taxes', icon: 'tax', path: '/invoice-taxes' },
      ],
    },
    {
      title: 'Help',
      items: [
        { label: 'Help centre', icon: 'help', path: '#' },
        { label: 'Learning centre', icon: 'learning', path: '#' },
        { label: 'Share your feedback', icon: 'feedback', path: '#' },
      ],
    },
  ];

  const getIcon = (iconType) => {
    const icons = {
      info: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      clock: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      phone: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 16.92V19.92C22 20.52 21.52 21 20.92 21C9.4 21 0 11.6 0 0.08C0 -0.52 0.48 -1 1.08 -1H4.08C4.68 -1 5.16 -0.52 5.16 0.08C5.16 1.08 5.28 2.04 5.52 2.96C5.64 3.4 5.56 3.88 5.24 4.2L3.68 5.76C4.96 8.48 7.52 11.04 10.24 12.32L11.8 10.76C12.12 10.44 12.6 10.36 13.04 10.48C13.96 10.72 14.92 10.84 15.92 10.84C16.52 10.84 17 11.32 17 11.92V14.92C17 15.52 16.52 16 15.92 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      staff: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      settings: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0396 19.206C15.7142 19.1472 15.3796 19.1869 15.078 19.32C14.7842 19.4468 14.532 19.6572 14.35 19.93L14.12 20.21C13.8842 20.4578 13.5871 20.6389 13.26 20.7347C12.9329 20.8305 12.5873 20.8376 12.256 20.7553C11.9247 20.673 11.6201 20.5038 11.375 20.265C11.1299 20.0262 10.9532 19.7264 10.864 19.4L10.58 18.41C10.5014 18.1222 10.3453 17.8616 10.13 17.66C9.91466 17.4584 9.64919 17.3243 9.36 17.27L8.34 17.05C8.04937 16.9952 7.77159 16.8846 7.525 16.725C7.27841 16.5654 7.06852 16.3604 6.91 16.12L6.62 15.67C6.45677 15.4216 6.35226 15.1401 6.314 14.85C6.27574 14.5599 6.30473 14.2647 6.39874 13.987C6.49275 13.7093 6.64908 13.4567 6.856 13.25L7.05 13.06C7.25059 12.8447 7.38466 12.5792 7.44 12.29L7.66 11.27C7.71477 10.9804 7.82536 10.7026 7.98496 10.456C8.14456 10.2094 8.34959 9.99952 8.59 9.84L9.04 9.55C9.28937 9.38677 9.57088 9.28226 9.861 9.244C10.1511 9.20574 10.4463 9.23473 10.724 9.32874C11.0017 9.42275 11.2543 9.57908 11.46 9.786L11.65 9.98C11.8516 10.1953 12.1122 10.3514 12.4 10.43L13.39 10.714C13.7164 10.8032 14.0162 10.9799 14.255 11.225C14.4938 11.4701 14.663 11.7747 14.7453 12.106C14.8276 12.4373 14.8205 12.7829 14.7247 13.11C14.6289 13.4371 14.4478 13.7342 14.2 13.97L13.92 14.2C13.6472 14.382 13.4368 14.6342 13.31 14.928C13.1769 15.2296 13.1372 15.5642 13.196 15.8886C13.2548 16.213 13.4095 16.5123 13.64 16.748L13.7 16.808C13.8857 16.994 14.1063 17.1415 14.3491 17.2421C14.5919 17.3428 14.8522 17.3946 15.115 17.3946C15.3778 17.3946 15.6381 17.3428 15.8809 17.2421C16.1237 17.1415 16.3443 16.994 16.53 16.808L16.59 16.748C16.8257 16.5175 17.125 16.3628 17.4494 16.304C17.7738 16.2452 18.1084 16.2849 18.41 16.418L18.4 16.41Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      bell: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      schedule: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
          <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M3 10H21" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      history: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3V9H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 21V15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 10C21 14.9706 16.9706 19 12 19C7.02944 19 3 14.9706 3 10C3 5.02944 7.02944 1 12 1C16.9706 1 21 5.02944 21 10Z" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 6V10L14 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      complaint: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 9H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M15 9H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      review: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 8L13.09 10.26L15.5 10.61L13.68 12.39L14.18 14.89L12 13.65L9.82 14.89L10.32 12.39L8.5 10.61L10.91 10.26L12 8Z" fill="currentColor"/>
        </svg>
      ),
      payout: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 9V7C17 6.46957 16.7893 5.96086 16.4142 5.58579C16.0391 5.21071 15.5304 5 15 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19H15C15.5304 19 16.0391 18.7893 16.4142 18.4142C16.7893 18.0391 17 17.5304 17 17V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 9H11C10.4477 9 10 9.44772 10 10V14C10 14.5523 10.4477 15 11 15H21C21.5523 15 22 14.5523 22 14V10C22 9.44772 21.5523 9 21 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      invoice: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 11V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 15V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M10 9C10 8.44772 10.4477 8 11 8H13C13.5523 8 14 8.44772 14 9C14 9.55228 13.5523 10 13 10H11C10.4477 10 10 9.55228 10 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      tax: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3H21V21H3V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 9H21" stroke="currentColor" strokeWidth="2"/>
          <path d="M9 3V21" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      help: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 9C9 7.89543 9.89543 7 11 7H13C14.1046 7 15 7.89543 15 9C15 10.1046 14.1046 11 13 11H11C9.89543 11 9 11.8954 9 13C9 14.1046 9.89543 15 11 15H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      learning: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      feedback: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      logout: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    };
    return icons[iconType] || icons.info;
  };

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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="store-info-card" onClick={() => navigate('/manage-store')}>
        <div className="store-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 21V7L13 2L21 7V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 9V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15 9V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="store-info">
          <h2>Burger Wings</h2>
          <p>Bridge Street</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="arrow-icon">
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div className="profile-sections">
        {menuSections.map((section, sectionIndex) => (
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
                  <div className="profile-icon">{getIcon(item.icon)}</div>
                  <span className="profile-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="profile-footer">
        <div className="footer-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8 2 5 5.5 5 9.5C5 12 6.5 14 8.5 15.5C9.5 16.2 10.5 16.5 11.5 16.5C12.5 16.5 13.5 16.2 14.5 15.5C16.5 14 18 12 18 9.5C18 5.5 15 2 12 2Z" fill="var(--primary-green)"/>
            <path d="M12 2L9 7L12 9L15 7L12 2Z" fill="white"/>
            <path d="M12 9L9 13L12 15L15 13L12 9Z" fill="white"/>
            <path d="M12 15L10.5 18.5L12 20L13.5 18.5L12 15Z" fill="white"/>
            <path d="M12 2L10 6L12 8L14 6L12 2Z" stroke="var(--primary-green)" strokeWidth="0.5" fill="none"/>
          </svg>
        </div>
        <h3 className="footer-brand">bestby bites</h3>
        <p className="footer-tagline">FOOD MARKETPLACE</p>
      </div>
    </div>
  );
};

export default Profile;
