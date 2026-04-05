import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { signOutUser } from './firebase/auth';
import Landing from './pages/Landing/Landing';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import OTPVerification from './pages/Auth/OTPVerification';
import StoreSignup from './pages/Auth/StoreSignup';
import EmailLinkHandler from './pages/Auth/EmailLinkHandler';
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
import PrivacyPolicy from './pages/Profile/PrivacyPolicy';
import ScheduleOff from './pages/Profile/ScheduleOff';
import OutletInformation from './pages/Profile/OutletInformation';
import OutletTimings from './pages/Profile/OutletTimings';
import PhoneNumbers from './pages/Profile/PhoneNumbers';
import ManageStaff from './pages/Profile/ManageStaff';
import BusinessCategory from './pages/Onboarding/BusinessCategory';
import OutletLocation from './pages/Onboarding/OutletLocation';
import StoreDetails from './pages/Onboarding/StoreDetails';
import FirstBag from './pages/Onboarding/FirstBag';
import OrderHistory from './pages/Profile/OrderHistory';
import Complaints from './pages/Profile/Complaints';
import Reviews from './pages/Profile/Reviews';
import ManageCommunication from './pages/Profile/ManageCommunication';
import Wallet from './pages/Wallet/Wallet';
import AdminChat from './pages/Chat/AdminChat';
import CustomerChat from './pages/Chat/CustomerChat';
import RestaurantCustomerChat from './pages/Chat/RestaurantCustomerChat';
import Layout from './components/Layout/Layout';
import ProfileLayout from './components/ProfileSidebar/ProfileLayout';
import './styles/common.css';

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

function OnboardingGate({ children }) {
  const location = useLocation();
  const {
    loading,
    profileLoading,
    vendorLoading,
    needsCategorySetup,
    needsCategorySelection,
    needsOutletLocationSetup,
    needsStoreDetailsSetup,
    needsFirstBagSetup,
  } = useAuth();

  // Avoid redirects while auth/profile is still loading
  if (loading || profileLoading || vendorLoading) return children;

  const searchParams = new URLSearchParams(location.search);
  const isFirstBagCreateRoute =
    location.pathname === '/create-bag'
    && ['1', 'true'].includes(searchParams.get('firstBag'));

  // First-bag onboarding must reach the bag wizard; allow regardless of requiredPath
  // ordering edge cases (e.g. profile flags updating between renders).
  if (needsFirstBagSetup && isFirstBagCreateRoute) {
    return children;
  }

  const ONBOARDING_STEPS = [
    '/business-category',
    '/store-details',
    '/outlet-location',
    '/first-bag',
  ];
  const stepIndex = (path) => ONBOARDING_STEPS.indexOf(path);
  const currentIndex = stepIndex(location.pathname);
  const isOnOnboardingStep = currentIndex !== -1;

  // Determine the earliest required (incomplete) step.
  let requiredPath = null;
  if (needsCategorySetup || needsCategorySelection) requiredPath = '/business-category';
  else if (needsStoreDetailsSetup) requiredPath = '/store-details';
  else if (needsOutletLocationSetup) requiredPath = '/outlet-location';
  else if (needsFirstBagSetup) requiredPath = '/first-bag';

  if (requiredPath) {
    const requiredIndex = stepIndex(requiredPath);

    // If user tries to access a non-onboarding route, force them to required step.
    if (!isOnOnboardingStep) {
      return <Navigate to={`${requiredPath}?onboarding=1`} replace />;
    }

    // If user tries to skip ahead past the required step, bring them back.
    if (currentIndex > requiredIndex) {
      return <Navigate to={`${requiredPath}?onboarding=1`} replace />;
    }

    // If user is on a previous step (going back), allow it.
  }

  return children;
}

function App() {
  const { isAuthenticated, loading, profileLoading } = useAuth();

  const handleLogin = () => {
    // Login is now handled by Firebase Auth
    // This function is kept for compatibility with existing components
  };

  const handleLogout = async () => {
    await signOutUser();
  };

  // Show loading state while checking authentication
  if (loading || profileLoading) {
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
    <Router basename={routerBasename}>
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
          element={<Register onLogin={handleLogin} />} 
        />
        <Route 
          path="/otp-verification" 
          element={<OTPVerification onLogin={handleLogin} />} 
        />
        <Route
          path="/email-link-handler"
          element={<EmailLinkHandler />}
        />
        <Route 
          path="/store-signup" 
          element={<StoreSignup onLogin={handleLogin} />} 
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <OnboardingGate>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<ProfileLayout><Dashboard /></ProfileLayout>} />
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
                  <Route path="/business-category" element={<BusinessCategory />} />
                    <Route path="/outlet-location" element={<OutletLocation />} />
                    <Route path="/store-details" element={<StoreDetails />} />
                    <Route path="/first-bag" element={<FirstBag />} />
                    <Route path="/outlet-info" element={<OutletInformation />} />
                    <Route path="/outlet-timings" element={<OutletTimings />} />
                    <Route path="/phone-numbers" element={<PhoneNumbers />} />
                    <Route path="/manage-staff" element={<ManageStaff />} />
                    {/* Orders pages */}
                    <Route path="/order-history" element={<OrderHistory />} />
                    <Route path="/complaints" element={<Complaints />} />
                    <Route path="/reviews" element={<Reviews />} />
                    <Route path="/wallet" element={<Wallet />} />
                    <Route path="/manage-communication" element={<ManageCommunication />} />
                    <Route path="/chat/admin" element={<AdminChat />} />
                    <Route path="/chat/customer/:chatId" element={<CustomerChat />} />
                    <Route path="/chat/restaurant/:chatId" element={<RestaurantCustomerChat />} />
                    {/* Other pages */}
                    <Route path="/schedule-off" element={<ScheduleOff />} />
                    <Route path="/help-centre" element={<HelpCentre />} />
                    <Route path="/learning-centre" element={<LearningCentre />} />
                    <Route path="/share-feedback" element={<ShareFeedback />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  </Routes>
                </Layout>
              </OnboardingGate>
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
