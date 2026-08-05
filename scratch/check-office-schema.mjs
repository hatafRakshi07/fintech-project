import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});
const tables = ['office_diary', 'office_tasks', 'complaints', 'donations', 'lotteries'];
for (const t of tables) {
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
  console.log(`${t}: ${r.rows.map(c=>c.column_name).join(', ')}`);
}
// check lottery status type
const lt = await pool.query(`SELECT pg_typeof(status) FROM lotteries LIMIT 1`);
console.log('lotteries.status type:', lt.rows[0]?.pg_typeof);
await pool.end();
