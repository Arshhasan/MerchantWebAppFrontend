import { Navigate } from "react-router-dom";
import { POST_AUTH_REDIRECT_KEY } from "./postAuthRedirectKey";

/** sessionStorage key — set before async work after OAuth so /login → authenticated redirect can honor onboarding. */

/**
 * Used when the user is authenticated but hits a public auth route (e.g. /login).
 * If we stashed a post-sign-in path (e.g. Google new user → onboarding), use it instead of dashboard.
 */
export default function AuthEntryRedirect() {
  if (typeof window !== "undefined") {
    const to = sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);
    if (to) {
      sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
      return <Navigate to={to} replace />;
    }

    // If a signup flow is in progress in another tab, keep this tab aligned with onboarding
    // instead of landing on a "blank" dashboard (sidebar hidden until onboarding completes).
    const signupStateRaw = window.localStorage.getItem("signupFormState");
    if (signupStateRaw) {
      return <Navigate to="/find-your-store?onboarding=1" replace />;
    }
  }
  return <Navigate to="/dashboard" replace />;
}
