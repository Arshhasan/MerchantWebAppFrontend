import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument, createDocument, updateDocument } from '../../firebase/firestore';
import './OutletTimings.css';

const OutletTimings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timings, setTimings] = useState({
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '16:00', closed: false },
    sunday: { open: '10:00', close: '16:00', closed: true },
  });

  const days = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  useEffect(() => {
    if (user) {
      loadTimings();
    }
  }, [user]);

  const loadTimings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await getDocument('merchant_outlet_info', user.uid);
      
      if (result.success && result.data && result.data.timings) {
        setTimings(result.data.timings);
      }
    } catch (error) {
      console.error('Error loading timings:', error);
      showToast('Failed to load outlet timings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTimingChange = (day, field, value) => {
    setTimings(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: field === 'closed' ? value : value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);

      // Check if document exists
      const existingDoc = await getDocument('merchant_outlet_info', user.uid);
      
      const timingsData = {
        merchantId: user.uid,
        timings: timings,
      };

      if (existingDoc.success && existingDoc.data) {
        // Update existing document
        const result = await updateDocument('merchant_outlet_info', user.uid, timingsData);
        if (result.success) {
          showToast('Outlet timings updated successfully!', 'success');
          navigate('/dashboard', { replace: true });
        } else {
          throw new Error(result.error || 'Failed to update outlet timings');
        }
      } else {
        // Create new document
        const result = await createDocument('merchant_outlet_info', timingsData, user.uid);
        if (result.success) {
          showToast('Outlet timings saved successfully!', 'success');
          navigate('/dashboard', { replace: true });
        } else {
          throw new Error(result.error || 'Failed to save outlet timings');
        }
      }
    } catch (error) {
      console.error('Error saving timings:', error);
      showToast(error.message || 'Failed to save outlet timings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="outlet-timings-page">
        <div className="page-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Outlet Timings</h1>
        </div>
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="outlet-timings-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Outlet Timings</h1>
      </div>

      <div className="outlet-timings-content">
        <form onSubmit={handleSubmit} className="outlet-timings-form">
          <div className="timings-list">
            {days.map((day) => (
              <div key={day.key} className="timing-row">
                <div className="day-section">
                  <label className="day-checkbox">
                    <input
                      type="checkbox"
                      checked={!timings[day.key].closed}
                      onChange={(e) =>
                        handleTimingChange(day.key, 'closed', !e.target.checked)
                      }
                    />
                    <span className="day-name">{day.label}</span>
                  </label>
                </div>
                {!timings[day.key].closed ? (
                  <div className="time-inputs">
                    <input
                      type="time"
                      value={timings[day.key].open}
                      onChange={(e) =>
                        handleTimingChange(day.key, 'open', e.target.value)
                      }
                      required
                    />
                    <span className="time-separator">to</span>
                    <input
                      type="time"
                      value={timings[day.key].close}
                      onChange={(e) =>
                        handleTimingChange(day.key, 'close', e.target.value)
                      }
                      required
                    />
                  </div>
                ) : (
                  <span className="closed-label">Closed</span>
                )}
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Timings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OutletTimings;
