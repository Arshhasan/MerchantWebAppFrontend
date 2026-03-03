import { payoutHistory } from '../../data/mockData';
import './Accounting.css';

const Payout = () => {
  const walletBalance = 7500;

  return (
    <div className="payout-page">
      <div className="page-header">
        <h1>Payout</h1>
      </div>

      <div className="card wallet-card">
        <h2>Wallet Balance</h2>
        <div className="wallet-balance">
          <span className="balance-label">Available Balance</span>
          <span className="balance-amount">${walletBalance.toLocaleString()}</span>
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
                  <td>${payout.amount.toLocaleString()}</td>
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
