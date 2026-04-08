import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { verifyOTPAndCompleteOrder } from '../../services/orderService';
import {
  resolveOrderVendorId,
  computeOrderPayableTotal,
  formatOrderPickupForMerchant,
  getSurpriseBagIdFromOrder,
} from '../../services/orderSchema';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { subscribeToVendorOrders } from '../../services/orderQuery';
import { getDocument } from '../../firebase/firestore';
import { getAdminCommissionSettings, merchantNetFromGross } from '../../services/adminCommission';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './Orders.css';

const Orders = () => {
  const navigate = useNavigate();
  const { user, vendorProfile } = useAuth();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('All');
  const [otpInputs, setOtpInputs] = useState({});
  const [verifyingOTP, setVerifyingOTP] = useState({});
  const [rawOrderDocs, setRawOrderDocs] = useState([]);
  const [commissionSettings, setCommissionSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateRange, setDateRange] = useState('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  /** `merchant_surprise_bag` docs keyed by bag id (from first line item) */
  const [bagDocsById, setBagDocsById] = useState({});
  const attemptedBagFetchRef = useRef(new Set());
  const dateFilterModalContentRef = useRef(null);
  const customDateInputsRef = useRef(null);

  // Get vendorID from user document
  useEffect(() => {
    const loadVendorId = async () => {
      if (!user) return;
      
      try {
        const resolvedVendorId = await resolveMerchantVendorId(user.uid);
        if (resolvedVendorId) {
          setVendorId(resolvedVendorId);
        } else {
          console.warn('No vendorID found for user. Please set up your store first.');
          showToast('Please set up your store to view orders', 'warning');
        }
      } catch (error) {
        console.error('Error loading vendorID:', error);
      }
    };
    
    loadVendorId();
  }, [user, showToast]);

  useEffect(() => {
    let cancelled = false;
    getAdminCommissionSettings().then((s) => {
      if (!cancelled) setCommissionSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setRawOrderDocs([]);
      return;
    }

    const unsubscribe = subscribeToVendorOrders(
      [vendorId, user?.uid],
      (documents) => {
        setRawOrderDocs(documents);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching orders:', error);
        showToast('Failed to load orders', 'error');
        setLoading(false);
        setRawOrderDocs([]);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, vendorId, showToast]);

  // Load surprise bag docs so pickup times can use `outletTimings` from bag creation.
  useEffect(() => {
    let cancelled = false;
    const ids = new Set();
    rawOrderDocs.forEach((order) => {
      const bid = getSurpriseBagIdFromOrder(order);
      if (bid) ids.add(bid);
    });
    const missing = [...ids].filter((id) => !attemptedBagFetchRef.current.has(id));
    if (missing.length === 0) return undefined;

    (async () => {
      const results = await Promise.all(
        missing.map((id) => getDocument('merchant_surprise_bag', id))
      );
      if (cancelled) return;
      missing.forEach((id) => attemptedBagFetchRef.current.add(id));
      setBagDocsById((prev) => {
        const next = { ...prev };
        missing.forEach((id, i) => {
          const r = results[i];
          if (r.success && r.data) next[id] = r.data;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [rawOrderDocs]);

  const orders = useMemo(() => {
    const vendorCandidates = new Set([vendorId, user?.uid].filter(Boolean));
    const transformedOrders = rawOrderDocs.map((order) => {
      const createdAt = order.createdAt?.toDate
        ? order.createdAt.toDate()
        : (order.createdAt ? new Date(order.createdAt) : new Date());

      const customerName = order.author?.firstName && order.author?.lastName
        ? `${order.author.firstName} ${order.author.lastName}`
        : order.author?.firstName || order.author?.email || 'Unknown Customer';

      const products = order.products || [];
      const bagName = products.length > 0
        ? products[0].name || 'Surprise Bag'
        : 'Surprise Bag';

      const totalAmount = computeOrderPayableTotal(order);
      const displayAmount = merchantNetFromGross(totalAmount, commissionSettings);
      const bagId = getSurpriseBagIdFromOrder(order);
      const bagDoc = bagId ? bagDocsById[bagId] : null;
      const pickupTime = formatOrderPickupForMerchant(order, bagDoc);

      let status = (order.status || '').toLowerCase();
      if (status === 'order completed' || status === 'completed') status = 'completed';
      else if (
        status === 'order cancelled'
        || status === 'cancelled'
        || status === 'order rejected'
        || status === 'rejected'
        || status === 'driver rejected'
      ) {
        status = 'cancelled';
      } else {
        // After acceptance and before completion, treat all as "pending" in merchant UI.
        status = 'pending';
      }

      const otp = order.otp || null;
      const otpExpiresAt = order.otpExpiresAt?.toDate
        ? order.otpExpiresAt.toDate()
        : (order.otpExpiresAt ? new Date(order.otpExpiresAt) : null);
      const otpVerified = order.otpVerified || false;

      return {
        id: order.id || order.orderId || `${order.createdAt?.seconds || 'order'}-${order.authorID || 'unknown'}`,
        customerName,
        customerPhone: order.author?.phoneNumber || (order.author?.countryCode ? `${order.author.countryCode}${order.author.phoneNumber}` : 'N/A'),
        customerEmail: order.author?.email || 'N/A',
        bagName,
        pickupTime,
        amount: displayAmount,
        status,
        createdAt,
        otp,
        otpExpiresAt,
        otpVerified,
        fullOrderData: order,
      };
    });

    let filteredOrders = transformedOrders;
    if (vendorCandidates.size > 0) {
      filteredOrders = transformedOrders.filter((row) => {
        const orderVendorId = resolveOrderVendorId(row.fullOrderData || {});
        return vendorCandidates.has(orderVendorId);
      });
    } else {
      filteredOrders = [];
    }

    filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return filteredOrders;
  }, [rawOrderDocs, vendorId, user?.uid, commissionSettings, bagDocsById]);

  // Calculate date ranges
  const getDateRange = (rangeType) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let startDate = new Date();
    
    switch (rangeType) {
      case 'Last 2 days':
        startDate.setDate(today.getDate() - 1); // Include today and yesterday
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'This week':
        const dayOfWeek = today.getDay();
        startDate.setDate(today.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'Last week':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
        lastWeekEnd.setHours(23, 59, 59, 999);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        lastWeekStart.setHours(0, 0, 0, 0);
        return { start: lastWeekStart, end: lastWeekEnd };
      case 'Last 30 days':
        startDate.setDate(today.getDate() - 29); // Include today, so 30 days total
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'Custom date range':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return null;
      default:
        return null;
    }
    
    return { start: startDate, end: today };
  };

  // Format date for display
  const formatDateRange = (rangeType) => {
    if (rangeType === 'All' || !rangeType) return '';
    
    const range = getDateRange(rangeType);
    if (!range) {
      if (rangeType === 'Custom date range') {
        return 'Select your own date range';
      }
      return '';
    }
    
    const formatDate = (date) => {
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      return `${day.toString().padStart(2, '0')} ${month}`;
    };
    
    if (rangeType === 'Custom date range') {
      return customStartDate && customEndDate 
        ? `${formatDate(new Date(customStartDate))} - ${formatDate(new Date(customEndDate))}`
        : 'Select your own date range';
    }
    
    return `${formatDate(range.start)} - ${formatDate(range.end)}`;
  };

  const filteredOrders = orders.filter(order => {
    // Filter by status (Archive parity: "Pending" = anything not completed/cancelled)
    let statusMatch = true;
    if (filter !== 'All') {
      if (filter === 'Complete') {
        statusMatch = order.status === 'completed';
      } else if (filter === 'Pending') {
        statusMatch = order.status !== 'completed' && order.status !== 'cancelled';
      } else {
        statusMatch = order.status === filter.toLowerCase();
      }
    }
    
    // Filter by date range
    let dateMatch = true;
    if (dateRange && dateRange !== 'All') {
      const range = getDateRange(dateRange);
      if (range) {
        const orderDate = new Date(order.createdAt);
        dateMatch = orderDate >= range.start && orderDate <= range.end;
      } else {
        dateMatch = false;
      }
    }
    
    return statusMatch && dateMatch;
  });

  const handleVerifyOTP = async (order) => {
    const enteredOTP = otpInputs[order.id];
    
    if (!enteredOTP || enteredOTP.length !== 6) {
      showToast('Please enter a valid 6-digit OTP', 'error');
      return;
    }

    // Set verifying state
    setVerifyingOTP(prev => ({ ...prev, [order.id]: true }));

    try {
      const result = await verifyOTPAndCompleteOrder(order.id, enteredOTP);

      if (result.success) {
        showToast('OTP verified successfully! Order marked as completed.', 'success');
        // Clear OTP input for this order
        setOtpInputs(prev => {
          const newInputs = { ...prev };
          delete newInputs[order.id];
          return newInputs;
        });
      } else {
        showToast(result.error || 'Invalid OTP. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      showToast('Failed to verify OTP. Please try again.', 'error');
    } finally {
      setVerifyingOTP(prev => {
        const newState = { ...prev };
        delete newState[order.id];
        return newState;
      });
    }
  };

  const filterOptions = ['All', 'Pending', 'Complete', 'Cancelled'];

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>Orders</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Orders</h1>
      </div>

      <div className="orders-filters">
        <div className="filter-segmented-control">
          {filterOptions.map((option) => (
            <button
              key={option}
              className={`filter-option ${filter === option ? 'active' : ''}`}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <button 
          className="date-filter-btn"
          onClick={() => setShowDateFilter(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {dateRange && dateRange !== 'All' && <span className="date-filter-label">{formatDateRange(dateRange)}</span>}
        </button>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-light)', marginBottom: '1rem' }}>
            No orders found
          </p>
          <p style={{ color: 'var(--text-light)' }}>
            Orders will appear here once customers place them.
          </p>
        </div>
      ) : (
        <div className="orders-grid">
          {filteredOrders.map((order) => (
          <div key={order.id} className="order-card">
            <div className="order-card-header">
              <h3>Order {order.id.substring(0, 8)}...</h3>
              <span className={`status-badge status-${order.status.toLowerCase()}`}>
                {order.status}
              </span>
            </div>
            <div className="order-card-body">
              <div className="order-detail">
                <span className="detail-label">Customer:</span>
                <span className="detail-value">{order.customerName}</span>
              </div>
              <div className="order-detail">
                <span className="detail-label">Bag:</span>
                <span className="detail-value">{order.bagName}</span>
              </div>
              <div className="order-detail">
                <span className="detail-label">Pickup Time:</span>
                <span className="detail-value">{order.pickupTime}</span>
              </div>
              <div className="order-detail">
                <span className="detail-label">Amount:</span>
                <span className="detail-value amount">
                  {formatMerchantCurrency(order.amount, vendorProfile)}
                </span>
              </div>
            </div>
            <div className="order-card-footer">
              {order.status === 'pending' && (
                <div className="accepted-order-section">
                  {!order.otpVerified ? (
                    <div className="otp-verification-section">
                      <label htmlFor={`otp-${order.id}`}>Customer OTP:</label>
                      <div className="otp-note">Enter 6 digit otp to confirm pickup.</div>
                      <div className="otp-input-group">
                        <input
                          id={`otp-${order.id}`}
                          type="text"
                          value={otpInputs[order.id] || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setOtpInputs((prev) => ({ ...prev, [order.id]: value }));
                          }}
                          placeholder="Enter OTP"
                          maxLength="6"
                          className="otp-input"
                        />
                        <button
                          type="button"
                          onClick={() => handleVerifyOTP(order)}
                          className="btn btn-success btn-sm"
                          disabled={verifyingOTP[order.id] || (otpInputs[order.id] || '').length !== 6}
                        >
                          {verifyingOTP[order.id] ? 'Verifying...' : 'image.pngComplete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="otp-verified-badge">
                      ✓ OTP Verified - Order Completed
                    </div>
                  )}
                </div>
              )}
              {(order.status === 'completed' || order.status === 'cancelled') && (
                <div className="order-status-final">
                  Status: {order.status === 'completed' ? 'Completed' : 'Cancelled'}
                </div>
              )}
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Date Range Filter Modal */}
      {showDateFilter && (
        <div className="date-filter-modal-overlay" onClick={(e) => {
          if (e.target.classList.contains('date-filter-modal-overlay')) {
            setShowDateFilter(false);
            setShowCustomDatePicker(false);
          }
        }}>
          <div className="date-filter-modal-content" ref={dateFilterModalContentRef}>
            <div className="date-filter-modal-header">
              <h2>Select date range</h2>
            </div>
            <div className="date-filter-options">
              {['All', 'Last 2 days', 'This week', 'Last week', 'Last 30 days', 'Custom date range'].map((option, index) => (
                <div key={option}>
                  <label 
                    className="date-filter-option"
                    onClick={() => {
                      if (option === 'Custom date range') {
                        const nextOpen = !(dateRange === 'Custom date range' && showCustomDatePicker);
                        setDateRange('Custom date range');
                        setShowCustomDatePicker(nextOpen);
                        if (nextOpen) {
                          // Expand and scroll to the start/end inputs so they are visible.
                          window.setTimeout(() => {
                            customDateInputsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 0);
                        }
                      } else {
                        setDateRange(option);
                        setShowCustomDatePicker(false);
                      }
                    }}
                  >
                    <div className="date-filter-option-content">
                      <div className="date-filter-option-main">
                        <span className="date-filter-option-title">{option}</span>
                        {option !== 'All' && <span className="date-filter-option-dates">{formatDateRange(option)}</span>}
                      </div>
                      {option === 'Custom date range' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            className={`date-filter-chevron${dateRange === 'Custom date range' && showCustomDatePicker ? ' date-filter-chevron--open' : ''}`}
                            d="M9 18L15 12L9 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : option === 'All' ? (
                        <input
                          type="radio"
                          name="dateRange"
                          value="All"
                          checked={dateRange === 'All'}
                          onChange={(e) => setDateRange(e.target.value)}
                          className="date-filter-radio"
                        />
                      ) : (
                        <input
                          type="radio"
                          name="dateRange"
                          value={option}
                          checked={dateRange === option}
                          onChange={(e) => setDateRange(e.target.value)}
                          className="date-filter-radio"
                        />
                      )}
                    </div>
                  </label>
                  {option === 'Custom date range' && dateRange === 'Custom date range' && showCustomDatePicker && (
                    <div className="custom-date-inputs" ref={customDateInputsRef}>
                      <div className="input-group">
                        <label>Start Date</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          max={customEndDate || new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="input-group">
                        <label>End Date</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          min={customStartDate}
                          max={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>
                  )}
                  {index < 5 && <div className="date-filter-divider"></div>}
                </div>
              ))}
            </div>
            <div className="date-filter-actions">
              <button
                className="btn btn-primary btn-full"
                onClick={() => {
                  if (dateRange === 'Custom date range' && (!customStartDate || !customEndDate)) {
                    showToast('Please select both start and end dates', 'error');
                    return;
                  }
                  setShowDateFilter(false);
                  setShowCustomDatePicker(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
