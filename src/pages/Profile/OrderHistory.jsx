import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDocuments } from '../../firebase/firestore';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import './OrderHistory.css';

/**
 * @typedef {{
 *  name: string;
 *  quantity: number;
 *  price: number;
 * }} OrderHistoryItem
 */

/**
 * @typedef {{
 *  id: string;
 *  date: string;
 *  time: string;
 *  customerName: string;
 *  customerPhone: string;
 *  customerEmail: string;
 *  bagName: string;
 *  bagId: string;
 *  amount: number;
 *  status: string;
 *  pickupTime: string;
 *  pickupDate: string;
 *  paymentMethod: string;
 *  items: OrderHistoryItem[];
 *  address: string;
 *  notes: string;
 * }} OrderHistoryRecord
 */

const OrderHistory = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [merchantVendorId, setMerchantVendorId] = useState('');

  const orderHistory = useMemo(() => orders, [orders]);

  useEffect(() => {
    let mounted = true;

    const loadVendorId = async () => {
      if (!user) {
        if (mounted) {
          setMerchantVendorId('');
          setLoading(false);
        }
        return;
      }

      const resolvedVendorId = userProfile?.vendorID || await resolveMerchantVendorId(user.uid);
      if (mounted) {
        setMerchantVendorId(resolvedVendorId || '');
      }
    };

    loadVendorId();
    return () => {
      mounted = false;
    };
  }, [user, userProfile]);

  useEffect(() => {
    let mounted = true;

    const formatTimestamp = (timestamp) => {
      if (!timestamp) return null;
      if (timestamp?.toDate) return timestamp.toDate();
      const parsed = new Date(timestamp);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    /** @param {any} order */
    const mapOrder = (order) => {
      const createdAt = formatTimestamp(order.createdAt) || new Date();
      const date = createdAt.toISOString().split('T')[0];
      const time = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const products = Array.isArray(order.products) ? order.products : [];
      const items = products.map((p) => ({
        name: p.name || 'Surprise Bag',
        quantity: parseInt(p.quantity || 1, 10),
        price: parseFloat(p.price || p.discountPrice || 0),
      }));

      const computedAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const amount = typeof order.totalAmount === 'number'
        ? order.totalAmount
        : parseFloat(order.totalAmount || computedAmount || 0);

      const firstProduct = products[0] || {};
      const customerFirst = order.author?.firstName || '';
      const customerLast = order.author?.lastName || '';
      const customerName = `${customerFirst} ${customerLast}`.trim() || order.author?.email || 'Unknown Customer';
      const pickupFrom = order.pickupTimeFrom || '';
      const pickupTo = order.pickupTimeTo || '';
      const pickupRange = pickupFrom && pickupTo ? `${pickupFrom} - ${pickupTo}` : (order.pickupTime || '');

      return /** @type {OrderHistoryRecord} */ ({
        id: order.orderId || order.id,
        date,
        time,
        customerName,
        customerPhone: order.author?.phoneNumber || 'N/A',
        customerEmail: order.author?.email || 'N/A',
        bagName: firstProduct.name || 'Surprise Bag',
        bagId: firstProduct.id || '',
        amount: Number.isNaN(amount) ? 0 : amount,
        status: order.status || 'Pending',
        pickupTime: pickupRange || 'Not set',
        pickupDate: order.pickupDate || date,
        paymentMethod: order.payment_method || order.paymentMethod || 'N/A',
        items,
        address: order.address?.address || order.vendor?.location || 'N/A',
        notes: order.notes || '',
      });
    };

    const loadOrders = async () => {
      if (!user) {
        if (mounted) {
          setOrders([]);
          setLoading(false);
        }
        return;
      }

      if (!merchantVendorId) {
        if (mounted) {
          setOrders([]);
          setLoading(false);
          setError('Vendor profile is not set up for this merchant.');
        }
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Strict merchant scoping: only this merchant's orders by vendorID.
        const result = await getDocuments(
          'restaurant_orders',
          [{ field: 'vendorID', operator: '==', value: merchantVendorId }],
          'createdAt',
          'desc',
          null
        );

        if (!mounted) return;

        if (!result.success) {
          throw new Error(result.error || 'Failed to load order history');
        }

        const mapped = (result.data || []).map(mapOrder);
        setOrders(mapped);
      } catch (err) {
        if (!mounted) return;
        setOrders([]);
        setError(err.message || 'Failed to load order history');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadOrders();
    return () => {
      mounted = false;
    };
  }, [merchantVendorId, user]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return '#4CAF50';
      case 'Pending':
        return '#FF9800';
      case 'Cancelled':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="order-history-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Order History</h1>
      </div>

      <div className="order-history-content">
        {!selectedOrder ? (
          <>
            {loading ? (
              <div className="perf-loading">Loading order history...</div>
            ) : error ? (
              <p className="perf-no-data">{error}</p>
            ) : orderHistory.length === 0 ? (
              <p className="perf-no-data">No orders found for this merchant.</p>
            ) : (
              <div className="orders-list">
                {orderHistory.map((order) => (
                  <div 
                    key={order.id} 
                    className="order-card"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="order-header">
                      <div className="order-id">Order #{order.id}</div>
                      <div 
                        className="order-status"
                        style={{ color: getStatusColor(order.status) }}
                      >
                        {order.status}
                      </div>
                    </div>
                    <div className="order-info">
                      <div className="info-row">
                        <span className="label">Customer:</span>
                        <span className="value">{order.customerName}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Bag:</span>
                        <span className="value">{order.bagName}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Date:</span>
                        <span className="value">{formatDate(order.date)} at {order.time}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Amount:</span>
                        <span className="value amount">${order.amount.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="view-details">
                      View Details →
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="order-details">
            <button className="back-to-list" onClick={() => setSelectedOrder(null)}>
              ← Back to Orders
            </button>
            <div className="details-card">
              <div className="details-header">
                <h2>Order #{selectedOrder.id}</h2>
                <div 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(selectedOrder.status) + '20', color: getStatusColor(selectedOrder.status) }}
                >
                  {selectedOrder.status}
                </div>
              </div>

              <div className="details-section">
                <h3>Order Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Order Date</span>
                    <span className="detail-value">{formatDate(selectedOrder.date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Order Time</span>
                    <span className="detail-value">{selectedOrder.time}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pickup Date</span>
                    <span className="detail-value">{formatDate(selectedOrder.pickupDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pickup Time</span>
                    <span className="detail-value">{selectedOrder.pickupTime}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Payment Method</span>
                    <span className="detail-value">{selectedOrder.paymentMethod}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total Amount</span>
                    <span className="detail-value amount">${selectedOrder.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Customer Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name</span>
                    <span className="detail-value">{selectedOrder.customerName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{selectedOrder.customerPhone}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{selectedOrder.customerEmail}</span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{selectedOrder.address}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Bag Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Bag Name</span>
                    <span className="detail-value">{selectedOrder.bagName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Bag ID</span>
                    <span className="detail-value">{selectedOrder.bagId}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Items</h3>
                <div className="items-list">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="item-row">
                      <div className="item-name">{item.name}</div>
                      <div className="item-quantity">Qty: {item.quantity}</div>
                      <div className="item-price">${item.price.toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="item-total">
                    <span>Total:</span>
                    <span>${selectedOrder.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="details-section">
                  <h3>Notes</h3>
                  <p className="notes-text">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
