import pg from 'pg';
const { Pool } = pg;
const DATABASE_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function isFutureMonth(monthStr) {
  if (!monthStr || monthStr === "all") return false;
  const parts = monthStr.split(/[\s-]+/);
  if (parts.length < 2) return false;
  const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const mIdx = monthNames.findIndex(m => parts[0].toLowerCase().startsWith(m));
  let year = parseInt(parts[1], 10);
  if (year < 100) year += 2000;
  if (mIdx === -1 || isNaN(year)) return false;

  const targetDate = new Date(year, mIdx, 1);
  const now = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return targetDate > curStart;
}

async function getSchemeBoxes(selectedMonth) {
  const result = await pool.query(`
    SELECT 
      c.id::text as "id",
      c.name as "name",
      c.monthly_installment::numeric as "installmentAmount",
      c.total_members::int as "memberLimit",
      c.status::text as "status",
      GREATEST(COALESCE(cm_sub.token_count, 0), COALESCE(tok_sub.token_count, 0))::int as "filledTokens",
      COALESCE(col_sub.collected_amount, 0)::numeric as "collectedAmount",
      COALESCE(col_sub.collected_count, 0)::int as "collectedCount",
      COALESCE(lot_sub.winners_count, 0)::int as "winnersCount"
    FROM committees c
    LEFT JOIN (
      SELECT committee_id::text as committee_id, COUNT(*)::int as token_count
      FROM committee_members
      GROUP BY committee_id::text
    ) cm_sub ON c.id::text = cm_sub.committee_id
    LEFT JOIN (
      SELECT committee_id::text as committee_id, COUNT(*)::int as token_count
      FROM tokens
      WHERE committee_id IS NOT NULL
      GROUP BY committee_id::text
    ) tok_sub ON c.id::text = tok_sub.committee_id
    LEFT JOIN (
      SELECT 
        committee_id::text as committee_id,
        SUM(amount)::numeric as collected_amount, 
        COUNT(id)::int as collected_count
      FROM collections
      WHERE committee_id IS NOT NULL
      GROUP BY committee_id::text
    ) col_sub ON c.id::text = col_sub.committee_id
    LEFT JOIN (
      SELECT committee_id::text as committee_id, COUNT(*)::int as winners_count
      FROM lotteries
      WHERE status = 'completed' AND winner_id IS NOT NULL
      GROUP BY committee_id::text
    ) lot_sub ON c.id::text = lot_sub.committee_id
    ORDER BY c.id ASC
  `);

  // Monthly collections breakdown
  const monthlyRes = await pool.query(`
    SELECT 
      committee_id::text as "committeeId",
      TO_CHAR(collected_at, 'Mon YYYY') as "month",
      DATE_TRUNC('month', collected_at) as "monthDate",
      SUM(amount)::numeric as "amount",
      COUNT(*)::int as "count"
    FROM collections
    WHERE committee_id IS NOT NULL
    GROUP BY committee_id::text, TO_CHAR(collected_at, 'Mon YYYY'), DATE_TRUNC('month', collected_at)
    ORDER BY DATE_TRUNC('month', collected_at) DESC
  `);

  const monthlyMap = {};
  for (const r of monthlyRes.rows) {
    if (!monthlyMap[r.committeeId]) monthlyMap[r.committeeId] = [];
    monthlyMap[r.committeeId].push({ month: r.month, amount: Number(r.amount), count: r.count });
  }

  // Pending for selected month
  const isFuture = isFutureMonth(selectedMonth);
  let monthPattern = "";
  if (selectedMonth && selectedMonth !== "all") {
    const mMatch = String(selectedMonth).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
    if (mMatch) monthPattern = `%${mMatch[1]}%`;
    else monthPattern = `%${selectedMonth}%`;
  }

  const paidSubquery = monthPattern
    ? `AND (TO_CHAR(col.collected_at, 'Mon-YY') ILIKE $1 OR TO_CHAR(col.collected_at, 'Mon YYYY') ILIKE $1 OR TO_CHAR(col.collected_at, 'Mon') ILIKE $1)`
    : `AND col.collected_at >= DATE_TRUNC('month', NOW())`;

  const pendingTokensRes = await pool.query(`
    WITH paid_this_month AS (
      SELECT DISTINCT col.customer_id::text as customer_id, col.committee_id::text as committee_id
      FROM collections col
      WHERE col.customer_id IS NOT NULL ${paidSubquery}
    )
    SELECT 
      t.committee_id::text as committee_id,
      COUNT(*)::int as pending_count,
      (COUNT(*) * c2.monthly_installment)::numeric as pending_amount
    FROM tokens t
    JOIN committees c2 ON c2.id::text = t.committee_id::text
    LEFT JOIN paid_this_month p ON (p.customer_id = t.customer_id::text OR p.committee_id = t.committee_id::text)
    WHERE p.customer_id IS NULL AND (t.status::text ILIKE 'active' OR t.status IS NULL)
    GROUP BY t.committee_id::text, c2.monthly_installment
  `, monthPattern ? [monthPattern] : []);

  const pendingMap = {};
  for (const r of pendingTokensRes.rows) {
    pendingMap[r.committee_id] = { pendingCount: Number(r.pending_count), pendingAmount: Number(r.pending_amount || 0) };
  }

  // Collections for selected month specifically
  const selectedMonthCollectionsRes = await pool.query(`
    SELECT 
      committee_id::text as committee_id,
      SUM(amount)::numeric as amount,
      COUNT(*)::int as count
    FROM collections
    WHERE committee_id IS NOT NULL
      ${monthPattern ? `AND (TO_CHAR(collected_at, 'Mon-YY') ILIKE $1 OR TO_CHAR(collected_at, 'Mon YYYY') ILIKE $1 OR TO_CHAR(collected_at, 'Mon') ILIKE $1)` : `AND collected_at >= DATE_TRUNC('month', NOW())`}
    GROUP BY committee_id::text
  `, monthPattern ? [monthPattern] : []);

  const monthColMap = {};
  for (const r of selectedMonthCollectionsRes.rows) {
    monthColMap[r.committee_id] = { amount: Number(r.amount || 0), count: Number(r.count || 0) };
  }

  const formatted = result.rows.map(r => {
    const limit = Number(r.memberLimit || 500);
    const filled = Number(r.filledTokens || 0);
    const installAmt = Number(r.installmentAmount || 3000);
    const monthlyPool = limit * installAmt;
    const mbList = monthlyMap[r.id] || [];

    const mCol = monthColMap[r.id] || { amount: 0, count: 0 };
    const pm = pendingMap[r.id] || { pendingCount: 0, pendingAmount: 0 };

    let pendingCount = pm.pendingCount;
    let pendingAmt = pm.pendingAmount;

    if (isFuture && mCol.amount === 0) {
      pendingCount = 0;
      pendingAmt = 0;
    }

    return {
      ...r,
      installmentAmount: installAmt,
      monthlyPool: monthlyPool,
      selectedMonth: selectedMonth || "Current Month",
      thisMonthCollected: mCol.amount,
      thisMonthReceipts: mCol.count,
      thisMonthPendingCount: pendingCount,
      dueAmount: pendingAmt,
      isFutureMonth: isFuture,
      lifetimeCollectedAmount: Number(r.collectedAmount || 0),
      filledTokens: filled,
      monthlyBreakdown: mbList,
    };
  });

  return formatted;
}

async function main() {
  try {
    console.log("=== Jul 2026 Scheme Boxes ===");
    const jul = await getSchemeBoxes("Jul 2026");
    console.log(jul.map(s => ({ name: s.name, collected: s.thisMonthCollected, receipts: s.thisMonthReceipts, pending: s.thisMonthPendingCount, due: s.dueAmount, isFuture: s.isFutureMonth })));

    console.log("\n=== Dec 2027 (Future Month) Scheme Boxes ===");
    const dec27 = await getSchemeBoxes("Dec 2027");
    console.log(dec27.map(s => ({ name: s.name, collected: s.thisMonthCollected, receipts: s.thisMonthReceipts, pending: s.thisMonthPendingCount, due: s.dueAmount, isFuture: s.isFutureMonth })));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
