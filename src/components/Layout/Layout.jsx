import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDocument } from '../../firebase/firestore';
import { resolveOrderVendorId, computeOrderPayableTotal } from '../../services/orderSchema';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { subscribeToVendorOrders } from '../../services/orderQuery';
import OrderNotificationModal from '../OrderNotificationModal/OrderNotificationModal';
import ChatButton from '../ChatButton/ChatButton';
import './Layout.css';

/** New order document — accept common initial statuses (not complete/cancelled). */
function isNewOrderStatusForNotification(status) {
  const s = (status || '').toString().trim().toLowerCase();
  if (!s) return false;
  if (s.includes('cancel')) return false;
  if (s.includes('complete')) return false;
  if (s.includes('reject')) return false;
  if (s === 'delivered') return false;
  if (s.includes('incomplete')) return false;
  return (
    s === 'order placed'
    || s === 'order accepted'
    || s === 'accepted'
    || s === 'pending'
    || s === 'order pending'
    || s.includes('placed')
    || s.includes('accepted')
  );
}

const Layout = ({ children, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    needsCategorySetup,
    needsCategorySelection,
    needsOutletLocationSetup,
    needsStoreDetailsSetup,
    needsFirstBagSetup,
  } = useAuth();

  /** Hide main app nav (mobile + desktop) until onboarding + first Surprise Bag step are done — aligns with OnboardingGate. */
  const hideNavForOnboarding = needsCategorySetup
    || needsCategorySelection
    || needsOutletLocationSetup
    || needsStoreDetailsSetup
    || needsFirstBagSetup
    || location.search.includes('onboarding=1');
  const [newOrder, setNewOrder] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  const seenOrderIds = useRef(new Set());
  const pendingOrdersQueue = useRef([]);
  /** IDs present in the previous Firestore snapshot — used to detect truly new orders only */
  const previousSnapshotOrderIdsRef = useRef(new Set());
  /** After first snapshot (even if empty), we only show modals for newly appearing order IDs */
  const orderNotificationBaselineReadyRef = useRef(false);
  const showNotificationRef = useRef(false);

  // Helper: stable key per signed-in user (vendorId can be null on first paint — was breaking dismiss persistence)
  const getAcknowledgedOrders = () => {
    if (!user?.uid) return [];
    try {
      const uidKey = `acknowledgedOrders_${user.uid}`;
      let stored = localStorage.getItem(uidKey);
      if (!stored && vendorId) {
        const legacy = localStorage.getItem(`acknowledgedOrders_${vendorId}`);
        if (legacy) {
          localStorage.setItem(uidKey, legacy);
          stored = legacy;
        }
      }
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading acknowledged orders:', error);
      return [];
    }
  };

  const markOrderAsAcknowledged = (orderId) => {
    if (!user?.uid) return;
    try {
      const key = `acknowledgedOrders_${user.uid}`;
      const acknowledged = getAcknowledgedOrders();
      if (!acknowledged.includes(orderId)) {
        acknowledged.push(orderId);
        const trimmed = acknowledged.slice(-1000);
        localStorage.setItem(key, JSON.stringify(trimmed));
      }
      seenOrderIds.current.add(orderId);
    } catch (error) {
      console.error('Error saving acknowledged order:', error);
    }
  };

  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Get vendorID from user document
  useEffect(() => {
    const loadVendorId = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDocument('users', user.uid);
        const fallbackVendorId = userDoc.success && userDoc.data ? userDoc.data.vendorID : null;
        const resolvedVendorId = fallbackVendorId || await resolveMerchantVendorId(user.uid);
        if (resolvedVendorId) setVendorId(resolvedVendorId);
      } catch (error) {
        console.error('Error loading vendorID:', error);
      }
    };
    
    loadVendorId();
  }, [user]);

  // Keep ref in sync so the subscription callback does not close over stale state
  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);

  // Reset snapshot diff state when vendor scope changes
  useEffect(() => {
    if (vendorId) {
      seenOrderIds.current.clear();
      pendingOrdersQueue.current = [];
      previousSnapshotOrderIdsRef.current = new Set();
      orderNotificationBaselineReadyRef.current = false;
    }
  }, [vendorId]);

  // Subscribe to orders — only show modal when a *new* order document appears (not on every refresh)
  useEffect(() => {
    if (!user) {
      return;
    }
    const vendorCandidates = new Set([vendorId, user?.uid].filter(Boolean));

    const acknowledgedOrders = getAcknowledgedOrders();
    acknowledgedOrders.forEach((orderId) => {
      seenOrderIds.current.add(orderId);
    });

    const unsubscribe = subscribeToVendorOrders([vendorId, user?.uid], (orders) => {
      const acknowledgedSet = new Set(getAcknowledgedOrders());
      const currentIds = new Set(orders.map((o) => o.orderId || o.id));
      const previous = previousSnapshotOrderIdsRef.current;

      // First merged snapshot after mount (even if empty): seed baseline — do NOT show modal for existing orders
      if (!orderNotificationBaselineReadyRef.current) {
        previousSnapshotOrderIdsRef.current = currentIds;
        orderNotificationBaselineReadyRef.current = true;
        return;
      }

      previousSnapshotOrderIdsRef.current = currentIds;

      orders.forEach((orderData) => {
        const orderId = orderData.orderId || orderData.id;
        if (previous.has(orderId)) {
          return;
        }

        const status = orderData.status || '';
        const orderVendorId = resolveOrderVendorId(orderData);

        if (!vendorCandidates.has(orderVendorId) || !isNewOrderStatusForNotification(status)) {
          return;
        }
        if (acknowledgedSet.has(orderId) || seenOrderIds.current.has(orderId)) {
          return;
        }

        seenOrderIds.current.add(orderId);

        console.log('Order notification: New order document detected', { orderId, status });

        const createdAt = orderData.createdAt?.toDate
          ? orderData.createdAt.toDate()
          : (orderData.createdAt ? new Date(orderData.createdAt) : new Date());

        const totalAmount = computeOrderPayableTotal(orderData);

        const transformedOrder = {
          id: orderId,
          amount: totalAmount,
          createdAt,
          status: 'Order Placed',
          fullOrderData: { ...orderData, id: orderId },
        };

        if (!pendingOrdersQueue.current.find((o) => o.id === orderId)) {
          pendingOrdersQueue.current.push(transformedOrder);
        }

        if (!showNotificationRef.current) {
          console.log('Order notification: Showing notification for order', orderId);
          setNewOrder(transformedOrder);
          setShowNotification(true);
        }
      });
    }, (error) => {
      console.error('Error fetching orders for notification:', error);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, vendorId]);

  // Handler to scroll to top on nav click
  const handleNavClick = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Home',  
      icon: (
        <img
          src="/home.png"
          alt="Home"
        />
      )
    },
    { 
      path: '/orders', 
      label: 'Orders', 
      icon: (
        <img
          src="/bag.png"
          alt="Orders"
        />
      )
    },
    { 
      path: '/create-bag', 
      label: 'Create Bag', 
      icon: (
        <img
          src="/fork-and-knife.png"
          alt="Create Bag"
        />
      )
    },
    { 
      path: '/performance', 
      label: 'Insight', 
      icon: (
        <img
          src="/insights.png"
          alt="Insight"
        />
      )
    },
    { 
      path: '/profile', 
      label: 'Profile', 
      icon: (
        <img
          src="/people.png"
          alt="Profile"
        />
      )
    },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const walletIcon = (
    <img src="/wallet.png" alt="" className="wallet-icon-img" width={24} height={24} />
  );

  const handleCloseNotification = () => {
    // Mark current order as acknowledged
    if (newOrder) {
      markOrderAsAcknowledged(newOrder.id);
      console.log('Order notification: Marked order', newOrder.id, 'as acknowledged');
    }
    
    setShowNotification(false);
    
    // Clear the order data after animation
    setTimeout(() => {
      setNewOrder(null);
      
      // Check if there are more orders in the queue
      if (pendingOrdersQueue.current.length > 0) {
        // Remove the current order from queue
        pendingOrdersQueue.current = pendingOrdersQueue.current.filter(
          order => order.id !== newOrder?.id
        );
        
        // Show next order in queue if available
        if (pendingOrdersQueue.current.length > 0) {
          const nextOrder = pendingOrdersQueue.current[0];
          console.log('Order notification: Showing next order in queue', nextOrder.id);
          setTimeout(() => {
            setNewOrder(nextOrder);
            setShowNotification(true);
          }, 500); // Small delay between notifications
        }
      }
    }, 300);
  };

  // Debug: Log when notification state changes
  useEffect(() => {
    if (showNotification && newOrder) {
      console.log('Order notification: Modal should be visible now for order', newOrder.id);
    }
  }, [showNotification, newOrder]);

  return (
    <div className={`layout${hideNavForOnboarding ? ' layout--onboarding' : ''}`}>
      <OrderNotificationModal
        isOpen={showNotification}
        onClose={handleCloseNotification}
        order={newOrder}
        onOrderUpdated={() => {
          // Mark order as acknowledged when accepted/rejected
          if (newOrder) {
            markOrderAsAcknowledged(newOrder.id);
            console.log('Order notification: Order updated, marked as acknowledged', newOrder.id);
          }
          // Refresh orders list by resetting initial load
          // This will trigger the subscription to update
        }}
      />
      {!hideNavForOnboarding && (
        <>
          {/* Mobile Header - Logo */}
          <nav className="mobile-header">
            <Link to="/dashboard" className="mobile-logo">
              <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK-Photoroom.png" alt="BestBy Bites Merchant Logo" className="mobile-logo-img" />
            </Link>
            <button
              type="button"
              className="mobile-wallet-btn"
              onClick={() => navigate('/wallet')}
              aria-label="Open wallet"
              title="Wallet"
            >
              {walletIcon}
              <span className="wallet-btn-label">Wallet</span>
            </button>
          </nav>

          {/* Desktop Top Nav */}
          <nav className="top-nav">
            <Link to="/dashboard" className="nav-logo">
              <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK-Photoroom.png" alt="BestBy Bites Merchant Logo" className="nav-logo-img" />
            </Link>
            <div className="nav-items-container">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={handleNavClick}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              className={`wallet-icon-btn${location.pathname === '/wallet' ? ' wallet-active' : ''}`}
              onClick={() => navigate('/wallet')}
              aria-label="Open wallet"
              title="Wallet"
            >
              {walletIcon}
              <span className="wallet-btn-label">Wallet</span>
            </button>
          </nav>
        </>
      )}
      <main className="main-content">
        {children}
      </main>
      <ChatButton />
      {!hideNavForOnboarding && (
        <nav className="bottom-nav">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={handleNavClick}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
};

export default Layout;
