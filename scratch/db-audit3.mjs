import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  try {
    // Check exact column types for key tables
    const colTypes = await pool.query(`
      SELECT table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name IN ('collections','committees','tokens','customers')
        AND column_name IN ('id','committee_id','customer_id','token_id')
      ORDER BY table_name, column_name
    `);
    console.log('Column types:');
    colTypes.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name}: ${r.data_type} (${r.udt_name})`));

    // Count tokens per committee
    const tokPerComm = await pool.query(`
      SELECT committee_id, count(*) as token_count, 
        count(*) FILTER(WHERE status='ACTIVE') as active,
        count(*) FILTER(WHERE status='CANCELLED') as cancelled
      FROM tokens GROUP BY committee_id ORDER BY committee_id
    `);
    console.log('\nTokens per committee_id:');
    tokPerComm.rows.forEach(r => console.log(`  committee_id=${r.committee_id}: total=${r.token_count}, active=${r.active}, cancelled=${r.cancelled}`));

    // Check committee_id values in collections
    const collComm = await pool.query(`SELECT DISTINCT committee_id, count(*) FROM collections GROUP BY committee_id ORDER BY committee_id`);
    console.log('\nCollections by committee_id:');
    collComm.rows.forEach(r => console.log(`  committee_id=${r.committee_id}: ${r.count} collections`));

    // Collections by month - check date range
    const collDates = await pool.query(`
      SELECT 
        MIN(collected_at) as earliest,
        MAX(collected_at) as latest,
        count(*) as total,
        count(DISTINCT committee_id) as committees
      FROM collections
    `);
    console.log('\nCollections date range:', JSON.stringify(collDates.rows[0]));

    // Collections by year-month
    const collByMonth = await pool.query(`
      SELECT 
        to_char(collected_at, 'YYYY-MM') as month,
        committee_id,
        count(*) as receipts,
        sum(amount)::float as total
      FROM collections
      GROUP BY month, committee_id
      ORDER BY month, committee_id
      LIMIT 30
    `);
    console.log('\nCollections by month (first 30):');
    collByMonth.rows.forEach(r => console.log(`  ${r.month} comm=${r.committee_id}: ${r.receipts} receipts = ₹${r.total}`));

    // Lotteries detail
    const lots = await pool.query('SELECT * FROM lotteries LIMIT 5');
    console.log('\nLotteries sample:', JSON.stringify(lots.rows));

    // Gift distributions sample
    const gd = await pool.query('SELECT * FROM gift_distributions LIMIT 5');
    console.log('\nGift distributions (empty expected):', gd.rows.length);

    // Check committees with collection linkage
    console.log('\n=== COMMITTEES vs COLLECTIONS MAPPING ===');
    const mapping = await pool.query(`
      SELECT c.id, c.name, c.code, c.monthly_installment,
        (SELECT count(*) FROM collections col WHERE col.committee_id::text = c.id::text) as coll_count_uuid,
        (SELECT count(*) FROM tokens t WHERE t.committee_id = c.id) as token_count
      FROM committees c ORDER BY c.code
    `);
    mapping.rows.forEach(r => console.log(`  ${r.code} | ${r.name} | inst=${r.monthly_installment} | tokens=${r.token_count} | coll_uuid_match=${r.coll_count_uuid}`));

  } catch(e) { console.error('ERROR:', e.message, e.stack?.split('\n')[1]); }
  finally { await pool.end(); }
}
main();
