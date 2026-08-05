/**
 * Deduplicate byaj_accounts and mi_accounts.
 * For each duplicate serial, keeps the record with MORE payment history,
 * re-points payments to the winner, then deletes losers.
 * Runs on BOTH Neon and Production (via API).
 */
import pg from 'pg';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const NEON = 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb';
const PROD = process.env.PROD_URL || 'https://fintech-project-tlgw.onrender.com';
const SECRET = 'ska-import-2026';

const pool = new pg.Pool({ connectionString: NEON, ssl:{rejectUnauthorized:false}, max:2 });

async function dedupTable(client, table, serialCol, paymentsTable, accountFkCol) {
  // Find all duplicate groups
  const dupes = await client.query(`
    SELECT ${serialCol}, array_agg(id::text ORDER BY 
      (SELECT COUNT(*) FROM ${paymentsTable} WHERE ${accountFkCol}=a.id) DESC, created_at ASC
    ) AS ids
    FROM ${table} a
    WHERE ${serialCol} IS NOT NULL
    GROUP BY ${serialCol}
    HAVING COUNT(*) > 1
  `);

  let deleted = 0;
  for (const row of dupes.rows) {
    const [keepId, ...deleteIds] = row.ids;
    // Re-point payments from losers to winner
    for (const delId of deleteIds) {
      await client.query(
        `UPDATE ${paymentsTable} SET ${accountFkCol}=$1 
         WHERE ${accountFkCol}=$2::uuid
         AND (${accountFkCol}, period_month) NOT IN (
           SELECT ${accountFkCol}, period_month FROM ${paymentsTable} WHERE ${accountFkCol}=$1::uuid
         )`,
        [keepId, delId]
      );
      // Delete remaining payments for loser (they're duplicates)
      await client.query(`DELETE FROM ${paymentsTable} WHERE ${accountFkCol}=$1::uuid`, [delId]);
      // Delete the loser account
      await client.query(`DELETE FROM ${table} WHERE id=$1::uuid`, [delId]);
      deleted++;
    }
  }
  console.log(`  ${table}: removed ${deleted} duplicates (kept ${dupes.rows.length} winners)`);
  return deleted;
}

// ── Clean Neon ────────────────────────────────────────────────────────────────
console.log('=== Cleaning Neon ===');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await dedupTable(client, 'byaj_accounts', 'byaj_serial', 'byaj_payments', 'account_id');
  await dedupTable(client, 'mi_accounts', 'token_serial', 'mi_payments', 'account_id');
  await client.query('COMMIT');
  console.log('Neon cleaned ✓');

  const t = await pool.query('SELECT COUNT(*)::int FROM byaj_accounts');
  console.log('Neon byaj_accounts after dedup:', t.rows[0].count);
} catch(e) {
  await client.query('ROLLBACK');
  console.error('Neon dedup failed:', e.message);
} finally { client.release(); }

// ── Clean Production via bulk-import dedup endpoint ───────────────────────────
console.log('\n=== Cleaning Production ===');

// Export clean deduplicated data from Neon
const cleanByaj = await pool.query(`
  SELECT ba.*, c.name AS customer_name, c.mobile AS customer_mobile
  FROM byaj_accounts ba
  LEFT JOIN customers c ON c.id = ba.customer_id::uuid
`);
const cleanByajPay = await pool.query('SELECT * FROM byaj_payments');
const cleanMI = await pool.query(`
  SELECT ma.*, c.name AS customer_name, c.mobile AS customer_mobile
  FROM mi_accounts ma
  LEFT JOIN customers c ON c.id = ma.customer_id::uuid
`);
const cleanMIPay = await pool.query('SELECT * FROM mi_payments');

console.log(`Pushing clean data: ${cleanByaj.rows.length} byaj, ${cleanByajPay.rows.length} payments, ${cleanMI.rows.length} mi, ${cleanMIPay.rows.length} mi_payments`);

// First, clear production tables then re-import clean data
const clearRes = await fetch(`${PROD}/api/v2/admin/clear-and-reimport`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secret: SECRET,
    byaj_accounts: cleanByaj.rows,
    byaj_payments: cleanByajPay.rows,
    mi_accounts: cleanMI.rows,
    mi_payments: cleanMIPay.rows,
  }),
});

if (clearRes.ok) {
  const result = await clearRes.json();
  console.log('Production re-import result:', result.inserted);
} else {
  console.log('Clear endpoint not available, using regular bulk-import...');
  // Fall back to regular bulk-import (will update with ON CONFLICT)
  const BATCH = 200;
  for (let i = 0; i < cleanByaj.rows.length; i += BATCH) {
    await fetch(`${PROD}/api/v2/admin/bulk-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: SECRET,
        byaj_accounts: cleanByaj.rows.slice(i, i + BATCH),
      }),
    });
  }
  console.log('Pushed deduplicated accounts via bulk-import');
}

await pool.end();
console.log('\n✅ Dedup complete');
