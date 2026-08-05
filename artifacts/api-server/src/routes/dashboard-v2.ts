import { Router } from "express";
import { pool, queryWithRetry } from "@workspace/db";

const router = Router();

// Self-healing: ensure columns exist regardless of which DB schema version is deployed
let schemaEnsured = false;
async function ensureSchema() {
  if (schemaEnsured) return;
  try {
    await pool.query(`
      ALTER TABLE committees ADD COLUMN IF NOT EXISTS code VARCHAR(50);
      ALTER TABLE committees ADD COLUMN IF NOT EXISTS bissi_int_id INTEGER;
      ALTER TABLE committees ADD COLUMN IF NOT EXISTS monthly_installment NUMERIC DEFAULT 3000;
      UPDATE committees SET bissi_int_id = 1, code = 'BISSI-1' WHERE id::text = '11111111-1111-1111-1111-111111111111' AND (bissi_int_id IS NULL OR code IS NULL);
      UPDATE committees SET bissi_int_id = 2, code = 'BISSI-2' WHERE id::text = '22222222-2222-2222-2222-222222222222' AND (bissi_int_id IS NULL OR code IS NULL);
      UPDATE committees SET bissi_int_id = 3, code = 'BISSI-3' WHERE id::text = '33333333-3333-3333-3333-333333333333' AND (bissi_int_id IS NULL OR code IS NULL);
      UPDATE committees SET bissi_int_id = 4, code = 'BISSI-4' WHERE id::text = 'a3d68b9c-63df-4884-a5ad-eb8a17e3be31' AND (bissi_int_id IS NULL OR code IS NULL);

      ALTER TABLE collections ADD COLUMN IF NOT EXISTS committee_uuid UUID;
      ALTER TABLE collections ADD COLUMN IF NOT EXISTS token_uuid UUID;
      ALTER TABLE collections ADD COLUMN IF NOT EXISTS customer_uuid UUID;
      ALTER TABLE gift_distributions ADD COLUMN IF NOT EXISTS committee_uuid UUID;
      ALTER TABLE gift_distributions ADD COLUMN IF NOT EXISTS customer_uuid UUID;
      ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS committee_uuid UUID;
      ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS winner_customer_uuid UUID;
    `);
    schemaEnsured = true;
  } catch (err) {
    console.error("ensureSchema non-fatal notice:", err);
  }
}

