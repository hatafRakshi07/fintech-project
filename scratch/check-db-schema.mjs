import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  const tables = ['customers', 'committees', 'committee_members', 'tokens', 'installments', 'collections'];
  for (const t of tables) {
    const res = await pool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t]
    );
    console.log(`\n=== TABLE: ${t} ===`);
    console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }
  await pool.end();
}

checkColumns();
