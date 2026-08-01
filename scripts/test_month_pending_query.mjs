import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testPending(committeeId, monthStr) {
  const client = await pool.connect();
  try {
    const params = [];
    let commCond = "";
    if (committeeId && committeeId !== "all") {
      params.push(parseInt(committeeId, 10));
      commCond = ` AND t.committee_id = $1`;
    }

    let monthCond = "";
    if (monthStr && monthStr !== "all") {
      params.push(`%${monthStr}%`);
      monthCond = ` AND (col.notes ILIKE $${params.length} OR TO_CHAR(col.collected_at, 'Mon-YY') ILIKE $${params.length} OR TO_CHAR(col.collected_at, 'Mon YYYY') ILIKE $${params.length})`;
    } else {
      monthCond = ` AND col.collected_at >= DATE_TRUNC('month', NOW())`;
    }

    const query = `
      SELECT 
        t.token_number as "tokenNumber",
        t.committee_id as "committeeId",
        c.name as "committeeName",
        c.installment_amount as "installmentAmount",
        cust.name as "customerName",
        cust.mobile as "customerMobile",
        cust.address as "customerAddress",
        cust.reference_number as "referenceNumber"
      FROM tokens t
      JOIN committees c ON c.id = t.committee_id
      JOIN customers cust ON cust.id = t.customer_id
      WHERE t.status = 'active' ${commCond}
        AND t.id NOT IN (
          SELECT DISTINCT col.customer_id
          FROM collections col
          WHERE col.committee_id = t.committee_id
            ${monthCond}
            AND col.customer_id IS NOT NULL
        )
      ORDER BY c.id ASC, 
               CASE WHEN t.token_number ~ '^[0-9]+$' THEN CAST(t.token_number AS integer) ELSE 99999 END ASC
      LIMIT 100
    `;

    const res = await client.query(query, params);
    console.log(`Pending Tokens for Committee ${committeeId || 'ALL'}, Month '${monthStr || 'Current'}': ${res.rows.length} pending members found.`);
    if (res.rows.length > 0) {
      console.table(res.rows.slice(0, 5));
    }
  } finally {
    client.release();
  }
}

async function main() {
  await testPending(1, 'Jul-26');
  await testPending(2, 'Apr-25');
  await testPending(3, 'Jun-24');
  await pool.end();
}

main().catch(console.error);
