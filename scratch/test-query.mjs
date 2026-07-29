import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("1. Testing committees + committee_members query...");
    const q = `
      SELECT 
        c.id,
        c.name,
        c.type::text as type,
        c.installment_amount,
        c.member_limit,
        c.status::text as status,
        COALESCE(sub.member_count, 0)::int as "currentMembers"
      FROM committees c
      LEFT JOIN (
        SELECT committee_id, COUNT(*)::int as member_count 
        FROM committee_members 
        GROUP BY committee_id
      ) sub ON c.id = sub.committee_id
      ORDER BY c.id ASC
    `;
    const res = await pool.query(q);
    console.log("Success! Rows:", res.rows);
  } catch (err) {
    console.error("Query Error:", err.message);
  }

  try {
    console.log("2. Checking tables in database...");
    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema='public'
    `);
    console.log("Tables:", tablesRes.rows.map(r => r.table_name));
  } catch (err) {
    console.error("Tables list error:", err.message);
  }

  await pool.end();
}

run();
