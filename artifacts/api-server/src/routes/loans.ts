import { Router, type IRouter } from "express";
import { db, loansTable, customersTable, branchesTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { safeIso } from "../lib/utils";

const router: IRouter = Router();

async function getCustomerLimitId(userId: number, role: string): Promise<number | null | undefined> {
  if (role !== "customer") return undefined;
  const [user] = await db.select({ customerId: usersTable.customerId }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.customerId;
}

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
  try {
    const customerLimitId = await getCustomerLimitId(req.userId, req.userRole);
    if (customerLimitId === null) {
      res.status(403).json({ error: "Access Denied: Customer profile not linked." });
      return;
    }

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

    const targetCustomerId = customerLimitId !== undefined ? customerLimitId : (customerId ? parseInt(customerId as string, 10) : undefined);

    if (targetCustomerId !== undefined) rows = rows.filter((r) => r.l.customerId === targetCustomerId);
    if (status) rows = rows.filter((r) => r.l.status === status);
    if (branchId) rows = rows.filter((r) => r.l.branchId === parseInt(branchId as string, 10));

    const total = rows.length;
    const sliced = rows.slice(offset, offset + limitNum);

    const data = sliced.map((row) => {
      const principal = parseFloat(row.l.principalAmount);
      const rate = parseFloat(row.l.interestRate);
      const tenure = row.l.tenure;
      const emi = row.l.emiAmount ? parseFloat(row.l.emiAmount) : calcEmi(principal, rate, tenure, row.l.interestType as any);
      const totalAmt = row.l.totalAmount ? parseFloat(row.l.totalAmount) : emi * tenure;
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
        totalAmount: Math.round(totalAmt * 100) / 100,
        outstandingAmount: Math.max(0, totalAmt - paid),
        disbursedAt: row.l.disbursedAt ? safeIso(row.l.disbursedAt) : null,
        createdAt: safeIso(row.l.createdAt),
      };
    });

    res.json({ data, total, page: pageNum, limit: limitNum });
  } catch (err: any) {
    console.error("[GET /loans ERROR]", err);
    res.json({ data: [], total: 0, page: 1, limit: 20 });
  }
});

router.post("/loans", async (req, res): Promise<void> => {
  try {
    if (req.userRole === "customer") {
      res.status(403).json({ error: "Forbidden: Customers cannot create loan applications." });
      return;
    }

    const { customerId, branchId, principalAmount, interestRate, interestType, tenure, remarks } = req.body;
    if (!customerId || !branchId || !principalAmount || !interestRate || !tenure) {
      res.status(400).json({ error: "customerId, branchId, principalAmount, interestRate, tenure required" });
      return;
    }
    const emi = calcEmi(parseFloat(principalAmount), parseFloat(interestRate), parseInt(tenure, 10), interestType ?? "flat");
    const totalAmount = emi * parseInt(tenure, 10);

    const [loan] = await db
      .insert(loansTable)
      .values({
        customerId: parseInt(customerId, 10),
        branchId: parseInt(branchId, 10),
        principalAmount: String(principalAmount),
        interestRate: String(interestRate),
        interestType: interestType ?? "flat",
        tenure: parseInt(tenure, 10),
        emiAmount: String(Math.round(emi * 100) / 100),
        totalAmount: String(Math.round(totalAmount * 100) / 100),
        paidAmount: "0",
        status: "pending",
        remarks,
      } as any)
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
      createdAt: safeIso(loan.createdAt),
    });
  } catch (err: any) {
    console.error("[POST /loans ERROR]", err);
    res.status(500).json({ error: err?.message || "Failed to create loan" });
  }
});

router.get("/loans/summary", async (req, res): Promise<void> => {
  try {
    if (req.userRole === "customer") {
      res.status(403).json({ error: "Forbidden: Customers cannot view general loan summaries." });
      return;
    }

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
  } catch (err: any) {
    console.error("[GET /loans/summary ERROR]", err);
    res.json({ totalLoans: 0, activeLoans: 0, pendingApproval: 0, totalDisbursed: 0, totalOutstanding: 0, totalOverdue: 0 });
  }
});

