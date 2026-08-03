import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  try {
    // Daily diary tables
    const ddl = await pool.query('SELECT count(*) FROM daily_diary_loans');
    console.log('daily_diary_loans:', ddl.rows[0].count);
    const ddlCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='daily_diary_loans' ORDER BY ordinal_position");
    console.log('daily_diary_loans columns:', ddlCols.rows.map(r=>r.column_name).join(', '));
    const ddSample = await pool.query('SELECT * FROM daily_diary_loans LIMIT 3');
    ddSample.rows.forEach(r => console.log(' ', JSON.stringify(r)));

    // Lotteries table
    const lotCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='lotteries' ORDER BY ordinal_position");
    console.log('\nlotteries columns:', lotCols.rows.map(r=>`${r.column_name}(${r.data_type})`).join(', '));
    const lotSample = await pool.query('SELECT * FROM lotteries LIMIT 5');
    lotSample.rows.forEach(r => console.log(' ', JSON.stringify(r)));

    // Gift catalog
    const gcCount = await pool.query('SELECT count(*) FROM gift_catalog');
    console.log('\ngift_catalog:', gcCount.rows[0].count);
    const gcSample = await pool.query('SELECT * FROM gift_catalog LIMIT 5');
    if (gcSample.rows.length) {
      console.log('gift_catalog columns:', Object.keys(gcSample.rows[0]).join(', '));
      gcSample.rows.forEach(r => console.log(' ', JSON.stringify(r)));
    }

    // Gift distributions columns
    const gdCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='gift_distributions' ORDER BY ordinal_position");
    console.log('\ngift_distributions columns:', gdCols.rows.map(r=>`${r.column_name}(${r.data_type})`).join(', '));

    // Collections schema (current)
    const collCols = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='collections' ORDER BY ordinal_position");
    console.log('\ncollections schema:');
    collCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable=${r.is_nullable})`));

    // Check tokens per committee
    const tokCounts = await pool.query(`
      SELECT c.code, c.name, c.monthly_installment, COUNT(t.id) as tokens, 
        COUNT(t.id) FILTER(WHERE t.status='ACTIVE') as active
      FROM committees c LEFT JOIN tokens t ON t.committee_id = c.id
      GROUP BY c.id, c.code, c.name, c.monthly_installment
      ORDER BY c.code
    `);
    console.log('\nCommittees with token counts:');
    tokCounts.rows.forEach(r => console.log(`  ${r.code}: ${r.name} | ₹${r.monthly_installment} | tokens=${r.tokens} (active=${r.active})`));

    // Existing data issues
    const colComm = await pool.query('SELECT DISTINCT committee_id FROM collections');
    console.log('\nUnique committee_ids in collections:', colComm.rows.map(r=>r.committee_id));

  } catch(e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
}
main();
