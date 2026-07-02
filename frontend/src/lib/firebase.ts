import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDLZAnrMZJhti55Mo3PTntoPFa4-8hvHb4",
  authDomain: "voting-0.firebaseapp.com",
  projectId: "voting-0",
  storageBucket: "voting-0.firebasestorage.app",
  messagingSenderId: "719858248032",
  appId: "1:719858248032:web:06f6fd64c8f29639cc5605",
  measurementId: "G-PP0ZC2Q44R"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
