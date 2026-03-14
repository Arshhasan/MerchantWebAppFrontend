import { useNavigate } from 'react-router-dom';
import './Wallet.css';

const Wallet = () => {
  const navigate = useNavigate();

  const handleSetup = (method) => {
    console.log(`Setting up ${method}`);
    // Navigate to setup page for the selected method
    // navigate(`/wallet/setup/${method.toLowerCase()}`);
  };

  const withdrawalMethods = [
    {
      id: 'stripe',
      name: 'Stripe',
      logo: (
        <div className="payment-logo stripe-logo">
          <span>stripe</span>
        </div>
      ),
    },
    {
      id: 'paypal',
      name: 'PayPal',
      logo: (
        <div className="payment-logo paypal-logo">
          <span>PayPal</span>
        </div>
      ),
    },
    {
      id: 'flutterwave',
      name: 'FlutterWave',
      logo: (
        <div className="payment-logo flutterwave-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#F5A623"/>
            <path d="M2 17L12 22L22 17" stroke="#F5A623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#F5A623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Flutterwave</span>
        </div>
      ),
    },
  ];

  return (
    <div className="wallet-page">
      <div className="wallet-header">
        <h1>Add a withdrawal method</h1>
      </div>
      <div className="wallet-content">
        <p className="wallet-subtitle">Setup your preferred withdrawal method for receiving your payments.</p>
        
        <div className="withdrawal-methods-section">
          <h2 className="section-title">Available Withdrawal Methods</h2>
          
          <div className="withdrawal-methods-list">
            {withdrawalMethods.map((method) => (
              <div key={method.id} className="withdrawal-method-item">
                <div className="method-info">
                  {method.logo}
                  <span className="method-name">{method.name}</span>
                </div>
                <button 
                  className="btn-setup"
                  onClick={() => handleSetup(method.name)}
                >
                  Setup
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
