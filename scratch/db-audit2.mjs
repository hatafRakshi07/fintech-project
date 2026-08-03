import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  try {
    // Committee columns
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='committees' ORDER BY ordinal_position");
    console.log('Committee columns:', cols.rows.map(r=>r.column_name).join(', '));

    const committees = await pool.query('SELECT * FROM committees ORDER BY id');
    console.log('\nCommittees:');
    committees.rows.forEach(c => console.log(' ', JSON.stringify(c)));

    // Collections count & sample
    const col = await pool.query('SELECT count(*) FROM collections');
    console.log('\nCollections:', col.rows[0].count);

    const colSample = await pool.query('SELECT * FROM collections LIMIT 3');
    if (colSample.rows.length) {
      console.log('Collections columns:', Object.keys(colSample.rows[0]).join(', '));
      colSample.rows.forEach(r => console.log(' ', JSON.stringify(r)));
    }

    // Gift distributions
    const gd = await pool.query('SELECT count(*) FROM gift_distributions');
    console.log('\nGift distributions:', gd.rows[0].count);

    const gdCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='gift_distributions' ORDER BY ordinal_position");
    console.log('GiftDist columns:', gdCols.rows.map(r=>r.column_name).join(', '));

    // Lotteries
    const lot = await pool.query('SELECT count(*) FROM lotteries');
    console.log('\nLotteries:', lot.rows[0].count);
    const lotSample = await pool.query('SELECT * FROM lotteries LIMIT 3');
    if (lotSample.rows.length) {
      console.log('Lottery columns:', Object.keys(lotSample.rows[0]).join(', '));
    }

    // Tokens - sample
    const tokSample = await pool.query('SELECT * FROM tokens LIMIT 3');
    if (tokSample.rows.length) {
      console.log('\nToken columns:', Object.keys(tokSample.rows[0]).join(', '));
      tokSample.rows.forEach(r => console.log(' ', JSON.stringify(r)));
    }

    // Installments
    const inst = await pool.query('SELECT count(*) FROM installments');
    console.log('\nInstallments:', inst.rows[0].count);
    const instCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='installments' ORDER BY ordinal_position");
    console.log('Installment columns:', instCols.rows.map(r=>r.column_name).join(', '));

    // Branches
    const branches = await pool.query('SELECT * FROM branches');
    console.log('\nBranches:', JSON.stringify(branches.rows));

  } catch(e) { console.error('ERROR:', e.message, e.stack); }
  finally { await pool.end(); }
}
main();
