require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { sequelize, User, Election } = require('../models');

async function testConnection() {
  console.log('Testing connection to remote cPanel MySQL database...');
  console.log(`Host: ${process.env.MYSQL_HOST}`);
  console.log(`Database: ${process.env.MYSQL_DATABASE}`);
  try {
    await sequelize.authenticate();
    console.log('✅ Connection has been established successfully.');

    // Count users or query database
    const userCount = await User.count();
    console.log(`📊 Users in database: ${userCount}`);

    const electionCount = await Election.count();
    console.log(`📊 Elections in database: ${electionCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    if (error.original && error.original.code === 'ER_HOST_NOT_PRIVILEGED') {
      console.error('\n⚠️ Access Denied by Remote MySQL Firewall:');
      console.error(error.original.sqlMessage);
      console.error('Please log into cPanel > Remote MySQL and add "%" or your IP to allowed Access Hosts.');
    }
    process.exit(1);
  }
}

testConnection();
