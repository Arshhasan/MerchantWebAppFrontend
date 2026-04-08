import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { payoutHistory } from '../../data/mockData';
import { formatMerchantCurrency } from '../../utils/merchantCurrencyFormat';
import './Accounting.css';

const Payout = () => {
  const navigate = useNavigate();
  const { vendorProfile } = useAuth();
  const walletBalance = 7500;

  return (
    <div className="payout-page">
      <div className="green-app-header">
        <button type="button" className="back-button" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>Payout</h1>
        <span className="green-app-header__spacer" aria-hidden="true" />
      </div>

      <div className="card wallet-card">
        <h2>Wallet Balance</h2>
        <div className="wallet-balance">
          <span className="balance-label">Available Balance</span>
          <span className="balance-amount">
            {formatMerchantCurrency(walletBalance, vendorProfile)}
          </span>
        </div>
        <button className="btn btn-primary">Request Payout</button>
      </div>

      <div className="card">
        <h2>Payout History</h2>
        <div className="payout-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Transaction ID</th>
              </tr>
            </thead>
            <tbody>
              {payoutHistory.map((payout) => (
                <tr key={payout.id}>
                  <td>{payout.date}</td>
                  <td>{formatMerchantCurrency(payout.amount, vendorProfile)}</td>
                  <td>
                    <span className={`status-badge status-${payout.status.toLowerCase()}`}>
                      {payout.status}
                    </span>
                  </td>
                  <td>{payout.transactionId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Payout;
