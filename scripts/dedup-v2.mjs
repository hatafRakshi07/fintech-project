/**
 * Clean dedup: for each duplicate byaj_serial, keep the record with more payments,
 * DELETE the loser's payments first (to avoid FK violations), then delete the loser.
 * Then re-import clean data to production.
 */
import pg from 'pg';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const NEON = 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb';
const PROD = process.env.PROD_URL || 'https://fintech-project-tlgw.onrender.com';
const SECRET = 'ska-import-2026';
const BATCH = 200;

const pool = new pg.Pool({ connectionString: NEON, ssl:{rejectUnauthorized:false}, max:2 });

// ─── Dedup Neon ────────────────────────────────────────────────────────────────
console.log('=== Deduplicating Neon byaj_accounts ===');

const before = await pool.query('SELECT COUNT(*)::int FROM byaj_accounts');
console.log('Before:', before.rows[0].count, 'accounts');

// Find duplicates: same byaj_serial → keep the one with more payments
const dupes = await pool.query(`
  SELECT byaj_serial,
    (SELECT id FROM byaj_accounts ba2 WHERE ba2.byaj_serial = ba.byaj_serial
     ORDER BY (SELECT COUNT(*) FROM byaj_payments bp WHERE bp.account_id = ba2.id) DESC, ba2.created_at ASC
     LIMIT 1) AS keep_id,
    array_agg(id::text) AS all_ids
  FROM byaj_accounts ba
  WHERE byaj_serial IS NOT NULL
  GROUP BY byaj_serial
  HAVING COUNT(*) > 1
`);

console.log(`Found ${dupes.rows.length} duplicate groups`);

for (const row of dupes.rows) {
  const toDelete = row.all_ids.filter((id) => id !== row.keep_id);
  for (const delId of toDelete) {
    // 1. Delete payments for the loser first
    await pool.query(`DELETE FROM byaj_payments WHERE account_id = $1::uuid`, [delId]);
    // 2. Delete the loser account
    await pool.query(`DELETE FROM byaj_accounts WHERE id = $1::uuid`, [delId]);
  }
}

// Same for mi_accounts
const miDupes = await pool.query(`
  SELECT token_serial,
    (SELECT id FROM mi_accounts ma2 WHERE ma2.token_serial = ma.token_serial
     ORDER BY (SELECT COUNT(*) FROM mi_payments mp WHERE mp.account_id = ma2.id) DESC, ma2.created_at ASC
     LIMIT 1) AS keep_id,
    array_agg(id::text) AS all_ids
  FROM mi_accounts ma
  WHERE token_serial IS NOT NULL
  GROUP BY token_serial
  HAVING COUNT(*) > 1
`);

console.log(`Found ${miDupes.rows.length} duplicate mi_accounts groups`);
for (const row of miDupes.rows) {
  const toDelete = row.all_ids.filter((id) => id !== row.keep_id);
  for (const delId of toDelete) {
    await pool.query(`DELETE FROM mi_payments WHERE account_id = $1::uuid`, [delId]);
    await pool.query(`DELETE FROM mi_accounts WHERE id = $1::uuid`, [delId]);
  }
}

const after = await pool.query('SELECT COUNT(*)::int FROM byaj_accounts');
const afterMI = await pool.query('SELECT COUNT(*)::int FROM mi_accounts');
console.log(`After dedup: byaj=${after.rows[0].count}, mi=${afterMI.rows[0].count}`);

// ─── Export clean data from Neon ───────────────────────────────────────────────
console.log('\n=== Exporting clean data from Neon ===');
const [byajAcc, byajPay, miAcc, miPay] = await Promise.all([
  pool.query(`SELECT ba.*, c.name AS customer_name, c.mobile AS customer_mobile FROM byaj_accounts ba LEFT JOIN customers c ON c.id = ba.customer_id::uuid`),
  pool.query('SELECT * FROM byaj_payments'),
  pool.query(`SELECT ma.*, c.name AS customer_name, c.mobile AS customer_mobile FROM mi_accounts ma LEFT JOIN customers c ON c.id = ma.customer_id::uuid`),
  pool.query('SELECT * FROM mi_payments'),
]);
console.log(`byaj: ${byajAcc.rows.length} accounts, ${byajPay.rows.length} payments`);
console.log(`mi:   ${miAcc.rows.length} accounts, ${miPay.rows.length} payments`);

// ─── Post clean data to production (clear + reimport) ─────────────────────────
console.log('\n=== Clearing and reimporting production ===');

async function postChunk(path, body) {
  const r = await fetch(`${PROD}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Send in batches (clear-and-reimport does the TRUNCATE on first call)
let firstBatch = true;
let totalInserted = { byaj_accounts: 0, byaj_payments: 0, mi_accounts: 0, mi_payments: 0 };

const maxLen = Math.max(byajAcc.rows.length, byajPay.rows.length, miAcc.rows.length, miPay.rows.length);
for (let i = 0; i < maxLen; i += BATCH) {
  const chunk = {
    secret: SECRET,
    byaj_accounts: byajAcc.rows.slice(i, i + BATCH),
    byaj_payments: byajPay.rows.slice(i, i + BATCH),
    mi_accounts:   miAcc.rows.slice(i, i + BATCH),
    mi_payments:   miPay.rows.slice(i, i + BATCH),
  };

  // First batch uses clear-and-reimport (truncates), rest use bulk-import
  const endpoint = firstBatch ? '/api/v2/admin/clear-and-reimport' : '/api/v2/admin/bulk-import';
  try {
    const r = await postChunk(endpoint, chunk);
    Object.keys(r.inserted || {}).forEach(k => { totalInserted[k] = (totalInserted[k]||0) + (r.inserted[k]||0); });
    firstBatch = false;
    process.stdout.write(`  Batch ${Math.floor(i/BATCH)+1}: byaj=${totalInserted.byaj_accounts}, pay=${totalInserted.byaj_payments}\r`);
  } catch(e) {
    console.error(`\n  Batch ${i/BATCH} error:`, e.message.slice(0,100));
    firstBatch = false; // don't truncate again
  }
}

console.log('\nTotal inserted:', totalInserted);

// Verify
const check = await fetch(`${PROD}/api/interests/accounts`).then(r=>r.json());
const checkFirst = check.accounts?.[0];
console.log(`\nProduction: ${check.total} byaj accounts, first customer: ${checkFirst?.customerName} (${checkFirst?.customerMobile})`);

await pool.end();
console.log('\n✅ Dedup + reimport complete');
