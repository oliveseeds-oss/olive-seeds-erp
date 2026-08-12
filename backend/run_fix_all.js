require('dotenv').config();
const db = require('./utils/db');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('Running fix_all.sql migration...');
  try {
    const sqlPath = path.join(__dirname, 'migrations', 'fix_all.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split queries by semicolon, ignoring comments and empty lines
    const queries = sqlContent
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      console.log(`Executing query ${i + 1}/${queries.length}...`);
      try {
        await db.query(q);
        console.log('✓ Success');
      } catch (err) {
        console.error(`✕ Error executing query: ${q}`);
        console.error(err.message);
      }
    }
    console.log('Database migration successfully processed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration execution failed:', err);
    process.exit(1);
  }
}

run();
