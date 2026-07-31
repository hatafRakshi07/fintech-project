import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    // Check missing token 311 across all 4 committees
    for (let cId = 1; cId <= 4; cId++) {
      const res = await pool.query("SELECT id, token_number FROM tokens WHERE committee_id = $1 AND token_number = '311'", [cId]);
      console.log(`Committee ID ${cId} has token 311:`, res.rows.length > 0 ? "YES" : "NO");
    }

    // Check which token numbers from 1 to 500 are missing in Committee 3 (Hare Ka Sahara Bissi)
    const res3 = await pool.query("SELECT token_number FROM tokens WHERE committee_id = 3");
    const existingTokens3 = new Set(res3.rows.map(r => parseInt(r.token_number, 10)));
    const missingIn3 = [];
    for (let i = 1; i <= 500; i++) {
      if (!existingTokens3.has(i)) missingIn3.push(i);
    }
    console.log("Missing token numbers in Committee 3 (Hare Ka Sahara Bissi):", missingIn3);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
