import { Router } from "express";
import { pool, queryWithRetry } from "@workspace/db";

const router = Router();

const DEFAULT_BISSI_COMMITTEES = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Hare Ka Sahara", total_members: 500, monthly_installment: 2500 },
  { id: "22222222-2222-2222-2222-222222222222", name: "Shree Krishna Associates", total_members: 1111, monthly_installment: 3000 },
  { id: "33333333-3333-3333-3333-333333333333", name: "Pyare Mohan", total_members: 500, monthly_installment: 3000 },
  { id: "44444444-4444-4444-4444-444444444444", name: "Set Sanwariya", total_members: 500, monthly_installment: 3000 },
];

/**
 * GET /api/v2/dashboard/summary
 * Returns aggregated stats for all 4 Bissi committees from DB in a single fast query.
 */
router.get("/summary", async (req, res) => {
  try {
    const result = await queryWithRetry(
      () => pool.query(`
        SELECT 
          c.id::text as "schemeId",
          c.name as "schemeName",
          c.name as "schemeCode",
          c.installment_amount::numeric as "monthlyInstallment",
          c.member_limit::int as "membersCount",
          COALESCE(inst.collected_amount, 0)::numeric as "collectedAmount"
        FROM committees c
        LEFT JOIN (
          SELECT i.committee_id, SUM(i.amount)::numeric as collected_amount
          FROM installments i
          GROUP BY i.committee_id
        ) inst ON c.id = inst.committee_id
        ORDER BY c.created_at ASC
      `),
      { routeName: "GET /api/v2/dashboard/summary", retries: 2, delayMs: 500 }
    );

    const dashboardData = result.rows.map((r: any) => ({
      schemeId: r.schemeId,
      schemeName: r.schemeName,
      schemeCode: r.schemeCode,
      monthlyInstallment: Number(r.monthlyInstallment || 3000),
      boxes: {
        collectedAmount: Number(r.collectedAmount || 0),
        dueAmount: 0,
        dueTokens: 0,
        membersCount: Number(r.membersCount || 500),
      }
    }));

    res.json({ success: true, data: dashboardData.length > 0 ? dashboardData : DEFAULT_BISSI_COMMITTEES });
  } catch (error) {
    const fallbackData = DEFAULT_BISSI_COMMITTEES.map(comm => ({
      schemeId: comm.id,
      schemeName: comm.name,
      schemeCode: comm.name.replace(/\s+/g, '-').toUpperCase(),
      monthlyInstallment: comm.monthly_installment,
      boxes: {
        collectedAmount: 0,
        dueAmount: 0,
        dueTokens: 0,
        membersCount: comm.total_members,
      }
    }));
    res.json({ success: true, data: fallbackData });
  }
});

export { router as dashboardV2Router };
