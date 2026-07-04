import { Router, type IRouter } from "express";
import { db, collectionsTable, loansTable, customersTable, branchesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reports/collection", async (req, res): Promise<void> => {
  const { startDate, endDate, branchId, collectorId } = req.query;
  const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate as string) : new Date();
  end.setHours(23, 59, 59, 999);

  let rows = await db.select({ c: collectionsTable, branchName: branchesTable.name })
    .from(collectionsTable)
    .leftJoin(branchesTable, eq(collectionsTable.branchId, branchesTable.id))
    .where(and(gte(collectionsTable.collectedAt, start), lte(collectionsTable.collectedAt, end)));

  if (branchId) rows = rows.filter((r: (typeof rows)[number]) => r.c.branchId === parseInt(branchId as string, 10));
  if (collectorId) rows = rows.filter((r: (typeof rows)[number]) => r.c.collectorId === parseInt(collectorId as string, 10));

  const totalAmount = rows.reduce((s, r: (typeof rows)[number]) => s + parseFloat(r.c.amount), 0);
  const totalCount = rows.length;

  // By branch
  type ColRow = (typeof rows)[number];
  const branchMap = new Map<string, { amount: number; count: number }>();
  for (const r of rows as ColRow[]) {
    const name = r.branchName ?? "Unknown";
    const prev = branchMap.get(name) ?? { amount: 0, count: 0 };
    branchMap.set(name, { amount: prev.amount + parseFloat(r.c.amount), count: prev.count + 1 });
  }
  const byBranch = Array.from(branchMap.entries()).map(([branchName, d]) => ({ branchName, amount: d.amount, count: d.count }));

  // By payment mode
  const modeMap = new Map<string, { amount: number; count: number }>();
  for (const r of rows as ColRow[]) {
    const mode = r.c.paymentMode;
    const prev = modeMap.get(mode) ?? { amount: 0, count: 0 };
    modeMap.set(mode, { amount: prev.amount + parseFloat(r.c.amount), count: prev.count + 1 });
  }
  const byPaymentMode = Array.from(modeMap.entries()).map(([mode, d]) => ({ mode, amount: d.amount, count: d.count }));

  // Daily trend
  const dayMap = new Map<string, { amount: number; count: number }>();
  for (const r of rows as ColRow[]) {
    const day = r.c.collectedAt.toISOString().split("T")[0];
    const prev = dayMap.get(day) ?? { amount: 0, count: 0 };
    dayMap.set(day, { amount: prev.amount + parseFloat(r.c.amount), count: prev.count + 1 });
  }
  const daily = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, amount: d.amount, count: d.count }));

  res.json({
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    totalAmount,
    totalCount,
    byBranch,
    byPaymentMode,
    daily,
  });
});

router.get("/reports/loan", async (req, res): Promise<void> => {
  const { startDate, endDate, branchId } = req.query;
  const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate as string) : new Date();
  end.setHours(23, 59, 59, 999);

  let rows = await db.select({ l: loansTable, branchName: branchesTable.name })
    .from(loansTable)
    .leftJoin(branchesTable, eq(loansTable.branchId, branchesTable.id))
    .where(and(gte(loansTable.createdAt, start), lte(loansTable.createdAt, end)));

  if (branchId) rows = rows.filter((r: (typeof rows)[number]) => r.l.branchId === parseInt(branchId as string, 10));

  type LoanRow = (typeof rows)[number];
  const disbursed = rows.filter((r: LoanRow) => ["active", "closed", "overdue"].includes(r.l.status));
  const totalDisbursed = disbursed.reduce((s, r: LoanRow) => s + parseFloat(r.l.principalAmount), 0);
  const totalCollected = rows.reduce((s, r: LoanRow) => s + parseFloat(r.l.paidAmount), 0);
  const totalOverdue = rows.filter((r: LoanRow) => r.l.status === "overdue").reduce((s, r: LoanRow) => s + parseFloat(r.l.principalAmount), 0);

  const branchMap = new Map<string, { amount: number; count: number }>();
  for (const r of rows as LoanRow[]) {
    const name = r.branchName ?? "Unknown";
    const prev = branchMap.get(name) ?? { amount: 0, count: 0 };
    branchMap.set(name, { amount: prev.amount + parseFloat(r.l.principalAmount), count: prev.count + 1 });
  }
  const byBranch = Array.from(branchMap.entries()).map(([branchName, d]) => ({ branchName, amount: d.amount, count: d.count }));

  res.json({
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    totalLoans: rows.length,
    totalDisbursed,
    totalCollected,
    totalOverdue,
    byBranch,
  });
});

router.get("/reports/customer-statement", async (req, res): Promise<void> => {
  const { customerId, startDate, endDate } = req.query;
  if (!customerId) { res.status(400).json({ error: "customerId required" }); return; }

  const id = parseInt(customerId as string, 10);
  const [row] = await db
    .select({ c: customersTable, branchName: branchesTable.name })
    .from(customersTable)
    .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
    .where(eq(customersTable.id, id));
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }

  const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
  const end = endDate ? new Date(endDate as string) : new Date();
  end.setHours(23, 59, 59, 999);

  const collections = await db.select().from(collectionsTable)
    .where(and(eq(collectionsTable.customerId, id), gte(collectionsTable.collectedAt, start), lte(collectionsTable.collectedAt, end)))
    .orderBy(collectionsTable.collectedAt);

  const entries = collections.map((c) => ({
    id: c.id,
    type: "payment" as const,
    description: `Payment via ${c.paymentMode}${c.receiptNumber ? ` (${c.receiptNumber})` : ""}`,
    amount: parseFloat(c.amount),
    balance: null,
    date: c.collectedAt.toISOString(),
  }));

  const totalPaid = entries.reduce((s, e) => s + e.amount, 0);

  const customer = {
    ...row.c,
    branchName: row.branchName,
    totalTokens: 0,
    totalLoans: 0,
    totalPaid,
    createdAt: row.c.createdAt.toISOString(),
  };

  res.json({
    customer,
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    openingBalance: 0,
    closingBalance: totalPaid,
    entries,
  });
});

export default router;
