import { useState } from 'react';
import { categories, timeSlots } from '../../data/mockData';
import './CreateSurpriseBag.css';

const CreateSurpriseBag = () => {
  const [formData, setFormData] = useState({
    categories: [],
    bagTitle: '',
    description: '',
    bagPrice: '',
    customPrice: '',
    useCustomPrice: false,
    quantity: '',
    pickupDate: '',
    pickupTime: '',
    photos: [],
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'useCustomPrice') {
        setFormData({ ...formData, [name]: checked });
      } else {
        const updatedCategories = checked
          ? [...formData.categories, value]
          : formData.categories.filter((cat) => cat !== value);
        setFormData({ ...formData, categories: updatedCategories });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map((file) => ({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setFormData({ ...formData, photos: [...formData.photos, ...newPhotos] });
  };

  const removePhoto = (id) => {
    setFormData({
      ...formData,
      photos: formData.photos.filter((photo) => photo.id !== id),
    });
  };

  const handleSubmit = (e, action) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      bagPrice: formData.useCustomPrice ? formData.customPrice : formData.bagPrice,
    };
    console.log(`${action} Data:`, submitData);
    if (action === 'Publish') {
      alert('Bag published successfully! (This is a demo)');
    } else {
      alert('Draft saved successfully! (This is a demo)');
    }
  };

  return (
    <div className="create-bag">
      <div className="page-header">
        <h1>Create Surprise Bag</h1>
      </div>

      <form className="bag-form">
        <div className="card">
          <h2>Bag Details</h2>
          
          <div className="input-group">
            <label>Category (Multi-select)</label>
            <div className="category-checkboxes">
              {categories.map((category) => (
                <label key={category} className="checkbox-label">
                  <input
                    type="checkbox"
                    value={category}
                    checked={formData.categories.includes(category)}
                    onChange={handleChange}
                  />
                  {category}
                </label>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label>Bag Title</label>
            <input
              type="text"
              name="bagTitle"
              value={formData.bagTitle}
              onChange={handleChange}
              placeholder="Enter bag title"
              required
            />
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter bag description"
              rows="4"
              required
            />
          </div>

          <div className="input-group">
            <label>Bag Price</label>
            <div className="price-options">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  name="useCustomPrice"
                  checked={formData.useCustomPrice}
                  onChange={handleChange}
                />
                Use Custom Price
              </label>
              {formData.useCustomPrice ? (
                <input
                  type="number"
                  name="customPrice"
                  value={formData.customPrice}
                  onChange={handleChange}
                  placeholder="Enter custom price"
                  min="0"
                  step="0.01"
                  required
                />
              ) : (
                <select
                  name="bagPrice"
                  value={formData.bagPrice}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Price</option>
                  <option value="10">$10</option>
                  <option value="15">$15</option>
                  <option value="20">$20</option>
                  <option value="25">$25</option>
                  <option value="30">$30</option>
                  <option value="35">$35</option>
                  <option value="40">$40</option>
                  <option value="50">$50</option>
                </select>
              )}
            </div>
          </div>

          <div className="input-group">
            <label>Quantity</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="Enter quantity"
              min="1"
              required
            />
          </div>

          <div className="input-group">
            <label>Pickup Date</label>
            <input
              type="date"
              name="pickupDate"
              value={formData.pickupDate}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="input-group">
            <label>Pickup Time</label>
            <select
              name="pickupTime"
              value={formData.pickupTime}
              onChange={handleChange}
              required
            >
              <option value="">Select Time Slot</option>
              {timeSlots.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Add Photos</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="file-input"
            />
            {formData.photos.length > 0 && (
              <div className="photo-preview">
                {formData.photos.map((photo) => (
                  <div key={photo.id} className="photo-item">
                    <img src={photo.preview} alt="Preview" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="remove-photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'Save Draft')}
            className="btn btn-secondary"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'Publish')}
            className="btn btn-primary"
          >
            Publish
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateSurpriseBag;
