import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDocument } from '../../firebase/firestore';
import { resolveOrderVendorId } from '../../services/orderSchema';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { getVendorOrdersOnce, subscribeToVendorOrders } from '../../services/orderQuery';
import OrderNotificationModal from '../OrderNotificationModal/OrderNotificationModal';
import ChatButton from '../ChatButton/ChatButton';
import Footer from '../Footer/Footer';
import './Layout.css';

const Layout = ({ children, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [newOrder, setNewOrder] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  const seenOrderIds = useRef(new Set());
  const isInitialLoad = useRef(true);
  const pendingOrdersQueue = useRef([]);

  // Helper function to get acknowledged orders from localStorage
  const getAcknowledgedOrders = () => {
    try {
      const stored = localStorage.getItem(`acknowledgedOrders_${vendorId || 'default'}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading acknowledged orders:', error);
      return [];
    }
  };

  // Helper function to mark order as acknowledged in localStorage
  const markOrderAsAcknowledged = (orderId) => {
    try {
      const key = `acknowledgedOrders_${vendorId || 'default'}`;
      const acknowledged = getAcknowledgedOrders();
      if (!acknowledged.includes(orderId)) {
        acknowledged.push(orderId);
        // Keep only last 1000 acknowledged orders to prevent localStorage from getting too large
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

  // Reset initial load when vendorId changes
  useEffect(() => {
    if (vendorId) {
      isInitialLoad.current = true;
      seenOrderIds.current.clear();
      pendingOrdersQueue.current = [];
    }
  }, [vendorId]);

  // Subscribe to orders and detect new ones (like merchant folder)
  useEffect(() => {
    if (!user) {
      return;
    }
    const vendorCandidates = new Set([vendorId, user?.uid].filter(Boolean));

    // Get acknowledged orders from localStorage
    const acknowledgedOrders = getAcknowledgedOrders();
    const acknowledgedSet = new Set(acknowledgedOrders);
    
    // Load acknowledged orders into seenOrderIds
    acknowledgedOrders.forEach(orderId => {
      seenOrderIds.current.add(orderId);
    });

    // Check for unacknowledged "Order Placed" orders on initial load
    if (isInitialLoad.current) {
      const checkUnacknowledgedOrders = async () => {
        try {
          const orders = await getVendorOrdersOnce([vendorId, user?.uid]);
          const unacknowledgedOrders = [];
          
          orders.forEach((orderData) => {
            const orderId = orderData.orderId || orderData.id;
            const status = orderData.status || '';
            const orderVendorId = resolveOrderVendorId(orderData);
            
            // Check for "Order Placed" status and if not acknowledged
            if (vendorCandidates.has(orderVendorId) && status === 'Order Placed' && !acknowledgedSet.has(orderId)) {
              // Mark as seen to prevent duplicate notifications
              seenOrderIds.current.add(orderId);
              
              const createdAt = orderData.createdAt?.toDate 
                ? orderData.createdAt.toDate() 
                : (orderData.createdAt ? new Date(orderData.createdAt) : new Date());
              
              // Calculate total amount
              const products = orderData.products || [];
              const subtotal = products.reduce((sum, p) => {
                const price = parseFloat(p.price || 0);
                const quantity = parseInt(p.quantity || 1);
                return sum + (price * quantity);
              }, 0);
              const deliveryCharge = parseFloat(orderData.deliveryCharge || 0);
              const discount = parseFloat(orderData.discount || 0);
              const tipAmount = parseFloat(orderData.tip_amount || 0);
              const totalAmount = subtotal + deliveryCharge - discount + tipAmount;

              unacknowledgedOrders.push({
                id: orderId,
                amount: parseFloat(totalAmount.toFixed(2)),
                createdAt,
                status: 'Order Placed',
                fullOrderData: { ...orderData, id: orderId },
              });
            }
          });

          if (unacknowledgedOrders.length > 0) {
            // Sort by date (newest first)
            unacknowledgedOrders.sort((a, b) => {
              return new Date(b.createdAt) - new Date(a.createdAt);
            });
            
            console.log('Order notification: Found', unacknowledgedOrders.length, 'unacknowledged orders on page load');
            
            // Queue all unacknowledged orders
            pendingOrdersQueue.current = unacknowledgedOrders;
            
            // Show notification for the newest unacknowledged order
            const newestOrder = unacknowledgedOrders[0];
            console.log('Order notification: Showing notification for unacknowledged order', newestOrder.id);
            setNewOrder(newestOrder);
            setShowNotification(true);
          }
          
          isInitialLoad.current = false;
        } catch (error) {
          console.error('Error checking unacknowledged orders:', error);
          isInitialLoad.current = false;
        }
      };
      
      checkUnacknowledgedOrders();
    }

    // Set up real-time listener for new orders (like merchant folder)
    const unsubscribe = subscribeToVendorOrders([vendorId, user?.uid], (orders) => {
      // Skip initial load - we handle that separately above
      if (isInitialLoad.current) {
        return;
      }

      orders.forEach((orderData) => {
        const orderId = orderData.orderId || orderData.id;
        const status = orderData.status || '';
        const orderVendorId = resolveOrderVendorId(orderData);
        
        // Check for "Order Placed" status (like merchant folder)
        if (vendorCandidates.has(orderVendorId) && status === 'Order Placed') {
          // Check if this order has already been acknowledged or seen
          if (acknowledgedSet.has(orderId) || seenOrderIds.current.has(orderId)) {
            return; // Skip if already acknowledged
          }

          // Mark as seen immediately to prevent duplicate notifications
          seenOrderIds.current.add(orderId);

          console.log('Order notification: New order detected', {
            orderId,
            status,
            changeType: 'snapshot'
          });

          const createdAt = orderData.createdAt?.toDate 
            ? orderData.createdAt.toDate() 
            : (orderData.createdAt ? new Date(orderData.createdAt) : new Date());
          
          // Calculate total amount
          const products = orderData.products || [];
          const subtotal = products.reduce((sum, p) => {
            const price = parseFloat(p.price || 0);
            const quantity = parseInt(p.quantity || 1);
            return sum + (price * quantity);
          }, 0);
          const deliveryCharge = parseFloat(orderData.deliveryCharge || 0);
          const discount = parseFloat(orderData.discount || 0);
          const tipAmount = parseFloat(orderData.tip_amount || 0);
          const totalAmount = subtotal + deliveryCharge - discount + tipAmount;

          const transformedOrder = {
            id: orderId,
            amount: parseFloat(totalAmount.toFixed(2)),
            createdAt,
            status: 'Order Placed',
            fullOrderData: { ...orderData, id: orderId },
          };

          // Add to queue if not already there
          if (!pendingOrdersQueue.current.find(o => o.id === orderId)) {
            pendingOrdersQueue.current.push(transformedOrder);
          }
          
          // Show notification if no notification is currently showing
          if (!showNotification) {
            console.log('Order notification: Showing notification for order', orderId);
            setNewOrder(transformedOrder);
            setShowNotification(true);
          }
        }
      });
    }, (error) => {
      console.error('Error fetching orders for notification:', error);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, vendorId, showNotification]);

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
      label: 'Menu', 
      icon: (
        <img
          src="/fork-and-knife.png"
          alt="Menu"
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
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 4H3C1.89543 4 1 4.89543 1 6V18C1 19.1046 1.89543 20 3 20H21C22.1046 20 23 19.1046 23 18V6C23 4.89543 22.1046 4 21 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 10H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 14C16.5523 14 17 13.5523 17 13C17 12.4477 16.5523 12 16 12C15.4477 12 15 12.4477 15 13C15 13.5523 15.4477 14 16 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
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
    <div className="layout">
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
        </button>
      </nav>

      {/* Desktop Top Nav */}
      <nav className="top-nav">
        <Link to="/dashboard" className="nav-logo">
          <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK-Photoroom.png" alt="BestBy Bites Merchant Logo" className=" h-37 w-auto" />
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
          className="wallet-icon-btn"
          onClick={() => navigate('/wallet')}
          aria-label="Open wallet"
          title="Wallet"
        >
          {walletIcon}
        </button>
      </nav>
      <main className="main-content">
        {children}
      </main>
      <Footer />
      {/* <ChatButton /> */}
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
    </div>
  );
};

export default Layout;
