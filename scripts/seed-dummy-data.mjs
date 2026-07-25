import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const url = process.env.DATABASE_URL || "postgresql://postgres:shreeassociation2026@db.ovtzfzeodcksosfwjibf.supabase.co:5432/postgres";

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  console.log("Connecting to Supabase to insert demo seed data...");
  const client = await pool.connect();

  try {
    // 1. Branches
    const branchRes = await client.query(`
      INSERT INTO branches (name, code, address, phone)
      VALUES ('Main Branch - Jaipur', 'BR-JP-01', 'MI Road, Jaipur, Rajasthan', '0141-2345678')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const branchId = branchRes.rows[0].id;
    console.log("✓ Branch created: Main Branch Jaipur");

    // 2. Customers
    const cust1 = await client.query(`
      INSERT INTO customers (name, phone, email, address, branch_id)
      VALUES ('Ramesh Kumar', '9876543210', 'ramesh@example.com', 'Vaishali Nagar, Jaipur', $1)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [branchId]);
    const cust2 = await client.query(`
      INSERT INTO customers (name, phone, email, address, branch_id)
      VALUES ('Sunita Sharma', '9876543211', 'sunita@example.com', 'Malviya Nagar, Jaipur', $1)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [branchId]);
    console.log("✓ Demo Customers created: Ramesh Kumar, Sunita Sharma");

    // 3. Agents
    const agent1 = await client.query(`
      INSERT INTO agents (name, phone, email, commission_rate, branch_id)
      VALUES ('Rajesh Verma (Agent)', '9123456789', 'rajesh.agent@example.com', 5.0, $1)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [branchId]);
    console.log("✓ Demo Agent created: Rajesh Verma");

    // 4. Agent User Login
    const passHash = await bcrypt.hash("agent123", 10);
    await client.query(`
      INSERT INTO users (username, password_hash, name, role, branch_id, agent_id, phone)
      VALUES ('agent1', $1, 'Rajesh Verma (Agent)', 'agent', $2, $3, '9123456789')
      ON CONFLICT (username) DO NOTHING;
    `, [passHash, branchId, agent1.rows[0].id]);
    console.log("✓ Demo Agent User Created -> Username: agent1 | Password: agent123");

    // 5. Collector User Login
    const collectorPassHash = await bcrypt.hash("collector123", 10);
    const userCollector = await client.query(`
      INSERT INTO users (username, password_hash, name, role, branch_id, phone)
      VALUES ('collector1', $1, 'Suresh Sharma (Collector)', 'collector', $2, '9988776655')
      ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [collectorPassHash, branchId]);

    const collector1 = await client.query(`
      INSERT INTO collectors (user_id, name, phone, branch_id)
      VALUES ($1, 'Suresh Sharma (Collector)', '9988776655', $2)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [userCollector.rows[0].id, branchId]);
    console.log("✓ Demo Collector User Created -> Username: collector1 | Password: collector123");

    // 6. Committees (Bissi Schemes)
    const comm1 = await client.query(`
      INSERT INTO committees (name, total_amount, monthly_installment, total_months, start_date, branch_id)
      VALUES ('Shree Gold Bissi 50K', 50000, 5000, 10, CURRENT_DATE, $1)
      RETURNING id;
    `, [branchId]);
    console.log("✓ Demo Committee created: Shree Gold Bissi 50K");

    // 7. Tokens
    await client.query(`
      INSERT INTO tokens (committee_id, customer_id, token_number, status)
      VALUES ($1, $2, 1, 'active'), ($1, $3, 2, 'active');
    `, [comm1.rows[0].id, cust1.rows[0].id, cust2.rows[0].id]);
    console.log("✓ Bissi Tokens assigned");

    // 8. Loans
    await client.query(`
      INSERT INTO loans (customer_id, amount, interest_rate, duration_months, status)
      VALUES ($1, 25000, 12.0, 12, 'active');
    `, [cust1.rows[0].id]);
    console.log("✓ Demo Loan created for Ramesh Kumar (₹25,000)");

    // 9. Collections
    await client.query(`
      INSERT INTO collections (collector_id, customer_id, amount, collection_date, status)
      VALUES ($1, $2, 5000, CURRENT_DATE, 'collected');
    `, [collector1.rows[0].id, cust1.rows[0].id]);
    console.log("✓ Demo Collection entry added (₹5,000)");

    // 10. KYC Submission
    await client.query(`
      INSERT INTO kyc_submissions (user_id, aadhaar_number, pan_number, bank_account_no, bank_ifsc, bank_name, status)
      VALUES ($1, '123456789012', 'ABCDE1234F', '987654321098', 'SBIN0001234', 'State Bank of India', 'approved');
    `, [userCollector.rows[0].id]);
    console.log("✓ Demo KYC Record added");

    console.log("🎉 ALL DEMO SEED DATA INSERTED SUCCESSFULLY!");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error("Error inserting demo data:", err);
  process.exit(1);
});
