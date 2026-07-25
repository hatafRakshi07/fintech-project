import pg from 'pg';
const { Pool } = pg;

const url = 'postgresql://postgres:shreeassociation2026@db.ovtzfzeodcksosfwjibf.supabase.co:5432/postgres';
const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Connecting to Supabase...");
  const client = await pool.connect();
  console.log("Connected successfully!");

  // Create tables SQL
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      branch_id INTEGER,
      phone TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      id_proof TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      commission_rate NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS kyc_submissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      aadhaar_number TEXT,
      pan_number TEXT,
      bank_account_no TEXT,
      bank_ifsc TEXT,
      bank_name TEXT,
      aadhaar_front_url TEXT,
      aadhaar_back_url TEXT,
      pan_card_url TEXT,
      selfie_url TEXT,
      status TEXT DEFAULT 'pending',
      rejection_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("Database tables created/verified successfully!");
  client.release();
  await pool.end();
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
