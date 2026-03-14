import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import './Profile.css';

const Settings = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    autoPrinting: false,
    notifications: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  });

  const handleToggle = (key) => {
    setSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <h2>Printing Settings</h2>
        <div className="setting-item">
          <div className="setting-info">
            <h3>Auto Printing</h3>
            <p>Automatically print orders when confirmed</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoPrinting}
              onChange={() => handleToggle('autoPrinting')}
            />
            <span className="slider"></span>
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
