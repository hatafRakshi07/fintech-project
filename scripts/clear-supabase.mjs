import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../lib/db/src/schema/index.ts';

const {
  collectionsTable, lotteriesTable, committeeMembersTable, tokensTable,
  loansTable, committeesTable, collectorsTable, customersTable, branchesTable
} = schema;

const url = 'postgresql://postgres:shreeassociation2026@db.ovtzfzeodcksosfwjibf.supabase.co:5432/postgres';

const pool = new pg.Pool({
  connectionString: url,
  options: "-c search_path=public",
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool);

const tables = [
  { name: 'collections', table: collectionsTable },
  { name: 'lotteries', table: lotteriesTable },
  { name: 'committee_members', table: committeeMembersTable },
  { name: 'tokens', table: tokensTable },
  { name: 'loans', table: loansTable },
  { name: 'committees', table: committeesTable },
  { name: 'collectors', table: collectorsTable },
  { name: 'customers', table: customersTable },
  { name: 'branches', table: branchesTable },
];

async function clearData() {
  console.log('Connecting to Supabase...');
  try {
    const res = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    const tableNames = res.rows.map(row => `"${row.tablename}"`);
    
    if (tableNames.length > 0) {
      const truncateQuery = `TRUNCATE TABLE ${tableNames.join(', ')} CASCADE;`;
      await pool.query(truncateQuery);
      console.log(`Successfully truncated tables: ${tableNames.join(', ')}`);
    } else {
      console.log('No tables found in the public schema.');
    }
  } catch (err) {
    console.error(`Failed to truncate tables: ${err.message}`);
  }

  console.log('\n✅ All data cleared from Supabase!');
  await pool.end();
}

clearData().catch(console.error);
