import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminCommissionSettings, merchantNetFromGross } from '../../services/adminCommission';
import { getMerchantChatQueryIds } from '../../services/chatMerchant';
import { getVendorOrdersOnce } from '../../services/orderQuery';
import {
  computeOrderPayableTotal,
  formatOrderPickupWindow,
  getOrderLineItemUnitPrice,
} from '../../services/orderSchema';
import { isOrderTerminalComplete } from '../../services/payoutRequest';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
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
 *  grossTotal: number;
 *  status: string;
 *  pickupTime: string;
 *  pickupDate: string;
 *  paymentMethod: string;
 *  items: OrderHistoryItem[];
 *  thumbUrls: string[];
 *  blinkitKind: 'success' | 'danger' | 'warning';
 *  blinkitTitle: string;
 *  address: string;
 *  notes: string;
 *  createdAt: Date;
 * }} OrderHistoryRecord
 */

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: '3days', label: 'Past 3 days' },
  { key: '7days', label: 'Past 7 days' },
  { key: 'month', label: 'Past month' },
  { key: 'year', label: 'Past year' },
];

function formatTimestamp(ts) {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** @param {Record<string, unknown>} p */
function productLineImage(p) {
  if (!p || typeof p !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (p);
  const candidates = [o.image, o.imageUrl, o.photo, o.thumbnail, o.picture];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('http')) return c;
  }
  return null;
}

/** @param {Record<string, unknown>} order */
function pickOrderThumbUrls(order) {
  const products = Array.isArray(order.products) ? order.products : [];
  const urls = [];
  for (const p of products) {
    const u = productLineImage(p);
    if (u) urls.push(u);
    if (urls.length >= 6) break;
  }
  return urls;
}

/** @param {Record<string, unknown>} order */
function orderBucket(order) {
  const st = (order.status || '').toString().toLowerCase();
  if (st.includes('cancel')) return 'cancelled';
  if (isOrderTerminalComplete(order)) return 'completed';
  return 'active';
}

/** @param {Record<string, unknown>} order */
function blinkitHeadline(order) {
  const bucket = orderBucket(order);
  if (bucket === 'cancelled') {
    return { kind: /** @type {const} */ ('danger'), title: 'Order cancelled' };
  }

  const created = formatTimestamp(order.createdAt);
  const completed = formatTimestamp(
    order.completedAt || order.completed_at || order.deliveredAt
  );

  if (bucket === 'completed' && created && completed) {
    const mins = Math.round((completed.getTime() - created.getTime()) / 60000);
    if (mins > 0 && mins < 7 * 24 * 60) {
      return { kind: /** @type {const} */ ('success'), title: `Arrived in ${mins} minutes` };
    }
  }
  if (bucket === 'completed') {
    return { kind: /** @type {const} */ ('success'), title: 'Order completed' };
  }

  const raw = (order.status || 'In progress').toString().trim();
  const title = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'In progress';
  return { kind: /** @type {const} */ ('warning'), title };
}

function formatBlinkitMetaLine(createdAt, grossTotal, vendorProfile) {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const datePart = d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const price = formatMerchantCurrency(grossTotal, vendorProfile);
  return `${price} • ${datePart}`;
}

