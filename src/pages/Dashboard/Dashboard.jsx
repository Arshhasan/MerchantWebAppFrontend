import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardKPIs } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToCollection, getDocument } from '../../firebase/firestore';
import './Dashboard.css';

const Dashboard = () => {
  const merchantName = 'Burger Wings';
  const { user } = useAuth();
  const { showToast } = useToast();
  const merchantAvatarUrl = user?.photoURL || null;
  const merchantDisplayName = user?.displayName || merchantName;
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [vendorId, setVendorId] = useState(null);

  // Get vendorID from user document
  useEffect(() => {
    const loadVendorId = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDocument('users', user.uid);
        if (userDoc.success && userDoc.data && userDoc.data.vendorID) {
          setVendorId(userDoc.data.vendorID);
        }
      } catch (error) {
        console.error('Error loading vendorID:', error);
      }
    };
    
    loadVendorId();
  }, [user]);

  // Fetch recent orders from Firebase
  useEffect(() => {
    if (!user) {
      setOrdersLoading(false);
      return;
    }

    // Subscribe to orders collection
    const unsubscribe = subscribeToCollection(
      'restaurant_orders',
      [], // Fetch all orders for now (can filter by vendorID later if needed)
      (documents) => {
        // Transform orders to match UI format
        const transformedOrders = documents.map((order) => {
          const createdAt = order.createdAt?.toDate 
            ? order.createdAt.toDate() 
            : (order.createdAt ? new Date(order.createdAt) : new Date());
          
          // Calculate total amount
          const products = order.products || [];
          const subtotal = products.reduce((sum, p) => {
            const price = parseFloat(p.price || 0);
            const quantity = parseInt(p.quantity || 1);
            return sum + (price * quantity);
          }, 0);
          const deliveryCharge = parseFloat(order.deliveryCharge || 0);
          const discount = parseFloat(order.discount || 0);
          const tipAmount = parseFloat(order.tip_amount || 0);
          const totalAmount = subtotal + deliveryCharge - discount + tipAmount;

          // Format date for display
          const formattedDate = createdAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          return {
            id: order.orderId || order.id,
            date: formattedDate,
            amount: parseFloat(totalAmount.toFixed(2)),
            createdAt,
          };
        });

        // Sort by date (newest first) and limit to 5 most recent
        transformedOrders.sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Filter by vendorID if available, otherwise show all
        let filteredOrders = transformedOrders;
        if (vendorId) {
          // Filter orders by vendorID if the order has a vendorID field
          filteredOrders = transformedOrders.filter(order => {
            // Check if order has vendorID field matching current vendor
            // This assumes orders have a vendorID field - adjust based on actual structure
            return true; // For now, show all orders until we confirm the structure
          });
        }

        // Limit to 5 most recent orders
        setRecentOrders(filteredOrders.slice(0, 5));
        setOrdersLoading(false);
      },
      (error) => {
        console.error('Error fetching orders:', error);
        showToast('Failed to load recent orders', 'error');
        setOrdersLoading(false);
        setRecentOrders([]);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, vendorId, showToast]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="merchant-info">
          <div className="merchant-logo">
            {merchantAvatarUrl ? (
              <img
                src={merchantAvatarUrl}
                alt={`${merchantDisplayName} avatar`}
                className="merchant-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="30" cy="30" r="28" stroke="#DC3545" strokeWidth="2" fill="white"/>
                <ellipse cx="30" cy="18" rx="12" ry="6" fill="#D2691E" stroke="#8B4513" strokeWidth="1"/>
                <path d="M18 22Q30 20 42 22" stroke="#228B22" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <path d="M18 22Q30 24 42 22" stroke="#228B22" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <ellipse cx="30" cy="26" rx="12" ry="4" fill="#8B4513"/>
                <ellipse cx="30" cy="32" rx="12" ry="6" fill="#D2691E" stroke="#8B4513" strokeWidth="1"/>
                <text x="30" y="48" textAnchor="middle" fontSize="7" fontWeight="700" fill="#DC3545" fontFamily="Arial, sans-serif">Burger</text>
              </svg>
            )}
          </div>
          <div className="merchant-details">
            <p className="greeting">{getGreeting()}</p>
            <h1 className="merchant-name">{merchantName}</h1>
          </div>
        </div>
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

      <div className="action-buttons">
        <Link to="/create-bag" className="action-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Create Surprise Bag</span>
        </Link>
        <Link to="/bags" className="action-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Bags</span>
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
          <h2>Recent Orders</h2>
          <Link to="/orders" className="view-all-link">
            <span>View More</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
        {ordersLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)' }}>
            Loading orders...
          </div>
        ) : recentOrders.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)' }}>
            No recent orders found
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default Dashboard;
