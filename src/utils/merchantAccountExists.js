import { getDocuments } from "../firebase/firestore";

/**
 * Returns true if we can find an existing merchant vendor record for this user/email.
 * Used to prevent forcing onboarding for legacy/migrated merchants whose `users/{uid}`
 * doc may be created on first login.
 *
 * @param {{ uid?: string, email?: string }} params
 */
export async function merchantAccountExists({ uid, email }) {
  const trimmedEmail = String(email || "").trim();
  if (!uid && !trimmedEmail) return false;

  // Prefer UID-based lookup (vendor.author is set to user.uid).
  if (uid) {
    const res = await getDocuments(
      "vendors",
      [{ field: "author", operator: "==", value: uid }],
      null,
      "asc",
      1
    );
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) return true;
  }

  // Fallback: email match (some flows mirror email to vendors.email).
  if (trimmedEmail) {
    const candidates = Array.from(new Set([trimmedEmail, trimmedEmail.toLowerCase()]));
    for (const value of candidates) {
      const res = await getDocuments(
        "vendors",
        [{ field: "email", operator: "==", value }],
        null,
        "asc",
        1
      );
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) return true;
    }
  }

  return false;
}

