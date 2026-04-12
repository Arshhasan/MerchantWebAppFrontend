import { Navigate } from 'react-router-dom';

/**
 * Onboarding step "restaurant name + description" is retired: store details are captured
 * from Google Places on `/find-your-store` and stored in `vendors.onboardingGooglePlace`
 * plus `title` / `description`. This route remains for old links only.
 *
 * Previous UI (form with store name + description) removed per product flow — see git history if needed.
 */
export default function StoreDetails() {
  return <Navigate to="/business-category?onboarding=1" replace />;
}
