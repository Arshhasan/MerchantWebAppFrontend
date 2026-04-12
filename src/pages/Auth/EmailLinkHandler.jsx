import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { auth } from "../../firebase/config";
import { createUserDocument } from "../../firebase/auth";
import { rememberDashboardWithoutForcedOnboarding } from "../../utils/existingMerchantSession";
import { Loader2 } from "lucide-react";

export default function EmailLinkHandler() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const completeSignIn = async () => {
      // React 18 StrictMode mounts, unmounts, then mounts again in dev.
      // Email-link codes are one-time use, so we persist a guard in sessionStorage
      // keyed by the oobCode to prevent a second attempt.
      const href = window.location.href;
      const url = new URL(href);
      const oobCode = url.searchParams.get("oobCode") || "";
      const guardKey = `emailLinkHandler:handled:${oobCode || href}`;
      if (window.sessionStorage.getItem(guardKey) === "1") {
        // If we already handled this code in this session, just go where auth state allows.
        navigate(auth.currentUser ? "/dashboard" : "/login", { replace: true });
        return;
      }
      window.sessionStorage.setItem(guardKey, "1");

      if (!isSignInWithEmailLink(auth, window.location.href)) {
        navigate(auth.currentUser ? "/dashboard" : "/login", { replace: true });
        return;
      }

      let email = window.localStorage.getItem("emailForSignIn");
      if (!email) email = window.prompt("Please enter your email for confirmation");

      if (!email) {
        setError("Email is required to complete sign-in.");
        return;
      }

      try {
        const signupStateRaw = window.localStorage.getItem("signupFormState");
        const signupState = signupStateRaw ? JSON.parse(signupStateRaw) : null;

        const result = await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem("emailForSignIn");

        if (signupState) {
          window.localStorage.removeItem("signupFormState");
        }

        const fromSignup = signupState?.signUpWithEmailLink === true;

        // Same path for login and signup magic links: create/update Firestore user, then go inside.
        const userDocResult = await createUserDocument(result.user, {
          email: result.user.email || email,
          provider: "email",
          ...(fromSignup
            ? {
                firstName: signupState.firstName || null,
                lastName: signupState.lastName || null,
              }
            : {}),
        });

        if (!userDocResult?.success) {
          setError(userDocResult?.error || "Failed to set up your account.");
          return;
        }

        if (userDocResult.isNew) {
          navigate("/business-category?onboarding=1", { replace: true });
        } else {
          rememberDashboardWithoutForcedOnboarding(result.user.uid);
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        const firebaseError = err;
        const code = firebaseError?.code;
        if (code === "auth/invalid-action-code") {
          // If we already ended up signed-in (common when a duplicate attempt happens),
          // don't show an error—just continue.
          if (auth.currentUser) {
            rememberDashboardWithoutForcedOnboarding(auth.currentUser.uid);
            navigate("/dashboard", { replace: true });
            return;
          }
          setError("This link has expired or already been used. Please request a new one.");
        } else if (code === "auth/invalid-email") {
          setError("Email mismatch. Please make sure you're using the same email.");
        } else {
          setError(firebaseError?.message || "Failed to sign in. Please try again.");
        }
      }
    };

    completeSignIn();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Sign-in Failed</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="w-full h-12 bg-[#03c55b] hover:bg-[#02a54f] text-white rounded-full text-base font-semibold shadow-md"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#03c55b] mx-auto mb-4" />
        <p className="text-gray-500">Completing sign-in...</p>
      </div>
    </div>
  );
}

