import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { MobileProfileDrawerProvider } from './contexts/MobileProfileDrawerContext';
import { SKIP_FORCED_ONBOARDING_UID_KEY } from './utils/existingMerchantSession';
import PageLoadingFallback from './components/PageLoadingFallback';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import './styles/common.css';

const Layout = lazy(() => import('./components/Layout/Layout'));
const ProfileLayout = lazy(() => import('./components/ProfileSidebar/ProfileLayout'));

const Landing = lazy(() => import('./pages/Landing/Landing'));
const OTPVerification = lazy(() => import('./pages/Auth/OTPVerification'));
const StoreSignup = lazy(() => import('./pages/Auth/StoreSignup'));
const EmailLinkHandler = lazy(() => import('./pages/Auth/EmailLinkHandler'));
const AuthEntryRedirect = lazy(() => import('./pages/Auth/AuthEntryRedirect'));
const LoginWelcome = lazy(() => import('./pages/Auth/LoginWelcome'));
const ContactSupport = lazy(() => import('./pages/Auth/ContactSupport'));

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const CreateSurpriseBag = lazy(() => import('./pages/CreateSurpriseBag/CreateSurpriseBag'));
const Orders = lazy(() => import('./pages/Orders/Orders'));
const Growth = lazy(() => import('./pages/Growth/Growth'));
const Offers = lazy(() => import('./pages/Growth/Offers'));
const Ads = lazy(() => import('./pages/Growth/Ads'));
const Performance = lazy(() => import('./pages/Performance/Performance'));
const Bags = lazy(() => import('./pages/Bags/Bags'));
const Profile = lazy(() => import('./pages/Profile/Profile'));
const ManageStore = lazy(() => import('./pages/Profile/ManageStore'));
const Settings = lazy(() => import('./pages/Profile/Settings'));
const ProfileOrders = lazy(() => import('./pages/Profile/ProfileOrders'));
const Accounting = lazy(() => import('./pages/Accounting/Accounting'));
const HelpCentre = lazy(() => import('./pages/Profile/HelpCentre'));
const LearningCentre = lazy(() => import('./pages/Profile/LearningCentre'));
const ShareFeedback = lazy(() => import('./pages/Profile/ShareFeedback'));
const LegalPolicies = lazy(() => import('./pages/Profile/LegalPolicies'));
const ScheduleOff = lazy(() => import('./pages/Profile/ScheduleOff'));
const OutletInformation = lazy(() => import('./pages/Profile/OutletInformation'));
const OutletTimings = lazy(() => import('./pages/Profile/OutletTimings'));
const PhoneNumbers = lazy(() => import('./pages/Profile/PhoneNumbers'));
const ManageStaff = lazy(() => import('./pages/Profile/ManageStaff'));
const FindYourStore = lazy(() => import('./pages/Onboarding/FindYourStore'));
const BusinessCategory = lazy(() => import('./pages/Onboarding/BusinessCategory'));
const OutletLocation = lazy(() => import('./pages/Onboarding/OutletLocation'));
const StoreDetails = lazy(() => import('./pages/Onboarding/StoreDetails'));
const OrderHistory = lazy(() => import('./pages/Profile/OrderHistory'));
const Complaints = lazy(() => import('./pages/Profile/Complaints'));
const Reviews = lazy(() => import('./pages/Profile/Reviews'));
const ManageCommunication = lazy(() => import('./pages/Profile/ManageCommunication'));
const Wallet = lazy(() => import('./pages/Wallet/Wallet'));
const AdminChat = lazy(() => import('./pages/Chat/AdminChat'));
const CustomerChat = lazy(() => import('./pages/Chat/CustomerChat'));
const RestaurantCustomerChat = lazy(() => import('./pages/Chat/RestaurantCustomerChat'));

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

/** Desktop left nav (ProfileSidebar) — use everywhere except the surprise bag wizard. */
function MerchantShell({ children }) {
  return <ProfileLayout>{children}</ProfileLayout>;
}

function OnboardingGate({ children }) {
  const location = useLocation();
  const {
    user,
    loading,
    profileLoading,
    vendorLoading,
    needsCategorySetup,
    needsCategorySelection,
    needsOutletLocationSetup,
    needsFirstBagSetup,
  } = useAuth();

  // Avoid redirects while auth/profile is still loading
  if (loading || profileLoading || vendorLoading) return children;

  // Existing merchant (email/phone already had a user doc): allow app routes without forcing onboarding.
  if (
    typeof sessionStorage !== 'undefined'
    && user?.uid
    && sessionStorage.getItem(SKIP_FORCED_ONBOARDING_UID_KEY) === user.uid
  ) {
    return children;
  }

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
    '/find-your-store',
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
    '/find-your-store',
    '/store-details',
    '/business-category',
    '/outlet-location',
    '/create-bag',
  ];
  const stepIndex = (path) => ONBOARDING_STEPS.indexOf(path);
  const currentIndex = stepIndex(location.pathname);
  const isOnOnboardingStep = currentIndex !== -1;

  // Determine the earliest required (incomplete) step.
  let requiredPath = null;
  if (needsCategorySetup) requiredPath = '/find-your-store';
  else if (needsCategorySelection) requiredPath = '/business-category';
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

    // Treat manual store-details as part of the same "find your store" step.
    if (requiredPath === '/find-your-store' && location.pathname === '/store-details') {
      return children;
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

function AppRoutes({
  isAuthenticated,
  loading,
  profileLoading,
  vendorLoading,
  handleLogin,
  handleLogout,
}) {
  const location = useLocation();
  const path = location.pathname || '/';

  // Don't block auth entry routes behind auth/profile loading.
  const isAuthEntryRoute = (
    path === '/login'
    || path === '/register'
    || path === '/email-link-handler'
    || path === '/otp-verification'
    || path === '/store-signup'
  );

  // Gate the rest of the app while auth/profile/vendor are loading.
  if ((loading || profileLoading || vendorLoading) && !isAuthEntryRoute) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}
      >
        <PageLoadingFallback />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated
            ? <Navigate to="/dashboard" replace />
            : <Landing onLogin={handleLogin} />
        }
      />
      <Route
        path="/login"
        element={
          isAuthenticated
            ? <AuthEntryRedirect />
            : <Login onLogin={handleLogin} />
        }
      />
      <Route
        path="/register"
        element={<Register onLogin={handleLogin} />}
      />
      <Route
        path="/contact-us"
        element={<ContactSupport />}
      />
      <Route
        path="/welcome"
        element={isAuthenticated ? <LoginWelcome /> : <Navigate to="/login" replace />}
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
                    <Route path="/find-your-store" element={<MerchantShell><FindYourStore /></MerchantShell>} />
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
  );
}

function App() {
  const { isAuthenticated, loading, profileLoading, vendorLoading } = useAuth();

  const handleLogin = () => {
    // Login is now handled by Firebase Auth
    // This function is kept for compatibility with existing components
  };

  const handleLogout = async () => {
    const { signOutUser } = await import('./firebase/auth');
    await signOutUser();
  };

  return (
    <Router basename={routerBasename}>
      <Suspense fallback={<PageLoadingFallback />}>
        <AppRoutes
          isAuthenticated={isAuthenticated}
          loading={loading}
          profileLoading={profileLoading}
          vendorLoading={vendorLoading}
          handleLogin={handleLogin}
          handleLogout={handleLogout}
        />
      </Suspense>
    </Router>
  );
}

export default App;
