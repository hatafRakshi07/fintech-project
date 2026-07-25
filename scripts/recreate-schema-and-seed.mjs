import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) { console.error("ERROR: DATABASE_URL environment variable is required."); process.exit(1); }

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Connecting to Supabase PostgreSQL...");
  const client = await pool.connect();
  console.log("Connected!");

  console.log("Re-creating clean schema tables...");

  // Drop existing tables to avoid schema mismatches
  await client.query(`
    DROP TABLE IF EXISTS kyc_submissions CASCADE;
    DROP TABLE IF EXISTS otps CASCADE;
    DROP TABLE IF EXISTS invoices CASCADE;
    DROP TABLE IF EXISTS ledger CASCADE;
    DROP TABLE IF EXISTS installments CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS office CASCADE;
    DROP TABLE IF EXISTS recovery CASCADE;
    DROP TABLE IF EXISTS interests CASCADE;
    DROP TABLE IF EXISTS gifts CASCADE;
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS lotteries CASCADE;
    DROP TABLE IF EXISTS collections CASCADE;
    DROP TABLE IF EXISTS loans CASCADE;
    DROP TABLE IF EXISTS tokens CASCADE;
    DROP TABLE IF EXISTS committees CASCADE;
    DROP TABLE IF EXISTS collectors CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS agents CASCADE;
    DROP TABLE IF EXISTS customers CASCADE;
    DROP TABLE IF EXISTS branches CASCADE;

    DROP TYPE IF EXISTS customer_status CASCADE;
    DROP TYPE IF EXISTS agent_status CASCADE;
    DROP TYPE IF EXISTS user_role CASCADE;

    CREATE TYPE user_role AS ENUM (
      'super_admin', 'owner', 'branch_manager', 'collector', 'accountant', 'customer', 'agent'
    );
    CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'blocked');
    CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'suspended');
  `);

  // Create clean Drizzle-matching tables
  await client.query(`
    CREATE TABLE branches (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      phone TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE agents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      agent_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      branch_id INTEGER REFERENCES branches(id),
      commission_rate NUMERIC DEFAULT 2.5,
      status agent_status DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE customers (
      id SERIAL PRIMARY KEY,
      reference_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      alternate_mobile TEXT,
      email TEXT,
      aadhaar TEXT,
      pan TEXT,
      address TEXT,
      city TEXT,
      nominee_name TEXT,
      nominee_relation TEXT,
      photo_url TEXT,
      reference_name TEXT,
      recovery_notes TEXT,
      documents TEXT,
      branch_id INTEGER REFERENCES branches(id),
      agent_id INTEGER REFERENCES agents(id),
      status customer_status DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role user_role DEFAULT 'collector',
      branch_id INTEGER REFERENCES branches(id),
      customer_id INTEGER REFERENCES customers(id),
      agent_id INTEGER REFERENCES agents(id),
      email TEXT,
      phone TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE collectors (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      branch_id INTEGER REFERENCES branches(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE committees (
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

    CREATE TABLE tokens (
      id SERIAL PRIMARY KEY,
      committee_id INTEGER REFERENCES committees(id),
      customer_id INTEGER REFERENCES customers(id),
      token_number INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE loans (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      amount NUMERIC NOT NULL,
      interest_rate NUMERIC NOT NULL,
      duration_months INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE collections (
      id SERIAL PRIMARY KEY,
      collector_id INTEGER REFERENCES collectors(id),
      customer_id INTEGER REFERENCES customers(id),
      amount NUMERIC NOT NULL,
      collection_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'collected',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE lotteries (
      id SERIAL PRIMARY KEY,
      committee_id INTEGER REFERENCES committees(id),
      month_number INTEGER NOT NULL,
      winner_customer_id INTEGER REFERENCES customers(id),
      prize_amount NUMERIC NOT NULL,
      draw_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE gifts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      points_required INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE interests (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER REFERENCES loans(id),
      amount NUMERIC NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'unpaid',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE recovery (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER REFERENCES loans(id),
      amount NUMERIC NOT NULL,
      recovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE office (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE installments (
      id SERIAL PRIMARY KEY,
      committee_id INTEGER REFERENCES committees(id),
      customer_id INTEGER REFERENCES customers(id),
      amount NUMERIC NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'unpaid',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE ledger (
      id SERIAL PRIMARY KEY,
      account_name TEXT NOT NULL,
      debit NUMERIC DEFAULT 0,
      credit NUMERIC DEFAULT 0,
      balance NUMERIC DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      amount NUMERIC NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE otps (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE kyc_submissions (
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

  console.log("✓ All 21 clean Drizzle tables created!");

  // Insert Seed Data
  console.log("Inserting rich seed data...");

  // 1. Branch
  const branch = await client.query(`
    INSERT INTO branches (name, code, address, phone)
    VALUES ('Main Branch - Jaipur', 'BR-JP-01', 'MI Road, Jaipur, Rajasthan', '0141-2345678')
    RETURNING id;
  `);
  const branchId = branch.rows[0].id;

  // 2. Admin User
  const adminHash = await bcrypt.hash("admin123", 10);
  await client.query(`
    INSERT INTO users (username, password_hash, name, role, branch_id)
    VALUES ('admin', $1, 'System Super Admin', 'super_admin', $2);
  `, [adminHash, branchId]);

  // 3. Agent
  const agent = await client.query(`
    INSERT INTO agents (agent_code, name, mobile, email, branch_id, commission_rate)
    VALUES ('AG-101', 'Rajesh Verma (Agent)', '9123456789', 'rajesh@example.com', $1, 5.0)
    RETURNING id;
  `, [branchId]);
  const agentId = agent.rows[0].id;

  // Agent User
  const agentHash = await bcrypt.hash("agent123", 10);
  await client.query(`
    INSERT INTO users (username, password_hash, name, role, branch_id, agent_id, phone)
    VALUES ('agent1', $1, 'Rajesh Verma', 'agent', $2, $3, '9123456789');
  `, [agentHash, branchId, agentId]);

  // 4. Customers
  const cust1 = await client.query(`
    INSERT INTO customers (reference_number, name, mobile, email, address, city, branch_id, agent_id)
    VALUES ('CUST-001', 'Ramesh Kumar', '9876543210', 'ramesh@example.com', 'Vaishali Nagar', 'Jaipur', $1, $2)
    RETURNING id;
  `, [branchId, agentId]);

  const cust2 = await client.query(`
    INSERT INTO customers (reference_number, name, mobile, email, address, city, branch_id, agent_id)
    VALUES ('CUST-002', 'Sunita Sharma', '9876543211', 'sunita@example.com', 'Malviya Nagar', 'Jaipur', $1, $2)
    RETURNING id;
  `, [branchId, agentId]);

  // Customer User login
  const custHash = await bcrypt.hash("customer123", 10);
  await client.query(`
    INSERT INTO users (username, password_hash, name, role, branch_id, customer_id, phone)
    VALUES ('ramesh1', $1, 'Ramesh Kumar', 'customer', $2, $3, '9876543210');
  `, [custHash, branchId, cust1.rows[0].id]);

  // 5. Collector
  const collectorHash = await bcrypt.hash("collector123", 10);
  const collUser = await client.query(`
    INSERT INTO users (username, password_hash, name, role, branch_id, phone)
    VALUES ('collector1', $1, 'Suresh Sharma', 'collector', $2, '9988776655')
    RETURNING id;
  `, [collectorHash, branchId]);

  const collector = await client.query(`
    INSERT INTO collectors (user_id, name, phone, branch_id)
    VALUES ($1, 'Suresh Sharma', '9988776655', $2)
    RETURNING id;
  `, [collUser.rows[0].id, branchId]);

  // 6. Committee (Bissi Scheme)
  const committee = await client.query(`
    INSERT INTO committees (name, total_amount, monthly_installment, total_months, start_date, branch_id)
    VALUES ('Shree Gold Bissi 50K', 50000, 5000, 10, CURRENT_DATE, $1)
    RETURNING id;
  `, [branchId]);
  const commId = committee.rows[0].id;

  // Tokens
  await client.query(`
    INSERT INTO tokens (committee_id, customer_id, token_number)
    VALUES ($1, $2, 1), ($1, $3, 2);
  `, [commId, cust1.rows[0].id, cust2.rows[0].id]);

  // 7. Loans
  await client.query(`
    INSERT INTO loans (customer_id, amount, interest_rate, duration_months, status)
    VALUES ($1, 25000, 12.0, 12, 'active');
  `, [cust1.rows[0].id]);

  // 8. Collections
  await client.query(`
    INSERT INTO collections (collector_id, customer_id, amount, collection_date)
    VALUES ($1, $2, 5000, CURRENT_DATE);
  `, [collector.rows[0].id, cust1.rows[0].id]);

  // 9. KYC Submission
  await client.query(`
    INSERT INTO kyc_submissions (user_id, aadhaar_number, pan_number, bank_account_no, bank_ifsc, bank_name, status)
    VALUES ($1, '1234 5678 9012', 'ABCDE1234F', '987654321098', 'SBIN0001234', 'State Bank of India', 'approved');
  `, [collUser.rows[0].id]);

  console.log("🎉 COMPLETE SCHEMA AND DEMO SEED DATA CREATED SUCCESSFULLY!");
  client.release();
  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
