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
      // Sanitize the private key in case it is wrapped in double quotes by Vercel
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
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
function sanitizeMockUpdate(existing, update) {
  const result = { ...existing };
  for (const key in update) {
    const val = update[key];
    if (val && typeof val === 'object' && val.constructor.name === 'NumericIncrementTransform') {
      const current = typeof result[key] === 'number' ? result[key] : 0;
      result[key] = current + (val.operand || 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}

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

  batch() {
    const ops = [];
    return {
      set: (docRef, data) => {
        ops.push({ type: 'set', ref: docRef, data });
      },
      update: (docRef, data) => {
        ops.push({ type: 'update', ref: docRef, data });
      },
      delete: (docRef) => {
        ops.push({ type: 'delete', ref: docRef });
      },
      commit: async () => {
        for (const op of ops) {
          if (op.type === 'set') {
            await op.ref.set(op.data);
          } else if (op.type === 'update') {
            await op.ref.update(op.data);
          } else if (op.type === 'delete') {
            await op.ref.delete();
          }
        }
        return true;
      }
    };
  }

  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new Map();
    }
    const collectionMap = this.collections[name];

    const getDocRef = (docId) => ({
      id: docId,
      set: async (data) => { collectionMap.set(docId, { ...data, id: docId }); return data; },
      get: async () => {
        const data = collectionMap.get(docId);
        return { exists: !!data, data: () => data, id: docId, ref: getDocRef(docId) };
      },
      update: async (data) => {
        const existing = collectionMap.get(docId) || {};
        const sanitized = sanitizeMockUpdate(existing, data);
        collectionMap.set(docId, sanitized);
        return sanitized;
      },
      delete: async () => { collectionMap.delete(docId); return true; }
    });

    return {
      doc: (id) => {
        const docId = id || Math.random().toString(36).substring(2);
        return getDocRef(docId);
      },
      add: async (data) => {
        const docId = Math.random().toString(36).substring(2);
        collectionMap.set(docId, { ...data, id: docId });
        return { id: docId, ref: getDocRef(docId) };
      },
      get: async () => {
        const docs = Array.from(collectionMap.values()).map(data => ({
          id: data.id,
          data: () => data,
          exists: true,
          ref: getDocRef(data.id)
        }));
        return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
      },
      select: function() { return this; },
      count: function() {
        return {
          get: async () => ({
            data: () => ({ count: collectionMap.size })
          })
        };
      },
      where: function(field, operator, value) {
        const filteredDocs = Array.from(collectionMap.values()).filter(doc => {
          if (operator === '==') return doc[field] === value;
          if (operator === '!=') return doc[field] !== value;
          if (operator === '>') return doc[field] > value;
          if (operator === '<') return doc[field] < value;
          if (operator === 'in') return Array.isArray(value) && value.includes(doc[field]);
          return false;
        });

        const buildQuery = (docs) => ({
          get: async () => {
            const result = docs.map(data => ({ id: data.id, data: () => data, exists: true, ref: getDocRef(data.id) }));
            return { docs: result, empty: result.length === 0, size: result.length, forEach: (cb) => result.forEach(cb) };
          },
          where: (f2, op2, v2) => buildQuery(docs.filter(doc => {
            if (op2 === '==') return doc[f2] === v2;
            if (op2 === '!=') return doc[f2] !== v2;
            if (op2 === '>') return doc[f2] > v2;
            if (op2 === '<') return doc[f2] < v2;
            if (op2 === 'in') return Array.isArray(v2) && v2.includes(doc[f2]);
            return false;
          })),
          select: function() { return this; },
          orderBy: function() { return this; },
          limit: function() { return this; },
          count: function() {
            return {
              get: async () => ({
                data: () => ({ count: docs.length })
              })
            };
          }
        });

        return buildQuery(filteredDocs);
      }
    };
  }
}

const db = firestoreDb || new MockFirestore();

// Multi-Tenant Migration Constant
// During the migration, all non-tenant specific API requests will hit the default_tenant
const DEFAULT_TENANT_ID = 'default_tenant';

module.exports = { db, DEFAULT_TENANT_ID };
