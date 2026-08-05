import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const tables = ['committees', 'customers', 'tokens', 'installments', 'committee_months', 'draw_events', 'draw_results', 'gift_winners', 'lottery_sessions', 'lottery_gifts', 'gift_distributions', 'loans'];
  
  console.log('=== TABLE ROW COUNTS ===');
  for (const tbl of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*)::int FROM ${tbl}`);
      console.log(`${tbl}: ${res.rows[0].count}`);
    } catch (e) {
      console.log(`${tbl}: DOES NOT EXIST OR ERROR (${e.message})`);
    }
  }

  console.log('\n=== COMMITTEES ===');
  const comms = await pool.query("SELECT id, name, code, total_members, monthly_installment FROM committees");
  console.table(comms.rows);

  console.log('\n=== SAMPLE TOKENS (First 5) ===');
  const tok = await pool.query("SELECT id, committee_id, customer_id, rawTokenNumber, normalized_token_number FROM tokens LIMIT 5").catch(async () => {
    return await pool.query("SELECT id, committee_id, customer_id, raw_token_number, normalized_token_number FROM tokens LIMIT 5");
  });
  console.table(tok.rows);

  console.log('\n=== SAMPLE CUSTOMERS (First 5) ===');
  const cust = await pool.query("SELECT id, name, mobile, aadhaar FROM customers LIMIT 5");
  console.table(cust.rows);

  console.log('\n=== SAMPLE INSTALLMENTS (First 5) ===');
  const inst = await pool.query("SELECT id, committee_month_id, token_id, receipt_number, expected_amount, paid_amount, payment_date FROM installments LIMIT 5");
  console.table(inst.rows);

  console.log('\n=== SAMPLE LOTTERY GIFTS / GIFT DISTRIBUTIONS (First 5) ===');
  try {
    const lg = await pool.query("SELECT * FROM lottery_gifts LIMIT 5");
    console.log('lottery_gifts count:', lg.rows.length);
    console.table(lg.rows);
  } catch (e) { console.log('lottery_gifts error:', e.message); }

  try {
    const gw = await pool.query("SELECT * FROM gift_winners LIMIT 5");
    console.log('gift_winners count:', gw.rows.length);
    console.table(gw.rows);
  } catch (e) { console.log('gift_winners error:', e.message); }

  try {
    const gd = await pool.query("SELECT * FROM gift_distributions LIMIT 5");
    console.log('gift_distributions count:', gd.rows.length);
    console.table(gd.rows);
  } catch (e) { console.log('gift_distributions error:', e.message); }

  await pool.end();
}

main().catch(console.error);
