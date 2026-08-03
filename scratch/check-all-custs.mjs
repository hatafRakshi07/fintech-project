import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const custRes = await pool.query("SELECT id, name FROM customers LIMIT 5");
  console.log("customers sample IDs:", custRes.rows);
  await pool.end();
}

run().catch(console.error);
