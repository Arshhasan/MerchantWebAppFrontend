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

  // const walletIcon = (
  //   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  //     <path d="M21 4H3C1.89543 4 1 4.89543 1 6V18C1 19.1046 1.89543 20 3 20H21C22.1046 20 23 19.1046 23 18V6C23 4.89543 22.1046 4 21 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  //     <path d="M1 10H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  //     <path d="M16 14C16.5523 14 17 13.5523 17 13C17 12.4477 16.5523 12 16 12C15.4477 12 15 12.4477 15 13C15 13.5523 15.4477 14 16 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  //   </svg>
  // );

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
      {/* Mobile Header - Logo */}
      <nav className="mobile-header">
        <Link to="/dashboard" className="mobile-logo">
          <img src="/LOGO-BESTBBYBITES-MERCHANT-DARK-Photoroom.png" alt="BestBy Bites Merchant Logo" className="mobile-logo-img" />
        </Link>
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
