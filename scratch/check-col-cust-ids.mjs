import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const colRes = await pool.query("SELECT id, customer_id, committee_id, amount FROM collections LIMIT 10");
  console.log("collections sample customer_ids:", colRes.rows);
  await pool.end();
}

run().catch(console.error);
