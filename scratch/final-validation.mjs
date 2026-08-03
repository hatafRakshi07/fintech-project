import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',ssl:{rejectUnauthorized:false}});

console.log('=== BISSI ERP DATABASE VALIDATION ===\n');

// 1. Record counts
const counts = await p.query(`
  SELECT
    (SELECT count(*) FROM customers) AS customers,
    (SELECT count(*) FROM tokens) AS tokens,
    (SELECT count(*) FROM collections WHERE committee_uuid IS NOT NULL) AS collections,
    (SELECT count(*) FROM lotteries WHERE committee_uuid IS NOT NULL) AS lotteries,
    (SELECT count(*) FROM gift_distributions WHERE committee_uuid IS NOT NULL) AS gifts,
    (SELECT count(*) FROM daily_diary_loans) AS diary_loans
`);
console.log('Record counts:', counts.rows[0]);

// 2. Collections by committee
const byComm = await p.query(`
  SELECT comm.name, comm.code, count(col.id) as receipts,
    sum(col.amount)::numeric as total_amount,
    min(col.collected_at) as earliest,
    max(col.collected_at) as latest
  FROM committees comm
  LEFT JOIN collections col ON col.committee_uuid = comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.name, comm.code, comm.monthly_installment
  ORDER BY comm.bissi_int_id
`);
console.log('\nCollections by committee:');
byComm.rows.forEach(r => console.log(`  ${r.code} | ${r.name}: ${r.receipts} receipts = ₹${Number(r.total_amount).toLocaleString('en-IN')} | ${r.earliest?.toISOString()?.slice(0,10)} → ${r.latest?.toISOString()?.slice(0,10)}`));

// 3. Dashboard stats - verify no hardcoding
const stats = await p.query(`
  SELECT
    (SELECT count(*) FROM collections WHERE committee_uuid IS NOT NULL AND DATE(collected_at) = CURRENT_DATE) as today_collections,
    (SELECT sum(amount) FROM collections WHERE committee_uuid IS NOT NULL AND DATE(collected_at) = CURRENT_DATE) as today_amount,
    (SELECT count(*) FROM lotteries WHERE reward_description = 'Lucky') as lucky_count
`);
console.log('\nToday stats:', stats.rows[0]);

// 4. Pending for current month per committee
const pending = await p.query(`
  SELECT c.name, c.monthly_installment,
    count(t.id) FILTER(WHERE t.status='ACTIVE') as active_tokens,
    count(t.id) FILTER(WHERE t.status='ACTIVE' AND EXISTS(
      SELECT 1 FROM collections col WHERE col.token_uuid = t.id
        AND DATE_TRUNC('month', col.collected_at) = DATE_TRUNC('month', CURRENT_DATE)
    )) as paid_this_month,
    count(t.id) FILTER(WHERE t.status='ACTIVE' AND NOT EXISTS(
      SELECT 1 FROM collections col WHERE col.token_uuid = t.id
        AND DATE_TRUNC('month', col.collected_at) = DATE_TRUNC('month', CURRENT_DATE)
    )) as pending_this_month
  FROM committees c
  LEFT JOIN tokens t ON t.committee_id = c.id
  WHERE c.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY c.id, c.name, c.monthly_installment, c.bissi_int_id
  ORDER BY c.bissi_int_id
`);
console.log('\nCurrent month pending per committee:');
pending.rows.forEach(r => console.log(`  ${r.name}: active=${r.active_tokens}, paid=${r.paid_this_month}, pending=${r.pending_this_month}, pending_amt=₹${(Number(r.pending_this_month) * Number(r.monthly_installment)).toLocaleString('en-IN')}`));

// 5. Available months for filter
const months = await p.query(`
  SELECT DISTINCT TO_CHAR(DATE_TRUNC('month', collected_at), 'YYYY-MM') as month
  FROM collections WHERE committee_uuid IS NOT NULL
  ORDER BY month ASC
`);
console.log('\nAvailable months:', months.rows.map(r=>r.month).join(', '));

// 6. Lucky draws
const lucky = await p.query(`
  SELECT c.name, count(l.id) as draws
  FROM lotteries l JOIN committees c ON c.id = l.committee_uuid
  WHERE l.reward_description = 'Lucky'
  GROUP BY c.name ORDER BY c.name
`);
console.log('\nLucky draws by scheme:', lucky.rows);

// 7. Daily diary sample
const diary = await p.query('SELECT customer_name, loan_amount, status FROM daily_diary_loans ORDER BY created_at LIMIT 5');
console.log('\nDaily diary sample:', diary.rows);

await p.end();
console.log('\n=== VALIDATION COMPLETE ===');
