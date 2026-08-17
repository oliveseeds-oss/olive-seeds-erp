const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runDiagnostics() {
  console.log('=== OLIVE SEEDS ERP DIAGNOSTICS ===');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Port:', process.env.PORT);
  console.log('DB Host:', process.env.DB_HOST);
  console.log('DB User:', process.env.DB_USER);
  console.log('DB Name:', process.env.DB_NAME);

  try {
    console.log('\nTesting Database Connection...');
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'oliveseeds_erp'
    });

    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    console.log('DB Connection SUCCESS. Result:', rows[0].result);

    console.log('\nChecking users table...');
    const [users] = await pool.query('SELECT id, user_id, name, email, role, is_active FROM users');
    console.log('Users found:', users.length);
    console.table(users);

    console.log('\nChecking frontend build directory...');
    const buildPath = path.join(__dirname, '../frontend/build');
    if (fs.existsSync(buildPath)) {
      console.log('Frontend build exists.');
      const files = fs.readdirSync(buildPath);
      console.log(`Files in build dir: ${files.length}`);
    } else {
      console.log('Frontend build directory DOES NOT EXIST.');
    }

    console.log('\nDiagnostics complete. No obvious fatal errors found.');
    process.exit(0);
  } catch (err) {
    console.error('\nDIAGNOSTIC ERROR:', err.message);
    process.exit(1);
  }
}

runDiagnostics();
