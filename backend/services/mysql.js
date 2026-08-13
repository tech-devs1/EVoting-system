const mysql = require('mysql2/promise');

let pool = null;
let isConnected = false;
let isInitializing = false;
let tablesCreated = false;

// Resolve Firestore collection / subcollection names to primary MySQL relational tables
function resolveTableName(name) {
  if (!name) return 'tenants';
  if (name === 'tenants' || name === 'departments') return 'tenants';
  if (name === 'organizations' || name === 'orgs') return 'organizations';
  if (name === 'users' || name === 'accounts') return 'users';
  if (name === 'elections') return 'elections';
  if (name === 'positions') return 'positions';
  if (name === 'candidates') return 'candidates';
  if (name === 'voters') return 'voters';
  if (name === 'votes') return 'votes';
  if (name === 'voted_voters') return 'voted_voters';
  if (name === 'activity_logs') return 'activity_logs';
  if (name === 'fraud_alerts') return 'fraud_alerts';
  if (name === 'onboarding_requests') return 'onboarding_requests';

  // Subcollections pattern matching
  if (name.includes('_elections')) return 'elections';
  if (name.includes('_voter_rolls') || name.includes('_voters')) return 'voters';
  if (name.includes('_candidates')) return 'candidates';
  if (name.includes('_positions')) return 'positions';
  if (name.includes('_votes')) return 'votes';
  if (name.includes('_activity_logs') || name.includes('_logs')) return 'activity_logs';

  return 'tenants';
}

// Initialize MySQL Connection Pool with auto-retry
async function initMySQL(retries = 5, delayMs = 3000) {
  if (isConnected && pool) return pool;
  if (isInitializing) return pool;
  isInitializing = true;

  const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'htu_elect';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!pool) {
        if (mysqlUrl) {
          pool = mysql.createPool(mysqlUrl);
          console.log(`🐬 Connecting to MySQL via URL string (attempt ${attempt}/${retries})...`);
        } else {
          pool = mysql.createPool({
            host,
            port,
            user,
            password,
            database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
          });
          console.log(`🐬 Connecting to MySQL at ${host}:${port}/${database} (attempt ${attempt}/${retries})...`);
        }
      }

      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();

      isConnected = true;
      isInitializing = false;
      console.log('✅ Connected to MySQL database successfully.');

      await createTables();
      tablesCreated = true;
      return pool;
    } catch (err) {
      console.warn(`⚠️ MySQL Connection attempt ${attempt}/${retries} failed:`, err.message);
      pool = null;
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }

  isInitializing = false;
  isConnected = false;
  console.warn('⚠️ MySQL backend running with fallback in-memory store until MYSQL_URL is available.');
  return null;
}

