import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT id, name, type FROM committees LIMIT 10;");
  console.log('Existing committees:', res.rows);
  const enums = await pool.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'committee_type';");
  console.log('Valid committee_type enums:', enums.rows.map(r => r.enumlabel));
  await pool.end();
}

main().catch(console.error);
