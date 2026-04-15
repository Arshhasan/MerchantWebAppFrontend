import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";

/**
 * Whether this email is registered in Firebase Auth.
 *
 * Prefer Cloud Function `checkAuthEmailExists` (Admin `getUserByEmail`) because
 * client `fetchSignInMethodsForEmail` returns an empty list when **Email Enumeration Protection**
 * is enabled in Firebase Console — which breaks both login and signup pre-checks.
 *
 * Falls back to `fetchSignInMethodsForEmail` if the callable is unavailable (e.g. not deployed locally).
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function isEmailRegisteredInFirebaseAuth(email) {
  const trimmed = String(email || "").trim().toLowerCase();
  if (!trimmed) return false;

  try {
    const checkFn = httpsCallable(functions, "checkAuthEmailExists");
    const result = await checkFn({ email: trimmed });
    const exists = result?.data?.exists === true;
    return exists;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    // Callable missing / CORS / offline — degrade to client API (may be wrong with enumeration protection)
    if (
      code === "functions/not-found"
      || code === "functions/unavailable"
      || code === "functions/internal"
    ) {
      try {
        const [{ auth }, firebaseAuth] = await Promise.all([
          import("../firebase/config"),
          import("firebase/auth"),
        ]);
        const methods = await firebaseAuth.fetchSignInMethodsForEmail(auth, trimmed);
        return Array.isArray(methods) && methods.length > 0;
      } catch (_) {
        return false;
      }
    }
    throw err;
  }
}
