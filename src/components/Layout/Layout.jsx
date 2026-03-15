import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToCollection, getDocument } from '../../firebase/firestore';
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
        if (userDoc.success && userDoc.data && userDoc.data.vendorID) {
          setVendorId(userDoc.data.vendorID);
        }
      } catch (error) {
        console.error('Error loading vendorID:', error);
      }
    };
    
    loadVendorId();
  }, [user]);

  // Subscribe to orders and detect new ones
  useEffect(() => {
    if (!user || !vendorId) {
      return;
    }

    // Subscribe to orders collection filtered by vendorID
    const filters = [{ field: 'vendorID', operator: '==', value: vendorId }];
    
    const unsubscribe = subscribeToCollection(
      'restaurant_orders',
      filters,
      (documents) => {
        console.log('Order notification: Received orders update', documents.length);
        
        // Transform orders to match format
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

          return {
            id: order.orderId || order.id,
            amount: parseFloat(totalAmount.toFixed(2)),
            createdAt,
            status,
            fullOrderData: order,
          };
        });

        // Sort by date (newest first)
        transformedOrders.sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Get current order IDs
        const currentOrderIds = new Set(transformedOrders.map(o => o.id));

        if (isInitialLoad.current) {
          // On initial load, mark all existing orders as seen
          console.log('Order notification: Initial load, marking', transformedOrders.length, 'orders as seen');
          transformedOrders.forEach(order => {
            seenOrderIds.current.add(order.id);
          });
          isInitialLoad.current = false;
        } else {
          // Find ALL new orders (not seen before) - show notification for every new order
          const newOrders = transformedOrders.filter(order => {
            const orderId = order.id;
            const isNew = !seenOrderIds.current.has(orderId);
            
            if (isNew) {
              console.log('Order notification: New order detected', {
                orderId,
                status: order.status,
                amount: order.amount,
                createdAt: order.createdAt
              });
              return true;
            }
            
            return false;
          });

          if (newOrders.length > 0) {
            console.log('Order notification: Found', newOrders.length, 'new orders to notify');
            // Show notification for the newest new order
            const newestNewOrder = newOrders[0];
            console.log('Order notification: Showing notification for order', newestNewOrder.id);
            
            // Mark this order as seen immediately
            seenOrderIds.current.add(newestNewOrder.id);
            
            // Set the order and show notification
            setNewOrder(newestNewOrder);
            setShowNotification(true);
          }

          // Clean up seenOrderIds - remove orders that no longer exist
          // This prevents memory leaks if orders are deleted
          seenOrderIds.current.forEach(orderId => {
            if (!currentOrderIds.has(orderId)) {
              seenOrderIds.current.delete(orderId);
            }
          });
        }
      },
      (error) => {
        console.error('Error fetching orders for notification:', error);
      }
    );

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
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      path: '/orders', 
      label: 'Orders', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      path: '/create-bag', 
      label: 'Menu', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 2V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 2V8C8 9.10457 8.89543 10 10 10C11.1046 10 12 9.10457 12 8V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 2V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17 2V8C17 9.10457 17.8954 10 19 10C20.1046 10 21 9.10457 21 8V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 2V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      path: '/performance', 
      label: 'Insight', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 10H16V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    { 
      path: '/profile', 
      label: 'Profile', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
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
    setShowNotification(false);
    // Clear the order data after animation
    setTimeout(() => {
      setNewOrder(null);
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
          // Refresh orders list by resetting initial load
          // This will trigger the subscription to update
        }}
      />
      {/* Mobile Header - Logo and Wallet */}
      <nav className="mobile-header">
        <Link to="/dashboard" className="mobile-logo">
          <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK-Photoroom.png" alt="BestBy Bites Merchant Logo" className="mobile-logo-img" />
        </Link>
        <button 
          className="mobile-wallet-btn"
          onClick={() => navigate('/wallet')}
          aria-label="Wallet"
        >
          {walletIcon}
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
          className="wallet-icon-btn"
          onClick={() => navigate('/wallet')}
          aria-label="Wallet"
        >
          {walletIcon}
        </button>
      </nav>
      <main className="main-content">
        {children}
      </main>
      <Footer />
      <ChatButton />
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
