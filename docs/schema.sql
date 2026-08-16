-- ─────────────────────────────────────────────────────────────────────────────
-- HTU ELECT — PRODUCTION MYSQL DATABASE SCHEMA
-- Database Engine: MySQL 8.0+ / MariaDB 10.5+
-- Optimized for production and cPanel standard PHP/Node deployments.
-- Designed to perfectly match the current Sequelize ORM models.
-- ─────────────────────────────────────────────────────────────────────────────

SET FOREIGN_KEY_CHECKS = 0;

-- 1. TENANTS / DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  acronym VARCHAR(64) NULL,
  domain VARCHAR(255) NULL,
  adminEmail VARCHAR(255) NULL,
  adminPassword VARCHAR(255) NULL,
  logoUrl TEXT NULL,
  brandColor VARCHAR(32) DEFAULT '#2563eb',
  status VARCHAR(32) DEFAULT 'active',
  orgName VARCHAR(255) NULL,
  portalTitle VARCHAR(255) NULL,
  supportEmail VARCHAR(255) NULL,
  supportPhone VARCHAR(64) NULL,
  address TEXT NULL,
  ecName VARCHAR(255) NULL,
  ecTitle VARCHAR(255) NULL,
  mNotifyApiKey VARCHAR(255) NULL,
  mNotifySenderId VARCHAR(64) NULL,
  admins TEXT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_tenant_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. PUBLIC ORGANIZATIONS DIRECTORY
CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  acronym VARCHAR(64) NULL,
  domain VARCHAR(255) NULL,
  logoUrl TEXT NULL,
  brandColor VARCHAR(32) DEFAULT '#2563eb',
  status VARCHAR(32) DEFAULT 'active',
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. USERS TABLE (Centralized User Directory for All System Roles)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  tenantId VARCHAR(128) NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(64) NULL,
  password VARCHAR(255) NULL,
  role VARCHAR(64) DEFAULT 'voter',
  studentId VARCHAR(128) NULL,
  indexNo VARCHAR(128) NULL,
  accessPin VARCHAR(64) NULL,
  status VARCHAR(32) DEFAULT 'active',
  isVerified TINYINT(1) DEFAULT 0,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_users_role (role),
  INDEX idx_users_tenant (tenantId),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ELECTIONS TABLE
