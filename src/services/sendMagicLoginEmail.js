import { sendSignInLinkToEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase/config";

/**
 * Full URL for email-link completion. Must match the router path including Vite `base`
 * (e.g. `/merchant/email-link-handler` when `base` is `/merchant/`).
 */
export function getEmailLinkContinueUrl() {
  const rawBase = import.meta.env.BASE_URL || "/";
  const base = rawBase.replace(/\/$/, "");
  const path = `${base}/email-link-handler`.replace(/\/{2,}/g, "/");
  return `${window.location.origin}${path}`;
}

/**
 * User-facing message for Firebase Auth email-link failures.
 * @param {unknown} err
 * @param {string} [genericFallback]
 * @returns {string}
 */
export function getSendLoginEmailErrorMessage(
  err,
  genericFallback = "Failed to send verification email."
) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  const raw =
    err && typeof err === "object" && "message" in err && typeof err.message === "string"
      ? err.message.trim()
      : "";
  const serverMsg = raw || "";

  if (code === "auth/invalid-email") {
    return serverMsg || "Invalid email address.";
  }
  if (code === "auth/missing-continue-uri" || code === "auth/invalid-continue-uri") {
    return "Invalid sign-in link configuration. Check Firebase Auth authorized domains.";
  }
  if (code === "auth/unauthorized-continue-uri") {
    return "This site URL is not allowed for email links. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email link sign-in is not enabled. Turn it on in Firebase Console → Authentication → Sign-in method.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please try again later.";
  }
  if (code === "functions/invalid-argument") {
    return serverMsg || "Invalid email address.";
  }
  if (code === "functions/resource-exhausted" || code === "functions/aborted") {
    return "Too many attempts. Please try again later.";
  }
  if (code === "functions/failed-precondition" || code === "functions/internal") {
    return serverMsg || "Email could not be sent. Check server configuration.";
  }
  if (code === "functions/not-found") {
    return "Email service is unavailable. Ensure Cloud Functions are deployed (sendLoginEmail, us-central1).";
  }
  return serverMsg || genericFallback;
}

/**
 * Sends the Firebase email sign-in link.
 * Prefer Cloud Function + SendGrid (branded HTML). Falls back to Firebase default email if SendGrid is not configured.
 *
 * @param {{ email: string, continueUrl?: string, displayName?: string, variant?: 'login' | 'signup' }} params
 * @returns {Promise<{ success: true }>}
 */
export async function sendMagicLoginEmail({
  email,
  continueUrl,
  displayName = "",
  variant = "login",
}) {
  const trimmed = email.trim();
  const url = continueUrl || getEmailLinkContinueUrl();

  window.localStorage.setItem("emailForSignIn", trimmed);

  const sendLoginEmail = httpsCallable(functions, "sendLoginEmail");

  try {
    await sendLoginEmail({
      email: trimmed,
      continueUrl: url,
      displayName: String(displayName || "").trim(),
      variant: variant === "signup" ? "signup" : "login",
    });
    return { success: true };
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    const message =
      err && typeof err === "object" && "message" in err && typeof err.message === "string"
        ? err.message
        : "";
    const useFirebaseDefault =
      code === "functions/failed-precondition" &&
      (message.includes("SendGrid") || message.includes("not configured"));

    if (useFirebaseDefault) {
      await sendSignInLinkToEmail(auth, trimmed, {
        url,
        handleCodeInApp: true,
      });
      return { success: true };
    }
    throw err;
  }
}
