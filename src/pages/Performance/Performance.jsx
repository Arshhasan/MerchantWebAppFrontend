import { useState } from 'react';
import { chartData } from '../../data/mockData';
import './Performance.css';

const Performance = () => {
  const [dateFilter, setDateFilter] = useState('today');
  const salesSummary = {
    totalSales: 12500,
    totalOrders: 45,
    averageOrderValue: 277.78,
    growth: 12.5,
  };

  const maxSales = Math.max(...chartData.map((d) => d.sales));

  return (
    <div className="performance-page">
      <div className="page-header">
        <h1>Performance Overview</h1>
        <div className="filter-group">
          <label>Date Filter:</label>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      <div className="sales-summary-card card">
        <h2>Sales Summary</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Total Sales</span>
            <span className="summary-value">${salesSummary.totalSales.toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Orders</span>
            <span className="summary-value">{salesSummary.totalOrders}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Average Order Value</span>
            <span className="summary-value">${salesSummary.averageOrderValue.toFixed(2)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Growth</span>
            <span className="summary-value positive">+{salesSummary.growth}%</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Best Selling Time Chart</h2>
        <div className="chart-container">
          <div className="chart">
            {chartData.map((data, index) => (
              <div key={index} className="chart-bar-container">
                <div className="chart-bar-wrapper">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(data.sales / maxSales) * 100}%`,
                    }}
                  >
                    <span className="bar-value">{data.sales}</span>
                  </div>
                </div>
                <span className="bar-label">{data.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Performance;
