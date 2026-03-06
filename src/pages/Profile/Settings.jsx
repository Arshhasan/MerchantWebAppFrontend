import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import './Profile.css';

const Settings = ({ onLogout }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    autoPrinting: false,
    notifications: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  });

  const [scheduleOff, setScheduleOff] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });

  const handleToggle = (key) => {
    setSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const handleScheduleOff = (e) => {
    e.preventDefault();
    console.log('Schedule Off:', scheduleOff);
    showToast('Schedule off saved!', 'success');
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

      <div className="card">
        <h2>Schedule Off</h2>
        <form onSubmit={handleScheduleOff}>
          <div className="input-group">
            <label>Start Date</label>
            <input
              type="date"
              value={scheduleOff.startDate}
              onChange={(e) =>
                setScheduleOff({ ...scheduleOff, startDate: e.target.value })
              }
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div className="input-group">
            <label>End Date</label>
            <input
              type="date"
              value={scheduleOff.endDate}
              onChange={(e) =>
                setScheduleOff({ ...scheduleOff, endDate: e.target.value })
              }
              min={scheduleOff.startDate || new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div className="input-group">
            <label>Reason</label>
            <textarea
              value={scheduleOff.reason}
              onChange={(e) =>
                setScheduleOff({ ...scheduleOff, reason: e.target.value })
              }
              placeholder="Enter reason for schedule off"
              rows="3"
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Schedule Off
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Account</h2>
        <div className="setting-item">
          <div className="setting-info">
            <h3>Logout</h3>
            <p>Sign out from your merchant account</p>
          </div>
          <button onClick={handleLogout} className="btn btn-danger">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
