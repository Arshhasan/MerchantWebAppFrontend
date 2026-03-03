import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Growth.css';

const Offers = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [formData, setFormData] = useState({
    discountPercentage: '',
    validityDate: '',
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
    const newOffer = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toLocaleDateString(),
    };
    setOffers([...offers, newOffer]);
    console.log('Offer Created:', newOffer);
    alert('Offer created successfully! (This is a demo)');
    setFormData({ discountPercentage: '', validityDate: '' });
    setShowForm(false);
  };

  const handleDelete = (id) => {
    setOffers(offers.filter((offer) => offer.id !== id));
  };

  return (
    <div className="offers-page">
      <div className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/growth')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Offers</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Create Offer'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>Create New Offer</h2>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Discount Percentage</label>
              <input
                type="number"
                name="discountPercentage"
                value={formData.discountPercentage}
                onChange={handleChange}
                placeholder="Enter discount percentage"
                min="1"
                max="100"
                required
              />
            </div>
            <div className="input-group">
              <label>Offer Validity Date</label>
              <input
                type="date"
                name="validityDate"
                value={formData.validityDate}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Save Offer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Active Offers</h2>
        {offers.length === 0 ? (
          <p className="empty-state">No offers created yet. Create your first offer above.</p>
        ) : (
          <div className="offers-list">
            {offers.map((offer) => (
              <div key={offer.id} className="offer-item">
                <div className="offer-info">
                  <h3>{offer.discountPercentage}% Off</h3>
                  <p>Valid until: {offer.validityDate}</p>
                  <span className="offer-date">Created: {offer.createdAt}</span>
                </div>
                <button
                  onClick={() => handleDelete(offer.id)}
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

export default Offers;
