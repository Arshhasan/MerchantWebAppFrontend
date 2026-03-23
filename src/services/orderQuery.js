import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

const ORDER_COLLECTION = "restaurant_orders";

const toCandidateArray = (vendorIdOrIds) => {
  if (Array.isArray(vendorIdOrIds)) {
    return [...new Set(vendorIdOrIds.filter(Boolean))];
  }
  return vendorIdOrIds ? [vendorIdOrIds] : [];
};

const buildVendorQueries = (vendorIdOrIds) => {
  const candidates = toCandidateArray(vendorIdOrIds);
  if (candidates.length === 0) return [];
  const ref = collection(db, ORDER_COLLECTION);
  const queries = [];

  candidates.forEach((candidate) => {
    queries.push(query(ref, where("vendor.vendorID", "==", candidate)));
    queries.push(query(ref, where("vendor.author", "==", candidate)));
    queries.push(query(ref, where("vendor.id", "==", candidate)));
  });

  return queries;
};

const mergeSnapshots = (snapshots) => {
  const byId = new Map();
  snapshots.forEach((snapshot) => {
    snapshot.forEach((docSnap) => {
      byId.set(docSnap.id, { ...docSnap.data(), id: docSnap.id });
    });
  });
  return Array.from(byId.values());
};

export const getVendorOrdersOnce = async (vendorIdOrIds) => {
  const queries = buildVendorQueries(vendorIdOrIds);
  if (queries.length === 0) return [];
  const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
  return mergeSnapshots(snapshots);
};

export const subscribeToVendorOrders = (vendorIdOrIds, onData, onError) => {
  const queries = buildVendorQueries(vendorIdOrIds);
  if (queries.length === 0) {
    onData([]);
    return () => {};
  }

  const snapshots = new Array(queries.length).fill(null);
  const unsubscribers = queries.map((q, index) =>
    onSnapshot(
      q,
      (snapshot) => {
        snapshots[index] = snapshot;
        const readySnapshots = snapshots.filter(Boolean);
        onData(mergeSnapshots(readySnapshots));
      },
      (error) => {
        if (onError) onError(error);
      }
    )
  );

  return () => unsubscribers.forEach((unsub) => unsub && unsub());
};
