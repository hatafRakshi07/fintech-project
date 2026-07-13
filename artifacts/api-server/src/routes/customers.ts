import { Router, type IRouter } from "express";
import { db, customersTable, branchesTable, tokensTable, loansTable, collectionsTable } from "@workspace/db";
import { committeesTable, committeeMembersTable, giftDistributionsTable, giftInventoryTable, interestAccountsTable, recoveryTasksTable } from "@workspace/db";
import { eq, and, ilike, or, sql, count } from "drizzle-orm";

const router: IRouter = Router();

async function getNextRef(): Promise<string> {
  // Use the DB max id as the basis — safe under concurrent inserts because
  // this generates a label after the insert succeeds (see usage below).
  const [row] = await db.select({ max: sql<number>`coalesce(max(id),0)` }).from(customersTable);
  const n = (row?.max ?? 0) + 1;
  return `REF${String(n).padStart(6, "0")}`;
}

router.get("/customers", async (req, res): Promise<void> => {
  const { search, branchId, status, page = "1", limit = "20" } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);
  const offset = (pageNum - 1) * limitNum;

  let query = db
    .select({
      c: customersTable,
      branchName: branchesTable.name,
    })
    .from(customersTable)
    .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
    .$dynamic();

  const conditions = [];
  if (branchId) conditions.push(eq(customersTable.branchId, parseInt(branchId as string, 10)));
  if (status) conditions.push(eq(customersTable.status, status as any));
  if (search && typeof search === "string") {
    conditions.push(
      or(
        ilike(customersTable.name, `%${search}%`),
        ilike(customersTable.mobile, `%${search}%`),
        ilike(customersTable.referenceNumber, `%${search}%`),
        ilike(customersTable.referenceName, `%${search}%`)
      )!
    );
  }
  if (conditions.length > 0) query = (query as any).where(and(...conditions));

  // Build a count query with the same filters for accurate pagination totals
  let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(customersTable).$dynamic();
  if (conditions.length > 0) countQuery = (countQuery as any).where(and(...conditions));

  const allRows = await (query as any).orderBy(customersTable.createdAt).offset(offset).limit(limitNum);
  const [{ total }] = await countQuery;

  const data = await Promise.all(
    allRows.map(async (row: any) => {
      const [tokCount] = await db.select({ c: sql<number>`count(*)::int` }).from(tokensTable).where(eq(tokensTable.customerId, row.c.id));
      const [lnCount] = await db.select({ c: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.customerId, row.c.id));
      const [paid] = await db.select({ sum: sql<string>`coalesce(sum(amount),0)` }).from(collectionsTable).where(eq(collectionsTable.customerId, row.c.id));
      return {
        ...row.c,
        branchName: row.branchName,
        status: row.c.status,
        totalTokens: tokCount?.c ?? 0,
        totalLoans: lnCount?.c ?? 0,
        totalPaid: parseFloat(paid?.sum ?? "0"),
        createdAt: row.c.createdAt.toISOString(),
      };
    })
  );

  res.json({ data, total: total ?? 0, page: pageNum, limit: limitNum });
});

