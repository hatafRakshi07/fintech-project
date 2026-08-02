import pg from 'pg';
const { Pool } = pg;
const DATABASE_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'tokens'`);
  console.log("Tokens columns:", res.rows.map(r => r.column_name));
  await pool.end();
}

main();
