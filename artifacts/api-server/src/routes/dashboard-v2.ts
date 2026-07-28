import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

/**
 * GET /api/v2/dashboard/summary
 * Returns aggregated stats for all 4 Bissi committees from Neon DB.
 */
router.get("/summary", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, type, installment_amount, member_limit, status FROM committees ORDER BY id ASC");
    
    const dashboardData = [];

    for (const comm of result.rows) {
      const commId = comm.id;
      
      const [tokenRes, colRes] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM tokens WHERE committee_id = $1", [commId]),
        pool.query(`
          SELECT COALESCE(SUM(c.amount), 0) as total
          FROM collections c
          JOIN tokens t ON t.customer_id = c.customer_id
          WHERE t.committee_id = $1
        `, [commId])
      ]);

      const memberCount = parseInt(tokenRes.rows[0].count, 10) || comm.member_limit || 500;
      const collectedAmount = Number(colRes.rows[0].total) || 0;

      dashboardData.push({
        schemeId: comm.id,
        schemeName: comm.name,
        schemeCode: `BISSI-${comm.id}`,
        monthlyInstallment: Number(comm.installment_amount),
        boxes: {
          collectedAmount,
          dueAmount: 0, 
          dueTokens: 0, 
          membersCount: comm.member_limit || memberCount,
        }
      });
    }

    res.json({ success: true, data: dashboardData });
  } catch (error) {
    console.error("Dashboard Summary Error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch dashboard data", data: [] });
  }
});

export { router as dashboardV2Router };
