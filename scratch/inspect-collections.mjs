import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const res = await pool.query('SELECT * FROM collections WHERE TO_CHAR(collected_at, \'Mon YYYY\') = \'Mar 2025\' LIMIT 10');
  console.log('Sample Mar 2025 collections:', res.rows);

  const tRes = await pool.query('SELECT * FROM tokens LIMIT 10');
  console.log('Sample tokens:', tRes.rows);

  await pool.end();
}

run().catch(console.error);
