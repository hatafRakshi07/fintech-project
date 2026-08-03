import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString:'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',ssl:{rejectUnauthorized:false}});

const tokens = await p.query(`
  SELECT comm.code, COUNT(t.id)::int as tokens,
    COUNT(t.id) FILTER(WHERE t.status='ACTIVE')::int as active
  FROM committees comm
  LEFT JOIN tokens t ON t.committee_id = comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.code, comm.bissi_int_id
  ORDER BY comm.bissi_int_id
`);
const cols = await p.query(`
  SELECT comm.code, COUNT(col.id)::int as receipts,
    COALESCE(SUM(col.amount),0)::float as total
  FROM committees comm
  LEFT JOIN collections col ON col.committee_uuid = comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.code, comm.bissi_int_id
  ORDER BY comm.bissi_int_id
`);

console.log('=== After JSK import ===');
tokens.rows.forEach((t,i) => {
  const c = cols.rows[i];
  console.log(` ${t.code}: tokens=${t.tokens} (active=${t.active}) | receipts=${c.receipts} | total=₹${Number(c.total).toLocaleString('en-IN')}`);
});

const grand = await p.query('SELECT count(*)::int as c, COALESCE(SUM(amount),0)::float as t FROM collections WHERE committee_uuid IS NOT NULL');
console.log(`\nGrand total: ${grand.rows[0].c} receipts = ₹${Number(grand.rows[0].t).toLocaleString('en-IN')}`);

// Sample new JSK members
const sample = await p.query(`
  SELECT c.name, t.normalized_token_number as tok, comm.code
  FROM customers c
  JOIN tokens t ON t.customer_id = c.id
  JOIN committees comm ON comm.id = t.committee_id
  WHERE c.mobile = '0000000000'
  ORDER BY comm.bissi_int_id, t.normalized_token_number
  LIMIT 10
`);
console.log('\nSample new JSK/Unknown members (first 10):');
sample.rows.forEach(r => console.log(`  ${r.code} Token#${r.tok} → ${r.name}`));
const total_new = await p.query("SELECT count(*) FROM customers WHERE mobile='0000000000'");
console.log(`\nTotal new JSK/Unknown members added: ${total_new.rows[0].count}`);

// Pending check for Aug 2026
const pending = await p.query(`
  SELECT comm.code, comm.monthly_installment,
    COUNT(t.id) FILTER(WHERE t.status='ACTIVE') as active,
    COUNT(t.id) FILTER(WHERE t.status='ACTIVE' AND NOT EXISTS(
      SELECT 1 FROM collections col WHERE col.token_uuid=t.id
      AND DATE_TRUNC('month',col.collected_at)=DATE_TRUNC('month',CURRENT_DATE)
    )) as pending
  FROM committees comm
  LEFT JOIN tokens t ON t.committee_id=comm.id
  WHERE comm.code IN ('BISSI-1','BISSI-2','BISSI-3','BISSI-4')
  GROUP BY comm.id, comm.code, comm.monthly_installment, comm.bissi_int_id
  ORDER BY comm.bissi_int_id
`);
console.log('\n=== August 2026 Pending (including new tokens) ===');
pending.rows.forEach(r => {
  const amt = Number(r.pending) * Number(r.monthly_installment);
  console.log(`  ${r.code}: ${r.active} active, ${r.pending} pending = ₹${amt.toLocaleString('en-IN')}`);
});

await p.end();
