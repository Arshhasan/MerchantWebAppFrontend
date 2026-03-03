import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

const StoreSignup = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    storeName: '',
    address: '',
    phone: '',
    category: '',
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Static signup - complete registration and login
    onLogin();
    navigate('/dashboard');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK.png" alt="Logo" className="auth-logo" />
          <h1>Store Information</h1>
          <p>Complete your store setup</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Store Name</label>
            <input
              type="text"
              name="storeName"
              value={formData.storeName}
              onChange={handleChange}
              placeholder="Enter store name"
              required
            />
          </div>
          <div className="input-group">
            <label>Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter store address"
              rows="3"
              required
            />
          </div>
          <div className="input-group">
            <label>Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
              required
            />
          </div>
          <div className="input-group">
            <label>Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select category</option>
              <option value="food">Food & Beverages</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="books">Books</option>
              <option value="home">Home & Garden</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-full">
            Complete Setup
          </button>
        </form>
      </div>
    </div>
  );
};

export default StoreSignup;
