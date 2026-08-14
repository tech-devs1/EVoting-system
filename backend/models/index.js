require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
const host = process.env.MYSQL_HOST || '162.215.128.215';
const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
const user = process.env.MYSQL_USER || 'evotinghtuedu_issaka';
const password = process.env.MYSQL_PASSWORD || '';
const database = process.env.MYSQL_DATABASE || 'evotinghtuedu_HTUELECT';

let sequelize;

if (mysqlUrl) {
  console.log('🐬 Connecting to MySQL via URL string...');
  sequelize = new Sequelize(mysqlUrl, {
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  console.log(`🐬 Connecting to MySQL at ${host}:${port}/${database}...`);
  sequelize = new Sequelize(database, user, password, {
    host,
    port,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

// ---------------------- DEFINING MODELS ----------------------

// 1. Tenant Model
const Tenant = sequelize.define('Tenant', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  acronym: { type: DataTypes.STRING(64) },
  domain: { type: DataTypes.STRING(255) },
  adminEmail: { type: DataTypes.STRING(255) },
  adminPassword: { type: DataTypes.STRING(255) },
  logoUrl: { type: DataTypes.TEXT },
  brandColor: { type: DataTypes.STRING(32), defaultValue: '#2563eb' },
  status: { type: DataTypes.STRING(32), defaultValue: 'active' },
  // Normalized EC Details & Settings (replacing raw json data field)
  orgName: { type: DataTypes.STRING(255) },
  portalTitle: { type: DataTypes.STRING(255) },
  supportEmail: { type: DataTypes.STRING(255) },
  supportPhone: { type: DataTypes.STRING(64) },
  address: { type: DataTypes.TEXT },
  ecName: { type: DataTypes.STRING(255) },
  ecTitle: { type: DataTypes.STRING(255) },
  mNotifyApiKey: { type: DataTypes.STRING(255) },
  mNotifySenderId: { type: DataTypes.STRING(64) },
  admins: {
    type: DataTypes.TEXT,
    get() {
      const raw = this.getDataValue('admins');
      return raw ? JSON.parse(raw) : [];
    },
    set(val) {
      this.setDataValue('admins', JSON.stringify(val));
    }
  }
}, { tableName: 'tenants', timestamps: true });

// 2. Organization Model
const Organization = sequelize.define('Organization', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  acronym: { type: DataTypes.STRING(64) },
  domain: { type: DataTypes.STRING(255) },
  logoUrl: { type: DataTypes.TEXT },
  brandColor: { type: DataTypes.STRING(32), defaultValue: '#2563eb' },
  status: { type: DataTypes.STRING(32), defaultValue: 'active' }
}, { tableName: 'organizations', timestamps: true });

// 3. User Model
const User = sequelize.define('User', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  tenantId: { type: DataTypes.STRING(128) },
  name: { type: DataTypes.STRING(255), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  phone: { type: DataTypes.STRING(64) },
  password: { type: DataTypes.STRING(255) },
  role: { type: DataTypes.STRING(64), defaultValue: 'voter' },
  studentId: { type: DataTypes.STRING(128) },
  indexNo: { type: DataTypes.STRING(128) },
  accessPin: { type: DataTypes.STRING(64) },
  status: { type: DataTypes.STRING(32), defaultValue: 'active' },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'users', timestamps: true });

// 4. Election Model
const Election = sequelize.define('Election', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  tenantId: { type: DataTypes.STRING(128), allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(128), defaultValue: 'General Election' },
  description: { type: DataTypes.TEXT },
  startDate: { type: DataTypes.STRING(128), allowNull: false },
  endDate: { type: DataTypes.STRING(128), allowNull: false },
  status: { type: DataTypes.STRING(32), defaultValue: 'draft' },
  allowAbstain: { type: DataTypes.BOOLEAN, defaultValue: true },
  isPublic: { type: DataTypes.BOOLEAN, defaultValue: true },
  realTimeResults: { type: DataTypes.BOOLEAN, defaultValue: true },
  requireSelfie: { type: DataTypes.BOOLEAN, defaultValue: false },
  showResults: { type: DataTypes.BOOLEAN, defaultValue: true },
  previewImageUrl: { type: DataTypes.TEXT },
  otpRequired: { type: DataTypes.BOOLEAN, defaultValue: true },
  reactivatedAt: { type: DataTypes.STRING(128) }
}, { tableName: 'elections', timestamps: true });

// 5. Position Model
const Position = sequelize.define('Position', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  electionId: { type: DataTypes.STRING(128), allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  maxChoices: { type: DataTypes.INTEGER, defaultValue: 1 },
  isReferendum: { type: DataTypes.BOOLEAN, defaultValue: false },
  order: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName: 'positions', timestamps: true });

// 6. Candidate Model
const Candidate = sequelize.define('Candidate', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  electionId: { type: DataTypes.STRING(128), allowNull: false },
  positionId: { type: DataTypes.STRING(128), allowNull: false },
  positionTitle: { type: DataTypes.STRING(255), allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  bio: { type: DataTypes.TEXT },
  manifesto: { type: DataTypes.TEXT },
  photoUrl: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(32), defaultValue: 'approved' },
  votes: { type: DataTypes.INTEGER, defaultValue: 0 },
  noVotes: { type: DataTypes.INTEGER, defaultValue: 0 },
  isIndependent: { type: DataTypes.BOOLEAN, defaultValue: false },
  ballotNumber: { type: DataTypes.STRING(32) }
}, { tableName: 'candidates', timestamps: true });

// 7. Voter Model (Combined Voter Roster & Eligible Voters)
const Voter = sequelize.define('Voter', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  tenantId: { type: DataTypes.STRING(128), allowNull: false },
  electionId: { type: DataTypes.STRING(128) },
  studentId: { type: DataTypes.STRING(128) },
  indexNumber: { type: DataTypes.STRING(128) }, // Dual field compatibility
  name: { type: DataTypes.STRING(255) },
  email: { type: DataTypes.STRING(255) },
  phone: { type: DataTypes.STRING(64) },
  password: { type: DataTypes.STRING(255) },
  isRegistered: { type: DataTypes.BOOLEAN, defaultValue: true },
  role: { type: DataTypes.STRING(32), defaultValue: 'voter' },
  faceImage: { type: DataTypes.TEXT },
  faceEmbedding: {
    type: DataTypes.TEXT,
    get() {
      const raw = this.getDataValue('faceEmbedding');
      return raw ? JSON.parse(raw) : null;
    },
    set(val) {
      this.setDataValue('faceEmbedding', val ? JSON.stringify(val) : null);
    }
  },
  // OTP codes & access codes
  accessOtp: { type: DataTypes.STRING(64) },
  accessOtpExpiry: { type: DataTypes.BIGINT },
  resetCode: { type: DataTypes.STRING(64) },
  resetCodeExpiry: { type: DataTypes.BIGINT }
}, { tableName: 'voters', timestamps: true });

