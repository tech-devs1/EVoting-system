import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDxNfoX5qwMCqDNWNtBYKbg5bqK5iYptaA",
  authDomain: "htu-elect.firebaseapp.com",
  projectId: "htu-elect",
  storageBucket: "htu-elect.firebasestorage.app",
  messagingSenderId: "165648828899",
  appId: "1:165648828899:web:7cfc969a599a1f5f08f8d6",
  measurementId: "G-LQBJCJ5KSS"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
