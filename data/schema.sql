-- ─────────────────────────────────────────────────────────────────────────────
-- HTU ELECT — PRODUCTION MYSQL DATABASE SCHEMA
-- Database Engine: MySQL 8.0+ / MariaDB 10.5+
-- Designed for Railway MySQL Service Deployment
-- ─────────────────────────────────────────────────────────────────────────────

SET FOREIGN_KEY_CHECKS = 0;

-- 1. TENANTS / DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  acronym VARCHAR(64),
  domain VARCHAR(255),
  adminEmail VARCHAR(255) NOT NULL,
  adminPassword VARCHAR(255) NOT NULL,
  logoUrl TEXT,
  brandColor VARCHAR(32) DEFAULT '#2563eb',
  status VARCHAR(32) DEFAULT 'active',
  data JSON,
  createdAt BIGINT NOT NULL,
  updatedAt BIGINT NOT NULL,
  INDEX idx_tenant_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. PUBLIC ORGANIZATIONS DIRECTORY
CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  acronym VARCHAR(64),
  domain VARCHAR(255),
  logoUrl TEXT,
  brandColor VARCHAR(32) DEFAULT '#2563eb',
  status VARCHAR(32) DEFAULT 'active',
  data JSON,
  createdAt BIGINT NOT NULL,
  updatedAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ELECTIONS TABLE
CREATE TABLE IF NOT EXISTS elections (
  id VARCHAR(128) PRIMARY KEY,
  tenantId VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(128) DEFAULT 'General Election',
  description TEXT,
  startDate VARCHAR(128) NOT NULL,
  endDate VARCHAR(128) NOT NULL,
  status VARCHAR(32) DEFAULT 'draft',
  allowAbstain TINYINT(1) DEFAULT 1,
  isPublic TINYINT(1) DEFAULT 1,
  realTimeResults TINYINT(1) DEFAULT 1,
  requireSelfie TINYINT(1) DEFAULT 0,
  data JSON,
  createdAt BIGINT NOT NULL,
  updatedAt BIGINT NOT NULL,
  INDEX idx_election_tenant (tenantId),
  INDEX idx_election_status (status),
  CONSTRAINT fk_election_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. POSITIONS TABLE (Per-Election Offices e.g. President, Financial Secretary)
CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  orderIndex INT DEFAULT 0,
  maxVotesAllowed INT DEFAULT 1,
  isRequired TINYINT(1) DEFAULT 1,
  data JSON,
  createdAt BIGINT NOT NULL,
  INDEX idx_pos_election (electionId),
  CONSTRAINT fk_pos_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS candidates (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NOT NULL,
  positionId VARCHAR(128) NOT NULL,
  positionTitle VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  manifesto TEXT,
  photoUrl TEXT,
  status VARCHAR(32) DEFAULT 'approved',
  votesCount INT DEFAULT 0,
  data JSON,
  createdAt BIGINT NOT NULL,
  INDEX idx_cand_election (electionId),
  INDEX idx_cand_position (positionId),
  CONSTRAINT fk_cand_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE,
  CONSTRAINT fk_cand_position FOREIGN KEY (positionId) REFERENCES positions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. VOTERS TABLE (Voter Roster & Credentials)
CREATE TABLE IF NOT EXISTS voters (
  id VARCHAR(128) PRIMARY KEY,
  tenantId VARCHAR(128) NOT NULL,
  electionId VARCHAR(128),
  studentId VARCHAR(128) NOT NULL,
  indexNo VARCHAR(128),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  accessPin VARCHAR(64),
  password VARCHAR(255),
  isVerified TINYINT(1) DEFAULT 0,
  hasVoted TINYINT(1) DEFAULT 0,
  votedAt BIGINT,
  data JSON,
  createdAt BIGINT NOT NULL,
  INDEX idx_voter_tenant_student (tenantId, studentId),
  INDEX idx_voter_email (email),
  INDEX idx_voter_election (electionId),
  CONSTRAINT fk_voter_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. VOTES TABLE (Cryptographic Ballot Ledger)
CREATE TABLE IF NOT EXISTS votes (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NOT NULL,
  voterId VARCHAR(128) NOT NULL,
  positionId VARCHAR(128) NOT NULL,
  candidateId VARCHAR(128) NOT NULL,
  encryptedHash TEXT,
  blockIndex INT,
  prevHash VARCHAR(255),
  timestamp BIGINT NOT NULL,
  data JSON,
  INDEX idx_vote_election (electionId),
  INDEX idx_vote_voter (electionId, voterId),
  INDEX idx_vote_candidate (candidateId),
  CONSTRAINT fk_vote_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. VOTED_VOTERS TABLE (Prevents Double Voting)
CREATE TABLE IF NOT EXISTS voted_voters (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NOT NULL,
  voterId VARCHAR(128) NOT NULL,
  timestamp BIGINT NOT NULL,
  data JSON,
  UNIQUE KEY uq_election_voter (electionId, voterId),
  CONSTRAINT fk_voted_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. AUDIT LOGS TABLE (360° System Activity Trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(128) PRIMARY KEY,
  tenantId VARCHAR(128) NOT NULL,
  actorEmail VARCHAR(255),
  actorRole VARCHAR(64),
  action VARCHAR(128) NOT NULL,
  description TEXT,
  ip VARCHAR(64),
  timestamp BIGINT NOT NULL,
  data JSON,
  INDEX idx_log_tenant (tenantId),
  INDEX idx_log_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. FRAUD ALERTS TABLE (Access & Anomaly Flags)
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128),
  voterId VARCHAR(128),
  severity VARCHAR(32) DEFAULT 'medium',
  type VARCHAR(128) NOT NULL,
  details TEXT,
  timestamp BIGINT NOT NULL,
  data JSON,
  INDEX idx_fraud_election (electionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. ONBOARDING REQUESTS TABLE (Self-Service Registration)
CREATE TABLE IF NOT EXISTS onboarding_requests (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  acronym VARCHAR(64),
  contactName VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  expectedVoters INT DEFAULT 100,
  description TEXT,
  status VARCHAR(32) DEFAULT 'pending',
  submittedAt BIGINT NOT NULL,
  data JSON,
  INDEX idx_onboard_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
