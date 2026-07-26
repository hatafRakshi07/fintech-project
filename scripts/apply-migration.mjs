import fs from 'fs';
import pg from 'pg';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const url = 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres';

const pool = new pg.Pool({
  connectionString: url,
  options: "-c search_path=public",
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('Connecting to Supabase...');
  try {
    // Drop the entire public schema and recreate it to ensure a clean slate
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;');
    console.log('Cleaned public schema.');

    const sql = fs.readFileSync('lib/db/drizzle/0000_minor_wild_pack.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error(`Migration failed: ${err.message}`);
  }

  await pool.end();
}

applyMigration();
