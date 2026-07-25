import { Router, type IRouter } from "express";
import { db, customersTable, branchesTable, collectorsTable, loansTable, committeesTable, collectionsTable } from "@workspace/db";
import { eq, sql, gte, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  try {
    const [customers] = await db.select({ count: sql<number>`count(*)::int` }).from(customersTable).catch(() => [{ count: 0 }]);
    const [branches] = await db.select({ count: sql<number>`count(*)::int` }).from(branchesTable).catch(() => [{ count: 0 }]);
    const [collectors] = await db.select({ count: sql<number>`count(*)::int` }).from(collectorsTable).catch(() => [{ count: 0 }]);
    const [committees] = await db.select({ count: sql<number>`count(*)::int` }).from(committeesTable).where(eq(committeesTable.status, "active")).catch(() => [{ count: 0 }]);
    const [activeLoans] = await db.select({ count: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.status, "active")).catch(() => [{ count: 0 }]);
    const [pendingLoans] = await db.select({ count: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.status, "pending")).catch(() => [{ count: 0 }]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayCol] = await db.select({ sum: sql<string>`coalesce(sum(amount::numeric),0)` }).from(collectionsTable).where(gte(collectionsTable.collectedAt, today)).catch(() => [{ sum: "0" }]);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [monthCol] = await db.select({ sum: sql<string>`coalesce(sum(amount::numeric),0)` }).from(collectionsTable).where(gte(collectionsTable.collectedAt, monthStart)).catch(() => [{ sum: "0" }]);

    const [outstanding] = await db.select({ sum: sql<string>`coalesce(sum((total_amount::numeric - paid_amount::numeric)),0)` }).from(loansTable).where(sql`status in ('active','overdue')`).catch(() => [{ sum: "0" }]);

    res.json({
      totalCustomers: customers?.count ?? 0,
      totalBranches: branches?.count ?? 0,
      totalCollectors: collectors?.count ?? 0,
      todayCollection: parseFloat(todayCol?.sum ?? "0"),
      todayDue: 0,
      totalActiveLoans: activeLoans?.count ?? 0,
      totalActiveCommittees: committees?.count ?? 0,
      totalPendingLoans: pendingLoans?.count ?? 0,
      monthlyCollection: parseFloat(monthCol?.sum ?? "0"),
      outstandingLoanAmount: parseFloat(outstanding?.sum ?? "0"),
    });
  } catch (err) {
    console.error("[DASHBOARD STATS ERROR]", err);
    res.json({
      totalCustomers: 0,
      totalBranches: 0,
      totalCollectors: 0,
      todayCollection: 0,
      todayDue: 0,
      totalActiveLoans: 0,
      totalActiveCommittees: 0,
      totalPendingLoans: 0,
      monthlyCollection: 0,
      outstandingLoanAmount: 0,
    });
  }
});

router.get("/dashboard/collection-trend", async (req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT
        date_trunc('day', collected_at)::date as date,
        coalesce(sum(amount::numeric), 0) as amount,
        count(*)::int as count
      FROM collections
      WHERE collected_at >= now() - interval '30 days'
      GROUP BY date_trunc('day', collected_at)::date
      ORDER BY date asc
    `);
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
    res.json((rows as Array<Record<string, unknown>>).map((r) => ({
      date: r["date"] ? new Date(r["date"] as string).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      amount: parseFloat((r["amount"] ?? 0) as string),
      count: parseInt((r["count"] ?? 0) as string, 10),
    })));
  } catch (err) {
    console.error("[DASHBOARD TREND ERROR]", err);
    res.json([]);
  }
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  try {
    const cols = await db
      .select({ c: collectionsTable, name: customersTable.name })
      .from(collectionsTable)
      .leftJoin(customersTable, eq(collectionsTable.customerId, customersTable.id))
      .orderBy(desc(collectionsTable.createdAt))
      .limit(10)
      .catch(() => []);

    const lns = await db
      .select({ l: loansTable, name: customersTable.name })
      .from(loansTable)
      .leftJoin(customersTable, eq(loansTable.customerId, customersTable.id))
      .orderBy(desc(loansTable.createdAt))
      .limit(5)
      .catch(() => []);

    const activity = [
      ...cols.map((c) => ({
        id: c.c.id,
        type: "payment",
        description: `Payment of ₹${parseFloat(c.c.amount || "0").toLocaleString()} collected via ${c.c.paymentMode || "Cash"}`,
        customerName: c.name || "Customer",
        amount: parseFloat(c.c.amount || "0"),
        createdAt: c.c.createdAt ? c.c.createdAt.toISOString() : new Date().toISOString(),
      })),
      ...lns.map((l) => ({
        id: l.l.id + 100000,
        type: "loan",
        description: `Loan ${l.l.status} — ₹${parseFloat(l.l.principalAmount || "0").toLocaleString()}`,
        customerName: l.name || "Customer",
        amount: parseFloat(l.l.principalAmount || "0"),
        createdAt: l.l.createdAt ? l.l.createdAt.toISOString() : new Date().toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    res.json(activity);
  } catch (err) {
    console.error("[RECENT ACTIVITY ERROR]", err);
    res.json([]);
  }
});

router.get("/dashboard/branch-summary", async (req, res): Promise<void> => {
  try {
    const branches = await db.select().from(branchesTable).catch(() => []);

    const result = await Promise.all(
      branches.map(async (b) => {
        const [custCount] = await db.select({ count: sql<number>`count(*)::int` }).from(customersTable).where(eq(customersTable.branchId, b.id)).catch(() => [{ count: 0 }]);
        const [collCount] = await db.select({ count: sql<number>`count(*)::int` }).from(collectorsTable).where(eq(collectorsTable.branchId, b.id)).catch(() => [{ count: 0 }]);
        const [colTotal] = await db.select({ sum: sql<string>`coalesce(sum(amount::numeric),0)` }).from(collectionsTable).where(eq(collectionsTable.branchId, b.id)).catch(() => [{ sum: "0" }]);
        return {
          branchId: b.id,
          branchName: b.name,
          totalCollection: parseFloat(colTotal?.sum ?? "0"),
          totalCustomers: custCount?.count ?? 0,
          totalCollectors: collCount?.count ?? 0,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error("[BRANCH SUMMARY ERROR]", err);
    res.json([]);
  }
});

export default router;
