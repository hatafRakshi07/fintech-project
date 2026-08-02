import pg from 'pg';
const { Pool } = pg;
const DATABASE_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const committeeId = "a3d68b9c-63df-4884-a5ad-eb8a17e3be31";
    const month = "Jul 2026";

    let commFilter = "";
    const params = [];

    if (committeeId && committeeId !== "all") {
      params.push(String(committeeId));
      commFilter = `AND (
        t.committee_id::text = $1 
        OR (c.id::text = $1)
        OR ($1 = '1' AND (c.name ILIKE '%Sawariya%' OR c.id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31'))
        OR ($1 = '2' AND (c.name ILIKE '%Pyare%' OR c.id::text = '33333333-3333-3333-3333-333333333333'))
        OR ($1 = '3' AND (c.name ILIKE '%Hare%' OR c.id::text = '11111111-1111-1111-1111-111111111111'))
        OR ($1 = '4' AND (c.name ILIKE '%Krishna%' OR c.id::text = '22222222-2222-2222-2222-222222222222'))
      )`;
    }

    let monthPattern = "";
    if (month && month !== "all") {
      const mMatch = String(month).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
      if (mMatch) {
        monthPattern = `%${mMatch[1]}%`;
      } else {
        monthPattern = `%${month}%`;
      }
    }

    let monthParamIdx = 0;
    if (monthPattern) {
      params.push(monthPattern);
      monthParamIdx = params.length;
    }

    const paidSubquery = monthParamIdx > 0
      ? `AND (TO_CHAR(col.collected_at, 'Mon-YY') ILIKE $${monthParamIdx} OR TO_CHAR(col.collected_at, 'Mon YYYY') ILIKE $${monthParamIdx} OR TO_CHAR(col.collected_at, 'Mon') ILIKE $${monthParamIdx})`
      : `AND col.collected_at >= DATE_TRUNC('month', NOW())`;

    const sql = `
      WITH paid AS (
        SELECT DISTINCT col.customer_id::text as customer_id, col.committee_id::text as committee_id
        FROM collections col
        WHERE col.customer_id IS NOT NULL ${paidSubquery}
      )
      SELECT 
        t.raw_token_number as "tokenNumber",
        t.committee_id::text as "committeeId",
        c.name as "committeeName",
        c.monthly_installment as "installmentAmount",
        cust.name as "customerName",
        cust.mobile as "customerMobile",
        cust.address as "customerAddress",
        NULL as "referenceNumber"
      FROM tokens t
      JOIN committees c ON c.id::text = t.committee_id::text
      JOIN customers cust ON cust.id::text = t.customer_id::text
      LEFT JOIN paid p ON (p.customer_id = cust.id::text OR p.customer_id = t.customer_id::text)
      WHERE (t.status::text ILIKE 'active' OR t.status IS NULL)
        ${commFilter}
        AND p.customer_id IS NULL
      ORDER BY c.id ASC, 
               CASE WHEN t.raw_token_number ~ '^[0-9]+$' THEN CAST(t.raw_token_number AS integer) ELSE 99999 END ASC
      LIMIT 3000
    `;

    const res = await pool.query(sql, params);
    console.log(`Pending members count for ${committeeId} (${month}):`, res.rows.length);
    console.log("Sample pending members:", res.rows.slice(0, 3));
  } catch (err) {
    console.error("Query Error:", err);
  } finally {
    await pool.end();
  }
}

main();
