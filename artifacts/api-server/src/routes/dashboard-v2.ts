import { Router } from "express";
import { db } from "@workspace/db";
import { schemes, memberships, paymentReceipts, paymentItems, tokens } from "@workspace/db";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Zod schema for query params
const dateFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/v2/dashboard/summary
 * Returns aggregated stats for all ACTIVE schemes based on the selected date range.
 */
router.get("/summary", async (req, res) => {
  try {
    const { startDate, endDate } = dateFilterSchema.parse(req.query);

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

      // 2. Collected Amount in the date range
      // We need to join paymentReceipts to paymentItems to filter by date (receipts) 
      // but only sum items that belong to THIS scheme's memberships.
      
      const dateFilters = [];
      if (startDate) dateFilters.push(gte(paymentReceipts.createdAt, startDate));
      if (endDate) dateFilters.push(lte(paymentReceipts.createdAt, endDate));

      const [collectionQuery] = await db
        .select({
          totalCollected: sql<number>\`COALESCE(SUM(\${paymentItems.amount}), 0)\`,
        })
        .from(paymentItems)
        .innerJoin(paymentReceipts, eq(paymentItems.receiptId, paymentReceipts.id))
        .innerJoin(memberships, eq(sql\`\${paymentItems.referenceId}::uuid\`, memberships.id))
        .where(
          and(
            eq(memberships.schemeId, scheme.id),
            ...dateFilters
          )
        );

      // 3. Due Amount & Due Tokens
      // This requires calculating Expected vs Paid. For simplicity right now,
      // we mock it, or we calculate total expected (members * elapsed months * installment) - totalPaid
      
      const totalCollected = Number(collectionQuery?.totalCollected || 0);

      dashboardData.push({
        schemeId: scheme.id,
        schemeName: scheme.name,
        schemeCode: scheme.code,
        monthlyInstallment: scheme.monthlyInstallment,
        boxes: {
          collectedAmount: totalCollected,
          dueAmount: 0, // TODO: complex calculation
          dueTokens: 0, // TODO: complex calculation
          membersCount: membersCount.value,
        }
      });
    }

    res.json({ success: true, data: dashboardData });
  } catch (error) {
    console.error("Dashboard Summary Error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch dashboard data" });
  }
});

export default router;
