import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

async function main() {
  const pg = new PGlite("./pglite-data");
  await pg.waitReady;
  const res = await pg.query("SELECT id, mobile, name, branch_id FROM customers");
  fs.writeFileSync("customers_dump.json", JSON.stringify(res.rows, null, 2));
  console.log(`Dumped ${res.rows.length} customers`);
  await pg.close();
}
main().catch(console.error);
