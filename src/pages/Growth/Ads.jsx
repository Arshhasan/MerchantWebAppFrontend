import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categories } from '../../data/mockData';
import './Growth.css';

const Ads = () => {
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [formData, setFormData] = useState({
    budget: '',
    duration: '',
    category: '',
  });
  const [showForm, setShowForm] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newAd = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toLocaleDateString(),
    };
    setAds([...ads, newAd]);
    console.log('Ad Created:', newAd);
    alert('Ad campaign created successfully! (This is a demo)');
    setFormData({ budget: '', duration: '', category: '' });
    setShowForm(false);
  };

  const handleDelete = (id) => {
    setAds(ads.filter((ad) => ad.id !== id));
  };

  return (
    <div className="ads-page">
      <div className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/growth')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Ads</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Run Ad'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>Create New Ad Campaign</h2>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Budget</label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="Enter budget amount"
                min="1"
                required
              />
            </div>
            <div className="input-group">
              <label>Duration (Days)</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                placeholder="Enter duration in days"
                min="1"
                required
              />
            </div>
            <div className="input-group">
              <label>Category Selection</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Create Ad Campaign
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Active Ad Campaigns</h2>
        {ads.length === 0 ? (
          <p className="empty-state">No ad campaigns created yet. Create your first ad above.</p>
        ) : (
          <div className="ads-list">
            {ads.map((ad) => (
              <div key={ad.id} className="ad-item">
                <div className="ad-info">
                  <h3>${ad.budget} Budget</h3>
                  <p>Duration: {ad.duration} days</p>
                  <p>Category: {ad.category}</p>
                  <span className="ad-date">Created: {ad.createdAt}</span>
                </div>
                <button
                  onClick={() => handleDelete(ad.id)}
                  className="btn btn-danger btn-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Ads;
