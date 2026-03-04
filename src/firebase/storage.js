// Firebase Storage utilities
import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { storage } from "./config";

/**
 * Upload a file to Firebase Storage
 * @param {File} file - File to upload
 * @param {string} path - Storage path (e.g., 'images/profile.jpg')
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise}
 */
export const uploadFile = async (file, path, onProgress = null) => {
  try {
    const storageRef = ref(storage, path);
    
    if (onProgress) {
      // Use resumable upload for progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error) => {
            reject({ success: false, error: error.message });
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ success: true, url: downloadURL, path });
          }
        );
      });
    } else {
      // Simple upload
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      return { success: true, url: downloadURL, path };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get download URL for a file
 * @param {string} path - Storage path
 * @returns {Promise}
 */
export const getFileURL = async (path) => {
  try {
    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Delete a file from Storage
 * @param {string} path - Storage path
 * @returns {Promise}
 */
export const deleteFile = async (path) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * List all files in a directory
 * @param {string} path - Directory path
 * @returns {Promise}
 */
export const listFiles = async (path) => {
  try {
    const listRef = ref(storage, path);
    const result = await listAll(listRef);
    
    const files = [];
    for (const itemRef of result.items) {
      const url = await getDownloadURL(itemRef);
      files.push({
        name: itemRef.name,
        fullPath: itemRef.fullPath,
        url,
      });
    }
    
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
