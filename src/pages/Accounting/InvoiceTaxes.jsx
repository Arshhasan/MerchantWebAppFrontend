import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { invoices } from '../../data/mockData';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './Accounting.css';

const InvoiceTaxes = () => {
  const { vendorProfile } = useAuth();
  const { showToast } = useToast();
  
  const handleDownload = (invoiceId) => {
    console.log('Downloading invoice:', invoiceId);
    showToast(`Downloading invoice ${invoiceId}...`, 'info');
  };

  return (
    <div className="invoice-taxes-page">
      <div className="page-header">
        <h1>Invoice & Taxes</h1>
      </div>

      <div className="card">
        <h2>Invoices</h2>
        <div className="invoices-table">
          <table>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.id}</td>
                  <td>{invoice.date}</td>
                  <td>{formatMerchantCurrency(invoice.amount, vendorProfile)}</td>
                  <td>{formatMerchantCurrency(invoice.tax, vendorProfile)}</td>
                  <td>{formatMerchantCurrency(invoice.total, vendorProfile)}</td>
                  <td>
                    <span className={`status-badge status-${invoice.status.toLowerCase()}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDownload(invoice.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTaxes;
