import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const monthStr = 'Mar 2025';

  const query = `
    WITH month_collections AS (
      SELECT DISTINCT col.customer_id::text as customer_id, col.committee_id::text as committee_id
      FROM collections col
      WHERE TO_CHAR(col.collected_at, 'Mon YYYY') = $1
    )
    SELECT 
      c.id::text as committee_id,
      c.name as committee_name,
      c.monthly_installment::numeric as monthly_installment,
      COUNT(t.id)::int as active_tokens,
      COUNT(mc.customer_id)::int as paid_tokens,
      (COUNT(t.id) - COUNT(mc.customer_id))::int as pending_tokens
    FROM committees c
    JOIN tokens t ON (
      t.committee_id::text = c.id::text 
      OR (t.committee_id::text = '1' AND c.id::text = '11111111-1111-1111-1111-111111111111')
      OR (t.committee_id::text = '2' AND c.id::text = '22222222-2222-2222-2222-222222222222')
      OR (t.committee_id::text = '3' AND c.id::text = '33333333-3333-3333-3333-333333333333')
      OR (t.committee_id::text = '4' AND c.id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31')
    ) AND (t.status::text ILIKE 'active' OR t.status IS NULL)
    LEFT JOIN month_collections mc ON (
      mc.customer_id = t.customer_id::text 
      AND (
        mc.committee_id = c.id::text 
        OR (mc.committee_id = '1' AND c.id::text = '11111111-1111-1111-1111-111111111111')
        OR (mc.committee_id = '2' AND c.id::text = '22222222-2222-2222-2222-222222222222')
        OR (mc.committee_id = '3' AND c.id::text = '33333333-3333-3333-3333-333333333333')
        OR (mc.committee_id = '4' AND c.id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31')
      )
    )
    GROUP BY c.id::text, c.name, c.monthly_installment
    ORDER BY c.id::text ASC;
  `;

  const res = await pool.query(query, [monthStr]);
  console.table(res.rows);
  await pool.end();
}

run().catch(console.error);
