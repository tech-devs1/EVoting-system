const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin (mock configuration for now if environment variables are not real)
// In a real environment, we'd use a service account key JSON.
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'mock-project',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'mock@mock.com',
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
    })
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.log('Using mock firestore instance as Firebase creds might be invalid.');
}

const db = admin.firestore ? admin.firestore() : null;

// Mock database wrapper to allow the app to run without a real Firebase project connected
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
        // Simple mock where
        const filteredDocs = Array.from(collectionMap.values()).filter(doc => {
          if (operator === '==') return doc[field] === value;
          return false;
        });
        
        return {
          get: async () => {
            const docs = filteredDocs.map(data => ({ id: data.id, data: () => data, exists: true }));
            return { docs, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
          }
        };
      }
    };
  }
}

// Export either real firestore or mock based on initialization success
const firestoreDb = db || new MockFirestore();

module.exports = {
  admin,
  db: firestoreDb
};
