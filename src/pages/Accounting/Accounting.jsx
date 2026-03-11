import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Accounting.css';

const Accounting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('payouts');

  useEffect(() => {
    // Set active tab based on route
    if (location.pathname === '/invoices' || location.pathname === '/taxes' || location.pathname === '/invoice-taxes') {
      setActiveTab('invoices');
    } else {
      setActiveTab('payouts');
    }
  }, [location.pathname]);
  const [dateRange, setDateRange] = useState('01 Feb - 01 Mar\'26');

  // Mock payout data
  const payouts = [
    {
      id: 1,
      netPayout: -359.80,
      orders: 0,
      status: 'CARRIED FORWARD',
      payoutFor: '23 Feb - 01 Mar\'26',
      payoutDate: '04 Mar\'26',
    },
    {
      id: 2,
      netPayout: -359.80,
      orders: 0,
      status: 'CARRIED FORWARD',
      payoutFor: '16 - 22 Feb\'26',
      payoutDate: '25 Feb\'26',
    },
    {
      id: 3,
      netPayout: 1250.50,
      orders: 15,
      status: 'COMPLETED',
      payoutFor: '09 - 15 Feb\'26',
      payoutDate: '18 Feb\'26',
    },
    {
      id: 4,
      netPayout: 890.25,
      orders: 12,
      status: 'COMPLETED',
      payoutFor: '02 - 08 Feb\'26',
      payoutDate: '11 Feb\'26',
    },
  ];

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

  const handleGetReport = () => {
    // TODO: Implement report download
    console.log('Downloading report for:', dateRange);
  };

  const handleViewDetails = (id) => {
    // TODO: Navigate to payout details
    console.log('Viewing details for payout:', id);
  };

  const formatCurrency = (amount) => {
    return `₹${Math.abs(amount).toFixed(2)}`;
  };

  return (
    <div className="accounting-page">
      <div className="accounting-header">
        <div className="accounting-tabs">
          <button
            className={`tab-button ${activeTab === 'payouts' ? 'active' : ''}`}
            onClick={() => setActiveTab('payouts')}
          >
            Payouts
          </button>
          <button
            className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            Invoices & Taxes
          </button>
        </div>

        <div className="accounting-filters">
          <button className="date-range-button">
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
          <button className="get-report-button" onClick={handleGetReport}>
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
            {payouts.map((payout) => (
              <div key={payout.id} className="payout-card">
                <div className="payout-header">
                  <div className="payout-amount-section">
                    <div className="payout-label">Net payout</div>
                    <div className={`payout-amount ${payout.netPayout < 0 ? 'negative' : ''}`}>
                      {payout.netPayout < 0 ? '-' : ''} {formatCurrency(payout.netPayout)}
                    </div>
                    <div className="payout-orders">{payout.orders} orders</div>
                  </div>
                  <div className={`payout-status status-${payout.status.toLowerCase().replace(' ', '-')}`}>
                    {payout.status}
                  </div>
                </div>
                <div className="payout-details">
                  <div className="payout-detail-item">
                    <span className="detail-label">Payout for:</span>
                    <span className="detail-value">{payout.payoutFor}</span>
                  </div>
                  <div className="payout-detail-item">
                    <span className="detail-label">Payout date:</span>
                    <span className="detail-value">{payout.payoutDate}</span>
                  </div>
                </div>
                <button className="view-details-link" onClick={() => handleViewDetails(payout.id)}>
                  View details →
                </button>
              </div>
            ))}
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
                <button className="download-invoice-button">
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
