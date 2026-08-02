import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const selectedMonth = 'Mar 2025';

  const sql = `
    WITH paid_in_month AS (
      SELECT DISTINCT 
        col.customer_id::text as customer_id,
        col.committee_id::text as committee_id
      FROM collections col
      WHERE (
        TO_CHAR(col.collected_at, 'Mon YYYY') ILIKE $1
        OR TO_CHAR(col.collected_at, 'Mon-YY') ILIKE $1
      )
    )
    SELECT 
      t.raw_token_number as "tokenNumber",
      t.committee_id::text as "committeeId",
      c.name as "committeeName",
      c.monthly_installment::numeric as "installmentAmount",
      cust.name as "customerName",
      cust.mobile as "customerMobile",
      cust.address as "customerAddress",
      'UNPAID' as "status"
    FROM tokens t
    JOIN committees c ON (
      t.committee_id::text = c.id::text 
      OR (t.committee_id::text = '1' AND c.id::text = '11111111-1111-1111-1111-111111111111')
      OR (t.committee_id::text = '2' AND c.id::text = '22222222-2222-2222-2222-222222222222')
      OR (t.committee_id::text = '3' AND c.id::text = '33333333-3333-3333-3333-333333333333')
      OR (t.committee_id::text = '4' AND c.id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31')
    )
    JOIN customers cust ON cust.id::text = t.customer_id::text
    LEFT JOIN paid_in_month p ON (
      p.customer_id = cust.id::text
      AND (
        p.committee_id = c.id::text
        OR (p.committee_id = '1' AND c.id::text = '11111111-1111-1111-1111-111111111111')
        OR (p.committee_id = '2' AND c.id::text = '22222222-2222-2222-2222-222222222222')
        OR (p.committee_id = '3' AND c.id::text = '33333333-3333-3333-3333-333333333333')
        OR (p.committee_id = '4' AND c.id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31')
      )
    )
    WHERE (t.status::text ILIKE 'active' OR t.status IS NULL)
      AND p.customer_id IS NULL
    ORDER BY c.id ASC, 
             CASE WHEN t.raw_token_number ~ '^[0-9]+$' THEN CAST(t.raw_token_number AS integer) ELSE 99999 END ASC
    LIMIT 20
  `;

  const result = await pool.query(sql, [selectedMonth]);
  console.log('Sample pending list for Mar 2025:', result.rows.length, 'rows');
  console.table(result.rows.slice(0, 10));
  await pool.end();
}

run().catch(console.error);
