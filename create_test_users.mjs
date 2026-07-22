import pg from 'pg';
const { Client } = pg;

const REAL_HASH = '$2b$12$16iWUxslobJbIjLVPSBJFOEI7V1RW9Nig3ESdBFmnUnXOsvMnlsnS'; // password: 'admin123'

const client = new Client({ connectionString: 'postgresql://postgres@127.0.0.1:5432/bissi_db' });

async function main() {
  try {
    await client.connect();
    
    // 1. Delete existing if any to prevent key constraint violations
    await client.query("DELETE FROM users WHERE username IN ('collector', 'customer');");

    // 2. Insert collector
    await client.query(`
      INSERT INTO users (username, password_hash, name, role, branch_id)
      VALUES ('collector', $1, 'Ram Singh (Collector)', 'collector', 1)
    `, [REAL_HASH]);
    console.log("✅ Collector user created: username='collector', password='admin123'");

    // 3. Insert customer linked to customer_id = 1
    await client.query(`
      INSERT INTO users (username, password_hash, name, role, branch_id, customer_id)
      VALUES ('customer', $1, 'Nitin Sisodiya', 'customer', 1, 1)
    `, [REAL_HASH]);
    console.log("✅ Customer user created: username='customer', password='admin123', customer_id=1");

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
