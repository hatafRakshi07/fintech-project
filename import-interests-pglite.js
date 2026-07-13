import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

async function main() {
  const pg = new PGlite("./pglite-data");
  await pg.waitReady;
  
  console.log("Reading interests_dump.json...");
  const accounts = JSON.parse(fs.readFileSync("interests_dump.json", "utf8"));
  console.log(`Found ${accounts.length} accounts to import.`);
  
  // Clear existing interest accounts first to avoid duplicates
  await pg.query("DELETE FROM interest_accounts");
  console.log("Cleared existing interest accounts.");
  
  // Insert accounts
  let count = 0;
  for (const a of accounts) {
    await pg.query(
      `INSERT INTO interest_accounts (
        customer_id, principal_amount, interest_rate, start_date, 
        monthly_interest, total_interest_paid, pending_interest, 
        status, branch_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        a.customerId, a.principalAmount, a.interestRate, a.startDate,
        a.monthlyInterest, a.totalInterestPaid, a.pendingInterest,
        a.status, a.branchId, a.notes
      ]
    );
    count++;
  }
  console.log(`Successfully imported ${count} interest accounts!`);
  await pg.close();
}
main().catch(console.error);
