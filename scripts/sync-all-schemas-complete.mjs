import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL || 'postgresql://postgres:shreeassociation2026@db.ovtzfzeodcksosfwjibf.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function syncAllSchemas() {
  console.log('Synchronizing all PostgreSQL table schemas in Supabase...');
  const client = await pool.connect();

  try {
    const queries = [
      // Enum types if missing
      `DO $$ BEGIN CREATE TYPE branch_status AS ENUM ('active', 'inactive'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE collector_status AS ENUM ('active', 'inactive'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE committee_type AS ENUM ('daily', 'weekly', 'monthly', 'festival', 'special'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE committee_status AS ENUM ('active', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,

      // Branches
      `ALTER TABLE branches ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Jaipur';`,
      `ALTER TABLE branches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_name TEXT;`,

      // Collectors
      `ALTER TABLE collectors ADD COLUMN IF NOT EXISTS mobile TEXT;`,
      `ALTER TABLE collectors ADD COLUMN IF NOT EXISTS email TEXT;`,
      `ALTER TABLE collectors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `UPDATE collectors SET mobile = phone WHERE mobile IS NULL AND phone IS NOT NULL;`,

      // Committees
      `ALTER TABLE committees ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'monthly';`,
      `ALTER TABLE committees ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(12,2);`,
      `ALTER TABLE committees ADD COLUMN IF NOT EXISTS member_limit INTEGER DEFAULT 50;`,
      `ALTER TABLE committees ADD COLUMN IF NOT EXISTS draw_date DATE;`,
      `ALTER TABLE committees ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 12;`,
      `UPDATE committees SET installment_amount = monthly_installment WHERE installment_amount IS NULL AND monthly_installment IS NOT NULL;`,
      `UPDATE committees SET member_limit = total_months WHERE member_limit IS NULL AND total_months IS NOT NULL;`,
      `UPDATE committees SET draw_date = start_date WHERE draw_date IS NULL AND start_date IS NOT NULL;`,

      // Users
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_id INTEGER;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id INTEGER;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`,

      // OTPs & Customers & Loans & Collections
      `ALTER TABLE otps ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS reference_name TEXT;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id INTEGER DEFAULT 1;`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_rate NUMERIC(5, 2) DEFAULT 0.00;`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS next_due_date DATE;`,
      `ALTER TABLE collections ADD COLUMN IF NOT EXISTS collector_id INTEGER;`,
      `ALTER TABLE collections ADD COLUMN IF NOT EXISTS branch_id INTEGER DEFAULT 1;`,
      `ALTER TABLE collections ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'verified';`
    ];

    for (const q of queries) {
      try {
        await client.query(q);
        console.log('OK:', q.slice(0, 60) + '...');
      } catch (e) {
        console.warn('WARN:', e.message);
      }
    }

    console.log('✓ All database table columns successfully synchronized!');
  } finally {
    client.release();
    await pool.end();
  }
}

syncAllSchemas().catch(console.error);
