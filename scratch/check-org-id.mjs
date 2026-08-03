import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const orgs = await pool.query("SELECT id FROM organizations LIMIT 1");
  console.log("Found Organization ID:", orgs.rows[0]?.id);
  await pool.end();
}

run().catch(console.error);
