import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- Testing pending query ---");
    const q1 = await client.query(`
      SELECT 
        cm.committee_id,
        COUNT(*)::int as pending_count,
        (COUNT(*) * c2.installment_amount)::numeric as pending_amount
      FROM committee_members cm
      JOIN committees c2 ON c2.id = cm.committee_id
      WHERE cm.customer_id NOT IN (
        SELECT DISTINCT col.customer_id
        FROM collections col
        WHERE col.committee_id = cm.committee_id
          AND col.collected_at >= DATE_TRUNC('month', NOW())
          AND col.customer_id IS NOT NULL
      )
      GROUP BY cm.committee_id, c2.installment_amount
    `);
    console.log("q1 result:", q1.rows);

    console.log("\n--- Checking latest collection dates per committee ---");
    const q2 = await client.query(`
      SELECT committee_id, MAX(collected_at), MIN(collected_at), COUNT(*)
      FROM collections
      WHERE committee_id IS NOT NULL
      GROUP BY committee_id
      ORDER BY committee_id
    `);
    console.log("q2 result:", q2.rows);

    console.log("\n--- Checking total pool vs collected per committee ---");
    const q3 = await client.query(`
      SELECT 
        c.id, 
        c.name, 
        c.member_limit, 
        c.installment_amount,
        (c.member_limit * c.installment_amount) as monthly_pool
      FROM committees c
      ORDER BY c.id
    `);
    console.log("q3 result:", q3.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
main();
