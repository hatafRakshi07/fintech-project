import { db } from './lib/db/src/index.js';
import {
  collectionsTable, lotteriesTable, committeeMembersTable, tokensTable,
  loansTable, committeesTable, collectorsTable, customersTable, branchesTable
} from './lib/db/src/schema/index.js';

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

for (const { name, table } of tables) {
  const result = await db.delete(table);
  console.log(`Cleared ${name}`);
}

console.log('\n✅ All sample data cleared! Admin user preserved.');
process.exit(0);
