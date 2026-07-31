import pg from 'pg';

const { Client } = pg;

async function getDbCounts() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const tables = [
      'customers',
      'committees',
      'committee_months',
      'tokens',
      'installments',
      'draw_events',
      'draw_results',
      'gift_allocations',
      'loans',
      'loan_repayments',
      'import_jobs',
      'import_errors',
      'audit_logs'
    ];

    const results = [];
    for (const tbl of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*)::int FROM ${tbl}`);
        results.push({ table: tbl, count: res.rows[0].count });
      } catch (err) {
        results.push({ table: tbl, count: 0 });
      }
    }

    console.log(JSON.stringify(results, null, 2));

    const committeeCounts = await client.query(`
      SELECT 
        c.name as "committee",
        COUNT(DISTINCT t.id)::int as "tokens",
        COUNT(DISTINCT t.customer_id)::int as "customers",
        COUNT(DISTINCT i.id)::int as "installments"
      FROM committees c
      LEFT JOIN tokens t ON t.committee_id = c.id
      LEFT JOIN committee_months cm ON cm.committee_id = c.id
      LEFT JOIN installments i ON i.committee_month_id = cm.id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY c.created_at ASC
    `);

    console.log('--- COMMITTEE BREAKDOWN ---');
    console.log(JSON.stringify(committeeCounts.rows, null, 2));

  } catch (err) {
    console.error('DB Connection error:', err.message);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

getDbCounts();
