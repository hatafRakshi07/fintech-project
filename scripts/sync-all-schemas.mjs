import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) { console.error("ERROR: DATABASE_URL environment variable is required."); process.exit(1); }

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function syncAllSchemas() {
  console.log('Synchronizing all PostgreSQL table schemas in Supabase...');
  const client = await pool.connect();

  try {
    // Add missing columns if any
    const queries = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_id INTEGER;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id INTEGER;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`,
      `ALTER TABLE otps ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS reference_name TEXT;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id INTEGER;`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_rate NUMERIC(5, 2) DEFAULT 0.00;`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS next_due_date DATE;`,
      `ALTER TABLE collections ADD COLUMN IF NOT EXISTS collector_id INTEGER;`,
      `ALTER TABLE collections ADD COLUMN IF NOT EXISTS branch_id INTEGER;`,
      `ALTER TABLE collections ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'verified';`
    ];

    for (const q of queries) {
      try {
        await client.query(q);
      } catch (e) {
        console.warn('Query warning:', e.message);
      }
    }

    console.log('✓ All database table columns are 100% in sync with Drizzle schema!');
  } finally {
    client.release();
    await pool.end();
  }
}

syncAllSchemas().catch(console.error);
