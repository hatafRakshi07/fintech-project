import { Router } from "express";
import { db } from "@workspace/db";
import { schemes, memberships, paymentReceipts, paymentItems, tokens } from "@workspace/db";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";

const router = Router();

/**
 * GET /api/v2/dashboard/summary
 * Returns aggregated stats for all ACTIVE schemes based on the selected date range.
 */
router.get("/summary", async (req, res) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    // Get all active schemes
    const activeSchemes = await db
      .select()
      .from(schemes)
      .where(eq(schemes.status, "ACTIVE"));

    const dashboardData = [];

    for (const scheme of activeSchemes) {
      // 1. Total Members in the scheme
      const [membersCount] = await db
        .select({ value: count(memberships.id) })
        .from(memberships)
        .where(eq(memberships.schemeId, scheme.id));

      const dateFilters = [];
      if (startDate) dateFilters.push(gte(paymentReceipts.createdAt, startDate));
      if (endDate) dateFilters.push(lte(paymentReceipts.createdAt, endDate));

      const [collectionQuery] = await db
        .select({
          totalCollected: sql<number>`COALESCE(SUM(${paymentItems.amount}), 0)`,
        })
        .from(paymentItems)
        .innerJoin(paymentReceipts, eq(paymentItems.receiptId, paymentReceipts.id))
        .innerJoin(memberships, eq(sql`${paymentItems.referenceId}::uuid`, memberships.id))
        .where(
          and(
            eq(memberships.schemeId, scheme.id),
            ...dateFilters
          )
        );
      
      const totalCollected = Number(collectionQuery?.totalCollected || 0);

      dashboardData.push({
        schemeId: scheme.id,
        schemeName: scheme.name,
        schemeCode: scheme.code,
        monthlyInstallment: scheme.monthlyInstallment,
        boxes: {
          collectedAmount: totalCollected,
          dueAmount: 0, 
          dueTokens: 0, 
          membersCount: membersCount.value,
        }
      });
    }

    res.json({ success: true, data: dashboardData });
    return;
  } catch (error) {
    console.error("Dashboard Summary Error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch dashboard data" });
    return;
  }
});

export default router;
