import { Router, type IRouter } from "express";
import { db, customersTable, branchesTable, collectorsTable, loansTable, committeesTable, collectionsTable } from "@workspace/db";
import { eq, sql, gte, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [customers] = await db.select({ count: sql<number>`count(*)::int` }).from(customersTable);
  const [branches] = await db.select({ count: sql<number>`count(*)::int` }).from(branchesTable);
  const [collectors] = await db.select({ count: sql<number>`count(*)::int` }).from(collectorsTable);
  const [committees] = await db.select({ count: sql<number>`count(*)::int` }).from(committeesTable).where(eq(committeesTable.status, "active"));
  const [activeLoans] = await db.select({ count: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.status, "active"));
  const [pendingLoans] = await db.select({ count: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.status, "pending"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayCol] = await db.select({ sum: sql<string>`coalesce(sum(amount::numeric),0)` }).from(collectionsTable).where(gte(collectionsTable.collectedAt, today));

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [monthCol] = await db.select({ sum: sql<string>`coalesce(sum(amount::numeric),0)` }).from(collectionsTable).where(gte(collectionsTable.collectedAt, monthStart));

  const [outstanding] = await db.select({ sum: sql<string>`coalesce(sum((total_amount::numeric - paid_amount::numeric)),0)` }).from(loansTable).where(sql`status in ('active','overdue')`);

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
});

router.get("/dashboard/collection-trend", async (req, res): Promise<void> => {
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
    date: new Date(r["date"] as string).toISOString().split("T")[0],
    amount: parseFloat(r["amount"] as string),
    count: parseInt(r["count"] as string, 10),
  })));
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const cols = await db
    .select({ c: collectionsTable, name: customersTable.name })
    .from(collectionsTable)
    .leftJoin(customersTable, eq(collectionsTable.customerId, customersTable.id))
    .orderBy(collectionsTable.createdAt)
    .limit(10);

  const lns = await db
    .select({ l: loansTable, name: customersTable.name })
    .from(loansTable)
    .leftJoin(customersTable, eq(loansTable.customerId, customersTable.id))
    .orderBy(loansTable.createdAt)
    .limit(5);

  const activity = [
    ...cols.map((c) => ({
      id: c.c.id,
      type: "payment",
      description: `Payment of ₹${parseFloat(c.c.amount).toLocaleString()} collected via ${c.c.paymentMode}`,
      customerName: c.name,
      amount: parseFloat(c.c.amount),
      createdAt: c.c.createdAt.toISOString(),
    })),
    ...lns.map((l) => ({
      id: l.l.id + 100000,
      type: "loan",
      description: `Loan ${l.l.status} — ₹${parseFloat(l.l.principalAmount).toLocaleString()}`,
      customerName: l.name,
      amount: parseFloat(l.l.principalAmount),
      createdAt: l.l.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  res.json(activity);
});

router.get("/dashboard/branch-summary", async (req, res): Promise<void> => {
  const branches = await db.select().from(branchesTable);

  const result = await Promise.all(
    branches.map(async (b) => {
      const [custCount] = await db.select({ count: sql<number>`count(*)::int` }).from(customersTable).where(eq(customersTable.branchId, b.id));
      const [collCount] = await db.select({ count: sql<number>`count(*)::int` }).from(collectorsTable).where(eq(collectorsTable.branchId, b.id));
      const [colTotal] = await db.select({ sum: sql<string>`coalesce(sum(amount::numeric),0)` }).from(collectionsTable).where(eq(collectionsTable.branchId, b.id));
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
});

export default router;
