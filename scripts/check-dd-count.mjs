import pg from 'pg';
const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb";

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const countRes = await client.query(`SELECT COUNT(*), status FROM daily_diary_loans GROUP BY status`);
    console.log("Daily Diary Loans Count by Status:", countRes.rows);

    const sampleRes = await client.query(`SELECT id, customer_name, mobile_number, loan_amount, status FROM daily_diary_loans LIMIT 10`);
    console.log("Sample 10 Loans:", sampleRes.rows);
  } finally {
    client.release();
    pool.end();
  }
}

main();
