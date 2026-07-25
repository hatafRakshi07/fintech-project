import { db, customersTable } from "@workspace/db";
import { sql, ilike } from "drizzle-orm";

async function main() {
  console.log("Testing Database Customers Query...");
  const total = await db.select({ count: sql`count(*)::int` }).from(customersTable);
  console.log("Total Customers in DB:", total[0].count);

  const sample = await db.select().from(customersTable).limit(5);
  console.log("Sample 5 Customers:", sample.map(c => ({ id: c.id, name: c.name, mobile: c.mobile, ref: c.referenceNumber })));

  if (sample.length > 0) {
    const testMob = sample[0].mobile;
    const testName = sample[0].name;
    console.log(`\nTesting lookup for Mobile: '${testMob}', Name: '${testName}'...`);

    const cleanMobile = testMob ? testMob.replace(/\D/g, "").slice(-10) : "";
    const nameStr = testName ? testName.trim() : "";

    const rows = await db
      .select()
      .from(customersTable)
      .where(sql`${customersTable.mobile} LIKE ${"%" + cleanMobile}`)
      .limit(5);

    console.log("Lookup result count:", rows.length);
    console.log("Matched rows:", rows.map(c => ({ id: c.id, name: c.name, mobile: c.mobile })));
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
