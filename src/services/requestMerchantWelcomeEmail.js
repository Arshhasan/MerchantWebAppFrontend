import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";

/**
 * Retries SendGrid welcome email for the signed-in merchant’s vendor (same logic as Firestore trigger).
 * @returns {Promise<{ success: boolean }>}
 */
export async function requestMerchantWelcomeEmail() {
  const fn = httpsCallable(functions, "requestMerchantWelcomeEmail");
  const { data } = await fn({});
  return data || { success: false };
}