// 8. Vote Model (Cryptographic Ballot Ledger)
const Vote = sequelize.define('Vote', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  electionId: { type: DataTypes.STRING(128), allowNull: false },
  voterId: { type: DataTypes.STRING(128), allowNull: false },
  positionId: { type: DataTypes.STRING(128), allowNull: false },
  candidateId: { type: DataTypes.STRING(128), allowNull: false },
  encryptedHash: { type: DataTypes.TEXT },
  blockIndex: { type: DataTypes.INTEGER },
  prevHash: { type: DataTypes.STRING(255) },
  timestamp: { type: DataTypes.BIGINT, allowNull: false }
}, { tableName: 'votes', timestamps: false });

// 9. VotedVoter Model
const VotedVoter = sequelize.define('VotedVoter', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  electionId: { type: DataTypes.STRING(128), allowNull: false },
  voterId: { type: DataTypes.STRING(128), allowNull: false },
  timestamp: { type: DataTypes.BIGINT, allowNull: false }
}, {
  tableName: 'voted_voters',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['electionId', 'voterId']
    }
  ]
});

// 10. ActivityLog Model
const ActivityLog = sequelize.define('ActivityLog', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  tenantId: { type: DataTypes.STRING(128), allowNull: false },
  actorEmail: { type: DataTypes.STRING(255) },
  actorRole: { type: DataTypes.STRING(64) },
  action: { type: DataTypes.STRING(128), allowNull: false },
  description: { type: DataTypes.TEXT },
  ip: { type: DataTypes.STRING(64) },
  timestamp: { type: DataTypes.BIGINT, allowNull: false }
}, { tableName: 'activity_logs', timestamps: false });

