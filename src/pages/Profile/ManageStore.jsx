import { useState } from 'react';
import { staffMembers } from '../../data/mockData';
import './Profile.css';

const ManageStore = () => {
  const [storeInfo, setStoreInfo] = useState({
    name: 'My Store',
    address: '123 Main Street, City, State 12345',
    email: 'store@example.com',
  });

  const [timing, setTiming] = useState({
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '16:00', closed: false },
    sunday: { open: '10:00', close: '16:00', closed: true },
  });

  const [phone, setPhone] = useState('+1234567890');
  const [staff, setStaff] = useState(staffMembers);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    role: '',
    phone: '',
  });

  const handleTimingChange = (day, field, value) => {
    setTiming({
      ...timing,
      [day]: {
        ...timing[day],
        [field]: value,
      },
    });
  };

  const handleStaffSubmit = (e) => {
    e.preventDefault();
    if (editingStaff) {
      setStaff(
        staff.map((s) =>
          s.id === editingStaff.id ? { ...editingStaff, ...staffForm } : s
        )
      );
      setEditingStaff(null);
    } else {
      const newStaff = {
        id: Date.now(),
        ...staffForm,
      };
      setStaff([...staff, newStaff]);
    }
    setStaffForm({ name: '', email: '', role: '', phone: '' });
    setShowAddStaff(false);
  };

  const handleEditStaff = (member) => {
    setEditingStaff(member);
    setStaffForm({
      name: member.name,
      email: member.email,
      role: member.role,
      phone: member.phone,
    });
    setShowAddStaff(true);
  };

  const handleDeleteStaff = (id) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      setStaff(staff.filter((s) => s.id !== id));
    }
  };

  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  return (
    <div className="manage-store">
      <div className="page-header">
        <h1>Manage Store</h1>
      </div>

      <div className="card">
        <h2>Outlet Info</h2>
        <div className="info-section">
          <div className="info-item">
            <span className="info-label">Store Name:</span>
            <span className="info-value">{storeInfo.name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Address:</span>
            <span className="info-value">{storeInfo.address}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Email:</span>
            <span className="info-value">{storeInfo.email}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Outlet Timing</h2>
        <form>
          {days.map((day) => (
            <div key={day} className="timing-row">
              <div className="day-name">
                <label className="closed-checkbox">
                  <input
                    type="checkbox"
                    checked={!timing[day].closed}
                    onChange={(e) =>
                      handleTimingChange(day, 'closed', !e.target.checked)
                    }
                  />
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </label>
              </div>
              {!timing[day].closed && (
                <div className="time-inputs">
                  <input
                    type="time"
                    value={timing[day].open}
                    onChange={(e) =>
                      handleTimingChange(day, 'open', e.target.value)
                    }
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={timing[day].close}
                    onChange={(e) =>
                      handleTimingChange(day, 'close', e.target.value)
                    }
                  />
                </div>
              )}
              {timing[day].closed && <span className="closed-label">Closed</span>}
            </div>
          ))}
          <div className="form-actions">
            <button type="button" className="btn btn-primary">
              Update Timing
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Phone Number</h2>
        <form>
          <div className="input-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary">
              Update Phone
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="section-header">
          <h2>Manage Staff</h2>
          <button
            onClick={() => {
              setShowAddStaff(!showAddStaff);
              setEditingStaff(null);
              setStaffForm({ name: '', email: '', role: '', phone: '' });
            }}
            className="btn btn-primary"
          >
            {showAddStaff ? 'Cancel' : 'Add Staff'}
          </button>
        </div>

        {showAddStaff && (
          <form onSubmit={handleStaffSubmit} className="staff-form">
            <div className="input-group">
              <label>Name</label>
              <input
                type="text"
                value={staffForm.name}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, name: e.target.value })
                }
                required
              />
            </div>
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                value={staffForm.email}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, email: e.target.value })
                }
                required
              />
            </div>
            <div className="input-group">
              <label>Role</label>
              <select
                value={staffForm.role}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, role: e.target.value })
                }
                required
              >
                <option value="">Select Role</option>
                <option value="Manager">Manager</option>
                <option value="Staff">Staff</option>
                <option value="Helper">Helper</option>
              </select>
            </div>
            <div className="input-group">
              <label>Phone</label>
              <input
                type="tel"
                value={staffForm.phone}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, phone: e.target.value })
                }
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingStaff ? 'Update Staff' : 'Add Staff'}
              </button>
            </div>
          </form>
        )}

        <div className="staff-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>{member.role}</td>
                  <td>{member.phone}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEditStaff(member)}
                        className="btn btn-secondary btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(member.id)}
                        className="btn btn-danger btn-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageStore;
