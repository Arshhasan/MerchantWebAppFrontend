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

const LEARNING_VIDEOS_PREFIX = "LearningVideos";

/**
 * Resolve a Firestore storage field (video or thumbnail) to an HTTPS URL.
 * Supports full https URLs, gs:// URLs, and paths under LearningVideos/.
 * @param {string} value
 * @returns {Promise<{ success: true, url: string } | { success: false, error: string }>}
 */
export const resolveLearningStorageUrl = async (value) => {
  const raw = (value || "").trim();
  if (!raw) {
    return { success: false, error: "Missing URL" };
  }
  if (/^https?:\/\//i.test(raw)) {
    return { success: true, url: raw };
  }
  let pathForRef = raw;
  if (!raw.startsWith("gs://")) {
    const normalized = raw.replace(/^\/+/, "");
    if (normalized.startsWith(`${LEARNING_VIDEOS_PREFIX}/`)) {
      pathForRef = normalized;
    } else {
      pathForRef = `${LEARNING_VIDEOS_PREFIX}/${normalized}`;
    }
  }
  try {
    const storageRef = ref(storage, pathForRef);
    const url = await getDownloadURL(storageRef);
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error.message || "Could not resolve URL" };
  }
};

/** @param {string} videoUrl */
export const resolveLearningVideoUrl = async (videoUrl) =>
  resolveLearningStorageUrl(videoUrl);

/** @param {string} thumbnailUrl — Firestore `thumbnail` (https, gs://, or LearningVideos/ path) */
export const resolveLearningThumbnailUrl = async (thumbnailUrl) =>
  resolveLearningStorageUrl(thumbnailUrl);
