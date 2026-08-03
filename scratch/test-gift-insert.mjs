import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  try {
    const cols = await pool.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='gift_distributions' ORDER BY ordinal_position`);
    console.log('gift_distributions schema:');
    cols.rows.forEach(r => console.log(' ', r.column_name, r.is_nullable === 'NO' ? 'NOT NULL' : 'nullable', r.column_default || ''));

    const enums = await pool.query(`SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname LIKE '%gift%'`);
    console.log('Gift enums:', enums.rows.map(r=>r.enumlabel));

    // Try test insert
    const custId = (await pool.query('SELECT id FROM customers LIMIT 1')).rows[0]?.id;
    const tokId = (await pool.query('SELECT id FROM tokens LIMIT 1')).rows[0]?.id;
    const commUuid = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31';

    const test = await pool.query(`
      INSERT INTO gift_distributions 
        (customer_id, committee_id, gift_id, distribution_date, status, notes,
         committee_uuid, customer_uuid, token_uuid, gift_name, token_number, customer_name)
      VALUES (1, 1, 1, CURRENT_DATE, 'delivered', 'test_gift',
              $1, $2, $3, 'Test Gift', 1, 'Test Customer')
      RETURNING id
    `, [commUuid, custId, tokId]);
    console.log('Test insert OK, id:', test.rows[0].id);
    await pool.query(`DELETE FROM gift_distributions WHERE notes = 'test_gift'`);
    console.log('Test cleanup OK');
  } catch(e) {
    console.error('ERROR:', e.message);
  }
  await pool.end();
}
main();
