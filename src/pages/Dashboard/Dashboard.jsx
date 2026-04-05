import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import { getDocument } from '../../firebase/firestore';
import { resolveOrderVendorId, computeOrderPayableTotal, formatOrderPickupWindow } from '../../services/orderSchema';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { subscribeToVendorOrders } from '../../services/orderQuery';
import { publicUrl } from '../../utils/publicUrl';
import './Dashboard.css';

const defaultKpis = {
  totalEarnings: 0,
  bagsSoldToday: 0,
  pendingPickups: 0,
  cancelledOrders: 0,
};

const Dashboard = () => {
  const { user, userProfile, vendorProfile, needsFirstBagSetup } = useAuth();
  const { showToast } = useToast();

  const defaultAvatar = publicUrl('user.png');

  const merchantAvatarUrl = useMemo(() => {
    const googleUrl = user?.photoURL || null;
    const outletUrl = vendorProfile?.photo || null;
    const source = userProfile?.dashboardAvatarSource;

    let resolved = null;
    if (source === 'google') {
      resolved = googleUrl || outletUrl;
    } else if (source === 'outlet') {
      resolved = outletUrl || googleUrl;
    } else {
      resolved = outletUrl || googleUrl;
    }
    return resolved || defaultAvatar;
  }, [user?.photoURL, userProfile?.dashboardAvatarSource, vendorProfile?.photo, defaultAvatar]);

  const isDefaultAvatar = merchantAvatarUrl === defaultAvatar;
  const [storeName, setStoreName] = useState('Store');
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [vendorId, setVendorId] = useState(null);
  const [kpis, setKpis] = useState(defaultKpis);

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
          
          const totalAmount = computeOrderPayableTotal(order);
          const pickupDisplay = formatOrderPickupWindow(order);

          // Get order status (normalize so KPI logic matches backend variants)
          let status = order.status || 'Pending';
          const st = (status || '').toString().trim().toLowerCase();
          if (st.includes('cancel')) status = 'Cancelled';
          else if (!st.includes('incomplete') && (st.includes('complete') || st === 'complete')) {
            status = 'Complete';
          }

          // Format date for display
          const formattedDate = createdAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          return {
            id: order.id || order.orderId || `${order.createdAt?.seconds || 'order'}-${order.authorID || 'unknown'}`,
            date: formattedDate,
            pickupDisplay,
            amount: totalAmount,
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

  // KPIs from vendors/{vendorId}.dashboardStats (maintained by Cloud Function syncVendorDashboardStats)
  useEffect(() => {
    if (!vendorId) {
      setKpis(defaultKpis);
      return undefined;
    }

    const vendorRef = doc(db, 'vendors', vendorId);
    const unsubscribe = onSnapshot(
      vendorRef,
      (snap) => {
        if (!snap.exists()) {
          setKpis(defaultKpis);
          return;
        }
        const d = snap.data()?.dashboardStats;
        if (!d || typeof d !== 'object') {
          setKpis(defaultKpis);
          return;
        }
        setKpis({
          totalEarnings: Number(d.totalEarnings) || 0,
          bagsSoldToday: Number(d.bagsSoldToday) || 0,
          pendingPickups: Number(d.pendingPickups) || 0,
          cancelledOrders: Number(d.cancelledBagsToday ?? d.cancelledOrders) || 0,
        });
      },
      (err) => {
        console.error('Dashboard: vendor dashboardStats snapshot error', err);
        setKpis(defaultKpis);
      }
    );

    return () => unsubscribe();
  }, [vendorId]);

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
          <div className={`merchant-logo${isDefaultAvatar ? ' merchant-logo--default' : ''}`}>
            <img
              src={merchantAvatarUrl}
              alt={`${storeName} avatar`}
              className={`merchant-avatar${isDefaultAvatar ? ' merchant-avatar--default' : ''}`}
              referrerPolicy="no-referrer"
            />
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
            <div className="kpi-label">Total Earning (after commission)</div>
            <div className="kpi-value">${kpis.totalEarnings.toLocaleString()}</div>
          </div>
          <div className="kpi-card kpi-card-orange">
            <div className="kpi-label">Bags Sold Today</div>
            <div className="kpi-value">{kpis.bagsSoldToday}</div>
          </div>
          <div className="kpi-card kpi-card-light-blue">
            <div className="kpi-label">Pending Bags</div>
            <div className="kpi-value">{kpis.pendingPickups}</div>
          </div>
          <div className="kpi-card kpi-card-coral">
            <div className="kpi-label">Bags Cancelled Today</div>
            <div className="kpi-value">{kpis.cancelledOrders}</div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <Link
          to={needsFirstBagSetup ? '/create-bag?firstBag=1' : '/create-bag'}
          className="action-btn action-btn--primary"
        >
          <img src={publicUrl('plus-button.png')} alt="Create Surprise Bag" className="action-btn-icon action-btn-icon-white" />
          <span>Create Surprise Bag</span>
        </Link>
        <Link to="/bags" className="action-btn">
          <img src={publicUrl('bag.png')} alt="Bags" className="action-btn-icon action-btn-icon-white" />
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
                <img
                  src={publicUrl('bag-handle-icon-size-512.png')}
                  alt=""
                  className="order-icon"
                  width={24}
                  height={24}
                />
                <div className="order-details">
                  <span className="order-id">Order id: #{order.id}</span>
                  <span className="order-date">{order.date}</span>
                  {order.pickupDisplay && order.pickupDisplay !== 'Not specified' ? (
                    <span className="order-pickup">{order.pickupDisplay}</span>
                  ) : null}
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
