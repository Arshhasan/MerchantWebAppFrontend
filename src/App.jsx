import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { signOutUser } from './firebase/auth';
import Landing from './pages/Landing/Landing';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import OTPVerification from './pages/Auth/OTPVerification';
import StoreSignup from './pages/Auth/StoreSignup';
import EmailLinkHandler from './pages/Auth/EmailLinkHandler';
import AuthEntryRedirect from './pages/Auth/AuthEntryRedirect';
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
import LegalPolicies from './pages/Profile/LegalPolicies';
import ScheduleOff from './pages/Profile/ScheduleOff';
import OutletInformation from './pages/Profile/OutletInformation';
import OutletTimings from './pages/Profile/OutletTimings';
import PhoneNumbers from './pages/Profile/PhoneNumbers';
import ManageStaff from './pages/Profile/ManageStaff';
import BusinessCategory from './pages/Onboarding/BusinessCategory';
import OutletLocation from './pages/Onboarding/OutletLocation';
import StoreDetails from './pages/Onboarding/StoreDetails';
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
import { MobileProfileDrawerProvider } from './contexts/MobileProfileDrawerContext';
import './styles/common.css';

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

/** Desktop left nav (ProfileSidebar) — use everywhere except the surprise bag wizard. */
function MerchantShell({ children }) {
  return <ProfileLayout>{children}</ProfileLayout>;
}

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

  /**
   * While the first Surprise Bag is still required, merchants may revisit onboarding steps
   * (category, store details, map) or open Manage Store / outlet screens to edit the store.
   * These paths are not all in ONBOARDING_STEPS, so we allow them explicitly before the
   * "non-onboarding → force create-bag" redirect.
   */
  const ALLOWED_PATHS_DURING_FIRST_BAG_SETUP = new Set([
    '/business-category',
    '/store-details',
    '/outlet-location',
    '/create-bag',
    '/manage-store',
    '/outlet-info',
    '/outlet-timings',
    '/phone-numbers',
  ]);

  if (needsFirstBagSetup && ALLOWED_PATHS_DURING_FIRST_BAG_SETUP.has(location.pathname)) {
    return children;
  }

  const ONBOARDING_STEPS = [
    '/business-category',
    '/store-details',
    '/outlet-location',
    '/create-bag',
  ];
  const stepIndex = (path) => ONBOARDING_STEPS.indexOf(path);
  const currentIndex = stepIndex(location.pathname);
  const isOnOnboardingStep = currentIndex !== -1;

  // Determine the earliest required (incomplete) step.
  let requiredPath = null;
  if (needsCategorySetup || needsCategorySelection) requiredPath = '/business-category';
  else if (needsStoreDetailsSetup) requiredPath = '/store-details';
  else if (needsOutletLocationSetup) requiredPath = '/outlet-location';
  else if (needsFirstBagSetup) requiredPath = '/create-bag';

  if (requiredPath) {
    const requiredIndex = stepIndex(requiredPath);

    // If user tries to access a non-onboarding route, force them to required step.
    if (!isOnOnboardingStep) {
      const target =
        requiredPath === '/create-bag'
          ? '/create-bag?firstBag=1'
          : `${requiredPath}?onboarding=1`;
      return <Navigate to={target} replace />;
    }

    // If user tries to skip ahead past the required step, bring them back.
    if (currentIndex > requiredIndex) {
      const target =
        requiredPath === '/create-bag'
          ? '/create-bag?firstBag=1'
          : `${requiredPath}?onboarding=1`;
      return <Navigate to={target} replace />;
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
              <AuthEntryRedirect /> : 
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
                <MobileProfileDrawerProvider>
                  <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<MerchantShell><Dashboard /></MerchantShell>} />
                    <Route path="/create-bag" element={<CreateSurpriseBag />} />
                    <Route path="/orders" element={<MerchantShell><Orders /></MerchantShell>} />
                    <Route path="/growth" element={<MerchantShell><Growth /></MerchantShell>} />
                    <Route path="/offers" element={<MerchantShell><Offers /></MerchantShell>} />
                    <Route path="/ads" element={<MerchantShell><Ads /></MerchantShell>} />
                    <Route path="/performance" element={<MerchantShell><Performance /></MerchantShell>} />
                    <Route path="/bags" element={<MerchantShell><Bags /></MerchantShell>} />
                    <Route path="/profile" element={<MerchantShell><Profile onLogout={handleLogout} /></MerchantShell>} />
                    <Route path="/manage-store" element={<MerchantShell><ManageStore /></MerchantShell>} />
                    <Route path="/settings" element={<MerchantShell><Settings onLogout={handleLogout} /></MerchantShell>} />
                    <Route path="/profile-orders" element={<MerchantShell><ProfileOrders /></MerchantShell>} />
                    <Route path="/payout" element={<MerchantShell><Accounting /></MerchantShell>} />
                    <Route path="/invoice-taxes" element={<MerchantShell><Accounting /></MerchantShell>} />
                    <Route path="/invoices" element={<MerchantShell><Accounting /></MerchantShell>} />
                    <Route path="/taxes" element={<MerchantShell><Accounting /></MerchantShell>} />
                    {/* Manage Store pages */}
                    <Route path="/business-category" element={<MerchantShell><BusinessCategory /></MerchantShell>} />
                    <Route path="/outlet-location" element={<MerchantShell><OutletLocation /></MerchantShell>} />
                    <Route path="/store-details" element={<MerchantShell><StoreDetails /></MerchantShell>} />
                    <Route path="/outlet-info" element={<MerchantShell><OutletInformation /></MerchantShell>} />
                    <Route path="/outlet-timings" element={<MerchantShell><OutletTimings /></MerchantShell>} />
                    <Route path="/phone-numbers" element={<MerchantShell><PhoneNumbers /></MerchantShell>} />
                    <Route path="/manage-staff" element={<MerchantShell><ManageStaff /></MerchantShell>} />
                    {/* Orders pages */}
                    <Route path="/order-history" element={<MerchantShell><OrderHistory /></MerchantShell>} />
                    <Route path="/complaints" element={<MerchantShell><Complaints /></MerchantShell>} />
                    <Route path="/reviews" element={<MerchantShell><Reviews /></MerchantShell>} />
                    <Route path="/wallet" element={<MerchantShell><Wallet /></MerchantShell>} />
                    <Route path="/manage-communication" element={<MerchantShell><ManageCommunication /></MerchantShell>} />
                    <Route path="/chat/admin" element={<MerchantShell><AdminChat /></MerchantShell>} />
                    <Route path="/chat/customer/:chatId" element={<MerchantShell><CustomerChat /></MerchantShell>} />
                    <Route path="/chat/restaurant/:chatId" element={<MerchantShell><RestaurantCustomerChat /></MerchantShell>} />
                    {/* Other pages */}
                    <Route path="/schedule-off" element={<MerchantShell><ScheduleOff /></MerchantShell>} />
                    <Route path="/help-centre" element={<MerchantShell><HelpCentre /></MerchantShell>} />
                    <Route path="/learning-centre" element={<MerchantShell><LearningCentre /></MerchantShell>} />
                    <Route path="/share-feedback" element={<MerchantShell><ShareFeedback /></MerchantShell>} />
                    <Route path="/legal" element={<MerchantShell><LegalPolicies /></MerchantShell>} />
                    <Route path="/privacy-policy" element={<Navigate to="/legal" replace />} />
                  </Routes>
                  </Layout>
                </MobileProfileDrawerProvider>
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
