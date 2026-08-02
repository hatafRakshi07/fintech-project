import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function testEndpoint(month) {
  const minMonthRes = await pool.query(`
    SELECT MIN(collected_at) as min_date FROM collections WHERE collected_at IS NOT NULL
  `);
  const minDateRaw = minMonthRes.rows[0]?.min_date;
  const minDate = minDateRaw ? new Date(minDateRaw) : new Date(2024, 0, 1);
  const now = new Date();
  const maxDate = new Date(now.getFullYear() + 1, 11, 1);

  const availableMonths = [];
  let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (curr <= maxDate) {
    const label = curr.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    availableMonths.push(label);
    curr.setMonth(curr.getMonth() + 1);
  }

  const currentMonthLabel = now.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const selectedMonth = month && month !== "all" && month !== "current" ? String(month) : currentMonthLabel;

  const committeesRes = await pool.query(`
    SELECT 
      c.id::text as id,
      c.name as name,
      c.monthly_installment::numeric as "installmentAmount",
      c.total_members::int as "memberLimit",
      c.status::text as status
    FROM committees c
    ORDER BY c.id ASC
  `);

  const getCommMatchClause = (colAlias, commId) => {
    if (commId === '11111111-1111-1111-1111-111111111111' || commId === '1') {
      return `(${colAlias}.committee_id::text IN ('11111111-1111-1111-1111-111111111111', '1'))`;
    }
    if (commId === '22222222-2222-2222-2222-222222222222' || commId === '2') {
      return `(${colAlias}.committee_id::text IN ('22222222-2222-2222-2222-222222222222', '2'))`;
    }
    if (commId === '33333333-3333-3333-3333-333333333333' || commId === '3') {
      return `(${colAlias}.committee_id::text IN ('33333333-3333-3333-3333-333333333333', '3'))`;
    }
    if (commId === 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31' || commId === '4' || commId === '44444444-4444-4444-4444-444444444444') {
      return `(${colAlias}.committee_id::text IN ('a3d68b9c-63df-4884-a5ad-eb8a17e3be31', '44444444-4444-4444-4444-444444444444', '4'))`;
    }
    return `${colAlias}.committee_id::text = '${commId}'`;
  };

  const schemes = [];
  for (const comm of committeesRes.rows) {
    const commId = comm.id;
    const installAmt = Number(comm.installmentAmount || 3000);
    const limit = Number(comm.memberLimit || 500);

    const tokRes = await pool.query(`
      SELECT COUNT(*)::int as count 
      FROM tokens t
      WHERE ${getCommMatchClause('t', commId)}
        AND (t.status::text ILIKE 'active' OR t.status IS NULL)
    `);
    const activeTokensCount = Number(tokRes.rows[0]?.count || limit);
    const monthlyTarget = activeTokensCount * installAmt;

    const colRes = await pool.query(`
      SELECT 
        SUM(amount)::numeric as collected_amount,
        COUNT(id)::int as receipt_count
      FROM collections col
      WHERE ${getCommMatchClause('col', commId)}
        AND (
          TO_CHAR(col.collected_at, 'Mon YYYY') ILIKE $1
          OR TO_CHAR(col.collected_at, 'Mon-YY') ILIKE $1
        )
    `, [selectedMonth]);

    const collectedAmount = Number(colRes.rows[0]?.collected_amount || 0);
    const receiptCount = Number(colRes.rows[0]?.receipt_count || 0);

    let pendingAmount = Math.max(0, monthlyTarget - collectedAmount);
    let pendingTokens = Math.max(0, activeTokensCount - receiptCount);

    schemes.push({
      id: commId,
      name: comm.name,
      selectedMonth,
      activeTokens: activeTokensCount,
      monthlyTarget,
      collectedAmount,
      receiptCount,
      pendingAmount,
      pendingTokens,
    });
  }

  console.log(`--- Result for month: ${selectedMonth} ---`);
  console.log("Total schemes:", schemes.length);
  console.table(schemes);
}

async function run() {
  await testEndpoint("Jul 2026");
  await testEndpoint("Mar 2025");
  await pool.end();
}

run().catch(console.error);
