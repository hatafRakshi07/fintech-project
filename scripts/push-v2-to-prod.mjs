/**
 * Push V2 data from Neon → Production Render server via bulk-import API.
 * Runs on local machine — reads from Neon, posts to production.
 */
import pg from 'pg';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const NEON = 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb';
const PROD = process.env.PROD_URL || 'https://fintech-project-tlgw.onrender.com';
const SECRET = process.env.IMPORT_SECRET || 'ska-import-2026';
const BATCH = 200; // records per POST

const pool = new pg.Pool({ connectionString: NEON, ssl:{rejectUnauthorized:false}, max:2 });

async function postBatch(path, body) {
  const r = await fetch(`${PROD}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${text.slice(0,200)}`);
  return JSON.parse(text);
}

async function exportTable(table, limit = 10000) {
  const r = await pool.query(`SELECT * FROM ${table} LIMIT ${limit}`);
  console.log(`  Neon ${table}: ${r.rows.length} rows`);
  return r.rows;
}

async function exportByajWithNames() {
  const r = await pool.query(`
    SELECT ba.*, c.name AS customer_name, c.mobile AS customer_mobile
    FROM byaj_accounts ba
    LEFT JOIN customers c ON c.id = ba.customer_id::uuid
    LIMIT 10000
  `);
  console.log(`  Neon byaj_accounts (with names): ${r.rows.length} rows`);
  return r.rows;
}

async function exportMIWithNames() {
  const r = await pool.query(`
    SELECT ma.*, c.name AS customer_name, c.mobile AS customer_mobile
    FROM mi_accounts ma
    LEFT JOIN customers c ON c.id = ma.customer_id::uuid
    LIMIT 10000
  `);
  console.log(`  Neon mi_accounts (with names): ${r.rows.length} rows`);
  return r.rows;
}

async function main() {
  console.log('=== Exporting V2 data from Neon ===');

  const [byaj_accounts, byaj_payments, mi_accounts, mi_payments] = await Promise.all([
    exportByajWithNames(),
    exportTable('byaj_payments', 20000),
    exportMIWithNames(),
    exportTable('mi_payments'),
  ]);

  console.log('\n=== Posting to production in batches ===');

  // Send in batches of BATCH records to avoid payload limits
  let totalInserted = { byaj_accounts: 0, byaj_payments: 0, mi_accounts: 0, mi_payments: 0 };

  for (let i = 0; i < byaj_accounts.length; i += BATCH) {
    const r = await postBatch('/api/v2/admin/bulk-import', {
      secret: SECRET,
      byaj_accounts: byaj_accounts.slice(i, i + BATCH),
      byaj_payments: byaj_payments.slice(i, i + BATCH),
      mi_accounts: mi_accounts.slice(i, i + BATCH),
      mi_payments: mi_payments.slice(i, i + BATCH),
    });
    Object.keys(r.inserted || {}).forEach(k => { totalInserted[k] = (totalInserted[k]||0) + (r.inserted[k]||0); });
    process.stdout.write(`  Batch ${Math.floor(i/BATCH)+1}: byaj_acc=${totalInserted.byaj_accounts}, byaj_pay=${totalInserted.byaj_payments}\r`);
  }

  // Send remaining payments beyond the account count
  const maxBatchIdx = byaj_accounts.length;
  for (let i = maxBatchIdx; i < byaj_payments.length; i += BATCH) {
    const r = await postBatch('/api/v2/admin/bulk-import', {
      secret: SECRET,
      byaj_payments: byaj_payments.slice(i, i + BATCH),
    });
    totalInserted.byaj_payments += r.inserted?.byaj_payments || 0;
    process.stdout.write(`  Extra payments batch ${Math.floor(i/BATCH)+1}: total_pay=${totalInserted.byaj_payments}\r`);
  }

  console.log('\n\n✅ Production import complete!');
  console.log('Total inserted:', totalInserted);

  // Verify on production
  const check = await fetch(`${PROD}/api/interests/accounts`).then(r=>r.json());
  console.log('Production byaj_accounts:', check.total);

  await pool.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
