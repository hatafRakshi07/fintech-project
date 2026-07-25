import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const url = process.env.DATABASE_URL || "postgresql://postgres:shreeassociation2026@db.ovtzfzeodcksosfwjibf.supabase.co:5432/postgres";

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Connecting to Supabase PostgreSQL...");
  const client = await pool.connect();
  console.log("Connected successfully!");

  console.log("Creating ENUMs and Tables...");

  // 1. Create Enums if not exist
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM (
        'super_admin', 'owner', 'branch_manager', 'collector', 'accountant', 'customer', 'agent'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // 2. Create All Tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      phone TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      address TEXT,
      id_proof TEXT,
      branch_id INTEGER REFERENCES branches(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      commission_rate NUMERIC DEFAULT 0,
      branch_id INTEGER REFERENCES branches(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role user_role NOT NULL DEFAULT 'collector',
      branch_id INTEGER REFERENCES branches(id),
      customer_id INTEGER REFERENCES customers(id),
      agent_id INTEGER REFERENCES agents(id),
      email TEXT,
      phone TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS collectors (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      branch_id INTEGER REFERENCES branches(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS committees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      total_amount NUMERIC NOT NULL,
      monthly_installment NUMERIC NOT NULL,
      total_months INTEGER NOT NULL,
      start_date DATE NOT NULL,
      status TEXT DEFAULT 'active',
      branch_id INTEGER REFERENCES branches(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id SERIAL PRIMARY KEY,
      committee_id INTEGER REFERENCES committees(id),
      customer_id INTEGER REFERENCES customers(id),
      token_number INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      amount NUMERIC NOT NULL,
      interest_rate NUMERIC NOT NULL,
      duration_months INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS collections (
      id SERIAL PRIMARY KEY,
      collector_id INTEGER REFERENCES collectors(id),
      customer_id INTEGER REFERENCES customers(id),
      amount NUMERIC NOT NULL,
      collection_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'collected',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lotteries (
      id SERIAL PRIMARY KEY,
      committee_id INTEGER REFERENCES committees(id),
      month_number INTEGER NOT NULL,
      winner_customer_id INTEGER REFERENCES customers(id),
      prize_amount NUMERIC NOT NULL,
      draw_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gifts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      points_required INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS interests (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER REFERENCES loans(id),
      amount NUMERIC NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'unpaid',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recovery (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER REFERENCES loans(id),
      amount NUMERIC NOT NULL,
      recovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS office (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS installments (
      id SERIAL PRIMARY KEY,
      committee_id INTEGER REFERENCES committees(id),
      customer_id INTEGER REFERENCES customers(id),
      amount NUMERIC NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'unpaid',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id SERIAL PRIMARY KEY,
      account_name TEXT NOT NULL,
      debit NUMERIC DEFAULT 0,
      credit NUMERIC DEFAULT 0,
      balance NUMERIC DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      amount NUMERIC NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS otps (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  console.log("All 21 tables created successfully!");

  // Seed default admin user if not exists
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await client.query(`
    INSERT INTO users (username, password_hash, name, role)
    VALUES ('admin', $1, 'System Super Admin', 'super_admin')
    ON CONFLICT (username) DO NOTHING;
  `, [adminPasswordHash]);

  console.log("Default Super Admin user seeded successfully!");
  console.log("Credentials -> Username: admin | Password: admin123");

  client.release();
  await pool.end();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
