import pg from 'pg';

const { Client } = pg;

async function checkTokensAndInstallments() {
  const connStr = 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres';
  const client = new Client({ connectionString: connStr });

  try {
    await client.connect();

    // tokens columns
    const tokCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tokens'
      ORDER BY ordinal_position
    `);
    console.log('=== TOKENS TABLE COLUMNS ===');
    console.table(tokCols.rows);

    // installments columns
    const instCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'installments'
      ORDER BY ordinal_position
    `);
    console.log('=== INSTALLMENTS TABLE COLUMNS ===');
    console.table(instCols.rows);

    // customers columns
    const custCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customers'
      ORDER BY ordinal_position
    `);
    console.log('=== CUSTOMERS TABLE COLUMNS ===');
    console.table(custCols.rows);

    // all tables
    const allTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('=== ALL PUBLIC TABLES ===');
    console.table(allTables.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkTokensAndInstallments();
