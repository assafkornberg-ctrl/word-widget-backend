const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool using Supabase URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 5000
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to Supabase PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { 
      text: text.substring(0, 50) + '...', 
      duration: duration + 'ms', 
      rows: res.rowCount 
    });
    return res;
  } catch (error) {
    console.error('Query error', { 
      text: text.substring(0, 50) + '...', 
      error: error.message 
    });
    throw error;
  }
};

module.exports = {
  pool,
  query
};
