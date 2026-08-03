import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  try {
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    console.log('Tables:', tables.rows.map(r=>r.tablename).join(', '));

    const counts = await pool.query(`
      SELECT 
        (SELECT count(*) FROM customers) as customers,
        (SELECT count(*) FROM committees) as committees,
        (SELECT count(*) FROM tokens) as tokens,
        (SELECT count(*) FROM installments) as installments
    `);
    console.log('Counts:', JSON.stringify(counts.rows[0]));

    const committees = await pool.query('SELECT id, name, type, installment_amount, status, start_date, collection_day FROM committees ORDER BY id');
    console.log('Committees:');
    committees.rows.forEach(c => console.log(' ', JSON.stringify(c)));

    // Check for collections table
    const colCheck = await pool.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='collections')");
    console.log('Has collections table:', colCheck.rows[0].exists);
    if (colCheck.rows[0].exists) {
      const colCount = await pool.query('SELECT count(*) FROM collections');
      console.log('Collections count:', colCount.rows[0].count);
    }

    // Check for gift_distributions
    const gdCheck = await pool.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='gift_distributions')");
    console.log('Has gift_distributions:', gdCheck.rows[0].exists);

    // Check for lotteries
    const lotCheck = await pool.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='lotteries')");
    console.log('Has lotteries:', lotCheck.rows[0].exists);

  } catch(e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
}
main();