// Automatically create database tables if they do not exist
async function createTables() {
  if (!pool) return;

  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(128) PRIMARY KEY,
      tenantId VARCHAR(128),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(64),
      password VARCHAR(255),
      role VARCHAR(64) NOT NULL DEFAULT 'voter',
      studentId VARCHAR(128),
      indexNo VARCHAR(128),
      accessPin VARCHAR(64),
      status VARCHAR(32) DEFAULT 'active',
      isVerified TINYINT(1) DEFAULT 0,
      data JSON,
      createdAt BIGINT,
      updatedAt BIGINT,
      INDEX idx_users_role (role),
      INDEX idx_users_email (email),
      INDEX idx_users_tenant (tenantId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      acronym VARCHAR(64),
      domain VARCHAR(255),
      adminEmail VARCHAR(255),
      adminPassword VARCHAR(255),
      logoUrl TEXT,
      brandColor VARCHAR(32),
      status VARCHAR(32) DEFAULT 'active',
      data JSON,
      createdAt BIGINT,
      updatedAt BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      acronym VARCHAR(64),
      domain VARCHAR(255),
      logoUrl TEXT,
      brandColor VARCHAR(32),
      status VARCHAR(32) DEFAULT 'active',
      data JSON,
      createdAt BIGINT,
      updatedAt BIGINT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS elections (
      id VARCHAR(128) PRIMARY KEY,
      tenantId VARCHAR(128),
      title VARCHAR(255) NOT NULL,
      category VARCHAR(128),
      description TEXT,
      startDate VARCHAR(128),
      endDate VARCHAR(128),
      status VARCHAR(32) DEFAULT 'draft',
      allowAbstain TINYINT(1) DEFAULT 1,
      isPublic TINYINT(1) DEFAULT 1,
      realTimeResults TINYINT(1) DEFAULT 1,
      requireSelfie TINYINT(1) DEFAULT 0,
      data JSON,
      createdAt BIGINT,
      updatedAt BIGINT,
      INDEX idx_tenant (tenantId),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS positions (
      id VARCHAR(128) PRIMARY KEY,
      electionId VARCHAR(128) NOT NULL,
      title VARCHAR(255) NOT NULL,
      orderIndex INT DEFAULT 0,
      maxVotesAllowed INT DEFAULT 1,
      isRequired TINYINT(1) DEFAULT 1,
      data JSON,
      createdAt BIGINT,
      INDEX idx_election (electionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS candidates (
      id VARCHAR(128) PRIMARY KEY,
      electionId VARCHAR(128) NOT NULL,
      positionId VARCHAR(128),
      positionTitle VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      bio TEXT,
      manifesto TEXT,
      photoUrl TEXT,
      status VARCHAR(32) DEFAULT 'approved',
      votesCount INT DEFAULT 0,
      data JSON,
      createdAt BIGINT,
      INDEX idx_election (electionId),
      INDEX idx_position (positionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS voters (
      id VARCHAR(128) PRIMARY KEY,
      tenantId VARCHAR(128),
      electionId VARCHAR(128),
      studentId VARCHAR(128) NOT NULL,
      indexNo VARCHAR(128),
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(64),
      accessPin VARCHAR(64),
      password VARCHAR(255),
      isVerified TINYINT(1) DEFAULT 0,
      hasVoted TINYINT(1) DEFAULT 0,
      votedAt BIGINT,
      data JSON,
      createdAt BIGINT,
      INDEX idx_tenant_voter (tenantId, studentId),
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS votes (
      id VARCHAR(128) PRIMARY KEY,
      electionId VARCHAR(128) NOT NULL,
      voterId VARCHAR(128) NOT NULL,
      positionId VARCHAR(128),
      candidateId VARCHAR(128),
      encryptedHash TEXT,
      blockIndex INT,
      prevHash VARCHAR(255),
      timestamp BIGINT,
      data JSON,
      INDEX idx_election_votes (electionId),
      INDEX idx_voter_votes (electionId, voterId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS voted_voters (
      id VARCHAR(128) PRIMARY KEY,
      electionId VARCHAR(128) NOT NULL,
      voterId VARCHAR(128) NOT NULL,
      timestamp BIGINT,
      data JSON,
      UNIQUE KEY uq_election_voter (electionId, voterId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(128) PRIMARY KEY,
      tenantId VARCHAR(128),
      actorEmail VARCHAR(255),
      actorRole VARCHAR(64),
      action VARCHAR(128),
      description TEXT,
      ip VARCHAR(64),
      timestamp BIGINT,
      data JSON,
      INDEX idx_tenant_logs (tenantId),
      INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS fraud_alerts (
      id VARCHAR(128) PRIMARY KEY,
      electionId VARCHAR(128),
      voterId VARCHAR(128),
      severity VARCHAR(32),
      type VARCHAR(128),
      details TEXT,
      timestamp BIGINT,
      data JSON
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS onboarding_requests (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      acronym VARCHAR(64),
      contactName VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(64),
      expectedVoters INT DEFAULT 100,
      description TEXT,
      status VARCHAR(32) DEFAULT 'pending',
      submittedAt BIGINT,
      data JSON
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  ];

  for (const q of queries) {
    try {
      await pool.query(q);
    } catch (err) {
      console.error('Error creating SQL table:', err.message);
    }
  }

  // Seed default accounts into users table if empty
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      const bcrypt = require('bcryptjs');
      const superadminPassword = await bcrypt.hash('superadmin080', 10);
      const adminPassword = await bcrypt.hash('admin080', 10);
      const now = Date.now();

      await pool.query(
        `INSERT INTO users (id, tenantId, name, email, password, role, status, isVerified, data, createdAt, updatedAt)
         VALUES 
         (?, 'global', 'Super Administrator', 'superadmin@htu.edu.gh', ?, 'superadmin', 'active', 1, '{}', ?, ?),
         (?, 'compssa', 'EC Administrator', 'admin@htu.edu.gh', ?, 'admin', 'active', 1, '{}', ?, ?)`,
        [
          'usr_superadmin', superadminPassword, now, now,
          'usr_admin', adminPassword, now, now
        ]
      );
      console.log('✅ Default users seeded into MySQL users table.');
    }
  } catch (err) {
    console.warn('User seed check notice:', err.message);
  }

  console.log('✅ MySQL schema tables created / verified.');
}

// In-Memory Fallback Store when MySQL is connecting or fallback
const memoryStore = {};

function sanitizeDocUpdate(existing, update) {
  const result = { ...existing };
  for (const key in update) {
    const val = update[key];
    if (val && typeof val === 'object' && (val.constructor.name === 'FieldValueIncrement' || (val.operand !== undefined && String(val.constructor.name).includes('Increment')))) {
      const current = typeof result[key] === 'number' ? result[key] : 0;
      result[key] = current + (val.operand || 1);
    } else if (val && typeof val === 'object' && (val.constructor.name === 'FieldValueArrayUnion' || (val.elements !== undefined && String(val.constructor.name).includes('ArrayUnion')))) {
      const current = Array.isArray(result[key]) ? result[key] : [];
      const newItems = Array.isArray(val.elements) ? val.elements : [];
      result[key] = [...new Set([...current, ...newItems])];
    } else {
      result[key] = val;
    }
  }
  return result;
}

class MySQLDocumentReference {
  constructor(collectionName, docId) {
    this.collectionName = collectionName;
    this.id = docId;
  }

  collection(subCollectionName) {
    return new MySQLCollectionReference(`${this.collectionName}_${this.id}_${subCollectionName}`);
  }

  async get() {
    if (isConnected && pool) {
      try {
        const targetTable = resolveTableName(this.collectionName);
        const [rows] = await pool.query(
          `SELECT * FROM \`${targetTable}\` WHERE id = ? LIMIT 1`,
          [this.id]
        );
        if (rows.length > 0) {
          const row = rows[0];
          const parsedData = row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : {};
          const fullData = { ...row, ...parsedData };
          delete fullData.data;

          return {
            id: this.id,
            exists: true,
            data: () => fullData
          };
        }
      } catch (err) {
        console.warn(`MySQL get error (${this.collectionName}/${this.id}):`, err.message);
      }
    }

    // Fallback store
    const key = `${this.collectionName}/${this.id}`;
    const data = memoryStore[key];
    return {
      id: this.id,
      exists: !!data,
      data: () => data ? JSON.parse(JSON.stringify(data)) : undefined
    };
  }

  async set(data, options = {}) {
    const key = `${this.collectionName}/${this.id}`;
    let existing = memoryStore[key] || {};

    if (isConnected && pool) {
      try {
        const targetTable = resolveTableName(this.collectionName);
        const [rows] = await pool.query(
          `SELECT data FROM \`${targetTable}\` WHERE id = ? LIMIT 1`,
          [this.id]
        );
        if (rows.length > 0 && rows[0].data) {
          const rowData = rows[0].data;
          existing = typeof rowData === 'string' ? JSON.parse(rowData) : rowData;
        }
      } catch (err) {
        // Safe fallback
      }
    }

    const updated = options.merge ? sanitizeDocUpdate(existing, data) : sanitizeDocUpdate({}, data);
    memoryStore[key] = updated;

    if (isConnected && pool) {
      try {
        const targetTable = resolveTableName(this.collectionName);
        const payload = JSON.stringify(updated);
        const name = updated.name || updated.title || 'Untitled';
        const acronym = updated.acronym || (name ? name.substring(0, 6).toUpperCase() : '');
        const domain = updated.domain || '';
        const adminEmail = updated.adminEmail || updated.email || null;
        const adminPassword = updated.adminPassword || updated.password || null;
        const logoUrl = updated.logoUrl || null;
        const brandColor = updated.brandColor || '#3B82F6';
        const status = updated.status || 'active';
        const createdAt = updated.createdAt || Date.now();
        const updatedAt = Date.now();

        if (targetTable === 'tenants') {
          await pool.query(
            `INSERT INTO tenants (id, name, acronym, domain, adminEmail, adminPassword, logoUrl, brandColor, status, data, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               name = VALUES(name), 
               acronym = VALUES(acronym), 
               domain = VALUES(domain), 
               adminEmail = COALESCE(VALUES(adminEmail), adminEmail), 
               adminPassword = COALESCE(VALUES(adminPassword), adminPassword), 
               status = VALUES(status), 
               data = VALUES(data), 
               updatedAt = VALUES(updatedAt)`,
            [this.id, name, acronym, domain, adminEmail, adminPassword, logoUrl, brandColor, status, payload, createdAt, updatedAt]
          );

          // ALSO mirror into organizations table
          await pool.query(
            `INSERT INTO organizations (id, name, acronym, domain, logoUrl, brandColor, status, data, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               name = VALUES(name), 
               acronym = VALUES(acronym), 
               domain = VALUES(domain), 
               status = VALUES(status), 
               data = VALUES(data), 
               updatedAt = VALUES(updatedAt)`,
            [this.id, name, acronym, domain, logoUrl, brandColor, status, payload, createdAt, updatedAt]
          );

          // ALSO mirror into users table if adminEmail exists
          if (adminEmail) {
            await pool.query(
              `INSERT INTO users (id, tenantId, name, email, password, role, status, data, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, 'admin', ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE 
                 name = VALUES(name), 
                 password = COALESCE(VALUES(password), password), 
                 role = 'admin', 
                 status = VALUES(status), 
                 data = VALUES(data), 
                 updatedAt = VALUES(updatedAt)`,
              [`usr_${this.id}`, this.id, `${name} Administrator`, adminEmail, adminPassword, status, payload, createdAt, updatedAt]
            );
          }
        } else if (targetTable === 'organizations') {
          await pool.query(
            `INSERT INTO organizations (id, name, acronym, domain, logoUrl, brandColor, status, data, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               name = VALUES(name), 
               acronym = VALUES(acronym), 
               domain = VALUES(domain), 
               status = VALUES(status), 
               data = VALUES(data), 
               updatedAt = VALUES(updatedAt)`,
            [this.id, name, acronym, domain, logoUrl, brandColor, status, payload, createdAt, updatedAt]
          );
        } else if (targetTable === 'users') {
          await pool.query(
            `INSERT INTO users (id, tenantId, name, email, password, role, status, data, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               name = VALUES(name), 
               password = COALESCE(VALUES(password), password), 
               role = VALUES(role), 
               status = VALUES(status), 
               data = VALUES(data), 
               updatedAt = VALUES(updatedAt)`,
            [this.id, updated.tenantId || 'global', name, updated.email || '', updated.password || null, updated.role || 'voter', status, payload, createdAt, updatedAt]
          );
        } else {
          await pool.query(
            `INSERT INTO \`${targetTable}\` (id, data, createdAt, updatedAt)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data), updatedAt = VALUES(updatedAt)`,
            [this.id, payload, createdAt, updatedAt]
          );
        }
      } catch (err) {
        console.warn(`MySQL set error (${this.collectionName}/${this.id}):`, err.message);
      }
    }

    return { id: this.id };
  }

  async update(data) {
    return this.set(data, { merge: true });
  }

  async delete() {
    const key = `${this.collectionName}/${this.id}`;
    delete memoryStore[key];

    if (isConnected && pool) {
      try {
        const targetTable = resolveTableName(this.collectionName);
        await pool.query(`DELETE FROM \`${targetTable}\` WHERE id = ?`, [this.id]);
        if (targetTable === 'tenants') {
          await pool.query(`DELETE FROM organizations WHERE id = ?`, [this.id]).catch(() => {});
        }
      } catch (err) {
        console.warn(`MySQL delete error (${this.collectionName}/${this.id}):`, err.message);
      }
    }
  }
}

class MySQLQuery {
  constructor(collectionName, filters = [], limitVal = null, orderByVal = null) {
    this.collectionName = collectionName;
    this.filters = filters;
    this.limitVal = limitVal;
    this.orderByVal = orderByVal;
  }

  where(field, op, value) {
    return new MySQLQuery(this.collectionName, [...this.filters, { field, op, value }], this.limitVal, this.orderByVal);
  }

  orderBy(field, direction = 'asc') {
    return new MySQLQuery(this.collectionName, this.filters, this.limitVal, { field, direction });
  }

  limit(num) {
    return new MySQLQuery(this.collectionName, this.filters, num, this.orderByVal);
  }

  async get() {
    let docs = [];

    if (isConnected && pool) {
      try {
        const targetTable = resolveTableName(this.collectionName);
        let sql = `SELECT * FROM \`${targetTable}\``;
        const params = [];
        const whereClauses = [];

        for (const f of this.filters) {
          whereClauses.push(`(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${f.field}')) = ? OR \`${f.field}\` = ?)`);
          params.push(String(f.value), String(f.value));
        }

        if (whereClauses.length > 0) {
          sql += ` WHERE ` + whereClauses.join(' AND ');
        }

        if (this.orderByVal) {
          sql += ` ORDER BY createdAt ${this.orderByVal.direction.toUpperCase()}`;
        }

        if (this.limitVal) {
          sql += ` LIMIT ${parseInt(this.limitVal, 10)}`;
        }

        let [rows] = await pool.query(sql, params);

        // Fallback for organizations query if organizations table is empty but tenants has rows
        if (rows.length === 0 && targetTable === 'organizations') {
          const [tenantRows] = await pool.query(`SELECT * FROM tenants`);
          rows = tenantRows;
        }

        docs = rows.map(r => {
          const parsedData = r.data ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : {};
          const fullData = { ...r, ...parsedData };
          delete fullData.data;

          return {
            id: r.id,
            exists: true,
            data: () => fullData
          };
        });

        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
          forEach: (cb) => docs.forEach(cb)
        };
      } catch (err) {
        console.warn(`MySQL query error (${this.collectionName}):`, err.message);
      }
    }

    // Memory store fallback search
    const prefix = `${this.collectionName}/`;
    const matchedDocs = [];

    for (const key of Object.keys(memoryStore)) {
      if (key.startsWith(prefix)) {
        const id = key.substring(prefix.length);
        const data = memoryStore[key];

        let pass = true;
        for (const f of this.filters) {
          if (f.op === '==' && data[f.field] !== f.value) pass = false;
        }

        if (pass) {
          matchedDocs.push({
            id,
            exists: true,
            data: () => JSON.parse(JSON.stringify(data))
          });
        }
      }
    }

    return {
      empty: matchedDocs.length === 0,
      size: matchedDocs.length,
      docs: matchedDocs,
      forEach: (cb) => matchedDocs.forEach(cb)
    };
  }

  count() {
    return {
      get: async () => {
        const res = await this.get();
        return { data: () => ({ count: res.size }) };
      }
    };
  }
}

class MySQLCollectionReference {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  doc(id) {
    const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    return new MySQLDocumentReference(this.collectionName, docId);
  }

  async add(data) {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const ref = new MySQLDocumentReference(this.collectionName, docId);
    await ref.set(data);
    return ref;
  }

  where(field, op, value) {
    return new MySQLQuery(this.collectionName, [{ field, op, value }]);
  }

  orderBy(field, direction = 'asc') {
    return new MySQLQuery(this.collectionName, [], null, { field, direction });
  }

  limit(num) {
    return new MySQLQuery(this.collectionName, [], num, null);
  }

  async get() {
    return new MySQLQuery(this.collectionName).get();
  }
}

const dbAdapter = {
  collection: (name) => new MySQLCollectionReference(name),
  collectionGroup: (name) => new MySQLCollectionReference(name)
};

module.exports = {
  initMySQL,
  db: dbAdapter,
  getPool: () => pool,
  isMySQLConnected: () => isConnected
};
