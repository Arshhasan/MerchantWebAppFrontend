import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDocument } from '../../firebase/firestore';
import { resolveOrderVendorId } from '../../services/orderSchema';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { subscribeToVendorOrders } from '../../services/orderQuery';
import './Dashboard.css';

const Dashboard = () => {
  const { user, userProfile, vendorProfile } = useAuth();
  const { showToast } = useToast();

  const merchantAvatarUrl = useMemo(() => {
    const googleUrl = user?.photoURL || null;
    const outletUrl = vendorProfile?.photo || null;
    const source = userProfile?.dashboardAvatarSource;

    if (source === 'google') {
      return googleUrl || outletUrl;
    }
    if (source === 'outlet') {
      return outletUrl || googleUrl;
    }
    return outletUrl || googleUrl;
  }, [user?.photoURL, userProfile?.dashboardAvatarSource, vendorProfile?.photo]);
  const [storeName, setStoreName] = useState('Store');
  const [recentOrders, setRecentOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [vendorId, setVendorId] = useState(null);
  const [kpis, setKpis] = useState({
    totalEarnings: 0,
    bagsSoldToday: 0,
    pendingPickups: 0,
    cancelledOrders: 0,
  });

  // Get vendorID and store name from user document and vendors collection
  useEffect(() => {
    const loadVendorData = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDocument('users', user.uid);
        const vendorIdValue = userDoc.success && userDoc.data ? userDoc.data.vendorID : null;
        const resolvedVendorId = vendorIdValue || await resolveMerchantVendorId(user.uid);
        if (resolvedVendorId) {
          setVendorId(resolvedVendorId);
          
          // Fetch vendor/store data to get store name
          const vendorDoc = await getDocument('vendors', resolvedVendorId);
          if (vendorDoc.success && vendorDoc.data) {
            const vendorData = vendorDoc.data;
            // Use title field as store name (matching merchant app structure)
            // The title field is the primary field for store name in vendors collection
            const name = vendorData.title || vendorData.storeName || vendorData.name || 'Store';
            console.log('Vendor data loaded:', { vendorId: resolvedVendorId, title: vendorData.title, name });
            if (name && name.trim() !== '' && name !== 'Store') {
              setStoreName(name.trim());
            } else {
              console.warn('No valid title found in vendor document, using default');
              setStoreName('Store');
            }
          } else {
            // If vendor document not found, set default
            console.warn('Vendor document not found for vendorID:', resolvedVendorId);
            setStoreName('Store');
          }
        } else {
          // No vendorID found
          console.warn('No vendorID found for user');
          setStoreName('Store');
        }
      } catch (error) {
        console.error('Error loading vendor data:', error);
        setStoreName('Store');
      }
    };
    
    loadVendorData();
  }, [user]);

  // Fetch recent orders from Firebase
  useEffect(() => {
    if (!user) {
      setOrdersLoading(false);
      return;
    }

    const unsubscribe = subscribeToVendorOrders(
      [vendorId, user?.uid],
      (documents) => {
        const vendorCandidates = new Set([vendorId, user?.uid].filter(Boolean));
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

          // Get order status
          let status = order.status || 'Pending';
          if (status === 'Order Cancelled') status = 'Cancelled';
          if (status === 'Order Completed' || status === 'Completed') status = 'Complete';

          // Format date for display
          const formattedDate = createdAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          return {
            id: order.id || order.orderId || `${order.createdAt?.seconds || 'order'}-${order.authorID || 'unknown'}`,
            date: formattedDate,
            amount: parseFloat(totalAmount.toFixed(2)),
            createdAt,
            status,
            fullOrderData: order,
          };
        });

        // Sort by date (newest first) and limit to 5 most recent
        transformedOrders.sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Filter by vendorID if available (client-side filter as backup)
        let filteredOrders = transformedOrders;
        if (vendorCandidates.size > 0) {
          filteredOrders = transformedOrders.filter((order) => {
            const orderVendorId = resolveOrderVendorId(order.fullOrderData || {});
            return vendorCandidates.has(orderVendorId);
          });
        } else {
          // If no vendorID, show no orders
          filteredOrders = [];
        }

        // Store all orders for KPI calculations
        setAllOrders(filteredOrders);

        // Limit to 5 most recent orders for display
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

  // Calculate KPIs from orders data
  useEffect(() => {
    if (allOrders.length === 0) {
      setKpis({
        totalEarnings: 0,
        bagsSoldToday: 0,
        pendingPickups: 0,
        cancelledOrders: 0,
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setMinutes(0, 0, 0);
    today.setSeconds(0, 0);
    today.setMilliseconds(0);

    // Calculate KPIs
    let totalEarnings = 0;
    let bagsSoldToday = 0;
    let pendingPickups = 0;
    let cancelledOrders = 0;

    allOrders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      orderDate.setMinutes(0, 0, 0);
      orderDate.setSeconds(0, 0);
      orderDate.setMilliseconds(0);

      // Total Earnings: Sum of completed orders
      if (order.status === 'Complete' || order.status === 'Completed') {
        totalEarnings += order.amount;
      }

      // Bags Sold Today: Count orders created today
      if (orderDate.getTime() === today.getTime()) {
        bagsSoldToday++;
      }

      // Pending Pickups: Count pending orders
      if (order.status === 'Pending' || order.status === 'pending') {
        pendingPickups++;
      }

      // Cancelled Orders: Count cancelled orders
      if (order.status === 'Cancelled' || order.status === 'Canceled' || order.status === 'Order Cancelled') {
        cancelledOrders++;
      }
    });

    setKpis({
      totalEarnings,
      bagsSoldToday,
      pendingPickups,
      cancelledOrders,
    });
  }, [allOrders]);

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
                alt={`${storeName} avatar`}
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
            <h1 className="merchant-name">{storeName}</h1>
          </div>
        </div>
      </div>
      <div className="kpi-container">
        <div className="kpi-cards grid grid-2x2">
          <div className="kpi-card kpi-card-dark-green">
            <div className="kpi-label">Total Earning</div>
            <div className="kpi-value">${kpis.totalEarnings.toLocaleString()}</div>
          </div>
          <div className="kpi-card kpi-card-orange">
            <div className="kpi-label">Bags Sold Today</div>
            <div className="kpi-value">{kpis.bagsSoldToday}</div>
          </div>
          <div className="kpi-card kpi-card-light-blue">
            <div className="kpi-label">Pending Pickups</div>
            <div className="kpi-value">{kpis.pendingPickups}</div>
          </div>
          <div className="kpi-card kpi-card-coral">
            <div className="kpi-label">Canceled Order</div>
            <div className="kpi-value">{kpis.cancelledOrders}</div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <Link to="/create-bag" className="action-btn action-btn--primary">
          <img src="/plus-button.png" alt="Create Surprise Bag" className="action-btn-icon action-btn-icon-white" />
          <span>Create Surprise Bag</span>
        </Link>
        <Link to="/bags" className="action-btn">
          <img src="/bag.png" alt="Bags" className="action-btn-icon action-btn-icon-white" />
          <span>Bags</span>
        </Link>
        {/* <Link to="/growth" className="action-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 10H16V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Growth</span>
        </Link> */}
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
