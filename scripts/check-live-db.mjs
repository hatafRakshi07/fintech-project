import pg from "pg";
const { Pool } = pg;

async function check(url, label) {
  console.log(`\nChecking ${label}...`);
  console.log(`URL: ${url.replace(/:[^:@]+@/, ":***@")}`);
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT count(*) FROM customers");
    console.log(`✅ ${label} Total Customers:`, res.rows[0].count);

    const comms = await pool.query("SELECT count(*) FROM committees");
    console.log(`✅ ${label} Total Committees:`, comms.rows[0].count);

    const tokens = await pool.query("SELECT count(*) FROM tokens");
    console.log(`✅ ${label} Total Tokens:`, tokens.rows[0].count);
  } catch (err) {
    console.error(`❌ ${label} Query Failed:`, err.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  const neon = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";
  const supabasePooler = "postgresql://postgres.ovtzfzeodcksosfwjibf:BissiAssociation2026@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require";

  await check(neon, "NEON DB");
  await check(supabasePooler, "SUPABASE POOLER DB");
}

main();
