import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
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
  fetchMerchantVisiblePayoutRequests,
  getPayoutRequestAmount,
  isOrderEligibleForPayout,
} from '../../services/payoutRequest';
import {
  fetchMerchantInvoices,
  syncMissingMerchantInvoices,
} from '../../services/merchantInvoices';
import InvoiceDocument from '../../components/Invoice/InvoiceDocument';
import { downloadInvoiceAsPdf } from '../../utils/invoicePdf';
import {
  formatDollarAmount,
  formatMerchantCurrency,
  resolveMerchantCurrencyCode,
} from '../../utils/merchantCurrencyFormat';
import { useMerchantWalletSummary } from '../../hooks/useMerchantWalletSummary';
import './Accounting.css';

function formatInvoiceMoney(amount) {
  return formatDollarAmount(amount);
}

function formatRequestTimestamp(ts) {
  if (!ts) return '—';
  const d =
    typeof ts.toDate === 'function'
      ? ts.toDate()
      : new Date((ts.seconds ?? 0) * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function payoutPaymentSummaryLine(payout) {
  const m = payout.payoutPaymentMethod;
  if (m === 'paypal') {
    const e = payout.payoutPaymentDetails?.paypal?.email;
    return e ? `PayPal — ${e}` : 'PayPal';
  }
  if (m === 'stripe') {
    const a = payout.payoutPaymentDetails?.stripe?.accountId;
    return a ? `Stripe — ${a}` : 'Stripe';
  }
  return null;
}

const Accounting = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, vendorProfile, vendorLoading } = useAuth();
  const { showToast } = useToast();
  const formatCurrency = (amount) => formatMerchantCurrency(amount, vendorProfile);
  const merchantInvoiceCurrency = resolveMerchantCurrencyCode(vendorProfile);

  const [activeTab, setActiveTab] = useState('payouts');

  const [vendorId, setVendorId] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [reloadTick] = useState(0);

  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [pdfWorking, setPdfWorking] = useState(false);
  const invoicePrintRef = useRef(null);

  const merchantIdForInvoices = useMemo(
    () => vendorId || userProfile?.vendorID || user?.uid || null,
    [vendorId, userProfile?.vendorID, user?.uid]
  );

  const { loading: walletSummaryLoading, walletBalance: walletBalanceFromFirestore } =
    useMerchantWalletSummary(vendorId, reloadTick);

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
    const mid = vendorId || userProfile?.vendorID || user.uid;
    if (!mid) {
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
          fetchMerchantVisiblePayoutRequests(db, mid),
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

  useEffect(() => {
    if (!merchantIdForInvoices) {
      setInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    if (ordersLoading) {
      setInvoicesLoading(true);
      return;
    }
    let cancelled = false;
    setInvoicesLoading(true);
    (async () => {
      try {
        await syncMissingMerchantInvoices(db, merchantIdForInvoices, ordersForMerchant, {
          fallbackCurrencyCode: merchantInvoiceCurrency,
        });
        const rows = await fetchMerchantInvoices(db, merchantIdForInvoices);
        if (!cancelled) setInvoices(rows);
      } catch (err) {
        console.error('invoices sync/load', err);
        if (!cancelled) {
          setInvoices([]);
          showToast(err?.message || 'Could not load invoices', 'error');
        }
      } finally {
        if (!cancelled) setInvoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    merchantIdForInvoices,
    ordersForMerchant,
    ordersLoading,
    reloadTick,
    showToast,
    merchantInvoiceCurrency,
  ]);

  const orderDerivedUnsettled = useMemo(() => {
    const eligible = ordersForMerchant.filter((o) => isOrderEligibleForPayout(o));
    return Math.round(eligible.reduce((sum, o) => sum + computeOrderPayableTotal(o), 0) * 100) / 100;
  }, [ordersForMerchant]);

  const displayWalletBalance =
    walletBalanceFromFirestore != null ? walletBalanceFromFirestore : orderDerivedUnsettled;

  const totalEarnings = Number(vendorProfile?.dashboardStats?.totalEarnings) || 0;

  const handleDownloadInvoicePdf = useCallback(async () => {
    const el = invoicePrintRef.current;
    if (!el || !selectedInvoice) return;
    setPdfWorking(true);
    try {
      await downloadInvoiceAsPdf(el, selectedInvoice.invoiceNumber);
      showToast('Invoice PDF downloaded', 'success');
    } catch (err) {
      console.error('downloadInvoiceAsPdf', err);
      showToast(err?.message || 'Could not generate PDF', 'error');
    } finally {
      setPdfWorking(false);
    }
  }, [selectedInvoice, showToast]);

  const payoutStatusClass = (status) => {
    const s = (status || 'pending').toString().trim().toLowerCase().replace(/\s+/g, '-');
    return `payout-status status-${s}`;
  };

  const accountingHeaderTitle = activeTab === 'payouts' ? 'Payout' : 'Invoices & Taxes';

  return (
    <div className="accounting-page">
      <div className="accounting-header">
        <div className="green-app-header accounting-green-header">
          <button type="button" className="back-button" onClick={() => navigate(-1)} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1>{accountingHeaderTitle}</h1>
          <span className="green-app-header__spacer" aria-hidden="true" />
        </div>
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

        {/*
        <div className="accounting-filters">
          <button type="button" className="date-range-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M3 10H21" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>01 Feb - 01 Mar&apos;26</span>
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
        */}
      </div>

      <div className="accounting-content">
        {activeTab === 'payouts' && (
          <div className="payouts-section">
            <section className="payout-request-panel accounting-card">
              <h2 className="payout-section-title">Wallet</h2>
              

              {(ordersLoading || walletSummaryLoading) && (
                <p className="payout-loading">Loading…</p>
              )}

              {!ordersLoading && !walletSummaryLoading ? (
                <div className="accounting-payout-kpis">
                  <div className="accounting-payout-kpi">
                    <div className="accounting-payout-kpi__label">Total earnings</div>
                    <div className="accounting-payout-kpi__value">
                      {vendorLoading && !vendorProfile ? '…' : formatCurrency(totalEarnings)}
                    </div>
                  </div>
                  <div className="accounting-payout-kpi accounting-payout-kpi--accent">
                    <div className="accounting-payout-kpi__label">Weekly Payout</div>
                    <div className="accounting-payout-kpi__value accounting-payout-kpi__value--accent">
                      {formatCurrency(displayWalletBalance)}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="payout-history-section">
              <h2 className="payout-section-title payout-history-title">Payout History</h2>
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
                        {formatCurrency(getPayoutRequestAmount(payout))}
                      </div>
                      <div className="payout-orders">
                        {(payout.orderIds?.length ?? 0) > 0
                          ? `${payout.orderIds.length} order${payout.orderIds.length === 1 ? '' : 's'}`
                          : 'Wallet withdrawal'}
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
                    {payoutPaymentSummaryLine(payout) ? (
                      <div className="payout-detail-item payout-detail-item--stack">
                        <span className="detail-label">Payout method:</span>
                        <span className="detail-value payout-mono payout-detail-value--wrap">
                          {payoutPaymentSummaryLine(payout)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="invoices-section">
            {invoicesLoading && (
              <p className="payout-loading">Loading invoices…</p>
            )}
            {!invoicesLoading && invoices.length === 0 && (
              <p className="payout-empty accounting-card">
                No invoices yet. Completed orders get an invoice automatically once the Cloud Function
                syncMerchantInvoiceOnOrderWrite is deployed; opening this page also backfills any missing
                invoices for your store.
              </p>
            )}
            {!invoicesLoading &&
              invoices.map((inv) => (
                <div key={inv.id} className="invoice-card">
                  <div className="invoice-header">
                    <div className="invoice-id">{inv.invoiceNumber}</div>
                    <div
                      className={`invoice-status status-${(inv.status || 'PAID').toLowerCase()}`}
                    >
                      {inv.status || 'PAID'}
                    </div>
                  </div>
                  <div className="invoice-details">
                    <div className="invoice-detail-row">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">{inv.invoiceDateLabel}</span>
                    </div>
                    <div className="invoice-detail-row">
                      <span className="detail-label">Order ID:</span>
                      <span className="detail-value payout-mono">{inv.orderId}</span>
                    </div>
                    <div className="invoice-detail-row">
                      <span className="detail-label">{inv.taxLabel || 'Tax'}:</span>
                      <span className="detail-value">
                        {formatInvoiceMoney(inv.vatAmount)}
                      </span>
                    </div>
                    <div className="invoice-detail-row total-row">
                      <span className="detail-label">Total:</span>
                      <span className="detail-value total-amount">
                        {formatInvoiceMoney(inv.grandTotal)}
                      </span>
                    </div>
                  </div>
                  <div className="invoice-card-actions">
                    <button
                      type="button"
                      className="download-invoice-button"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      View invoice
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {selectedInvoice && (
          <div
            className="invoice-modal-overlay"
            role="dialog"
            aria-modal
            aria-labelledby="invoice-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedInvoice(null);
            }}
          >
            <div className="invoice-modal-dialog">
              <div className="invoice-modal-toolbar">
                <h2 id="invoice-modal-title" className="invoice-modal-toolbar-title">
                  Invoice {selectedInvoice.invoiceNumber}
                </h2>
                <div className="invoice-modal-actions">
                  <button
                    type="button"
                    className="invoice-modal-btn invoice-modal-btn--ghost"
                    onClick={() => setSelectedInvoice(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="invoice-modal-btn invoice-modal-btn--primary"
                    disabled={pdfWorking}
                    onClick={handleDownloadInvoicePdf}
                  >
                    {pdfWorking ? 'Preparing…' : 'Download PDF'}
                  </button>
                </div>
              </div>
              <div className="invoice-modal-body">
                <InvoiceDocument ref={invoicePrintRef} invoice={selectedInvoice} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Accounting;