router.post("/customers", async (req, res): Promise<void> => {
  const { name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status, photoUrl, referenceName, recoveryNotes, documents } = req.body;
  if (!name || !mobile || !branchId) {
    res.status(400).json({ error: "name, mobile, branchId required" });
    return;
  }
  const referenceNumber = await getNextRef();
  const [customer] = await db
    .insert(customersTable)
    .values({ name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status: status ?? "active", referenceNumber, photoUrl, referenceName, recoveryNotes, documents })
    .returning();
  res.status(201).json({ ...customer, totalTokens: 0, totalLoans: 0, totalPaid: 0, createdAt: customer.createdAt.toISOString() });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({ c: customersTable, branchName: branchesTable.name })
    .from(customersTable)
    .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
    .where(eq(customersTable.id, id));
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }

  // Parallel lookups for summary counts
  const [tokCount, lnCount, paid, giftCount, interestAcc, recoveryCount] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(tokensTable).where(eq(tokensTable.customerId, id)),
    db.select({ c: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.customerId, id)),
    db.select({ sum: sql<string>`coalesce(sum(amount),0)` }).from(collectionsTable).where(eq(collectionsTable.customerId, id)),
    db.select({ c: sql<number>`count(*)::int` }).from(giftDistributionsTable).where(eq(giftDistributionsTable.customerId, id)),
    db.select().from(interestAccountsTable).where(eq(interestAccountsTable.customerId, id)).limit(1),
    db.select({ c: sql<number>`count(*)::int` }).from(recoveryTasksTable).where(and(eq(recoveryTasksTable.customerId, id), eq(recoveryTasksTable.status, "pending"))),
  ]);

  // Committee memberships with token numbers
  const memberships = await db
    .select({ cm: committeeMembersTable, commName: committeesTable.name, commType: committeesTable.type })
    .from(committeeMembersTable)
    .leftJoin(committeesTable, eq(committeeMembersTable.committeeId, committeesTable.id))
    .where(eq(committeeMembersTable.customerId, id));

  // Group by committee → array of tokens
  const committeeSummary = Object.values(
    memberships.reduce((acc, m) => {
      const key = m.cm.committeeId;
      if (!acc[key]) acc[key] = { committeeId: key, committeeName: m.commName ?? "", type: m.commType ?? "", tokens: [] };
      acc[key].tokens.push(m.cm.tokenNumber);
      return acc;
    }, {} as Record<number, { committeeId: number; committeeName: string; type: string; tokens: string[] }>)
  );

  res.json({
    ...row.c,
    branchName: row.branchName,
    totalTokens: tokCount[0]?.c ?? 0,
    totalLoans: lnCount[0]?.c ?? 0,
    totalPaid: parseFloat(paid[0]?.sum ?? "0"),
    totalGifts: giftCount[0]?.c ?? 0,
    pendingRecovery: recoveryCount[0]?.c ?? 0,
    hasInterestAccount: interestAcc.length > 0,
    interestMonthly: interestAcc[0] ? parseFloat(interestAcc[0].monthlyInterest ?? "0") : 0,
    committeeMemberships: committeeSummary,
    createdAt: row.c.createdAt.toISOString(),
  });
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status, photoUrl, referenceName, recoveryNotes, documents } = req.body;
  const [customer] = await db
    .update(customersTable)
    .set({ name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status, photoUrl, referenceName, recoveryNotes, documents })
    .where(eq(customersTable.id, id))
    .returning();
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ ...customer, totalTokens: 0, totalLoans: 0, totalPaid: 0, createdAt: customer.createdAt.toISOString() });
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.sendStatus(204);
});