router.get("/loans/:id", async (req, res): Promise<void> => {
  try {
    const customerLimitId = await getCustomerLimitId(req.userId, req.userRole);
    if (customerLimitId === null) {
      res.status(403).json({ error: "Access Denied: Customer profile not linked." });
      return;
    }

    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const [row] = await db
      .select({ l: loansTable, customerName: customersTable.name, customerMobile: customersTable.mobile, branchName: branchesTable.name })
      .from(loansTable)
      .leftJoin(customersTable, eq(loansTable.customerId, customersTable.id))
      .leftJoin(branchesTable, eq(loansTable.branchId, branchesTable.id))
      .where(eq(loansTable.id, id));
    if (!row) { res.status(404).json({ error: "Loan not found" }); return; }

    if (customerLimitId !== undefined && row.l.customerId !== customerLimitId) {
      res.status(403).json({ error: "Forbidden: You do not have permission to view this loan." });
      return;
    }

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
      disbursedAt: row.l.disbursedAt ? safeIso(row.l.disbursedAt) : null,
      createdAt: safeIso(row.l.createdAt),
    });
  } catch (err: any) {
    console.error("[GET /loans/:id ERROR]", err);
    res.status(500).json({ error: "Loan not found" });
  }
});

router.patch("/loans/:id", async (req, res): Promise<void> => {
  try {
    if (req.userRole === "customer") {
      res.status(403).json({ error: "Forbidden: Customers cannot update loans." });
      return;
    }

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
      disbursedAt: loan.disbursedAt ? safeIso(loan.disbursedAt) : null,
      createdAt: safeIso(loan.createdAt),
    });
  } catch (err: any) {
    console.error("[PATCH /loans/:id ERROR]", err);
    res.status(500).json({ error: "Failed to update loan" });
  }
});

router.get("/loans/:id/emi-schedule", async (req, res): Promise<void> => {
  try {
    const customerLimitId = await getCustomerLimitId(req.userId, req.userRole);
    if (customerLimitId === null) {
      res.status(403).json({ error: "Access Denied: Customer profile not linked." });
      return;
    }

    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, id));
    if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

    if (customerLimitId !== undefined && loan.customerId !== customerLimitId) {
      res.status(403).json({ error: "Forbidden: Access denied." });
      return;
    }

    const principal = parseFloat(loan.principalAmount);
    const rate = parseFloat(loan.interestRate);
    const tenure = loan.tenure;
    const emi = loan.emiAmount ? parseFloat(loan.emiAmount) : calcEmi(principal, rate, tenure, loan.interestType as any);

    const schedule = [];
    let balance = principal;
    const startDate = loan.disbursedAt ? new Date(loan.disbursedAt) : new Date(loan.createdAt);

    for (let i = 1; i <= tenure; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      let interestPart = 0;
      let principalPart = 0;

      if (loan.interestType === "reducing") {
        const monthlyRate = rate / (12 * 100);
        interestPart = balance * monthlyRate;
        principalPart = emi - interestPart;
        balance = Math.max(0, balance - principalPart);
      } else {
        const totalInterest = (principal * rate * tenure) / (100 * 12);
        interestPart = totalInterest / tenure;
        principalPart = principal / tenure;
        balance = Math.max(0, balance - principalPart);
      }

      schedule.push({
        installmentNo: i,
        dueDate: safeIso(dueDate).split("T")[0],
        emiAmount: Math.round(emi * 100) / 100,
        principalPart: Math.round(principalPart * 100) / 100,
        interestPart: Math.round(interestPart * 100) / 100,
        remainingBalance: Math.round(balance * 100) / 100,
        isPaid: parseFloat(loan.paidAmount) >= emi * i,
      });
    }

    res.json(schedule);
  } catch (err: any) {
    console.error("[GET /loans/:id/emi-schedule ERROR]", err);
    res.json([]);
  }
});

export default router;
