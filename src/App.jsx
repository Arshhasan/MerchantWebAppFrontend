import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { signOutUser } from './firebase/auth';
import Landing from './pages/Landing/Landing';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import OTPVerification from './pages/Auth/OTPVerification';
import StoreSignup from './pages/Auth/StoreSignup';
import Dashboard from './pages/Dashboard/Dashboard';
import CreateSurpriseBag from './pages/CreateSurpriseBag/CreateSurpriseBag';
import Orders from './pages/Orders/Orders';
import Growth from './pages/Growth/Growth';
import Offers from './pages/Growth/Offers';
import Ads from './pages/Growth/Ads';
import Performance from './pages/Performance/Performance';
import Bags from './pages/Bags/Bags';
import Profile from './pages/Profile/Profile';
import ManageStore from './pages/Profile/ManageStore';
import Settings from './pages/Profile/Settings';
import ProfileOrders from './pages/Profile/ProfileOrders';
import Accounting from './pages/Accounting/Accounting';
import BlankPage from './pages/Profile/BlankPage';
import HelpCentre from './pages/Profile/HelpCentre';
import LearningCentre from './pages/Profile/LearningCentre';
import ShareFeedback from './pages/Profile/ShareFeedback';
import ScheduleOff from './pages/Profile/ScheduleOff';
import OutletInformation from './pages/Profile/OutletInformation';
import OutletTimings from './pages/Profile/OutletTimings';
import PhoneNumbers from './pages/Profile/PhoneNumbers';
import ManageStaff from './pages/Profile/ManageStaff';
import OrderHistory from './pages/Profile/OrderHistory';
import Complaints from './pages/Profile/Complaints';
import Reviews from './pages/Profile/Reviews';
import ManageCommunication from './pages/Profile/ManageCommunication';
import Wallet from './pages/Wallet/Wallet';
import AdminChat from './pages/Chat/AdminChat';
import CustomerChat from './pages/Chat/CustomerChat';
import Layout from './components/Layout/Layout';
import './styles/common.css';

function App() {
  const { isAuthenticated, loading } = useAuth();

  const handleLogin = () => {
    // Login is now handled by Firebase Auth
    // This function is kept for compatibility with existing components
  };

  const handleLogout = async () => {
    await signOutUser();
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Landing onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Login onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/register" 
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Register onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/otp-verification" 
          element={<OTPVerification onLogin={handleLogin} />} 
        />
        <Route 
          path="/store-signup" 
          element={<StoreSignup onLogin={handleLogin} />} 
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/create-bag" element={<CreateSurpriseBag />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/growth" element={<Growth />} />
                  <Route path="/offers" element={<Offers />} />
                  <Route path="/ads" element={<Ads />} />
                  <Route path="/performance" element={<Performance />} />
                  <Route path="/bags" element={<Bags />} />
                  <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
                  <Route path="/manage-store" element={<ManageStore />} />
                  <Route path="/settings" element={<Settings onLogout={handleLogout} />} />
                  <Route path="/profile-orders" element={<ProfileOrders />} />
                  <Route path="/payout" element={<Accounting />} />
                  <Route path="/invoice-taxes" element={<Accounting />} />
                  <Route path="/invoices" element={<Accounting />} />
                  <Route path="/taxes" element={<Accounting />} />
                  {/* Manage Store pages */}
                  <Route path="/outlet-info" element={<OutletInformation />} />
                  <Route path="/outlet-timings" element={<OutletTimings />} />
                  <Route path="/phone-numbers" element={<PhoneNumbers />} />
                  <Route path="/manage-staff" element={<ManageStaff />} />
                  {/* Blank pages for other Profile options */}
                  {/* Orders pages */}
                  <Route path="/order-history" element={<OrderHistory />} />
                  <Route path="/complaints" element={<Complaints />} />
                  <Route path="/reviews" element={<Reviews />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/manage-communication" element={<ManageCommunication />} />
                  <Route path="/chat/admin" element={<AdminChat />} />
                  <Route path="/chat/customer/:chatId" element={<CustomerChat />} />
                  {/* Blank pages for other Profile options */}
                  <Route path="/schedule-off" element={<ScheduleOff />} />
                  <Route path="/invoices" element={<Accounting />} />
                  <Route path="/taxes" element={<Accounting />} />
                  <Route path="/help-centre" element={<HelpCentre />} />
                  <Route path="/learning-centre" element={<LearningCentre />} />
                  <Route path="/share-feedback" element={<ShareFeedback />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
