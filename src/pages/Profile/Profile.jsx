import { useNavigate } from 'react-router-dom';
import './Profile.css';

const Profile = ({ onLogout }) => {
  const navigate = useNavigate();

  const menuSections = [
    {
      title: 'Manage Store',
      items: [
        { label: 'Outlet info', icon: 'info', path: '/outlet-info' },
        { label: 'Outlet timings', icon: 'clock', path: '/outlet-timings' },
        { label: 'Phone numbers', icon: 'phone', path: '/phone-numbers' },
        { label: 'Manage staff', icon: 'staff', path: '/manage-staff' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'Settings', icon: 'settings', path: '/settings' },
        { label: 'Manage Communication', icon: 'bell', path: '/manage-communication' },
        { label: 'Schedule off', icon: 'schedule', path: '/schedule-off' },
      ],
    },
    {
      title: 'Orders',
      items: [
        { label: 'Order history', icon: 'history', path: '/order-history' },
        { label: 'Complaints', icon: 'complaint', path: '/complaints' },
        { label: 'Reviews', icon: 'review', path: '/reviews' },
      ],
    },
    {
      title: 'Accounting',
      items: [
        { label: 'Payout', icon: 'payout', path: '/payout' },
        { label: 'Invoices', icon: 'invoice', path: '/invoices' },
        { label: 'Taxes', icon: 'tax', path: '/taxes' },
      ],
    },
    {
      title: 'Help',
      items: [
        { label: 'Help centre', icon: 'help', path: '/help-centre' },
        { label: 'Learning centre', icon: 'learning', path: '/learning-centre' },
        { label: 'Share your feedback', icon: 'feedback', path: '/share-feedback' },
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
        <img
          src="/phone-call.png"
          alt="Phone numbers"
        />
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
        <img
          src="/settings.png"
          alt="Settings"
        />
      ),
      bell: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      schedule: (
        <img
          width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"
          src="/scheduleoff.png"
          alt="Schedule off"
        />
      ),
      history: (
        <img
          src="/orderhistry.png"
          alt="Order history"
        />
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
        <img
          src="/review.png"
          alt="Reviews"
        />
      ),
      payout: (
        <img
          src="/wallet.png"
          alt="Payout"
        />
      ),
      invoice: (
        <img
          src="/invoice.png"
          alt="Invoices"
        />
      ),
      tax: (
        <img
          src="/tax.png"
          alt="Taxes"
        />
      ),
      help: (
        <img
          src="/customer-service.png"
          alt="Help centre"
        />
      ),
      learning: (
        // <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        //   <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        //   <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        //   <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        // </svg>
        <img
          src="/learningcenter.png"
          alt="Learning centre"
        />
      ),
      feedback: (
        <img
          src="/feedback.png"
          alt="Feedback"
        />
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
          Logout
        </button>
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

      <div className="profile-bottom-logo">
        <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png" alt="BestBy Bites Merchant Logo" />
      </div>
    </div>
  );
};

export default Profile;
