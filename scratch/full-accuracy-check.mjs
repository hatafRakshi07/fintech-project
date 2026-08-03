import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',ssl:{rejectUnauthorized:false}});

console.log('=== ACCURACY VALIDATION REPORT ===\n');

// 1. Collections count per scheme
const colsByScheme = await p.query(`
  SELECT comm.code, comm.name, comm.monthly_installment,
    COUNT(col.id)::int as receipts,
    SUM(col.amount)::numeric as total_amount,
    MIN(col.collected_at::date)::text as earliest,
    MAX(col.collected_at::date)::text as latest
  FROM committees comm
  LEFT JOIN collections col ON col.committee_uuid = comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.code, comm.name, comm.monthly_installment, comm.bissi_int_id
  ORDER BY comm.bissi_int_id
`);
console.log('── Collections by Scheme ──');
colsByScheme.rows.forEach(r => {
  console.log(`  ${r.code} | ${r.name}`);
  console.log(`    Receipts: ${r.receipts} | Total: ₹${Number(r.total_amount).toLocaleString('en-IN')} | ${r.earliest} → ${r.latest}`);
});

// 2. Token counts
const tokens = await p.query(`
  SELECT comm.code, comm.name,
    COUNT(*) FILTER(WHERE t.status='ACTIVE')::int as active,
    COUNT(*)::int as total
  FROM committees comm
  LEFT JOIN tokens t ON t.committee_id = comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.code, comm.name, comm.bissi_int_id
  ORDER BY comm.bissi_int_id
`);
console.log('\n── Tokens per Scheme ──');
tokens.rows.forEach(r => console.log(`  ${r.code}: active=${r.active}, total=${r.total}`));

// 3. This month pending
const pending = await p.query(`
  SELECT comm.code, comm.name, comm.monthly_installment,
    COUNT(t.id) FILTER(WHERE t.status='ACTIVE') as active_tokens,
    COUNT(t.id) FILTER(WHERE t.status='ACTIVE' AND NOT EXISTS(
      SELECT 1 FROM collections col WHERE col.token_uuid=t.id 
      AND DATE_TRUNC('month',col.collected_at)=DATE_TRUNC('month',CURRENT_DATE)
    )) as pending_count
  FROM committees comm
  LEFT JOIN tokens t ON t.committee_id=comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.code, comm.name, comm.monthly_installment, comm.bissi_int_id
  ORDER BY comm.bissi_int_id
`);
console.log('\n── August 2026 Pending ──');
pending.rows.forEach(r => {
  const pendAmt = Number(r.pending_count) * Number(r.monthly_installment);
  console.log(`  ${r.code}: active=${r.active_tokens}, pending=${r.pending_count} tokens = ₹${pendAmt.toLocaleString('en-IN')}`);
});

// 4. Gift records
const gifts = await p.query(`
  SELECT comm.code,
    COUNT(gd.id)::int as total_gifts,
    COUNT(gd.id) FILTER(WHERE gd.gift_name ILIKE '%lucky%')::int as lucky,
    COUNT(gd.id) FILTER(WHERE gd.status::text='distributed')::int as delivered,
    MIN(gd.distribution_date::text) as earliest,
    MAX(gd.distribution_date::text) as latest
  FROM committees comm
  LEFT JOIN gift_distributions gd ON gd.committee_uuid=comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.code, comm.bissi_int_id
  ORDER BY comm.bissi_int_id
`);
console.log('\n── Gift Records ──');
gifts.rows.forEach(r => console.log(`  ${r.code}: ${r.total_gifts} gifts, ${r.lucky} lucky, ${r.delivered} delivered | ${r.earliest}→${r.latest}`));

// 5. Lotteries (lucky draw entries)
const lot = await p.query(`
  SELECT comm.code, COUNT(l.id)::int as draws
  FROM committees comm
  LEFT JOIN lotteries l ON l.committee_uuid=comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.code, comm.bissi_int_id
  ORDER BY comm.bissi_int_id
`);
console.log('\n── Lottery Records ──');
lot.rows.forEach(r => console.log(`  ${r.code}: ${r.draws} lucky draw entries`));

// 6. Daily diary
const diary = await p.query(`
  SELECT customer_name, loan_amount::text, start_date, status
  FROM daily_diary_loans ORDER BY created_at
`);
console.log('\n── Daily Diary Loans ──');
console.log(`  Total: ${diary.rows.length} records`);
diary.rows.forEach(r => console.log(`  ${r.customer_name.substring(0,35)} | ₹${r.loan_amount} | ${r.start_date} | ${r.status}`));

// 7. Overall summary
const summary = await p.query(`
  SELECT
    (SELECT count(*) FROM customers) as customers,
    (SELECT count(*) FROM tokens) as tokens,
    (SELECT count(*) FROM collections WHERE committee_uuid IS NOT NULL) as collections,
    (SELECT COALESCE(SUM(amount),0)::numeric FROM collections WHERE committee_uuid IS NOT NULL) as total_collected,
    (SELECT count(*) FROM lotteries WHERE committee_uuid IS NOT NULL) as lotteries,
    (SELECT count(*) FROM gift_distributions WHERE committee_uuid IS NOT NULL) as gifts,
    (SELECT count(*) FROM daily_diary_loans) as diary
`);
const s = summary.rows[0];
console.log('\n── OVERALL SUMMARY ──');
console.log(`  Customers:   ${s.customers}`);
console.log(`  Tokens:      ${s.tokens}`);
console.log(`  Collections: ${s.collections} receipts`);
console.log(`  Total Collected: ₹${Number(s.total_collected).toLocaleString('en-IN')}`);
console.log(`  Lucky Draws: ${s.lotteries}`);
console.log(`  Gift Records:${s.gifts}`);
console.log(`  Daily Diary: ${s.diary} loans`);

await p.end();
