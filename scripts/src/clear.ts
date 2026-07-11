/**
 * Clear all sample data from the database.
 * Keeps the admin user. Run with:
 *   DATABASE_URL=... node --import=tsx scripts/src/clear.ts
 * OR via: pnpm --filter @workspace/scripts run clear
 */
import { db } from "@workspace/db";
import {
  collectionsTable,
  lotteriesTable,
  committeeMembersTable,
  tokensTable,
  loansTable,
  committeesTable,
  collectorsTable,
  customersTable,
  branchesTable,
  sessionsTable,
} from "@workspace/db";
import { not, eq } from "drizzle-orm";
import { usersTable } from "@workspace/db";

console.log("\n── Clearing sample data (admin user preserved)\n");

// Must delete in dependency order
const steps = [
  { name: "collections",       fn: () => db.delete(collectionsTable) },
  { name: "lotteries",         fn: () => db.delete(lotteriesTable) },
  { name: "committee_members", fn: () => db.delete(committeeMembersTable) },
  { name: "tokens",            fn: () => db.delete(tokensTable) },
  { name: "loans",             fn: () => db.delete(loansTable) },
  { name: "committees",        fn: () => db.delete(committeesTable) },
  { name: "collectors",        fn: () => db.delete(collectorsTable) },
  { name: "customers",         fn: () => db.delete(customersTable) },
  { name: "branches",          fn: () => db.delete(branchesTable) },
  { name: "sessions",          fn: () => db.delete(sessionsTable) },
  // Delete all non-admin users
  { name: "non-admin users",   fn: () => db.delete(usersTable).where(not(eq(usersTable.username, "admin"))) },
];

for (const step of steps) {
  await step.fn();
  console.log(`  ✔ Cleared ${step.name}`);
}

console.log("\n✅ Done! Database is clean. Login with admin / (your password)\n");
process.exit(0);
