import { Link } from 'react-router-dom';
import { dashboardKPIs, recentOrders } from '../../data/mockData';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <div className="kpi-container">
        <div className="kpi-cards grid grid-2x2">
          <div className="kpi-card kpi-card-dark-green">
            <div className="kpi-label">Total Earning</div>
            <div className="kpi-value">${dashboardKPIs.totalEarnings.toLocaleString()}</div>
          </div>
          <div className="kpi-card kpi-card-orange">
            <div className="kpi-label">Bags Sold Today</div>
            <div className="kpi-value">{dashboardKPIs.bagsSoldToday}</div>
          </div>
          <div className="kpi-card kpi-card-light-blue">
            <div className="kpi-label">Pending Pickups</div>
            <div className="kpi-value">{dashboardKPIs.pendingPickups}</div>
          </div>
          <div className="kpi-card kpi-card-coral">
            <div className="kpi-label">Canceled Order</div>
            <div className="kpi-value">{dashboardKPIs.cancelledOrders}</div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <Link to="/create-bag" className="action-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Create Surprise Bag</span>
        </Link>
        <Link to="/growth" className="action-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 10H16V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Growth</span>
        </Link>
      </div>

      <div className="recent-orders-section">
        <div className="recent-orders-header">
          <h2>Recent Order</h2>
          <Link to="/orders" className="view-all-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
        <div className="orders-list">
          {recentOrders.map((order) => (
            <div key={order.id} className="order-item">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="order-icon">
                <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="order-details">
                <span className="order-id">Order id: #{order.id}</span>
                <span className="order-date">{order.date}</span>
              </div>
              <span className="order-amount">${order.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
