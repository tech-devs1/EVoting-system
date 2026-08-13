const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

// Custom mock classes to represent Firestore FieldValues without firebase-admin
class FieldValueIncrement {
  constructor(operand) {
    this.operand = operand;
  }
}

class FieldValueArrayUnion {
  constructor(elements) {
    this.elements = elements;
  }
}

const FieldValue = {
  increment: (val) => new FieldValueIncrement(val),
  arrayUnion: (...elements) => new FieldValueArrayUnion(elements)
};

function mapFields(data) {
  if (!data) return data;
  const copy = { ...data };

  // Map accessOtp <-> otp
  if (copy.accessOtp !== undefined && copy.otp === undefined) {
    copy.otp = copy.accessOtp;
  } else if (copy.otp !== undefined && copy.accessOtp === undefined) {
    copy.accessOtp = copy.otp;
  }

  // Map accessOtpExpiry <-> otpExpiry
  if (copy.accessOtpExpiry !== undefined && copy.otpExpiry === undefined) {
    copy.otpExpiry = copy.accessOtpExpiry;
  } else if (copy.otpExpiry !== undefined && copy.accessOtpExpiry === undefined) {
    copy.accessOtpExpiry = copy.otpExpiry;
  }

  return copy;
}

function sanitizeDocUpdate(existing, update) {
  const result = { ...existing };
  for (const key in update) {
    const val = update[key];
    if (val && typeof val === 'object' && val instanceof FieldValueIncrement) {
      const current = typeof result[key] === 'number' ? result[key] : 0;
      result[key] = current + (val.operand || 1);
    } else if (val && typeof val === 'object' && val instanceof FieldValueArrayUnion) {
      const current = Array.isArray(result[key]) ? result[key] : [];
      const newItems = val.elements;
      result[key] = [...new Set([...current, ...newItems])];
    } else {
      result[key] = val;
    }
  }
  return mapFields(result);
}

const MOCK_DATA_FILE = path.join(__dirname, '../.mock_firestore_data.json');

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
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(MOCK_DATA_FILE)) {
        const raw = fs.readFileSync(MOCK_DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        for (const key in parsed) {
          this.collections[key] = new Map(Object.entries(parsed[key]));
        }
      }
    } catch (err) {
      console.warn('[MockFirestore] Could not load persisted data:', err.message);
    }
  }

  saveToDisk() {
    try {
      const exportData = {};
      for (const key in this.collections) {
        if (this.collections[key] && this.collections[key].size > 0) {
          exportData[key] = Object.fromEntries(this.collections[key]);
        }
      }
      fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(exportData, null, 2), 'utf8');
    } catch (err) {
      console.warn('[MockFirestore] Could not persist data to disk:', err.message);
    }
  }

  async runTransaction(updateFunction) {
    const transaction = {
      get: async (docRef) => {
        return docRef.get();
      },
      set: (docRef, data, options) => {
        docRef.set(data, options);
        return transaction;
      },
      update: (docRef, data) => {
        docRef.update(data);
        return transaction;
      },
      delete: (docRef) => {
        docRef.delete();
        return transaction;
      }
    };
    const res = await updateFunction(transaction);
    this.saveToDisk();
    return res;
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
        this.saveToDisk();
        return true;
      }
    };
  }

  collection(name) {
    const canonicalName = (name && (name === 'tenants' || name.startsWith('tenants/')))
      ? name.replace(/^tenants/, 'organizations')
      : name;

    if (!this.collections[canonicalName]) {
      this.collections[canonicalName] = new Map();
    }
    const collectionMap = this.collections[canonicalName];

    const getDocRef = (docId, parentPath = name) => {
      const fullPath = `${parentPath}/${docId}`;
      return {
        id: docId,
        path: fullPath,
        set: async (data) => {
          const mapped = mapFields({ ...data, id: docId });
          collectionMap.set(docId, mapped);
          this.saveToDisk();
          return mapped;
        },
        get: async () => {
          const data = collectionMap.get(docId);
          const mapped = data ? mapFields(data) : data;
          return { exists: !!data, data: () => mapped, id: docId, ref: getDocRef(docId, parentPath) };
        },
        update: async (data) => {
          const existing = collectionMap.get(docId) || {};
          const sanitized = sanitizeDocUpdate(existing, data);
          const mapped = mapFields(sanitized);
          collectionMap.set(docId, mapped);
          this.saveToDisk();
          return mapped;
        },
        delete: async () => {
          collectionMap.delete(docId);
          this.saveToDisk();
          return true;
        },
        collection: (subName) => this.collection(`${fullPath}/${subName}`)
      };
    };

    return {
      doc: (id) => {
        const docId = id || Math.random().toString(36).substring(2);
        return getDocRef(docId);
      },
      add: async (data) => {
        const docId = Math.random().toString(36).substring(2);
        const mapped = mapFields({ ...data, id: docId });
        collectionMap.set(docId, mapped);
        this.saveToDisk();
        return { id: docId, ref: getDocRef(docId) };
      },
      get: async () => {
        const docs = Array.from(collectionMap.values()).map(data => {
          const mapped = mapFields(data);
          return {
            id: mapped.id,
            data: () => mapped,
            exists: true,
            ref: getDocRef(mapped.id)
          };
        });
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
        const filteredDocs = Array.from(collectionMap.values()).map(mapFields).filter(doc => {
          if (operator === '==') return doc[field] === value;
          if (operator === '!=') return doc[field] !== value;
          if (operator === '>') return doc[field] > value;
          if (operator === '<') return doc[field] < value;
          if (operator === 'in') return Array.isArray(value) && value.includes(doc[field]);
          return false;
        });

        const buildQuery = (docs) => ({
          get: async () => {
            const result = docs.map(data => {
              const mapped = mapFields(data);
              return { id: mapped.id, data: () => mapped, exists: true, ref: getDocRef(mapped.id) };
            });
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

const { initMySQL, db: mysqlDb, isMySQLConnected } = require('./mysql');

// Auto-start MySQL connection check
initMySQL().catch(err => console.warn('MySQL auto-init:', err.message));

const mockInstance = new MockFirestore();
const db = new Proxy({}, {
  get(target, prop) {
    const activeDb = (isMySQLConnected() ? mysqlDb : mockInstance);
    const value = activeDb[prop];
    return typeof value === 'function' ? value.bind(activeDb) : value;
  }
});

const DEFAULT_TENANT_ID = 'compssa';

module.exports = {
  db,
  DEFAULT_TENANT_ID,
  initMySQL,
  FieldValue,
  FieldValueIncrement,
  FieldValueArrayUnion,
  sanitizeDocUpdate
};