// ── Utility: get month filter SQL ──────────────────────────────────────────
function buildMonthFilter(month: string | undefined, colAlias = "c") {
  if (!month || month === "all") return "";
  return `AND DATE_TRUNC('month', ${colAlias}.collected_at) = DATE_TRUNC('month', '${month}-01'::date)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/dashboard/available-months
// Returns all months that have at least one collection, in chronological order
// ─────────────────────────────────────────────────────────────────────────────
router.get("/available-months", async (_req, res) => {
  await ensureSchema();
  try {
    const result = await pool.query(`
      SELECT DISTINCT
        TO_CHAR(DATE_TRUNC('month', collected_at), 'YYYY-MM') as value,
        TO_CHAR(DATE_TRUNC('month', collected_at), 'Mon YYYY') as label
      FROM collections
      WHERE collected_at IS NOT NULL
      ORDER BY value ASC
    `);
    res.json({ success: true, months: result.rows });
  } catch (err: any) {
    res.json({ success: true, months: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/dashboard/summary
// Core dashboard: per-scheme stats, all real from DB
// ─────────────────────────────────────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  const month = (req.query.month as string) || "";
  await ensureSchema();
  try {
    const result = await queryWithRetry(
      () => pool.query(`
        SELECT
          c.id::text                         AS "schemeId",
          c.name                             AS "schemeName",
          c.code                             AS "schemeCode",
          COALESCE(c.monthly_installment, c.installment_amount, 3000)::numeric AS "monthlyInstallment",

          -- Token counts
          COALESCE(tok.active_count, 0)::int AS "activeTokens",
          COALESCE(tok.total_count, 0)::int  AS "totalTokens",

          -- Lucky winners
          COALESCE(lot.lucky_count, 0)::int  AS "luckyTokens",

          -- Lifetime collection
          COALESCE(life.total, 0)::numeric   AS "lifetimeCollection",

          -- Today's collection
          COALESCE(tod.total, 0)::numeric    AS "todayCollection",

          -- Selected month collection
          COALESCE(mon.total, 0)::numeric    AS "monthCollection",
          COALESCE(mon.cnt, 0)::int          AS "monthReceiptCount",

          -- Pending tokens this month (active tokens without a receipt)
          COALESCE(pend.pending_count, 0)::int AS "pendingTokens"

        FROM committees c

        -- Token counts
        LEFT JOIN (
          SELECT committee_id,
            COUNT(*) FILTER (WHERE status = 'ACTIVE')::int  AS active_count,
            COUNT(*)::int                                    AS total_count
          FROM tokens
          GROUP BY committee_id
        ) tok ON tok.committee_id = c.id

        -- Lucky winners
        LEFT JOIN (
          SELECT COALESCE(committee_uuid::text, committee_id::text) AS comm_id, COUNT(*)::int AS lucky_count
          FROM lotteries
          WHERE reward_description ILIKE '%Lucky%' OR status::text ILIKE 'completed' OR status IS NULL
          GROUP BY COALESCE(committee_uuid::text, committee_id::text)
        ) lot ON lot.comm_id = c.id::text

        -- Lifetime totals
        LEFT JOIN (
          SELECT COALESCE(committee_uuid::text, committee_id::text) AS comm_id, SUM(amount)::numeric AS total
          FROM collections
          WHERE COALESCE(committee_uuid::text, committee_id::text) IS NOT NULL
          GROUP BY COALESCE(committee_uuid::text, committee_id::text)
        ) life ON life.comm_id = c.id::text

        -- Today
        LEFT JOIN (
          SELECT COALESCE(committee_uuid::text, committee_id::text) AS comm_id, SUM(amount)::numeric AS total
          FROM collections
          WHERE COALESCE(committee_uuid::text, committee_id::text) IS NOT NULL
            AND DATE(collected_at) = CURRENT_DATE
          GROUP BY COALESCE(committee_uuid::text, committee_id::text)
        ) tod ON tod.comm_id = c.id::text

        -- Selected month (or current month if none selected)
        LEFT JOIN (
          SELECT COALESCE(committee_uuid::text, committee_id::text) AS comm_id, SUM(amount)::numeric AS total, COUNT(*)::int AS cnt
          FROM collections
          WHERE COALESCE(committee_uuid::text, committee_id::text) IS NOT NULL
            ${month
              ? `AND DATE_TRUNC('month', collected_at) = DATE_TRUNC('month', '${month}-01'::date)`
              : `AND DATE_TRUNC('month', collected_at) = DATE_TRUNC('month', CURRENT_DATE)`
            }
          GROUP BY COALESCE(committee_uuid::text, committee_id::text)
        ) mon ON mon.comm_id = c.id::text

        -- Pending: active tokens without a receipt in selected month
        LEFT JOIN (
          SELECT t2.committee_id,
            COUNT(*)::int AS pending_count
          FROM tokens t2
          WHERE t2.status = 'ACTIVE'
            AND NOT EXISTS (
              SELECT 1 FROM collections col
              WHERE (col.token_uuid = t2.id OR col.customer_id = t2.customer_id)
                AND ${month
                  ? `DATE_TRUNC('month', col.collected_at) = DATE_TRUNC('month', '${month}-01'::date)`
                  : `DATE_TRUNC('month', col.collected_at) = DATE_TRUNC('month', CURRENT_DATE)`
                }
            )
          GROUP BY t2.committee_id
        ) pend ON pend.committee_id = c.id

        WHERE c.id::text IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','a3d68b9c-63df-4884-a5ad-eb8a17e3be31')
        ORDER BY c.bissi_int_id ASC NULLS LAST
      `),
      { routeName: "GET /api/v2/dashboard/summary", retries: 2, delayMs: 500 }
    );

    const schemes = result.rows.map((r: any) => {
      const installment = Number(r.monthlyInstallment) || 3000;
      const activeTokens = Number(r.activeTokens) || 0;
      const monthlyTarget = activeTokens * installment;
      const monthCollection = Number(r.monthCollection) || 0;
      const pendingAmount = Math.max(0, monthlyTarget - monthCollection);
      const collectionPct = monthlyTarget > 0
        ? Math.min(100, Math.round((monthCollection / monthlyTarget) * 100))
        : 0;

      return {
        schemeId: r.schemeId,
        schemeName: r.schemeName,
        schemeCode: r.schemeCode,
        monthlyInstallment: installment,
        activeTokens,
        totalTokens: Number(r.totalTokens) || 0,
        luckyTokens: Number(r.luckyTokens) || 0,
        monthlyTarget,
        todayCollection: Number(r.todayCollection) || 0,
        monthCollection,
        monthReceiptCount: Number(r.monthReceiptCount) || 0,
        lifetimeCollection: Number(r.lifetimeCollection) || 0,
        pendingAmount,
        pendingTokens: Number(r.pendingTokens) || 0,
        collectionPercentage: collectionPct,
        remainingCollection: pendingAmount,
      };
    });

    res.json({ success: true, data: schemes, schemes });
  } catch (err: any) {
    console.error("Dashboard summary error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/dashboard/scheme-boxes  (alias — same as summary)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/scheme-boxes", (req, res, next) => {
  req.url = "/summary";
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/dashboard/pending-report
// Tokens without payment in selected month
// ─────────────────────────────────────────────────────────────────────────────
router.get("/pending-report", async (req, res) => {
  const { committeeId, month } = req.query as Record<string, string>;
  await ensureSchema();

  let commFilter = "";
  const params: any[] = [];

  if (committeeId && committeeId !== "all") {
    params.push(committeeId);
    commFilter = `AND t.committee_id = $${params.length}::uuid`;
  }

  const monthSQL = month && month !== "all"
    ? `DATE_TRUNC('month', col.collected_at) = DATE_TRUNC('month', '${month}-01'::date)`
    : `DATE_TRUNC('month', col.collected_at) = DATE_TRUNC('month', CURRENT_DATE)`;

  try {
    const result = await pool.query(`
      SELECT
        t.normalized_token_number AS "tokenNumber",
        t.display_token           AS "displayToken",
        c2.id::text               AS "committeeId",
        c2.name                   AS "committeeName",
        COALESCE(c2.monthly_installment, c2.installment_amount, 3000)::numeric AS "installmentAmount",
        cust.name                 AS "customerName",
        cust.mobile               AS "customerMobile",
        cust.address              AS "customerAddress"
      FROM tokens t
      JOIN committees c2 ON c2.id = t.committee_id
      JOIN customers cust ON cust.id = t.customer_id
      WHERE t.status = 'ACTIVE'
        ${commFilter}
        AND NOT EXISTS (
          SELECT 1 FROM collections col
          WHERE (col.token_uuid = t.id OR col.customer_id = t.customer_id)
            AND ${monthSQL}
        )
      ORDER BY c2.bissi_int_id ASC NULLS LAST,
               t.normalized_token_number ASC
      LIMIT 3000
    `, params);

    res.json({ success: true, pendingList: result.rows, totalPending: result.rows.length });
  } catch (err: any) {
    console.error("Pending report error:", err.message);
    res.json({ success: true, pendingList: [], totalPending: 0 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/dashboard/collection-trend
// Last 30 days daily collection totals
// ─────────────────────────────────────────────────────────────────────────────
router.get("/collection-trend", async (_req, res) => {
  await ensureSchema();
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE(collected_at), 'Mon DD')  AS date,
        DATE(collected_at)                      AS "dateRaw",
        SUM(amount)::numeric                    AS amount,
        COUNT(*)::int                           AS count
      FROM collections
      WHERE collected_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(collected_at)
      ORDER BY DATE(collected_at) ASC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.json([]);
  }
});

export { router as dashboardV2Router };


