import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase/config';
import { resolveMerchantVendorId } from '../../services/merchantVendor';
import { getVendorOrdersOnce } from '../../services/orderQuery';
import {
  computeOrderPayableTotal,
  resolveOrderVendorId,
} from '../../services/orderSchema';
import {
  createPayoutRequest,
  fetchPayoutRequestsForMerchant,
  isOrderEligibleForPayout,
} from '../../services/payoutRequest';
import './Accounting.css';

const formatCurrency = (amount) => `₹${Math.abs(amount).toFixed(2)}`;

function formatRequestTimestamp(ts) {
  if (!ts) return '—';
  const d =
    typeof ts.toDate === 'function'
      ? ts.toDate()
      : new Date((ts.seconds ?? 0) * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const Accounting = () => {
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('payouts');
  const [dateRange] = useState('01 Feb - 01 Mar\'26');

  const [vendorId, setVendorId] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (location.pathname === '/invoices' || location.pathname === '/taxes' || location.pathname === '/invoice-taxes') {
      setActiveTab('invoices');
    } else {
      setActiveTab('payouts');
    }
  }, [location.pathname]);

  // Match Orders.jsx: primary vendor id from resolveMerchantVendorId only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setVendorId(null);
        return;
      }
      try {
        const resolved = await resolveMerchantVendorId(user.uid);
        if (!cancelled) setVendorId(resolved);
      } catch (e) {
        console.error('Accounting: resolveMerchantVendorId failed', e);
        if (!cancelled) setVendorId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Query orders with every id the store might use on documents (same union as Orders queries,
  // plus users.vendorID when it differs from resolve — fixes missing rows on Payout).
  useEffect(() => {
    if (!user) {
      setAllOrders([]);
      setPayoutRequests([]);
      setOrdersLoading(false);
      return;
    }
    const orderCandidates = [...new Set([userProfile?.vendorID, vendorId, user.uid].filter(Boolean))];
    const merchantIdForPayouts = vendorId || userProfile?.vendorID || user.uid;
    if (!merchantIdForPayouts) {
      setAllOrders([]);
      setPayoutRequests([]);
      setOrdersLoading(false);
      return;
    }

    let cancelled = false;
    setOrdersLoading(true);
    (async () => {
      try {
        const [orders, requests] = await Promise.all([
          getVendorOrdersOnce(orderCandidates),
          fetchPayoutRequestsForMerchant(db, merchantIdForPayouts),
        ]);
        if (cancelled) return;
        setAllOrders(orders);
        setPayoutRequests(requests);
      } catch (err) {
        console.error('Accounting load failed', err);
        if (!cancelled) {
          showToast(err?.message || 'Could not load payout data', 'error');
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, userProfile?.vendorID, vendorId, reloadTick, showToast]);

  const vendorCandidates = useMemo(
    () => new Set([userProfile?.vendorID, vendorId, user?.uid].filter(Boolean)),
    [userProfile?.vendorID, vendorId, user?.uid]
  );

  const ordersForMerchant = useMemo(() => {
    if (vendorCandidates.size === 0) return [];
    return allOrders.filter((o) => vendorCandidates.has(resolveOrderVendorId(o)));
  }, [allOrders, vendorCandidates]);

  const eligibleOrders = useMemo(
    () => ordersForMerchant.filter((o) => isOrderEligibleForPayout(o)),
    [ordersForMerchant]
  );

  const selectedOrders = useMemo(
    () => eligibleOrders.filter((o) => selectedIds.has(o.id)),
    [eligibleOrders, selectedIds]
  );

  const selectedTotal = useMemo(
    () =>
      Math.round(
        selectedOrders.reduce((sum, o) => sum + computeOrderPayableTotal(o), 0) * 100
      ) / 100,
    [selectedOrders]
  );

  const toggleOrder = (orderId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const selectAllEligible = () => {
    setSelectedIds(new Set(eligibleOrders.map((o) => o.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleRequestPayout = async () => {
    const merchantIdForPayouts = vendorId || userProfile?.vendorID || user?.uid;
    if (!merchantIdForPayouts) {
      showToast('Merchant account not ready', 'error');
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showToast('Select at least one order', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createPayoutRequest(db, merchantIdForPayouts, ids);
      showToast('Payout request submitted', 'success');
      setSelectedIds(new Set());
      setReloadTick((t) => t + 1);
    } catch (err) {
      console.error('createPayoutRequest', err);
      showToast(err?.message || 'Could not create payout request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGetReport = () => {
    console.log('Downloading report for:', dateRange);
  };

  // Mock invoice data
  const invoices = [
    {
      id: 'INV-001',
      date: '01 Mar\'26',
      amount: 1250.50,
      tax: 125.05,
      total: 1375.55,
      status: 'PAID',
    },
    {
      id: 'INV-002',
      date: '18 Feb\'26',
      amount: 890.25,
      tax: 89.03,
      total: 979.28,
      status: 'PAID',
    },
    {
      id: 'INV-003',
      date: '11 Feb\'26',
      amount: 650.00,
      tax: 65.00,
      total: 715.00,
      status: 'PENDING',
    },
  ];

  const payoutStatusClass = (status) => {
    const s = (status || 'pending').toString().trim().toLowerCase().replace(/\s+/g, '-');
    return `payout-status status-${s}`;
  };

  return (
    <div className="accounting-page">
      <div className="accounting-header">
        <div className="accounting-tabs">
          <button
            type="button"
            className={`tab-button ${activeTab === 'payouts' ? 'active' : ''}`}
            onClick={() => setActiveTab('payouts')}
          >
            Payouts
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            Invoices & Taxes
          </button>
        </div>

        <div className="accounting-filters">
          <button type="button" className="date-range-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M3 10H21" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>{dateRange}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button type="button" className="get-report-button" onClick={handleGetReport}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Get report
          </button>
        </div>
      </div>

      <div className="accounting-content">
        {activeTab === 'payouts' && (
          <div className="payouts-section">
            <section className="payout-request-panel accounting-card">
              <div className="payout-panel-header">
                <div>
                  <h2 className="payout-section-title">Request payout</h2>
                  <p className="payout-section-hint">
                    Select completed orders that are not already in a payout request. Amounts use the same totals as your dashboard.
                  </p>
                </div>
                {eligibleOrders.length > 0 && (
                  <div className="payout-select-tools">
                    <button type="button" className="payout-text-btn" onClick={selectAllEligible}>
                      Select all
                    </button>
                    <button type="button" className="payout-text-btn" onClick={clearSelection}>
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {ordersLoading && (
                <p className="payout-loading">Loading orders…</p>
              )}

              {!ordersLoading && user && eligibleOrders.length === 0 && (
                <p className="payout-empty">
                  {ordersForMerchant.length > 0
                    ? 'No orders are eligible for payout yet. Check that each order is completed, has a positive total, and is not already in a payout request.'
                    : 'No eligible orders right now. Completed orders that have not been requested for payout will appear here.'}
                </p>
              )}

              {!ordersLoading && eligibleOrders.length > 0 && (
                <div className="payout-table-wrap">
                  <table className="payout-eligible-table">
                    <thead>
                      <tr>
                        <th className="payout-col-check" scope="col">
                          <span className="sr-only">Select</span>
                        </th>
                        <th scope="col">Order</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="payout-col-amount">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleOrders.map((order) => {
                        const amount = computeOrderPayableTotal(order);
                        const checked = selectedIds.has(order.id);
                        return (
                          <tr key={order.id}>
                            <td className="payout-col-check">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleOrder(order.id)}
                                aria-label={`Include order ${order.id}`}
                              />
                            </td>
                            <td>
                              <span className="payout-order-id">{order.id}</span>
                            </td>
                            <td>
                              <span className="payout-order-status">{order.status || '—'}</span>
                            </td>
                            <td className="payout-col-amount">{formatCurrency(amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!ordersLoading && eligibleOrders.length > 0 && (
                <div className="payout-request-actions">
                  <div className="payout-request-summary">
                    <span>
                      {selectedOrders.length} order{selectedOrders.length === 1 ? '' : 's'} selected
                    </span>
                    <span className="payout-request-total">
                      Total: {formatCurrency(selectedTotal)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="payout-request-submit"
                    disabled={submitting || selectedIds.size === 0}
                    onClick={handleRequestPayout}
                  >
                    {submitting ? 'Submitting…' : 'Request payout'}
                  </button>
                </div>
              )}
            </section>

            <section className="payout-history-section">
              <h2 className="payout-section-title payout-history-title">Payout requests</h2>
              {payoutRequests.length === 0 && !ordersLoading && (
                <p className="payout-empty accounting-card payout-history-empty">
                  No payout requests yet.
                </p>
              )}
              {payoutRequests.map((payout) => (
                <div key={payout.id} className="payout-card">
                  <div className="payout-header">
                    <div className="payout-amount-section">
                      <div className="payout-label">Requested amount</div>
                      <div className="payout-amount">
                        {formatCurrency(payout.totalAmount ?? 0)}
                      </div>
                      <div className="payout-orders">
                        {(payout.orderIds?.length ?? 0)} order{(payout.orderIds?.length ?? 0) === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className={payoutStatusClass(payout.status)}>
                      {(payout.status || 'pending').toString().toUpperCase()}
                    </div>
                  </div>
                  <div className="payout-details">
                    <div className="payout-detail-item">
                      <span className="detail-label">Request ID:</span>
                      <span className="detail-value payout-mono">{payout.id}</span>
                    </div>
                    <div className="payout-detail-item">
                      <span className="detail-label">Requested:</span>
                      <span className="detail-value">{formatRequestTimestamp(payout.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="invoices-section">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="invoice-card">
                <div className="invoice-header">
                  <div className="invoice-id">{invoice.id}</div>
                  <div className={`invoice-status status-${invoice.status.toLowerCase()}`}>
                    {invoice.status}
                  </div>
                </div>
                <div className="invoice-details">
                  <div className="invoice-detail-row">
                    <span className="detail-label">Date:</span>
                    <span className="detail-value">{invoice.date}</span>
                  </div>
                  <div className="invoice-detail-row">
                    <span className="detail-label">Amount:</span>
                    <span className="detail-value">{formatCurrency(invoice.amount)}</span>
                  </div>
                  <div className="invoice-detail-row">
                    <span className="detail-label">Tax:</span>
                    <span className="detail-value">{formatCurrency(invoice.tax)}</span>
                  </div>
                  <div className="invoice-detail-row total-row">
                    <span className="detail-label">Total:</span>
                    <span className="detail-value total-amount">{formatCurrency(invoice.total)}</span>
                  </div>
                </div>
                <button type="button" className="download-invoice-button">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Download Invoice
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Accounting;
