import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    console.log("Creating database performance indexes...");
    const t0 = Date.now();

    await pool.query("CREATE INDEX IF NOT EXISTS idx_collections_collected_at ON collections(collected_at)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_collections_committee_id ON collections(committee_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_collections_customer_id ON collections(customer_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_installments_committee_id ON installments(committee_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_installments_customer_id ON installments(customer_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_tokens_committee_id ON tokens(committee_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_committee_members_committee_id ON committee_members(committee_id)");

    console.log(`Performance indexes created in ${Date.now() - t0}ms!`);
  } catch (err) {
    console.error("Error creating indexes:", err.message);
  } finally {
    await pool.end();
  }
}

main();
