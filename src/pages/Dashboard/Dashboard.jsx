import { Link } from 'react-router-dom';
import { dashboardKPIs, recentOrders } from '../../data/mockData';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/create-bag" className="btn btn-primary">
          ➕ Create New Surprise Bag
        </Link>
      </div>

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

      <div className="dashboard-sections">
        <div className="card">
          <div className="section-header">
            <h2>Growth</h2>
            <div className="growth-actions">
              <Link to="/offers" className="btn btn-outline">
                Manage Offers
              </Link>
              <Link to="/ads" className="btn btn-outline">
                Run Ads
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <h2>Recent Orders</h2>
            <Link to="/orders" className="btn btn-secondary">
              View All
            </Link>
          </div>
          <div className="orders-list">
            {recentOrders.map((order) => (
              <div key={order.id} className="order-item">
                <div className="order-info">
                  <h4>{order.bagName}</h4>
                  <p>{order.customerName}</p>
                  <span className="order-time">Pickup: {order.pickupTime}</span>
                </div>
                <div className="order-status">
                  <span className={`status-badge status-${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                  <span className="order-amount">${order.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
