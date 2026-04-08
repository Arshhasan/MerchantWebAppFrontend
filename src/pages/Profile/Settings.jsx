import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { updateDocument } from '../../firebase/firestore';
import './Profile.css';

const Settings = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  });
  const [dashboardAvatarSource, setDashboardAvatarSource] = useState('outlet');
  const [savingAvatarPref, setSavingAvatarPref] = useState(false);

  useEffect(() => {
    const src = userProfile?.dashboardAvatarSource;
    if (src === 'google' || src === 'outlet') {
      setDashboardAvatarSource(src);
    }
  }, [userProfile?.dashboardAvatarSource]);

  const handleToggle = (key) => {
    setSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const handleDashboardAvatarChange = async (value) => {
    if (!user?.uid) {
      showToast('You must be signed in', 'error');
      return;
    }
    setDashboardAvatarSource(value);
    setSavingAvatarPref(true);
    const res = await updateDocument('users', user.uid, { dashboardAvatarSource: value });
    setSavingAvatarPref(false);
    if (res.success) {
      showToast('Dashboard photo preference saved', 'success');
    } else {
      showToast(res.error || 'Could not save preference', 'error');
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Settings</h1>
      </div>

      <div className="card">
        <h2>Dashboard photo</h2>
        <p className="settings-hint">
          Choose which image appears on your home dashboard next to your store name.
        </p>
        <div className="setting-item dashboard-photo-choice">
          <label className="radio-row">
            <input
              type="radio"
              name="dashboardAvatarSource"
              value="google"
              checked={dashboardAvatarSource === 'google'}
              onChange={() => handleDashboardAvatarChange('google')}
              disabled={savingAvatarPref}
            />
            <span>Google account photo</span>
          </label>
          <label className="radio-row">
            <input
              type="radio"
              name="dashboardAvatarSource"
              value="outlet"
              checked={dashboardAvatarSource === 'outlet'}
              onChange={() => handleDashboardAvatarChange('outlet')}
              disabled={savingAvatarPref}
            />
            <span>Store photo from outlet information</span>
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Notification Settings</h2>
        <div className="setting-item">
          <div className="setting-info">
            <h3>Enable Notifications</h3>
            <p>Receive notifications for new orders and updates</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={() => handleToggle('notifications')}
            />
            <span className="slider"></span>
          </label>
        </div>

        {settings.notifications && (
          <div className="notification-options">
            <div className="setting-item">
              <div className="setting-info">
                <h3>Email Notifications</h3>
                <p>Receive notifications via email</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={() => handleToggle('emailNotifications')}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-item">
              <div className="setting-info">
                <h3>SMS Notifications</h3>
                <p>Receive notifications via SMS</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={() => handleToggle('smsNotifications')}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-item">
              <div className="setting-info">
                <h3>Push Notifications</h3>
                <p>Receive push notifications on device</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={() => handleToggle('pushNotifications')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
