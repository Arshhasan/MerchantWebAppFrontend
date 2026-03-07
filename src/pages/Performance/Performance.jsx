import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Performance.css';

const TIME_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
  { label: 'Custom', value: 'custom' },
];

const statCards = [
  { label: 'Total Revenue', value: '€0.00', color: 'stat-dark-green' },
  { label: 'Total Bags Sold', value: '0', color: 'stat-yellow' },
  { label: 'Waste Saved (Kg)', value: '0 kg', color: 'stat-blue' },
  { label: 'CO₂ Impact Saved', value: '0 kg', color: 'stat-coral' },
];

const Performance = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  return (
    <div className="performance-page">
      {/* Green Header with Back Arrow */}
      <div className="perf-header">
        <button className="perf-back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="perf-title">Performance Overview</h1>
      </div>

      {/* Time Filter Tabs */}
      <div className="perf-filter-tabs">
        {TIME_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`perf-filter-tab${activeFilter === f.value ? ' active' : ''}`}
            onClick={() => setActiveFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats Section */}
      <div className="perf-section">
        <h2 className="perf-section-title">Stats</h2>
        <div className="perf-stats-grid">
          {statCards.map((card) => (
            <div key={card.label} className={`perf-stat-card ${card.color}`}>
              <span className="perf-stat-label">{card.label}</span>
              <span className="perf-stat-value">{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Best Selling Time Slots */}
      <div className="perf-section">
        <h2 className="perf-section-title">Best Selling Time Slots</h2>
        <div className="perf-timeslot-row">
          <input
            type="date"
            className="perf-date-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="From"
          />
          <span className="perf-timeslot-from">from</span>
          <input
            type="date"
            className="perf-date-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="To"
          />
        </div>

        {/* Time slots result area */}
        <div className="perf-timeslot-results">
          <p className="perf-no-data">No data available for selected period.</p>
        </div>
      </div>
    </div>
  );
};

export default Performance;
