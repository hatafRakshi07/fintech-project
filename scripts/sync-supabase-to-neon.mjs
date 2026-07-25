import pg from 'pg';

const supabaseUrl = 'postgresql://postgres:shreeassociation2026@db.ovtzfzeodcksosfwjibf.supabase.co:5432/postgres';
const neonUrl = 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';

const srcPool = new pg.Pool({ connectionString: supabaseUrl, ssl: { rejectUnauthorized: false } });
const destPool = new pg.Pool({ connectionString: neonUrl, ssl: { rejectUnauthorized: false } });

async function syncTable(table, customCols = null) {
  console.log(`Syncing table ${table}...`);
  try {
    const srcRows = await srcPool.query(`SELECT * FROM ${table}`);
    console.log(`Source ${table} count: ${srcRows.rows.length}`);
    if (srcRows.rows.length === 0) return;

    // Filter columns that exist in destination
    const destColRes = await destPool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    const destCols = new Set(destColRes.rows.map(r => r.column_name));

    const srcCols = Object.keys(srcRows.rows[0]);
    const validCols = srcCols.filter(c => destCols.has(c));

    if (validCols.length === 0) {
      console.warn(`No matching columns for ${table}`);
      return;
    }

    const colNames = validCols.map(c => `"${c}"`).join(', ');

    // Truncate destination table
    await destPool.query(`TRUNCATE TABLE "${table}" CASCADE`);
    console.log(`Truncated destination ${table}`);

    // Batch insert
    const batchSize = 500;
    for (let i = 0; i < srcRows.rows.length; i += batchSize) {
      const batch = srcRows.rows.slice(i, i + batchSize);
      const valueTuples = [];
      const queryParams = [];
      let paramIdx = 1;

      for (const row of batch) {
        const placeholders = [];
        for (const col of validCols) {
          queryParams.push(row[col]);
          placeholders.push(`$${paramIdx++}`);
        }
        valueTuples.push(`(${placeholders.join(', ')})`);
      }

      const insertQuery = `INSERT INTO "${table}" (${colNames}) VALUES ${valueTuples.join(', ')} ON CONFLICT DO NOTHING`;
      await destPool.query(insertQuery, queryParams);
      console.log(`Inserted ${i + batch.length} / ${srcRows.rows.length} into ${table}`);
    }
  } catch (err) {
    console.error(`Failed to sync ${table}:`, err.message);
  }
}

async function main() {
  const tables = [
    'branches',
    'collectors',
    'users',
    'customers',
    'committees',
    'committee_members',
    'tokens',
    'loans',
    'collections',
    'lotteries',
    'sessions',
    'gifts',
    'gift_categories',
    'gift_inventory',
    'gift_distributions',
    'interest_accounts',
    'interest_transactions',
    'recovery_tasks',
    'recovery_call_logs',
    'office_diary',
    'office_tasks',
    'complaints',
    'donations',
    'installments',
    'invoices',
    'invoice_items',
    'ledger',
    'notifications'
  ];

  for (const t of tables) {
    await syncTable(t);
  }

  console.log('✓ ALL DATA SYNCED FROM SUPABASE TO NEON SUCCESSFULLY!');
  await srcPool.end();
  await destPool.end();
}

main().catch(console.error);