const OrderHistory = () => {
  const navigate = useNavigate();
  const { user, vendorProfile } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState(/** @type {OrderHistoryRecord | null} */ (null));
  const [orders, setOrders] = useState(/** @type {OrderHistoryRecord[]} */ ([]));
  const [dateFilter, setDateFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const orderHistory = useMemo(() => orders, [orders]);

  useEffect(() => {
    let mounted = true;

    /** @param {any} order @param {Record<string, unknown> | null} commissionSettings */
    const mapOrder = (order, commissionSettings) => {
      const createdAt = formatTimestamp(order.createdAt) || new Date();
      const date = createdAt.toISOString().split('T')[0];
      const time = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const products = Array.isArray(order.products) ? order.products : [];
      const items = products.map((p) => ({
        name: p.name || 'Surprise Bag',
        quantity: parseInt(p.quantity || 1, 10),
        price: getOrderLineItemUnitPrice(p),
      }));

      const gross = computeOrderPayableTotal(order);
      const amount = merchantNetFromGross(gross, commissionSettings);
      const { kind, title } = blinkitHeadline(order);
      const thumbUrls = pickOrderThumbUrls(order);

      const firstProduct = products[0] || {};
      const customerFirst = order.author?.firstName || '';
      const customerLast = order.author?.lastName || '';
      const customerName =
        `${customerFirst} ${customerLast}`.trim() || order.author?.email || 'Unknown Customer';
      const pickupLabel = formatOrderPickupWindow(order);

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
        grossTotal: Number.isFinite(gross) ? gross : 0,
        status: order.status || 'Pending',
        pickupTime: pickupLabel === 'Not specified' ? 'Not set' : pickupLabel,
        pickupDate: order.pickupDate || date,
        paymentMethod: order.payment_method || order.paymentMethod || 'N/A',
        items,
        thumbUrls,
        blinkitKind: kind,
        blinkitTitle: title,
        address: order.address?.address || order.vendor?.location || 'N/A',
        notes: order.notes || '',
        createdAt,
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

      try {
        setLoading(true);
        setError('');

        const merchantIds = await getMerchantChatQueryIds(user.uid);
        if (!mounted) return;

        if (merchantIds.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }

        const [commissionSettings, rawOrders] = await Promise.all([
          getAdminCommissionSettings(),
          getVendorOrdersOnce(merchantIds),
        ]);

        if (!mounted) return;

        const sorted = [...rawOrders].sort((a, b) => {
          const ta = formatTimestamp(a.createdAt)?.getTime() || 0;
          const tb = formatTimestamp(b.createdAt)?.getTime() || 0;
          return tb - ta;
        });

        const mapped = sorted.map((o) => mapOrder(o, commissionSettings));
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
  }, [user]);

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
      day: 'numeric',
    });
  };

  const filteredOrderHistory = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    return orderHistory.filter((order) => {
      const orderDate = order.createdAt instanceof Date ? order.createdAt : new Date(order.date);
      if (Number.isNaN(orderDate.getTime())) return false;

      if (dateFilter === 'today') {
        return orderDate >= startOfToday;
      }
      if (dateFilter === '3days') {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 3);
        return orderDate >= cutoff;
      }
      if (dateFilter === '7days') {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 7);
        return orderDate >= cutoff;
      }
      if (dateFilter === 'month') {
        const cutoff = new Date(now);
        cutoff.setMonth(now.getMonth() - 1);
        return orderDate >= cutoff;
      }
      if (dateFilter === 'year') {
        const cutoff = new Date(now);
        cutoff.setFullYear(now.getFullYear() - 1);
        return orderDate >= cutoff;
      }
      return true;
    });
  }, [orderHistory, dateFilter]);

  return (
    <div className="order-history-page">
      <div className="page-header">
        <button type="button" className="back-button" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Order History</h1>
      </div>

      <div className="order-history-content">
        {!selectedOrder ? (
          <>
            {!loading && !error && orderHistory.length > 0 && (
              <div className="order-history-filters">
                {DATE_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`order-history-filter-btn ${dateFilter === filter.key ? 'active' : ''}`}
                    onClick={() => setDateFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
            {loading ? (
              <div className="perf-loading">Loading order history...</div>
            ) : error ? (
              <p className="perf-no-data">{error}</p>
            ) : filteredOrderHistory.length === 0 ? (
              <div className="order-history-empty">
                <p className="order-history-empty__title">No orders yet</p>
                <p className="order-history-empty__sub">
                  Completed and in-progress orders for your store will show up here.
                </p>
              </div>
            ) : (
              <div className="orders-list orders-list--blinkit">
                {filteredOrderHistory.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="oh-card"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="oh-card__header">
                      <div
                        className={`oh-card__status-icon oh-card__status-icon--${order.blinkitKind}`}
                        aria-hidden
                      >
                        {order.blinkitKind === 'danger' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="oh-card__header-text">
                        <div className="oh-card__title">{order.blinkitTitle}</div>
                        <div className="oh-card__meta">
                          {formatBlinkitMetaLine(order.createdAt, order.grossTotal, vendorProfile)}
                        </div>
                      </div>
                      <span className="oh-card__chevron" aria-hidden>›</span>
                    </div>
                    <div className="oh-card__thumbs">
                      {order.thumbUrls.length > 0 ? (
                        order.thumbUrls.map((url, i) => (
                          <div key={`${order.id}-t-${i}`} className="oh-card__thumb-cell">
                            <img src={url} alt="" />
                          </div>
                        ))
                      ) : (
                        <div className="oh-card__thumb-cell oh-card__thumb-cell--placeholder">
                          <span className="oh-card__thumb-placeholder-label">{order.bagName}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="order-details">
            <button type="button" className="back-to-list" onClick={() => setSelectedOrder(null)}>
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
                    <span className="detail-label">Total (customer)</span>
                    <span className="detail-value amount">
                      {formatMerchantCurrency(selectedOrder.grossTotal, vendorProfile)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Your earnings (after commission)</span>
                    <span className="detail-value amount">
                      {formatMerchantCurrency(selectedOrder.amount, vendorProfile)}
                    </span>
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
                      <div className="item-price">
                        {formatMerchantCurrency(item.price, vendorProfile)}
                      </div>
                    </div>
                  ))}
                  <div className="item-total">
                    <span>Your earnings:</span>
                    <span>
                      {formatMerchantCurrency(selectedOrder.amount, vendorProfile)}
                    </span>
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
