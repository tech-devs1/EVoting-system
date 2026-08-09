# 🗳️ COMPSSA Secure Electronic Voting System
## Full Implementation Progress & System Optimization Report

---

## 📋 Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Current System Architecture & Feature Checklist](#2-current-system-architecture--feature-checklist)
3. [High-Concurrency Crash Diagnosis & Applied Fixes](#3-high-concurrency-crash-diagnosis--applied-fixes)
4. [MySQL Database Migration Strategy (for phpMyAdmin & cPanel)](#4-mysql-database-migration-strategy-for-phpmyadmin--cpanel)
5. [Future Recommendations & Structural Adjustments](#5-future-recommendations--structural-adjustments)

---

## 1. Executive Summary
The **COMPSSA Secure Electronic Voting System** is a modern, Progress Web App (PWA) designed to provide secure, transparent, and user-friendly student elections at HTU. It uses a Next.js (React) frontend and a Node.js Express backend, utilizing Firebase Firestore as its document store.

This report provides a comprehensive overview of the current implementation status of all system components. It analyzes critical system crash issues under high concurrency (multiple concurrent voting actions) and details the optimized caching and transaction handling applied to secure system stability. Finally, it outlines a robust, production-ready **MySQL Database Migration Roadmap** tailored for deployment on **cPanel/phpMyAdmin** hosting environments.

---

## 2. Current System Architecture & Feature Checklist
The platform currently utilizes a decoupled multi-tenant architecture, supporting departmental isolating under the `tenants` collection structure.

### 2.1 Backend Route & Service Checklist
Below is the progress checklist of backend services, middleware, and route handlers:

| Route / Service File | Feature / Description | Status | Details / Notes |
|---|---|---|---|
| `backend/server.js` | App entry point, CORS, payload limits, global error handling. | **Completed** | Enhanced with a basic error handler to capture async rejections. |
| `routes/auth.js` | Student verification, signup, dual-channel OTP delivery, login, password reset. | **Completed** | Handles voter login, dual admins (primary tenant admin and secondary department admins), andforgot-password flow. Dual-channel OTP uses EmailJS and mNotify/BMS Africa SMS. |
| `routes/votes.js` | Vote casting, double-voting validation, candidate tallies. | **Completed / Optimized** | Uses Firestore `db.runTransaction` for concurrency safety. *Recently optimized* with candidate caching and graceful transaction conflict handling. |
| `routes/elections.js` | CRUD elections, time-window updates, PDF report exports. | **Completed** | Caches report data and includes cryptographic verification hashes in generated PDF files. |
| `routes/candidates.js` | CRUD candidates, manifestos, independent vs. party candidates. | **Completed** | Links candidates directly to elections. |
| `routes/admin.js` | KPI counts, combined dashboard stats, voter roster CSV uploads, fraud logs. | **Completed** | Utilizes fast count aggregations (`.count()`) to reduce read bills and improve responsiveness. |
| `services/firebase.js` | Firebase SDK credentials loading, fallback in-memory MockFirestore. | **Completed** | Seamlessly falls back to local map-based structure if credential variables are missing. |
| `services/audit.js` | Cryptographic SHA-256 vote hash chaining (Tamper-evident ledger). | **Completed / Optimized** | Prevents tampering. *Recently optimized* with previousHash caching to eliminate read storms. |
| `services/cache.js` | In-memory TTL cache with manual invalidation and prefix clearing. | **Completed** | Essential for mitigating serverless and database read overhead. |
| `services/fraud.js` | Anomaly check, duplicate voter flagging. | **Completed** | Logs suspicious activities to global and tenant-specific collections. |

### 2.2 Biometrics & Face Recognition Status
- **Registration (Enrolment):** Users register by sending their webcam snapshot (base64 string) to the database under their Firestore voter profile.
- **Verification (`/verify-face`):**
  - **Status:** **Partially Stubbed / Pending API Key Integration**.
  - **Details:** The backend route `routes/auth.js` has a placeholder `/verify-face` endpoint which currently returns `{ verified: true }` automatically.
  - **Action Required:** In a live production environment, the endpoint must be uncommented and configured to call the `api.deepface.dev/verify` serverless API, matching the live capture against the enrolled base64 string using the `Facenet` model.

---

## 3. High-Concurrency Crash Diagnosis & Applied Fixes
When multiple voters try to access and vote in the system simultaneously, the original architecture experienced crashes and timeouts. We identified two primary bottlenecks and applied targeted code-level mitigations to make the system stable.

### 3.1 The Root Causes of Concurrency Crashes
1. **The Audit Log Read Storm (Cryptographic Chaining Overhead):**
   - **How it worked:** To maintain the tamper-evident hash chain, `recordVoteAudit` in `backend/services/audit.js` queried the database for the last 50 audit logs of that election (`audit_logs.where('electionId', '==', id).limit(50).get()`) on **every single vote cast** to calculate the sequential hash block.
   - **The Crash Trigger:** If 100 users voted concurrently, the backend performed $100 \times 50 = 5,000$ Firestore reads concurrently, causing massive Firestore quota exhaustion, API throttling, slow responses, and eventual gateway timeouts. It also caused cryptographic "branches" because multiple parallel threads read the same "latest" hash.
2. **Firestore Transaction Hotspots (Candidate Tallies):**
   - **How it worked:** Voting increments the `votes` tally on a single candidate document.
   - **The Crash Trigger:** Firestore limits writes to a single document to approximately **1 write per second**. Under high concurrency, hundreds of transactions repeatedly try to read-and-update the *same candidate document*, triggering massive transaction contention. This causes Firestore transactions to repeatedly abort, retry, and eventually fail, exhausting server memory and causing connection pools to crash.

### 3.2 Implemented Code Mitigations
We implemented surgical, non-breaking modifications in the codebase to eliminate these issues immediately:

1. **Previous Hash Caching (`backend/services/audit.js`):**
   - **Mitigation:** We integrated our memory cache (`cache.js`) into `recordVoteAudit`. The system now queries Firestore for the latest hash *only once* on cache miss. When a new vote is recorded, the computed hash is immediately saved to the in-memory cache under `audit:latest-hash:${electionId}` with a 60-second TTL.
   - **Benefit:** Firestore reads for audit block chains are reduced from **O(N * 50) to O(1)** under heavy traffic, completely eliminating the read storm.
2. **Candidate Detail Caching (`backend/routes/votes.js`):**
   - **Mitigation:** Candidate details (name, position, department) are now loaded from the in-memory cache (`candidates:detail:${candidateId}`) rather than querying Firestore on every vote request, saving an additional database read per vote.
3. **Graceful Contention & Timeout Handling (`backend/routes/votes.js`):**
   - **Mitigation:** The vote transaction block is wrapped in a robust catch-all. If the database experiences a contention lock or timeout (Firestore Error Code 4 / 10), the system gracefully intercepts the error and returns a **HTTP 429 Too Many Requests** response with a friendly message: *"The system is experiencing high traffic. Your vote was not recorded yet. Please try again in a few seconds."*
   - **Benefit:** This prevents the server process from hanging or crashing, maintains server responsiveness, and advises the client to back off and retry.

---

## 4. MySQL Database Migration Strategy (for phpMyAdmin & cPanel)
Migrating from Firebase Firestore (NoSQL) to **MySQL (Relational SQL)** is the single best way to solve document lock contention and support unlimited high-concurrency voting on cost-effective traditional hosting panels like cPanel.

### 4.1 Why Migrate to MySQL on cPanel?
- **True ACID Compliance & Row-level Locking:** MySQL manages transactional changes gracefully. With appropriate isolation levels, it handles concurrent increments of candidate votes seamlessly without retries crashing the server.
- **Relational Integrity:** Foreign key constraints guarantee that a voter cannot vote for a candidate that doesn't exist, and cascades election deletion safely.
- **Extremely Low Cost:** Deploying the backend Node.js application alongside a MySQL database on cPanel/cPanel VPS is cheap, widely supported, and managed visually through **phpMyAdmin**.

### 4.2 Target SQL Schema Design
Here is the recommended MySQL database schema, optimized with indexes to ensure rapid reads and writes during voting peaks:

```sql
-- 1. Tenants (Departments / Orgs) Table
CREATE TABLE tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    admin_email VARCHAR(150) UNIQUE NOT NULL,
    admin_password VARCHAR(255) NOT NULL,
    created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Voter Rolls (Registered & Pre-enrolled Students)
CREATE TABLE voter_rolls (
    student_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30) NULL,
    password VARCHAR(255) NULL,
    role VARCHAR(20) DEFAULT 'voter',
    is_registered BOOLEAN DEFAULT FALSE,
    face_image LONGTEXT NULL,                -- Base64 photo representation
    face_embedding TEXT NULL,                -- JSON string representation of 512-D float array
    otp VARCHAR(10) NULL,
    otp_expiry BIGINT NULL,
    reset_code VARCHAR(10) NULL,
    reset_code_expiry BIGINT NULL,
    programme VARCHAR(100) NULL,
    level VARCHAR(20) NULL,
    upload_id VARCHAR(50) NULL,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_tenant_email (tenant_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Elections Table
CREATE TABLE elections (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    start_date VARCHAR(50) NOT NULL,
    end_date VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',      -- 'draft', 'active', 'completed'
    type VARCHAR(25) DEFAULT 'src',
    department VARCHAR(100) NULL,
    show_results BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_tenant_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Candidates Table
CREATE TABLE candidates (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    election_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    position VARCHAR(100) NOT NULL,
    manifesto TEXT NULL,
    image_url TEXT NULL,
    votes INT DEFAULT 0,
    no_votes INT DEFAULT 0,                  -- Used if independent candidate (Yes/No choices)
    is_independent BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    INDEX idx_election_position (election_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Votes (Anonymized Ballot Ledger)
CREATE TABLE votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    election_id VARCHAR(50) NOT NULL,
    candidate_id VARCHAR(50) NOT NULL,
    position VARCHAR(100) NOT NULL,
    timestamp BIGINT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Voted Voters (Double-Voting Protection Ledger)
-- A unique constraint on (voter_id, election_id, position) prevents double-voting at the database driver level!
CREATE TABLE voted_voters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    voter_id VARCHAR(50) NOT NULL,
    election_id VARCHAR(50) NOT NULL,
    position VARCHAR(100) NOT NULL,
    audit_tx_id VARCHAR(100) NOT NULL,
    timestamp BIGINT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (voter_id) REFERENCES voter_rolls(student_id) ON DELETE CASCADE,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_voter_ballot (voter_id, election_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Audit Logs Table (Tamper-evident Ledger Chaining)
CREATE TABLE audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    election_id VARCHAR(50) NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    candidate_name VARCHAR(150) NOT NULL,
    position VARCHAR(100) NOT NULL,
    data_payload TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Fraud Alerts Table
CREATE TABLE fraud_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT NULL,                      -- Serialized JSON metadata
    status VARCHAR(20) DEFAULT 'unresolved',
    timestamp BIGINT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Activity Logs Table
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    actor_email VARCHAR(150) NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    ip VARCHAR(45) NOT NULL,
    status VARCHAR(20) NOT NULL,
    meta TEXT NULL,                          -- Serialized JSON metadata
    timestamp BIGINT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.3 Step-by-Step Migration Roadmap

#### Step 1: Initialize MySQL Database in cPanel
1. Log in to your cPanel control panel.
2. Search for the **MySQL Database Wizard**.
3. Create a database (e.g. `compssa_voting`) and a database user with a secure password. Assign **ALL PRIVILEGES** to the user.
4. Open **phpMyAdmin** from cPanel, select your newly created database, and click the **SQL** tab.
5. Paste the schema SQL DDL commands from Section 4.2 and click **Go** to create all tables and indexes.

#### Step 2: Set up Node.js Environment on cPanel
1. In cPanel, find the **Setup Node.js App** tool.
2. Click **Create Application**. Select your Node version (v18+ recommended) and set the application URL and startup file (`server.js`).
3. Add environment variables inside the cPanel UI (e.g. `DB_HOST=127.0.0.1`, `DB_USER=...`, `DB_PASSWORD=...`, `DB_NAME=...`, `PORT=5000`).

#### Step 3: Rewrite Codebase with SQL Driver
1. In `backend/package.json`, add standard SQL connectors:
   `npm install mysql2 sequelize` (or plain `mysql2` pool queries for the fastest performance).
2. Create a database connection pool helper `backend/services/mysql.js`:
   ```javascript
   const mysql = require('mysql2/promise');
   const pool = mysql.createPool({
     host: process.env.DB_HOST || '127.0.0.1',
     user: process.env.DB_USER,
     password: process.env.DB_PASSWORD,
     database: process.env.DB_NAME,
     waitForConnections: true,
     connectionLimit: 50, // Critical for high concurrency!
     queueLimit: 0
   });
   module.exports = pool;
   ```
3. Update route files (e.g. `routes/votes.js`) to use standard SQL query syntax. For casting votes, use database transactions with `START TRANSACTION`, `FOR UPDATE` lock reading to prevent double-votes, and increment tallies reliably:
   ```javascript
   const connection = await pool.getConnection();
   try {
     await connection.beginTransaction();

     // 1. Check double voting with row-level lock
     const [voted] = await connection.execute(
       'SELECT id FROM voted_voters WHERE voter_id = ? AND election_id = ? AND position = ? FOR UPDATE',
       [voterId, electionId, position]
     );
     if (voted.length > 0) throw new Error('DUPLICATE_VOTE');

     // 2. Safely increment Candidate tally
     const voteCol = (choice === 'no') ? 'no_votes' : 'votes';
     await connection.execute(
       `UPDATE candidates SET ${voteCol} = ${voteCol} + 1 WHERE id = ?`,
       [candidateId]
     );

     // 3. Write anonymized vote log
     await connection.execute(
       'INSERT INTO votes (tenant_id, election_id, candidate_id, position, timestamp) VALUES (?, ?, ?, ?, ?)',
       [tenantId, electionId, candidateId, position, Date.now()]
     );

     // 4. Record voted status
     await connection.execute(
       'INSERT INTO voted_voters (tenant_id, voter_id, election_id, position, audit_tx_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
       [tenantId, voterId, electionId, position, auditTxId, Date.now()]
     );

     await connection.commit();
   } catch (err) {
     await connection.rollback();
     throw err;
   } finally {
     connection.release();
   }
   ```

#### Step 4: Run Data ETL Script (Firebase to MySQL)
Create a migration script `scripts/migrateFirebaseToSql.js` in the backend. This script reads all current documents from Firebase and batches them into the newly created MySQL tables:
```javascript
// Example ETL excerpt
const { db } = require('../services/firebase');
const pool = require('../services/mysql');

async function migrateVoterRolls() {
  const votersSnap = await db.collection('tenants').doc('compssa').collection('voter_rolls').get();
  for (const doc of votersSnap.docs) {
    const data = doc.data();
    await pool.execute(
      'INSERT INTO voter_rolls (student_id, tenant_id, name, email, phone, password, role, is_registered, face_image, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [doc.id, 'compssa', data.name, data.email, data.phone || null, data.password || null, data.role || 'voter', data.isRegistered || false, data.faceImage || null, data.createdAt || Date.now()]
    );
  }
}
```

---

## 5. Future Recommendations & Structural Adjustments
To guarantee 100% security and zero downtime, the following issues are highlighted in our **TODO.md** list:
- **Enable Write-Sharding or Read-Replicas:** If the system scales past 10,000 concurrent voters, utilize a MySQL master-replica configuration.
- **Biometric Identity Protection:** Transition facial verification `/verify-face` from a development stub to the live Cloud Biometrics API.
- **Dual-Channel Fallbacks:** Maintain the active status of both SMTP/EmailJS and BMS Africa SMS gateways so voters are never blocked by local carrier outages.
