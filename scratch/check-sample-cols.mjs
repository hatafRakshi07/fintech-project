import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const colRes = await pool.query("SELECT * FROM collections LIMIT 5");
  console.log("sample collection row:", colRes.rows[0]);
  await pool.end();
}

run().catch(console.error);
