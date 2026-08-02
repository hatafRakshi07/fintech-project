import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const monthStr = 'Mar 2025';

  const query = `
    SELECT 
      c.id::text as scheme_id,
      c.name as scheme_name,
      c.monthly_installment::numeric as monthly_installment,
      COALESCE(tok_active.active_tokens, c.total_members, 500)::int as active_tokens,
      (COALESCE(tok_active.active_tokens, c.total_members, 500) * c.monthly_installment)::numeric as monthly_target,
      COALESCE(col_month.collected_amount, 0)::numeric as collected_amount,
      COALESCE(col_month.receipt_count, 0)::int as receipt_count,
      ((COALESCE(tok_active.active_tokens, c.total_members, 500) * c.monthly_installment) - COALESCE(col_month.collected_amount, 0))::numeric as pending_amount,
      GREATEST(0, (COALESCE(tok_active.active_tokens, c.total_members, 500) - COALESCE(col_month.receipt_count, 0)))::int as pending_tokens
    FROM committees c
    LEFT JOIN (
      SELECT 
        t.committee_id::text as committee_id,
        COUNT(t.id)::int as active_tokens
      FROM tokens t
      WHERE t.status::text ILIKE 'active' OR t.status IS NULL
      GROUP BY t.committee_id::text
    ) tok_active ON (
      tok_active.committee_id = c.id::text
      OR (tok_active.committee_id = '1' AND c.id::text = '11111111-1111-1111-1111-111111111111')
      OR (tok_active.committee_id = '2' AND c.id::text = '22222222-2222-2222-2222-222222222222')
      OR (tok_active.committee_id = '3' AND c.id::text = '33333333-3333-3333-3333-333333333333')
      OR (tok_active.committee_id = '4' AND c.id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31')
    )
    LEFT JOIN (
      SELECT 
        col.committee_id::text as committee_id,
        SUM(col.amount)::numeric as collected_amount,
        COUNT(col.id)::int as receipt_count
      FROM collections col
      WHERE TO_CHAR(col.collected_at, 'Mon YYYY') = $1
      GROUP BY col.committee_id::text
    ) col_month ON (
      col_month.committee_id = c.id::text
      OR (col_month.committee_id = '1' AND c.id::text = '11111111-1111-1111-1111-111111111111')
      OR (col_month.committee_id = '2' AND c.id::text = '22222222-2222-2222-2222-222222222222')
      OR (col_month.committee_id = '3' AND c.id::text = '33333333-3333-3333-3333-333333333333')
      OR (col_month.committee_id = '4' AND c.id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31')
    )
    ORDER BY c.id::text ASC;
  `;

  const res = await pool.query(query, [monthStr]);
  console.table(res.rows);
  await pool.end();
}

run().catch(console.error);