CREATE TABLE IF NOT EXISTS elections (
  id VARCHAR(128) PRIMARY KEY,
  tenantId VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(128) DEFAULT 'General Election',
  description TEXT NULL,
  startDate VARCHAR(128) NOT NULL,
  endDate VARCHAR(128) NOT NULL,
  status VARCHAR(32) DEFAULT 'draft',
  allowAbstain TINYINT(1) DEFAULT 1,
  isPublic TINYINT(1) DEFAULT 1,
  realTimeResults TINYINT(1) DEFAULT 1,
  requireSelfie TINYINT(1) DEFAULT 0,
  showResults TINYINT(1) DEFAULT 1,
  previewImageUrl TEXT NULL,
  otpRequired TINYINT(1) DEFAULT 1,
  reactivatedAt VARCHAR(128) NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_election_tenant (tenantId),
  INDEX idx_election_status (status),
  CONSTRAINT fk_election_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. POSITIONS TABLE (Per-Election Offices e.g. President, Financial Secretary)
CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  maxChoices INT DEFAULT 1,
  isReferendum TINYINT(1) DEFAULT 0,
  `order` INT DEFAULT 1,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_pos_election (electionId),
  CONSTRAINT fk_pos_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS candidates (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NOT NULL,
  positionId VARCHAR(128) NOT NULL,
  positionTitle VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  bio TEXT NULL,
  manifesto TEXT NULL,
  photoUrl TEXT NULL,
  status VARCHAR(32) DEFAULT 'approved',
  votes INT DEFAULT 0,
  noVotes INT DEFAULT 0,
  isIndependent TINYINT(1) DEFAULT 0,
  ballotNumber VARCHAR(32) NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_cand_election (electionId),
  INDEX idx_cand_position (positionId),
  CONSTRAINT fk_cand_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE,
  CONSTRAINT fk_cand_position FOREIGN KEY (positionId) REFERENCES positions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. VOTERS TABLE (Voter Roster & Credentials)
CREATE TABLE IF NOT EXISTS voters (
  id VARCHAR(128) PRIMARY KEY,
  tenantId VARCHAR(128) NOT NULL,
  electionId VARCHAR(128) NULL,
  studentId VARCHAR(128) NULL,
  indexNumber VARCHAR(128) NULL,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  password VARCHAR(255) NULL,
  isRegistered TINYINT(1) DEFAULT 1,
  role VARCHAR(32) DEFAULT 'voter',
  faceImage TEXT NULL,
  faceEmbedding TEXT NULL,
  accessOtp VARCHAR(64) NULL,
  accessOtpExpiry BIGINT NULL,
  resetCode VARCHAR(64) NULL,
  resetCodeExpiry BIGINT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_voter_tenant_student (tenantId, studentId),
  INDEX idx_voter_email (email),
  UNIQUE KEY uq_voter_email (email),  -- Email is the login credential: one account per email
  INDEX idx_voter_election (electionId),
  CONSTRAINT fk_voter_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. VOTES TABLE (Cryptographic Ballot Ledger)
CREATE TABLE IF NOT EXISTS votes (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NOT NULL,
  voterId VARCHAR(128) NOT NULL,
  positionId VARCHAR(128) NOT NULL,
  candidateId VARCHAR(128) NOT NULL,
  encryptedHash TEXT NULL,
  blockIndex INT NULL,
  prevHash VARCHAR(255) NULL,
  timestamp BIGINT NOT NULL,
  INDEX idx_vote_election (electionId),
  INDEX idx_vote_voter (electionId, voterId),
  INDEX idx_vote_candidate (candidateId),
  CONSTRAINT fk_vote_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. VOTED_VOTERS TABLE (Prevents Double Voting)
CREATE TABLE IF NOT EXISTS voted_voters (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NOT NULL,
  voterId VARCHAR(128) NOT NULL,
  timestamp BIGINT NOT NULL,
  UNIQUE KEY uq_election_voter (electionId, voterId),
  CONSTRAINT fk_voted_election FOREIGN KEY (electionId) REFERENCES elections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. ACTIVITY LOGS TABLE (360° System Activity Trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(128) PRIMARY KEY,
  tenantId VARCHAR(128) NOT NULL,
  actorEmail VARCHAR(255) NULL,
  actorRole VARCHAR(64) NULL,
  action VARCHAR(128) NOT NULL,
  description TEXT NULL,
  ip VARCHAR(64) NULL,
  timestamp BIGINT NOT NULL,
  INDEX idx_log_tenant (tenantId),
  INDEX idx_log_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. FRAUD ALERTS TABLE (Access & Anomaly Flags)
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id VARCHAR(128) PRIMARY KEY,
  electionId VARCHAR(128) NULL,
  voterId VARCHAR(128) NULL,
  severity VARCHAR(32) DEFAULT 'medium',
  type VARCHAR(128) NOT NULL,
  details TEXT NULL,
  timestamp BIGINT NOT NULL,
  INDEX idx_fraud_election (electionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. ONBOARDING REQUESTS TABLE (Self-Service Registration)
CREATE TABLE IF NOT EXISTS onboarding_requests (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  acronym VARCHAR(64) NULL,
  contactName VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NULL,
  expectedVoters INT DEFAULT 100,
  description TEXT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  submittedAt BIGINT NOT NULL,
  INDEX idx_onboard_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. UNLOCKED ELECTIONS TABLE (Access OTP Tracking)
CREATE TABLE IF NOT EXISTS unlocked_elections (
  id VARCHAR(255) PRIMARY KEY,
  voterId VARCHAR(128) NOT NULL,
  electionId VARCHAR(128) NOT NULL,
  verifiedAt BIGINT NOT NULL,
  INDEX idx_unlocked_voter_election (voterId, electionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