// 11. FraudAlert Model
const FraudAlert = sequelize.define('FraudAlert', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  electionId: { type: DataTypes.STRING(128) },
  voterId: { type: DataTypes.STRING(128) },
  severity: { type: DataTypes.STRING(32), defaultValue: 'medium' },
  type: { type: DataTypes.STRING(128), allowNull: false },
  details: { type: DataTypes.TEXT },
  timestamp: { type: DataTypes.BIGINT, allowNull: false }
}, { tableName: 'fraud_alerts', timestamps: false });

// 12. OnboardingRequest Model
const OnboardingRequest = sequelize.define('OnboardingRequest', {
  id: { type: DataTypes.STRING(128), primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  acronym: { type: DataTypes.STRING(64) },
  contactName: { type: DataTypes.STRING(255), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false },
  phone: { type: DataTypes.STRING(64) },
  expectedVoters: { type: DataTypes.INTEGER, defaultValue: 100 },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(32), defaultValue: 'pending' },
  submittedAt: { type: DataTypes.BIGINT, allowNull: false }
}, { tableName: 'onboarding_requests', timestamps: false });

// 13. UnlockedElection Model (Kept for access OTP status tracking)
const UnlockedElection = sequelize.define('UnlockedElection', {
  id: { type: DataTypes.STRING(255), primaryKey: true }, // composite format voterId_electionId
  voterId: { type: DataTypes.STRING(128), allowNull: false },
  electionId: { type: DataTypes.STRING(128), allowNull: false },
  verifiedAt: { type: DataTypes.BIGINT, allowNull: false }
}, { tableName: 'unlocked_elections', timestamps: false });


// ---------------------- ASSOCIATIONS ----------------------

// Tenant has many Elections
Tenant.hasMany(Election, { foreignKey: 'tenantId', as: 'elections', onDelete: 'CASCADE' });
Election.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// Election has many Positions
Election.hasMany(Position, { foreignKey: 'electionId', as: 'positions', onDelete: 'CASCADE' });
Position.belongsTo(Election, { foreignKey: 'electionId', as: 'election' });

// Election has many Candidates
Election.hasMany(Candidate, { foreignKey: 'electionId', as: 'candidates', onDelete: 'CASCADE' });
Candidate.belongsTo(Election, { foreignKey: 'electionId', as: 'election' });

// Position has many Candidates
Position.hasMany(Candidate, { foreignKey: 'positionId', as: 'candidates', onDelete: 'CASCADE' });
Candidate.belongsTo(Position, { foreignKey: 'positionId', as: 'position' });

// Sync Function
async function syncDatabase() {
  try {
    // For local tests on SQLite, disable foreign keys checking or handle cascade safely
    await sequelize.sync({ alter: true });
    console.log('✅ Sequelize database synchronized and schema up to date.');

    // Seed default superadmin / admins if empty
    const adminCount = await User.count();
    if (adminCount === 0) {
      const bcrypt = require('bcryptjs');
      const superadminPassword = await bcrypt.hash('superadmin080', 10);
      const adminPassword = await bcrypt.hash('admin080', 10);
      const now = Date.now();

      await User.bulkCreate([
        {
          id: 'usr_superadmin',
          tenantId: 'global',
          name: 'Super Administrator',
          email: 'superadmin@htu.edu.gh',
          password: superadminPassword,
          role: 'superadmin',
          status: 'active',
          isVerified: true
        },
        {
          id: 'usr_admin',
          tenantId: 'compssa',
          name: 'EC Administrator',
          email: 'admin@htu.edu.gh',
          password: adminPassword,
          role: 'admin',
          status: 'active',
          isVerified: true
        }
      ]);
      console.log('✅ Default users seeded into User table.');
    }
  } catch (err) {
    console.error('❌ Failed to synchronize database:', err);
  }
}

module.exports = {
  sequelize,
  Tenant,
  Organization,
  User,
  Election,
  Position,
  Candidate,
  Voter,
  Vote,
  VotedVoter,
  ActivityLog,
  FraudAlert,
  OnboardingRequest,
  UnlockedElection,
  syncDatabase
};
