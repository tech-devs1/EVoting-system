// firebase-admin v14 uses named top-level exports (no more admin.credential namespace)
const {
  initializeApp,
  getApps,
  cert,
} = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
// Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env
const hasFirebaseCreds =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY;

let firestoreDb = null;

if (!hasFirebaseCreds) {
  console.warn('⚠️  WARNING: Firebase credentials are missing from .env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).');
  console.warn('⚠️  Student index numbers cannot be fetched from the real database — falling back to in-memory MockFirestore.');
  console.warn('⚠️  Add the Firebase service account credentials to backend/.env and restart the server to fix this.');
} else {
  try {
    // Only initialize if not already done (prevents duplicate app error on hot-reload)
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    firestoreDb = getFirestore();
    console.log('✅ Firebase Admin SDK initialized — connected to project:', process.env.FIREBASE_PROJECT_ID);
  } catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error.message);
    console.warn('⚠️  Falling back to in-memory MockFirestore. Student records will not persist across restarts.');
    firestoreDb = null;
  }
}

// ─── Mock Firestore ───────────────────────────────────────────────────────────
// Used when real Firebase credentials are absent or initialization fails.
// Data is in-memory only — lost on server restart.
class MockFirestore {
  constructor() {
    this.collections = {
      users: new Map(),
      elections: new Map(),
      candidates: new Map(),
      votes: new Map(),
      voted_voters: new Map(),
      audit_logs: new Map(),
      fraud_alerts: new Map(),
      announcements: new Map()
    };
  }

  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new Map();
    }
    const collectionMap = this.collections[name];

    return {
      doc: (id) => {
        const docId = id || Math.random().toString(36).substring(2);
        return {
          id: docId,
          set: async (data) => { collectionMap.set(docId, { ...data, id: docId }); return data; },
          get: async () => {
            const data = collectionMap.get(docId);
            return { exists: !!data, data: () => data, id: docId };
          },
          update: async (data) => {
            const existing = collectionMap.get(docId) || {};
            collectionMap.set(docId, { ...existing, ...data });
            return data;
          },
          delete: async () => { collectionMap.delete(docId); return true; }
        };
      },
      add: async (data) => {
        const docId = Math.random().toString(36).substring(2);
        collectionMap.set(docId, { ...data, id: docId });
        return { id: docId };
      },
      get: async () => {
        const docs = Array.from(collectionMap.values()).map(data => ({
          id: data.id,
          data: () => data,
          exists: true
        }));
        return { docs, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
      },
      where: function(field, operator, value) {
        const filteredDocs = Array.from(collectionMap.values()).filter(doc => {
          if (operator === '==') return doc[field] === value;
          if (operator === '!=') return doc[field] !== value;
          if (operator === '>') return doc[field] > value;
          if (operator === '<') return doc[field] < value;
          return false;
        });

        const buildQuery = (docs) => ({
          get: async () => {
            const result = docs.map(data => ({ id: data.id, data: () => data, exists: true }));
            return { docs: result, empty: result.length === 0, forEach: (cb) => result.forEach(cb) };
          },
          where: (f2, op2, v2) => buildQuery(docs.filter(doc => op2 === '==' ? doc[f2] === v2 : false)),
          orderBy: function() { return this; },
          limit: function() { return this; },
        });

        return buildQuery(filteredDocs);
      }
    };
  }
}

const db = firestoreDb || new MockFirestore();

module.exports = { db };
