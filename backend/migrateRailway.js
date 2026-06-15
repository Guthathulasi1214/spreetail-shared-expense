const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const connection = await mysql.createConnection({
    uri: 'mysql://root:eaqXZyLHSHiNAUvrPqxOJSrhogJcbdHz@thomas.proxy.rlwy.net:41069/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  const sql = fs.readFileSync(path.join(__dirname, 'migrations/001_initial_schema.sql'), 'utf8');
  
  // Split by ; but keep the statements intact
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (let statement of statements) {
    if (!statement.startsWith('--')) { // skip pure comments if they are left
      console.log('Executing:', statement.substring(0, 50) + '...');
      await connection.query(statement);
    }
  }
  
  console.log('Migration successful');
  await connection.end();
}

run().catch(console.error);
