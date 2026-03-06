// Firestore database utilities
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

/**
 * Create a new document in a collection
 * @param {string} collectionName - Collection name
 * @param {Object} data - Document data
 * @param {string} docId - Optional document ID (if not provided, auto-generated)
 * @returns {Promise}
 */
export const createDocument = async (collectionName, data, docId = null) => {
  try {
    if (docId) {
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true, id: docId };
    } else {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true, id: docRef.id };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get a single document by ID
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise}
 */
export const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
    } else {
      return { success: false, error: "Document not found" };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get all documents from a collection
 * @param {string} collectionName - Collection name
 * @param {Array} filters - Optional array of filters [{field, operator, value}]
 * @param {string} orderByField - Optional field to order by
 * @param {string} orderDirection - 'asc' or 'desc'
 * @param {number} limitCount - Optional limit
 * @returns {Promise}
 */
export const getDocuments = async (
  collectionName,
  filters = [],
  orderByField = null,
  orderDirection = "asc",
  limitCount = null
) => {
  try {
    let q = collection(db, collectionName);
    
    // Apply filters
    if (filters.length > 0) {
      filters.forEach((filter) => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
    }
    
    // Apply ordering
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection));
    }
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const querySnapshot = await getDocs(q);
    const documents = [];
    
    querySnapshot.forEach((doc) => {
      documents.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, data: documents };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Update a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Updated data
 * @returns {Promise}
 */
export const updateDocument = async (collectionName, docId, data) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Delete a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise}
 */
export const deleteDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Listen to real-time updates for a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToDocument = (collectionName, docId, callback) => {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
};

/**
 * Listen to real-time updates for a collection
 * @param {string} collectionName - Collection name
 * @param {Array} filters - Optional array of filters
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToCollection = (collectionName, filters = [], callback, onError = null) => {
  let q = collection(db, collectionName);
  
  if (filters.length > 0) {
    filters.forEach((filter) => {
      q = query(q, where(filter.field, filter.operator, filter.value));
    });
  }
  
  return onSnapshot(
    q, 
    (querySnapshot) => {
      const documents = [];
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      callback(documents);
    },
    (error) => {
      console.error('Firestore subscription error:', error);
      if (onError) {
        onError(error);
      } else {
        // Default error handling - call callback with empty array
        callback([]);
      }
    }
  );
};
