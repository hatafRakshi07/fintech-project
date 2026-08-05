import pg from 'pg';
import { readFileSync } from 'fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const DB_URL = 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb';
const SQL_PATH = 'c:/Users/iSN_kota_T52/Desktop/fintech-project/migrations/v2.0_clean_architecture.sql';

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  const sql = readFileSync(SQL_PATH, 'utf8');
  await client.query(sql);
  console.log('✅ Migration v2.0 applied successfully');
} catch (e) {
  console.error('❌ Migration failed:', e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
