import { Router, type IRouter } from "express";
import { db, loansTable, customersTable, branchesTable, collectionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

function calcEmi(principal: number, rate: number, tenure: number, type: "flat" | "reducing"): number {
  if (type === "flat") {
    const totalInterest = (principal * rate * tenure) / (100 * 12);
    return (principal + totalInterest) / tenure;
  } else {
    const monthlyRate = rate / (12 * 100);
    if (monthlyRate === 0) return principal / tenure;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
  }
}

router.get("/loans", async (req, res): Promise<void> => {
  const { customerId, status, branchId, page = "1", limit = "20" } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);
  const offset = (pageNum - 1) * limitNum;

  let rows = await db
    .select({ l: loansTable, customerName: customersTable.name, customerMobile: customersTable.mobile, branchName: branchesTable.name })
    .from(loansTable)
    .leftJoin(customersTable, eq(loansTable.customerId, customersTable.id))
    .leftJoin(branchesTable, eq(loansTable.branchId, branchesTable.id))
    .orderBy(loansTable.createdAt);

  if (customerId) rows = rows.filter((r) => r.l.customerId === parseInt(customerId as string, 10));
  if (status) rows = rows.filter((r) => r.l.status === status);
  if (branchId) rows = rows.filter((r) => r.l.branchId === parseInt(branchId as string, 10));

  const total = rows.length;
  const sliced = rows.slice(offset, offset + limitNum);

  const data = sliced.map((row: (typeof sliced)[number]) => {
    const principal = parseFloat(row.l.principalAmount);
    const rate = parseFloat(row.l.interestRate);
    const tenure = row.l.tenure;
    const emi = row.l.emiAmount ? parseFloat(row.l.emiAmount) : calcEmi(principal, rate, tenure, row.l.interestType as any);
    const total = row.l.totalAmount ? parseFloat(row.l.totalAmount) : emi * tenure;
    const paid = parseFloat(row.l.paidAmount);
    return {
      ...row.l,
      customerName: row.customerName,
      customerMobile: row.customerMobile,
      branchName: row.branchName,
      principalAmount: principal,
      interestRate: rate,
      paidAmount: paid,
      emiAmount: Math.round(emi * 100) / 100,
      totalAmount: Math.round(total * 100) / 100,
      outstandingAmount: Math.max(0, total - paid),
      disbursedAt: row.l.disbursedAt?.toISOString() ?? null,
      createdAt: row.l.createdAt.toISOString(),
    };
  });

  res.json({ data, total, page: pageNum, limit: limitNum });
});

router.post("/loans", async (req, res): Promise<void> => {
  const { customerId, principalAmount, interestRate, interestType, tenure, branchId, purpose } = req.body;
  if (!customerId || !principalAmount || !interestRate || !interestType || !tenure || !branchId) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  const emi = calcEmi(parseFloat(principalAmount), parseFloat(interestRate), parseInt(tenure, 10), interestType);
  const totalAmt = emi * parseInt(tenure, 10);
  const [loan] = await db
    .insert(loansTable)
    .values({
      customerId,
      principalAmount: String(principalAmount),
      interestRate: String(interestRate),
      interestType,
      tenure: parseInt(tenure, 10),
      emiAmount: String(Math.round(emi * 100) / 100),
      totalAmount: String(Math.round(totalAmt * 100) / 100),
      branchId,
      purpose,
      status: "pending",
      paidAmount: "0",
    })
    .returning();
  res.status(201).json({
    ...loan,
    principalAmount: parseFloat(loan.principalAmount),
    interestRate: parseFloat(loan.interestRate),
    emiAmount: parseFloat(loan.emiAmount!),
    totalAmount: parseFloat(loan.totalAmount!),
    paidAmount: 0,
    outstandingAmount: parseFloat(loan.totalAmount!),
    disbursedAt: null,
    createdAt: loan.createdAt.toISOString(),
  });
});