router.get("/customers/:id/passbook", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({ c: customersTable, branchName: branchesTable.name })
    .from(customersTable)
    .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
    .where(eq(customersTable.id, id));
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }

  const [collections, loans, gifts, interestAccs, recoveryTasks] = await Promise.all([
    db.select().from(collectionsTable).where(eq(collectionsTable.customerId, id)).orderBy(collectionsTable.collectedAt),
    db.select().from(loansTable).where(eq(loansTable.customerId, id)).orderBy(loansTable.createdAt),
    db.select({ gd: giftDistributionsTable, giftName: giftInventoryTable.name })
      .from(giftDistributionsTable)
      .leftJoin(giftInventoryTable, eq(giftDistributionsTable.giftId, giftInventoryTable.id))
      .where(eq(giftDistributionsTable.customerId, id))
      .orderBy(giftDistributionsTable.distributionDate),
    db.select().from(interestAccountsTable).where(eq(interestAccountsTable.customerId, id)),
    db.select().from(recoveryTasksTable).where(eq(recoveryTasksTable.customerId, id)).orderBy(recoveryTasksTable.createdAt),
  ]);

  const entries = [
    ...collections.map((c) => ({
      id: c.id, type: "payment" as const,
      description: `Payment via ${c.paymentMode}${c.notes ? ` — ${c.notes}` : ""}`,
      amount: parseFloat(c.amount), date: c.collectedAt.toISOString(),
    })),
    ...loans.map((l) => ({
      id: l.id + 100000, type: "loan" as const,
      description: `Loan ${l.status} — ₹${parseFloat(l.principalAmount).toLocaleString("en-IN")} @ ${l.interestRate}% (${l.interestType})`,
      amount: parseFloat(l.principalAmount), date: l.createdAt.toISOString(),
    })),
    ...gifts.map((g) => ({
      id: g.gd.id + 200000, type: "gift" as const,
      description: `Gift: ${g.giftName ?? "Item"} × ${g.gd.quantity}`,
      amount: 0, date: g.gd.distributionDate ? new Date(g.gd.distributionDate + "T00:00:00Z").toISOString() : new Date().toISOString(),
    })),
    ...recoveryTasks.map((r) => ({
      id: r.id + 300000, type: "recovery" as const,
      description: `Recovery: ${r.notes ?? ""} — ${r.status} | Overdue: ₹${r.overdueAmount ?? 0}`,
      amount: parseFloat(r.overdueAmount ?? "0"), date: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPaid = collections.reduce((s, c) => s + parseFloat(c.amount), 0);
  const customer = { ...row.c, branchName: row.branchName, totalTokens: 0, totalLoans: 0, totalPaid, createdAt: row.c.createdAt.toISOString() };

  res.json({
    customer, entries, totalPaid, totalDue: 0,
    loans, gifts: gifts.map(g => ({ ...g.gd, giftName: g.giftName })),
    interestAccounts: interestAccs.map(a => ({
      ...a,
      principalAmount: parseFloat(a.principalAmount),
      interestRate: parseFloat(a.interestRate),
      monthlyInterest: parseFloat(a.monthlyInterest ?? "0"),
    })),
    recoveryTasks,
  });
});

router.get("/customers/:id/timeline", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const cols = await db.select().from(collectionsTable).where(eq(collectionsTable.customerId, id)).orderBy(collectionsTable.collectedAt);
  const lns = await db.select().from(loansTable).where(eq(loansTable.customerId, id)).orderBy(loansTable.createdAt);

  const entries = [
    ...cols.map((c) => ({
      id: c.id,
      type: "payment",
      title: "Payment Received",
      description: `₹${parseFloat(c.amount).toLocaleString()} via ${c.paymentMode}`,
      amount: parseFloat(c.amount),
      date: c.collectedAt.toISOString(),
    })),
    ...lns.map((l) => ({
      id: l.id + 10000,
      type: "loan",
      title: `Loan ${l.status}`,
      description: `Loan of ₹${parseFloat(l.principalAmount).toLocaleString()} - ${l.interestType} rate ${l.interestRate}%`,
      amount: parseFloat(l.principalAmount),
      date: l.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json(entries);
});

// ─── Full Customer History ──────────────────────────────────────────────────
router.get("/customers/:id/history", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  // Get customer
  const [row] = await db
    .select({ c: customersTable, branchName: branchesTable.name })
    .from(customersTable)
    .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
    .where(eq(customersTable.id, id));
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }

  // Fetch all related data in parallel
  const [
    membershipRows,
    tokenRows,
    collectionRows,
    loanRows,
    giftRows,
    interestRows,
    recoveryRows,
  ] = await Promise.all([
    db.select({ cm: committeeMembersTable, commName: committeesTable.name, commType: committeesTable.type, installment: committeesTable.installmentAmount })
      .from(committeeMembersTable)
      .leftJoin(committeesTable, eq(committeeMembersTable.committeeId, committeesTable.id))
      .where(eq(committeeMembersTable.customerId, id)),
    db.select({ t: tokensTable, commName: committeesTable.name })
      .from(tokensTable)
      .leftJoin(committeesTable, eq(tokensTable.committeeId, committeesTable.id))
      .where(eq(tokensTable.customerId, id)),
    db.select()
      .from(collectionsTable)
      .where(eq(collectionsTable.customerId, id))
      .orderBy(sql`collected_at DESC`)
      .limit(200),
    db.select().from(loansTable).where(eq(loansTable.customerId, id)),
    db.select({ gd: giftDistributionsTable, giftName: giftInventoryTable.name })
      .from(giftDistributionsTable)
      .leftJoin(giftInventoryTable, eq(giftDistributionsTable.giftId, giftInventoryTable.id))
      .where(eq(giftDistributionsTable.customerId, id))
      .orderBy(sql`distribution_date DESC`),
    db.select().from(interestAccountsTable).where(eq(interestAccountsTable.customerId, id)),
    db.select().from(recoveryTasksTable).where(eq(recoveryTasksTable.customerId, id)),
  ]);

  // Process memberships
  const memberships = Object.values(
    membershipRows.reduce((acc, m) => {
      const key = m.cm.committeeId;
      if (!acc[key]) acc[key] = {
        committeeId: key,
        committeeName: m.commName ?? "",
        type: m.commType ?? "",
        installment: m.installment ? parseFloat(m.installment) : 0,
        tokens: [],
      };
      acc[key].tokens.push(m.cm.tokenNumber);
      return acc;
    }, {} as Record<number, any>)
  );

  // Process tokens
  const tokens = tokenRows.map(t => ({
    id: t.t.id,
    tokenNumber: t.t.tokenNumber,
    committeeName: t.commName ?? "",
    status: t.t.status,
  }));

  // Process collections
  const collections = collectionRows.map(c => ({
    id: c.id,
    amount: parseFloat(c.amount),
    paymentMode: c.paymentMode,
    date: c.collectedAt.toISOString(),
    notes: c.notes,
    committeeId: c.committeeId,
  }));

  // Summary stats
  const totalPaid = collectionRows.reduce((s, c) => s + parseFloat(c.amount), 0);
  const totalLoanAmount = loanRows.reduce((s, l) => s + parseFloat(l.principalAmount), 0);
  const totalLoanPaid = loanRows.reduce((s, l) => s + parseFloat(l.paidAmount), 0);

  res.json({
    customer: {
      ...row.c,
      branchName: row.branchName,
      createdAt: row.c.createdAt.toISOString(),
    },
    summary: {
      totalPaid,
      totalCollections: collectionRows.length,
      totalTokens: tokenRows.length,
      totalLoans: loanRows.length,
      totalLoanAmount,
      totalLoanPaid,
      totalGifts: giftRows.length,
      totalInterestAccounts: interestRows.length,
      totalRecoveryTasks: recoveryRows.length,
      committeesJoined: memberships.length,
    },
    memberships,
    tokens,
    collections,
    loans: loanRows.map(l => ({
      ...l,
      principalAmount: parseFloat(l.principalAmount),
      interestRate: parseFloat(l.interestRate),
      paidAmount: parseFloat(l.paidAmount),
      emiAmount: l.emiAmount ? parseFloat(l.emiAmount) : null,
      totalAmount: l.totalAmount ? parseFloat(l.totalAmount) : null,
      createdAt: l.createdAt.toISOString(),
    })),
    gifts: giftRows.map(g => ({
      id: g.gd.id,
      giftName: g.giftName ?? "Item",
      quantity: g.gd.quantity,
      date: g.gd.distributionDate,
      status: g.gd.status,
    })),
    interestAccounts: interestRows.map(a => ({
      ...a,
      principalAmount: parseFloat(a.principalAmount),
      interestRate: parseFloat(a.interestRate),
      monthlyInterest: parseFloat(a.monthlyInterest ?? "0"),
      totalInterestPaid: parseFloat(a.totalInterestPaid),
      pendingInterest: parseFloat(a.pendingInterest),
      createdAt: a.createdAt.toISOString(),
    })),
    recoveryTasks: recoveryRows.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
