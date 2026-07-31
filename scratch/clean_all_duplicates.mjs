import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== CLEANING DATABASE DUPLICATES ===");
    await client.query("BEGIN");

    // 1. Deduplicate committee_members
    console.log("Deduplicating committee_members...");
    const cmBefore = await client.query("SELECT COUNT(*) FROM committee_members");
    await client.query(`
      DELETE FROM committee_members
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM committee_members
        GROUP BY committee_id, token_number
      )
    `);
    const cmAfter = await client.query("SELECT COUNT(*) FROM committee_members");
    console.log(`committee_members: ${cmBefore.rows[0].count} -> ${cmAfter.rows[0].count}`);

    // Delete tokens with non-numeric or token_number > memberLimit
    await client.query("DELETE FROM committee_members WHERE token_number !~ '^[0-9]+$'");
    await client.query("DELETE FROM committee_members WHERE committee_id IN (1,2,3) AND CAST(token_number AS integer) > 500");
    await client.query("DELETE FROM committee_members WHERE committee_id = 4 AND CAST(token_number AS integer) > 1111");

    // 2. Deduplicate tokens
    console.log("Deduplicating tokens...");
    const tokBefore = await client.query("SELECT COUNT(*) FROM tokens");
    await client.query(`
      DELETE FROM tokens
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM tokens
        GROUP BY committee_id, token_number
      )
    `);
    const tokAfter = await client.query("SELECT COUNT(*) FROM tokens");
    console.log(`tokens: ${tokBefore.rows[0].count} -> ${tokAfter.rows[0].count}`);

    await client.query("DELETE FROM tokens WHERE token_number !~ '^[0-9]+$'");
    await client.query("DELETE FROM tokens WHERE committee_id IN (1,2,3) AND CAST(token_number AS integer) > 500");
    await client.query("DELETE FROM tokens WHERE committee_id = 4 AND CAST(token_number AS integer) > 1111");

    // 3. Deduplicate collections
    console.log("Deduplicating collections...");
    const colBefore = await client.query("SELECT COUNT(*) FROM collections");
    await client.query(`
      DELETE FROM collections
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM collections
        GROUP BY committee_id, customer_id, collected_at, amount, COALESCE(notes, '')
      )
    `);
    const colAfter = await client.query("SELECT COUNT(*) FROM collections");
    console.log(`collections: ${colBefore.rows[0].count} -> ${colAfter.rows[0].count}`);

    await client.query("COMMIT");
    console.log("\n=== DEDUPLICATION COMPLETE ===");

    // Verify stats
    const cmStats = await client.query("SELECT committee_id, COUNT(*) FROM committee_members GROUP BY committee_id ORDER BY committee_id");
    console.log("\nTokens per committee (committee_members):");
    console.log(cmStats.rows);

    const colStats = await client.query("SELECT committee_id, COUNT(*), SUM(amount) FROM collections GROUP BY committee_id ORDER BY committee_id");
    console.log("\nCollections per committee:");
    console.log(colStats.rows);

  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error cleaning DB:", e);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
