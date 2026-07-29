import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('--- TABLES IN NEON DB ---');
  for (const row of tables.rows) {
    const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${row.table_name}' ORDER BY ordinal_position;`);
    console.log(`Table: ${row.table_name}`);
    console.log('  Columns:', cols.rows.map(c => `${c.column_name}:${c.data_type}`).join(', '));
  }
  await pool.end();
}

main().catch(console.error);
