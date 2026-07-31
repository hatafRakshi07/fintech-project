import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    const resTokens = await pool.query("SELECT committee_id, count(*)::int as count FROM tokens GROUP BY committee_id ORDER BY committee_id");
    console.log("Token counts per committee:", resTokens.rows);

    const resHare = await pool.query("SELECT id, name, member_limit, installment_amount FROM committees WHERE id = 3");
    console.log("Hare Ka Sahara Bissi DB Row:", resHare.rows[0]);

    const resGifts = await pool.query("SELECT count(*)::int as count FROM lotteries");
    console.log("Total Lotteries/Gifts in DB:", resGifts.rows[0].count);
  } catch (err) {
    console.error("Node DB Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
