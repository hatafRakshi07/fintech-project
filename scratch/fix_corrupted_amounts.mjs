import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== FIXING CORRUPTED COLLECTION AMOUNTS ===");
    await client.query("BEGIN");

    // Fix committee 1 (Sawariya Seth, 3000)
    const r1 = await client.query("UPDATE collections SET amount = 3000.00 WHERE committee_id = 1 AND amount > 5000");
    console.log(`Committee 1 fixed: ${r1.rowCount} rows`);

    // Fix committee 2 (Pyare Mohan, 3000)
    const r2 = await client.query("UPDATE collections SET amount = 3000.00 WHERE committee_id = 2 AND amount > 5000");
    console.log(`Committee 2 fixed: ${r2.rowCount} rows`);

    // Fix committee 3 (Hare Ka Sahara, 2500)
    const r3 = await client.query("UPDATE collections SET amount = 2500.00 WHERE committee_id = 3 AND amount > 5000");
    console.log(`Committee 3 fixed: ${r3.rowCount} rows`);

    // Fix committee 4 (Shree Krishna, 3000)
    const r4 = await client.query("UPDATE collections SET amount = 3000.00 WHERE committee_id = 4 AND amount > 5000");
    console.log(`Committee 4 fixed: ${r4.rowCount} rows`);

    await client.query("COMMIT");

    console.log("\n=== RE-CHECKING TOTAL COLLECTIONS PER BISSI ===");
    const res = await client.query(`
      SELECT c.id, c.name, COUNT(col.id) as count, SUM(col.amount) as total_amount
      FROM committees c
      LEFT JOIN collections col ON c.id = col.committee_id
      GROUP BY c.id, c.name
      ORDER BY c.id
    `);
    res.rows.forEach(r => {
      console.log(`${r.name} (ID ${r.id}): ${r.count} receipts, Total: ₹${Number(r.total_amount).toLocaleString('en-IN')}`);
    });

  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error fixing amounts:", e);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
