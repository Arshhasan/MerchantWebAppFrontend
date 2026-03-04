// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAAyrWO6gVnjISA49NonXFLHmdonwctaJA",
  authDomain: "bestbybites-76bcd.firebaseapp.com",
  databaseURL: "https://bestbybites-76bcd-default-rtdb.firebaseio.com",
  projectId: "bestbybites-76bcd",
  storageBucket: "bestbybites-76bcd.firebasestorage.app",
  messagingSenderId: "948179404768",
  appId: "1:948179404768:web:578d5dfbb1826e1b7bcd85",
  measurementId: "G-BMW9C81Y17"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics (only in browser environment)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
export default app;
