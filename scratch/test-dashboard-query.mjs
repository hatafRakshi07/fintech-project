import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const query = `
    SELECT 
      c.id::text as committee_id,
      c.name,
      c.monthly_installment,
      TO_CHAR(col.collected_at, 'Mon YYYY') as month,
      SUM(col.amount) as total_amount,
      COUNT(col.id) as receipt_count
    FROM committees c
    JOIN collections col ON (
      col.committee_id::text = c.id::text 
      OR (col.committee_id::text = '1' AND c.id::text = '11111111-1111-1111-1111-111111111111')
      OR (col.committee_id::text = '2' AND c.id::text = '22222222-2222-2222-2222-222222222222')
      OR (col.committee_id::text = '3' AND c.id::text = '33333333-3333-3333-3333-333333333333')
      OR (col.committee_id::text = '4' AND c.id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31')
    )
    GROUP BY c.id::text, c.name, c.monthly_installment, TO_CHAR(col.collected_at, 'Mon YYYY'), DATE_TRUNC('month', col.collected_at)
    ORDER BY DATE_TRUNC('month', col.collected_at) DESC, c.id::text ASC
    LIMIT 30;
  `;

  const res = await pool.query(query);
  console.table(res.rows);
  await pool.end();
}

run().catch(console.error);
