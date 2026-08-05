import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function runTests() {
  console.log("=== SMOKE TEST BACKEND ENDPOINTS & DATABASE MAPPINGS ===");

  // 1. Committees test
  const committeesRes = await pool.query("SELECT id::text, name, code, total_members, monthly_installment FROM committees ORDER BY name");
  console.log(`\n1. Committees (${committeesRes.rows.length} rows):`);
  for (const c of committeesRes.rows) {
    const tokensRes = await pool.query("SELECT COUNT(*)::int as count FROM tokens WHERE committee_id::text = $1", [c.id]);
    const collectionsRes = await pool.query("SELECT COALESCE(SUM(amount), 0)::numeric as total FROM collections WHERE committee_uuid::text = $1", [c.id]);
    const giftRes = await pool.query("SELECT COUNT(*)::int as count FROM gift_distributions WHERE committee_uuid::text = $1", [c.id]);
    const lotteryRes = await pool.query("SELECT COUNT(*)::int as count FROM lotteries WHERE committee_uuid::text = $1", [c.id]);
    
    console.log(`- [${c.code}] ${c.name}:`);
    console.log(`  Members/Tokens: ${tokensRes.rows[0].count}`);
    console.log(`  Collections Total: ₹${Number(collectionsRes.rows[0].total).toLocaleString("en-IN")}`);
    console.log(`  Gift Distributions: ${giftRes.rows[0].count}`);
    console.log(`  Lottery Draws: ${lotteryRes.rows[0].count}`);
  }

  // 2. Sample Customer History Test
  const sampleCustRes = await pool.query("SELECT id::text, name, mobile FROM customers LIMIT 1");
  if (sampleCustRes.rows.length > 0) {
    const cust = sampleCustRes.rows[0];
    console.log(`\n2. Customer Profile Test for ${cust.name} (${cust.id}):`);

    const tokRes = await pool.query("SELECT id::text, committee_id::text, normalized_token_number FROM tokens WHERE customer_id::text = $1", [cust.id]);
    const colRes = await pool.query("SELECT COUNT(*)::int as count, COALESCE(SUM(amount), 0)::numeric as total FROM collections WHERE customer_uuid::text = $1", [cust.id]);
    const giftRes = await pool.query("SELECT COUNT(*)::int as count FROM gift_distributions WHERE customer_uuid::text = $1", [cust.id]);
    const byajRes = await pool.query("SELECT id::text, interest_amount FROM byaj_accounts WHERE customer_id::text = $1", [cust.id]);

    console.log(`  Tokens: ${tokRes.rows.length}`);
    console.log(`  Collections: ${colRes.rows[0].count} payments (Total ₹${colRes.rows[0].total})`);
    console.log(`  Gifts Won: ${giftRes.rows[0].count}`);
    console.log(`  Interest Accounts: ${byajRes.rows.length}`);
  }

  // 3. Gifts Summary Test
  const totalGiftsRes = await pool.query("SELECT COUNT(*)::int as count FROM gift_distributions");
  console.log(`\n3. Gift Distributions Total Rows: ${totalGiftsRes.rows[0].count}`);

  // 4. Interest Accounts Test
  const totalInterestRes = await pool.query("SELECT COUNT(*)::int as count FROM byaj_accounts WHERE status = 'ACTIVE'");
  console.log(`\n4. Active Interest Accounts: ${totalInterestRes.rows[0].count}`);

  console.log("\n=== ALL DATABASE MAPPINGS VERIFIED SUCCESSFULLY ===");
  await pool.end();
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
