import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument, createDocument, updateDocument } from '../../firebase/firestore';
import './ManageCommunication.css';

const ManageCommunication = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    whatsappNotifications: true,
    orderNotifications: true,
    ringVolume: 30,
    dailyReports: {
      whatsapp: false,
      email: false,
    },
    weeklyReports: {
      whatsapp: true,
      email: true,
    },
  });

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await getDocument('merchant_communication_settings', user.uid);
      
      if (result.success && result.data) {
        setSettings({
          whatsappNotifications: result.data.whatsappNotifications ?? true,
          orderNotifications: result.data.orderNotifications ?? true,
          ringVolume: result.data.ringVolume ?? 30,
          dailyReports: {
            whatsapp: result.data.dailyReports?.whatsapp ?? false,
            email: result.data.dailyReports?.email ?? false,
          },
          weeklyReports: {
            whatsapp: result.data.weeklyReports?.whatsapp ?? true,
            email: result.data.weeklyReports?.email ?? true,
          },
        });
      }
    } catch (error) {
      console.error('Error loading communication settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (field, value) => {
    const newSettings = { ...settings };
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      newSettings[parent] = {
        ...newSettings[parent],
        [child]: value,
      };
    } else {
      newSettings[field] = value;
    }
    
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleRingVolumeChange = async (value) => {
    const newSettings = { ...settings, ringVolume: parseInt(value) };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const saveSettings = async (settingsToSave) => {
    if (!user) return;

    try {
      setSaving(true);
      const existingDoc = await getDocument('merchant_communication_settings', user.uid);
      
      const settingsData = {
        merchantId: user.uid,
        ...settingsToSave,
      };

      if (existingDoc.success && existingDoc.data) {
        await updateDocument('merchant_communication_settings', user.uid, settingsData);
      } else {
        await createDocument('merchant_communication_settings', settingsData, user.uid);
      }
    } catch (error) {
      console.error('Error saving communication settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="manage-communication-page">
        <div className="page-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Manage communications</h1>
        </div>
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-communication-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Manage communications</h1>
      </div>

      <div className="communication-content">
        {/* WhatsApp Notifications */}
        <div className="communication-section">
          <div className="section-header">
            <div className="section-title-with-icon">
              <svg className="section-icon whatsapp-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" fill="#25D366"/>
              </svg>
              <h2>WhatsApp notifications</h2>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.whatsappNotifications}
                onChange={(e) => handleToggle('whatsappNotifications', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <p className="section-description">
            Receive updates and other reminders related to your restaurant on WhatsApp (+91 7838012503).
          </p>
        </div>

        {/* Business Reports */}
        <div className="communication-section">
          <h2 className="section-title">Business Reports</h2>
          
          {/* Daily Reports */}
          <div className="report-subsection">
            <div className="subsection-header">
              <h3>Daily Reports</h3>
              <p className="subsection-description">Every morning for previous day.</p>
            </div>
            <div className="report-options">
              <div className="report-option">
                <div className="report-option-content">
                  <svg className="report-icon whatsapp-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" fill="#25D366"/>
                  </svg>
                  <span>Share on whatsapp</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.dailyReports.whatsapp}
                    onChange={(e) => handleToggle('dailyReports.whatsapp', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="report-option">
                <div className="report-option-content">
                  <svg className="report-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Share on email</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.dailyReports.email}
                    onChange={(e) => handleToggle('dailyReports.email', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Weekly Reports */}
          <div className="report-subsection">
            <div className="subsection-header">
              <h3>Weekly Reports</h3>
              <p className="subsection-description">Every Monday for previous week.</p>
            </div>
            <div className="report-options">
              <div className="report-option">
                <div className="report-option-content">
                  <svg className="report-icon whatsapp-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" fill="#25D366"/>
                  </svg>
                  <span>Share on whatsapp</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.weeklyReports.whatsapp}
                    onChange={(e) => handleToggle('weeklyReports.whatsapp', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="report-option">
                <div className="report-option-content">
                  <svg className="report-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Share on email</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.weeklyReports.email}
                    onChange={(e) => handleToggle('weeklyReports.email', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Order Notifications */}
        <div className="communication-section">
          <div className="section-header">
            <div className="section-title-with-icon">
              <svg className="section-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2>Order notifications</h2>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.orderNotifications}
                onChange={(e) => handleToggle('orderNotifications', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <p className="section-description">
            Receive order notifications on this device.
          </p>
        </div>

        {/* Ring Volume */}
        <div className="communication-section">
          <div className="section-header">
            <div className="section-title-with-icon">
              <svg className="section-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34835 21.9979 12C21.9979 14.6517 20.9447 17.1947 19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 12C17.0039 13.3308 16.4774 14.6024 15.54 15.54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2>Ring volume</h2>
            </div>
          </div>
          <div className="volume-control">
            <input
              type="range"
              min="0"
              max="100"
              value={settings.ringVolume}
              onChange={(e) => handleRingVolumeChange(e.target.value)}
              className="volume-slider"
              style={{
                background: `linear-gradient(to right, var(--primary-green) 0%, var(--primary-green) ${settings.ringVolume}%, #e0e0e0 ${settings.ringVolume}%, #e0e0e0 100%)`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageCommunication;
