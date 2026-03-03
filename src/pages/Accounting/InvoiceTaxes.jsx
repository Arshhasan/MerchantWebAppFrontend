import { invoices } from '../../data/mockData';
import './Accounting.css';

const InvoiceTaxes = () => {
  const handleDownload = (invoiceId) => {
    console.log('Downloading invoice:', invoiceId);
    alert(`Downloading invoice ${invoiceId}... (This is a demo)`);
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
                  <td>${invoice.amount.toLocaleString()}</td>
                  <td>${invoice.tax.toLocaleString()}</td>
                  <td>${invoice.total.toLocaleString()}</td>
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
