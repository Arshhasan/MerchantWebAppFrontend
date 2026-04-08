import { Navigate } from "react-router-dom";

/** sessionStorage key — set before async work after OAuth so /login → authenticated redirect can honor onboarding. */
export const POST_AUTH_REDIRECT_KEY = "bbbPostAuthRedirect";

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
  }
  return <Navigate to="/dashboard" replace />;
}
