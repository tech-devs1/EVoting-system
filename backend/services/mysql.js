const mysql = require('mysql2/promise');

let pool = null;
let isConnected = false;

// Initialize MySQL Connection Pool
async function initMySQL() {
  const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'htu_elect';

  try {
    if (mysqlUrl) {
      pool = mysql.createPool(mysqlUrl);
      console.log('🐬 Connecting to MySQL via URL connection string...');
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
      console.log(`🐬 Connecting to MySQL at ${host}:${port}/${database}...`);
    }

    // Verify connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    isConnected = true;
    console.log('✅ Connected to MySQL database successfully.');

    // Auto-create required SQL tables
    await createTables();
    return pool;
  } catch (err) {
    console.warn('⚠️ MySQL Connection Warning:', err.message);
    console.warn('⚠️ Backend running with fallback in-memory database store until MYSQL_URL is configured.');
    isConnected = false;
    return null;
  }
}

// Automatically create database tables if they do not exist
async function createTables() {
  if (!pool) return;

  const queries = [
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

  console.log('✅ MySQL schema tables created / verified.');
}

// In-Memory Fallback Store when MySQL is connecting or fallback
const memoryStore = {};

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
        const [rows] = await pool.query(
          `SELECT * FROM \`${this.collectionName}\` WHERE id = ? LIMIT 1`,
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
    const existing = memoryStore[key] || {};
    const updated = options.merge ? { ...existing, ...data } : data;
    memoryStore[key] = updated;

    if (isConnected && pool) {
      try {
        const payload = JSON.stringify(updated);
        const name = updated.name || updated.title || null;
        const acronym = updated.acronym || null;
        const domain = updated.domain || null;
        const status = updated.status || 'active';
        const createdAt = updated.createdAt || Date.now();
        const updatedAt = Date.now();

        await pool.query(
          `INSERT INTO \`${this.collectionName}\` (id, data, name, acronym, domain, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE data = VALUES(data), name = VALUES(name), acronym = VALUES(acronym), domain = VALUES(domain), status = VALUES(status), updatedAt = VALUES(updatedAt)`,
          [this.id, payload, name, acronym, domain, status, createdAt, updatedAt]
        );
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
        await pool.query(`DELETE FROM \`${this.collectionName}\` WHERE id = ?`, [this.id]);
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
        let sql = `SELECT * FROM \`${this.collectionName}\``;
        const params = [];
        const whereClauses = [];

        for (const f of this.filters) {
          whereClauses.push(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${f.field}')) = ?`);
          params.push(String(f.value));
        }

        if (whereClauses.length > 0) {
          sql += ` WHERE ` + whereClauses.join(' AND ');
        }

        if (this.orderByVal) {
          sql += ` ORDER BY JSON_EXTRACT(data, '$.${this.orderByVal.field}') ${this.orderByVal.direction.toUpperCase()}`;
        }

        if (this.limitVal) {
          sql += ` LIMIT ${parseInt(this.limitVal, 10)}`;
        }

        const [rows] = await pool.query(sql, params);
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
