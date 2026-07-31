import pg from 'pg';

const { Client } = pg;

async function introspectCommittees() {
  const connStr = 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres';
  const client = new Client({ connectionString: connStr });

  try {
    await client.connect();
    console.log('Connected to production database.');

    // 1. Get ACTUAL columns on committees table
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'committees'
      ORDER BY ordinal_position
    `);
    console.log('\n=== ACTUAL COLUMNS ON committees TABLE IN LIVE DB ===');
    console.table(colsRes.rows);

    // 2. Row count
    const countRes = await client.query('SELECT COUNT(*)::int as count FROM committees');
    console.log('\n=== COMMITTEE ROW COUNT ===');
    console.log('Total rows:', countRes.rows[0].count);

    // 3. Sample rows
    const sampleRes = await client.query('SELECT * FROM committees LIMIT 5');
    console.log('\n=== SAMPLE ROWS ===');
    console.log(JSON.stringify(sampleRes.rows, null, 2));

    // 4. Check for DELETE/UPDATE triggers or functions
    const trigRes = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'committees'
    `);
    console.log('\n=== TRIGGERS ON committees TABLE ===');
    console.table(trigRes.rows);

    // 5. Check other table counts for data-loss audit
    const tables = ['customers', 'tokens', 'installments', 'committee_months'];
    for (const t of tables) {
      try {
        const r = await client.query(`SELECT COUNT(*)::int as count FROM ${t}`);
        console.log(`${t}: ${r.rows[0].count} rows`);
      } catch (e) {
        console.log(`${t}: TABLE DOES NOT EXIST`);
      }
    }

  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

introspectCommittees();