router.get("/loans/summary", async (req, res): Promise<void> => {
  const [all] = await db.select({ count: sql<number>`count(*)::int` }).from(loansTable);
  const [active] = await db.select({ count: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.status, "active"));
  const [pending] = await db.select({ count: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.status, "pending"));
  const [overdue] = await db.select({ count: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.status, "overdue"));
  const [disbursed] = await db.select({ sum: sql<string>`coalesce(sum(principal_amount::numeric),0)` }).from(loansTable).where(sql`status in ('active','closed','overdue')`);
  const [outstanding] = await db.select({ sum: sql<string>`coalesce(sum((total_amount::numeric - paid_amount::numeric)),0)` }).from(loansTable).where(sql`status in ('active','overdue')`);

  res.json({
    totalLoans: all?.count ?? 0,
    activeLoans: active?.count ?? 0,
    pendingApproval: pending?.count ?? 0,
    totalDisbursed: parseFloat(disbursed?.sum ?? "0"),
    totalOutstanding: parseFloat(outstanding?.sum ?? "0"),
    totalOverdue: overdue?.count ?? 0,
  });
});

router.get("/loans/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({ l: loansTable, customerName: customersTable.name, customerMobile: customersTable.mobile, branchName: branchesTable.name })
    .from(loansTable)
    .leftJoin(customersTable, eq(loansTable.customerId, customersTable.id))
    .leftJoin(branchesTable, eq(loansTable.branchId, branchesTable.id))
    .where(eq(loansTable.id, id));
  if (!row) { res.status(404).json({ error: "Loan not found" }); return; }
  const principal = parseFloat(row.l.principalAmount);
  const emi = row.l.emiAmount ? parseFloat(row.l.emiAmount) : 0;
  const total = row.l.totalAmount ? parseFloat(row.l.totalAmount) : 0;
  const paid = parseFloat(row.l.paidAmount);
  res.json({
    ...row.l,
    customerName: row.customerName,
    customerMobile: row.customerMobile,
    branchName: row.branchName,
    principalAmount: principal,
    interestRate: parseFloat(row.l.interestRate),
    paidAmount: paid,
    emiAmount: emi,
    totalAmount: total,
    outstandingAmount: Math.max(0, total - paid),
    disbursedAt: row.l.disbursedAt?.toISOString() ?? null,
    createdAt: row.l.createdAt.toISOString(),
  });
});

router.patch("/loans/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { status, disbursedAt } = req.body;
  const update: any = {};
  if (status !== undefined) update.status = status;
  if (disbursedAt !== undefined) update.disbursedAt = new Date(disbursedAt);
  const [loan] = await db.update(loansTable).set(update).where(eq(loansTable.id, id)).returning();
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }
  res.json({
    ...loan,
    principalAmount: parseFloat(loan.principalAmount),
    interestRate: parseFloat(loan.interestRate),
    emiAmount: loan.emiAmount ? parseFloat(loan.emiAmount) : null,
    totalAmount: loan.totalAmount ? parseFloat(loan.totalAmount) : null,
    paidAmount: parseFloat(loan.paidAmount),
    outstandingAmount: loan.totalAmount ? Math.max(0, parseFloat(loan.totalAmount) - parseFloat(loan.paidAmount)) : null,
    disbursedAt: loan.disbursedAt?.toISOString() ?? null,
    createdAt: loan.createdAt.toISOString(),
  });
});

router.get("/loans/:id/emi-schedule", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, id));
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const principal = parseFloat(loan.principalAmount);
  const rate = parseFloat(loan.interestRate);
  const tenure = loan.tenure;
  const interestType = loan.interestType as "flat" | "reducing";
  const startDate = loan.disbursedAt ?? loan.createdAt;

  const schedule = [];
  let balance = principal;

  for (let i = 1; i <= tenure; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    let principalComp: number;
    let interestComp: number;
    let emiAmt: number;

    if (interestType === "flat") {
      const totalInterest = (principal * rate * tenure) / (100 * 12);
      emiAmt = (principal + totalInterest) / tenure;
      principalComp = principal / tenure;
      interestComp = totalInterest / tenure;
    } else {
      const monthlyRate = rate / (12 * 100);
      emiAmt = monthlyRate === 0 ? principal / tenure : (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
      interestComp = balance * monthlyRate;
      principalComp = emiAmt - interestComp;
    }

    balance -= principalComp;

    schedule.push({
      installmentNumber: i,
      dueDate: dueDate.toISOString().split("T")[0],
      emiAmount: Math.round(emiAmt * 100) / 100,
      principalComponent: Math.round(principalComp * 100) / 100,
      interestComponent: Math.round(interestComp * 100) / 100,
      paidAmount: 0,
      status: "pending",
    });
  }

  res.json(schedule);
});

export default router;
