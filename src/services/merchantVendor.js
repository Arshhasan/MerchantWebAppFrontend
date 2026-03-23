import { getDocument, getDocuments } from "../firebase/firestore";

// Resolve vendor id for current merchant user in a resilient way.
// 1) users/{uid}.vendorID
// 2) vendors where author == uid (legacy/newer writer variants)
export const resolveMerchantVendorId = async (uid) => {
  if (!uid) return null;

  try {
    const userDoc = await getDocument("users", uid);
    const fromUserDoc = userDoc?.success ? userDoc?.data?.vendorID : null;
    if (fromUserDoc) return fromUserDoc;
  } catch (error) {
    console.warn("resolveMerchantVendorId: users lookup failed", error);
  }

  try {
    const byAuthor = await getDocuments(
      "vendors",
      [{ field: "author", operator: "==", value: uid }],
      null,
      "asc",
      1
    );
    if (byAuthor.success && Array.isArray(byAuthor.data) && byAuthor.data.length > 0) {
      const vendor = byAuthor.data[0];
      // Prefer vendor identifier values that match order payload fields.
      return vendor.vendorID || vendor.author || vendor.id || null;
    }
  } catch (error) {
    console.warn("resolveMerchantVendorId: vendors author lookup failed", error);
  }

  // Last fallback: auth uid is often used directly as vendor identifier in order payloads.
  return uid;
};
