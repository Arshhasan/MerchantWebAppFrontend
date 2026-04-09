import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";

/**
 * Sends the Firebase email-link sign-in URL via your Cloud Function (SendGrid only).
 * Do not use `sendSignInLinkToEmail` on the client — that triggers Firebase's default email.
 *
 * @param {{ email: string, name?: string, continueUrl?: string }} params
 * @returns {Promise<{ success?: boolean }>}
 */
export async function sendMagicLoginEmail({ email, name, continueUrl }) {
  const fn = httpsCallable(functions, "sendLoginEmail");
  const trimmed = email.trim();
  const displayName =
    (name && String(name).trim()) || trimmed.split("@")[0] || "there";
  const url =
    continueUrl || `${window.location.origin}/email-link-handler`;

  const { data } = await fn({
    email: trimmed,
    name: displayName,
    continueUrl: url,
  });
  return data;
}
