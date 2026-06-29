import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

/**
 * Execute a query. Always require school_id for tenant isolation.
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB] ${Date.now() - start}ms — ${text.slice(0, 80)}`);
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

export async function getClient() {
  return pool.connect();
}

/**
 * Run migrations
 */
export async function migrate() {
  const sql = readFileSync(join(__dirname, '../../migrations/001_initial_schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[DB] Migration complete');
}

export default pool;
