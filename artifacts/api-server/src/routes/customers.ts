import { Router, type IRouter } from "express";
import { db, customersTable, branchesTable, tokensTable, loansTable, collectionsTable } from "@workspace/db";
import { committeesTable, committeeMembersTable, giftDistributionsTable, giftInventoryTable, interestAccountsTable, recoveryTasksTable } from "@workspace/db";
import { eq, and, ilike, or, sql, count } from "drizzle-orm";
import { safeIso } from "../lib/utils";

const router: IRouter = Router();

async function getNextRef(): Promise<string> {
  const [row] = await db.select({ max: sql<number>`coalesce(max(id),0)` }).from(customersTable);
  const n = (row?.max ?? 0) + 1;
  return `REF${String(n).padStart(6, "0")}`;
}

router.get("/customers", async (req, res): Promise<void> => {
  try {
    const { search, branchId, status, page = "1", limit = "20" } = req.query;
    let pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum <= 0) pageNum = 1;
    let limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum <= 0) limitNum = 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (search && typeof search === "string" && search.trim().length > 0) {
      const q = `%${search.trim()}%`;
      conditions.push(or(ilike(customersTable.name, q), ilike(customersTable.mobile, q), ilike(customersTable.referenceNumber, q), ilike(customersTable.city, q)));
    }
    
    if (branchId && typeof branchId === "string" && branchId !== "undefined" && branchId !== "null" && branchId !== "0") {
      const bId = parseInt(branchId, 10);
      if (!isNaN(bId) && bId > 0) {
        conditions.push(eq(customersTable.branchId, bId));
      }
    }

    if (status && typeof status === "string" && status !== "all" && status !== "undefined") {
      conditions.push(eq(customersTable.status, status as any));
    }

    let query = db
      .select({
        c: customersTable,
        branchName: branchesTable.name,
      })
      .from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .$dynamic();

    if (conditions.length > 0) {
      query = (query as any).where(and(...conditions));
    }

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(customersTable).$dynamic();
    if (conditions.length > 0) countQuery = (countQuery as any).where(and(...conditions));

    const [allRows, countRes] = await Promise.all([
      (query as any).orderBy(customersTable.id).offset(offset).limit(limitNum),
      countQuery.catch((err: any) => {
        console.error("[GET /customers countQuery error]", err);
        return [{ total: 0 }];
      }),
    ]);

    const total = countRes[0]?.total ?? allRows.length;

    const data = await Promise.all(
      allRows.map(async (row: any) => {
        const [tokCount] = await db.select({ c: sql<number>`count(*)::int` }).from(tokensTable).where(eq(tokensTable.customerId, row.c.id)).catch(() => [{ c: 0 }]);
        const [lnCount] = await db.select({ c: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.customerId, row.c.id)).catch(() => [{ c: 0 }]);
        const [paid] = await db.select({ sum: sql<string>`coalesce(sum(CASE WHEN amount ~ '^[0-9]+(\.[0-9]+)?$' THEN amount::numeric ELSE 0 END), 0)` }).from(collectionsTable).where(eq(collectionsTable.customerId, row.c.id)).catch(() => [{ sum: "0" }]);
        return {
          ...row.c,
          branchName: row.branchName,
          status: row.c.status,
          totalTokens: tokCount?.c ?? 0,
          totalLoans: lnCount?.c ?? 0,
          totalPaid: parseFloat(paid?.sum ?? "0"),
          createdAt: safeIso(row.c.createdAt),
        };
      })
    );

    res.json({ data, total: total ?? 0, page: pageNum, limit: limitNum });
  } catch (err: any) {
    console.error("[GET /customers ERROR]", err);
    res.status(500).json({ error: "Failed to load customers list", message: err?.message });
  }
});

router.post("/customers", async (req, res): Promise<void> => {
  try {
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
    res.status(201).json({ ...customer, totalTokens: 0, totalLoans: 0, totalPaid: 0, createdAt: safeIso(customer.createdAt) });
  } catch (err: any) {
    console.error("[POST /customers ERROR]", err);
    res.status(500).json({ error: err?.message || "Failed to create customer" });
  }
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const [row] = await db
      .select({ c: customersTable, branchName: branchesTable.name })
      .from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(eq(customersTable.id, id));
    if (!row) { res.status(404).json({ error: "Customer not found" }); return; }

    const [tokCount, lnCount, paid, giftCount, recoveryCount, interestAcc, tokenRows, committeeMemberships] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(tokensTable).where(eq(tokensTable.customerId, id)).catch(() => [{ c: 0 }]),
      db.select({ c: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.customerId, id)).catch(() => [{ c: 0 }]),
      db.select({ sum: sql<string>`coalesce(sum(CASE WHEN amount ~ '^[0-9]+(\.[0-9]+)?$' THEN amount::numeric ELSE 0 END), 0)` }).from(collectionsTable).where(eq(collectionsTable.customerId, id)).catch(() => [{ sum: "0" }]),
      db.select({ c: sql<number>`count(*)::int` }).from(giftDistributionsTable).where(eq(giftDistributionsTable.customerId, id)).catch(() => [{ c: 0 }]),
      db.select({ c: sql<number>`count(*)::int` }).from(recoveryTasksTable).where(and(eq(recoveryTasksTable.customerId, id), eq(recoveryTasksTable.status, "pending"))).catch(() => [{ c: 0 }]),
      db.select().from(interestAccountsTable).where(and(eq(interestAccountsTable.customerId, id), eq(interestAccountsTable.status, "active"))).catch(() => []),
      db.select({ t: tokensTable, commName: committeesTable.name, commType: committeesTable.type, installment: committeesTable.installmentAmount })
        .from(tokensTable)
        .leftJoin(committeesTable, eq(tokensTable.committeeId, committeesTable.id))
        .where(eq(tokensTable.customerId, id))
        .catch(() => []),
      db.select({ cm: committeeMembersTable, commName: committeesTable.name, commType: committeesTable.type, installment: committeesTable.installmentAmount })
        .from(committeeMembersTable)
        .leftJoin(committeesTable, eq(committeeMembersTable.committeeId, committeesTable.id))
        .where(eq(committeeMembersTable.customerId, id))
        .catch(() => []),
    ]);

    const membershipMap = new Map<number, any>();
    for (const t of tokenRows) {
      const commId = t.t.committeeId ?? 1;
      if (!membershipMap.has(commId)) {
        membershipMap.set(commId, {
          committeeId: commId,
          committeeName: t.commName ?? "General Bissi Scheme",
          type: t.commType ?? "monthly",
          installment: t.installment ? parseFloat(t.installment) : 0,
          tokens: [],
        });
      }
      const tokList = membershipMap.get(commId).tokens;
      if (t.t.tokenNumber && !tokList.includes(t.t.tokenNumber)) {
        tokList.push(t.t.tokenNumber);
      }
    }
    for (const m of committeeMemberships) {
      const commId = m.cm.committeeId;
      if (!membershipMap.has(commId)) {
        membershipMap.set(commId, {
          committeeId: commId,
          committeeName: m.commName ?? "General Bissi Scheme",
          type: m.commType ?? "monthly",
          installment: m.installment ? parseFloat(m.installment) : 0,
          tokens: [],
        });
      }
      const tokList = membershipMap.get(commId).tokens;
      if (m.cm.tokenNumber && !tokList.includes(m.cm.tokenNumber)) {
        tokList.push(m.cm.tokenNumber);
      }
    }
    const committeeSummary = Array.from(membershipMap.values());

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
      createdAt: safeIso(row.c.createdAt),
    });
  } catch (err: any) {
    console.error("[GET /customers/:id ERROR]", err);
    res.status(500).json({ error: "Customer not found" });
  }
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const { name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status, photoUrl, referenceName, recoveryNotes, documents } = req.body;
    const [customer] = await db
      .update(customersTable)
      .set({ name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status, photoUrl, referenceName, recoveryNotes, documents })
      .where(eq(customersTable.id, id))
      .returning();
    if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json({ ...customer, totalTokens: 0, totalLoans: 0, totalPaid: 0, createdAt: safeIso(customer.createdAt) });
  } catch (err: any) {
    console.error("[PATCH /customers/:id ERROR]", err);
    res.status(500).json({ error: err?.message || "Failed to update customer" });
  }
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    await db.delete(customersTable).where(eq(customersTable.id, id));
    res.sendStatus(204);
  } catch (err: any) {
    console.error("[DELETE /customers/:id ERROR]", err);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

router.get("/customers/:id/passbook", async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const [row] = await db
      .select({ c: customersTable, branchName: branchesTable.name })
      .from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(eq(customersTable.id, id));
    if (!row) { res.status(404).json({ error: "Customer not found" }); return; }

    const [collections, loans, gifts, interestAccs, recoveryTasks] = await Promise.all([
      db.select().from(collectionsTable).where(eq(collectionsTable.customerId, id)).orderBy(desc(collectionsTable.collectedAt)).catch(() => []),
      db.select().from(loansTable).where(eq(loansTable.customerId, id)).catch(() => []),
      db.select({ gd: giftDistributionsTable, giftName: giftInventoryTable.name })
        .from(giftDistributionsTable)
        .leftJoin(giftInventoryTable, eq(giftDistributionsTable.giftId, giftInventoryTable.id))
        .where(eq(giftDistributionsTable.customerId, id))
        .orderBy(desc(giftDistributionsTable.distributionDate))
        .catch(() => []),
      db.select().from(interestAccountsTable).where(eq(interestAccountsTable.customerId, id)).catch(() => []),
      db.select().from(recoveryTasksTable).where(eq(recoveryTasksTable.customerId, id)).orderBy(desc(recoveryTasksTable.createdAt)).catch(() => []),
    ]);

    const entries = [
      ...collections.map((c) => ({
        id: c.id, type: "payment" as const,
        description: `Payment via ${c.paymentMode}${c.notes ? ` — ${c.notes}` : ""}`,
        amount: parseFloat(c.amount), date: safeIso(c.collectedAt),
      })),
      ...loans.map((l) => ({
        id: l.id + 100000, type: "loan" as const,
        description: `Loan ${l.status} — ₹${parseFloat(l.principalAmount).toLocaleString("en-IN")} @ ${l.interestRate}% (${l.interestType})`,
        amount: parseFloat(l.principalAmount), date: safeIso(l.createdAt),
      })),
      ...gifts.map((g) => ({
        id: g.gd.id + 200000, type: "gift" as const,
        description: `Gift: ${g.giftName ?? "Item"} × ${g.gd.quantity}`,
        amount: 0, date: safeIso(g.gd.distributionDate),
      })),
      ...recoveryTasks.map((r) => ({
        id: r.id + 300000, type: "recovery" as const,
        description: `Recovery: ${r.notes ?? ""} — ${r.status} | Overdue: ₹${r.overdueAmount ?? 0}`,
        amount: parseFloat(r.overdueAmount ?? "0"), date: safeIso(r.createdAt),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalPaid = collections.reduce((s, c) => s + parseFloat(c.amount), 0);
    const customer = { ...row.c, branchName: row.branchName, totalTokens: 0, totalLoans: 0, totalPaid, createdAt: safeIso(row.c.createdAt) };

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
  } catch (err: any) {
    console.error("[GET /customers/:id/passbook ERROR]", err);
    res.status(500).json({ error: "Failed to load passbook" });
  }
});

router.get("/customers/:id/timeline", async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const [row] = await db
      .select({ c: customersTable, branchName: branchesTable.name })
      .from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(eq(customersTable.id, id));
    if (!row) { res.status(404).json({ error: "Customer not found" }); return; }

    const [collections, loans, gifts, interestAccs, recoveryTasks] = await Promise.all([
      db.select().from(collectionsTable).where(eq(collectionsTable.customerId, id)).orderBy(desc(collectionsTable.collectedAt)).catch(() => []),
      db.select().from(loansTable).where(eq(loansTable.customerId, id)).catch(() => []),
      db.select().from(giftDistributionsTable).where(eq(giftDistributionsTable.customerId, id)).catch(() => []),
      db.select().from(interestAccountsTable).where(eq(interestAccountsTable.customerId, id)).catch(() => []),
      db.select().from(recoveryTasksTable).where(eq(recoveryTasksTable.customerId, id)).catch(() => []),
    ]);

    const entries = [
      ...collections.map((c: any) => ({ type: "collection", date: safeIso(c.collectedAt), amount: parseFloat(c.amount || "0"), title: `Payment Received (${c.paymentMode})`, description: c.notes || "" })),
      ...loans.map((l: any) => ({ type: "loan", date: safeIso(l.createdAt), amount: parseFloat(l.principalAmount || "0"), title: `Loan Disbursed (${l.loanType})`, description: `Interest Rate: ${l.interestRate}%` })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(entries);
  } catch (err: any) {
    console.error("[GET /customers/:id/timeline ERROR]", err);
    res.status(500).json({ error: "Failed to load timeline" });
  }
});

router.get("/customers/:id/history", async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

    const [row] = await db
      .select({ c: customersTable, branchName: branchesTable.name })
      .from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(eq(customersTable.id, id));
    if (!row) { res.status(404).json({ error: "Customer not found" }); return; }

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
        .where(eq(committeeMembersTable.customerId, id))
        .catch(() => []),
      db.select({ t: tokensTable, commName: committeesTable.name, commType: committeesTable.type, installment: committeesTable.installmentAmount })
        .from(tokensTable)
        .leftJoin(committeesTable, eq(tokensTable.committeeId, committeesTable.id))
        .where(eq(tokensTable.customerId, id))
        .catch(() => []),
      db.select()
        .from(collectionsTable)
        .where(eq(collectionsTable.customerId, id))
        .orderBy(desc(collectionsTable.collectedAt))
        .limit(200)
        .catch(() => []),
      db.select().from(loansTable).where(eq(loansTable.customerId, id)).catch(() => []),
      db.select({ gd: giftDistributionsTable, giftName: giftInventoryTable.name })
        .from(giftDistributionsTable)
        .leftJoin(giftInventoryTable, eq(giftDistributionsTable.giftId, giftInventoryTable.id))
        .where(eq(giftDistributionsTable.customerId, id))
        .orderBy(desc(giftDistributionsTable.distributionDate))
        .catch(() => []),
      db.select().from(interestAccountsTable).where(eq(interestAccountsTable.customerId, id)).catch(() => []),
      db.select().from(recoveryTasksTable).where(eq(recoveryTasksTable.customerId, id)).catch(() => []),
    ]);

    const membershipMap = new Map<number, any>();
    for (const t of tokenRows) {
      const commId = t.t.committeeId ?? 1;
      if (!membershipMap.has(commId)) {
        membershipMap.set(commId, {
          committeeId: commId,
          committeeName: t.commName ?? "General Bissi Scheme",
          type: t.commType ?? "monthly",
          installment: t.installment ? parseFloat(t.installment) : 0,
          tokens: [],
        });
      }
      const tokList = membershipMap.get(commId).tokens;
      if (t.t.tokenNumber && !tokList.includes(t.t.tokenNumber)) {
        tokList.push(t.t.tokenNumber);
      }
    }
    for (const m of membershipRows) {
      const commId = m.cm.committeeId;
      if (!membershipMap.has(commId)) {
        membershipMap.set(commId, {
          committeeId: commId,
          committeeName: m.commName ?? "General Bissi Scheme",
          type: m.commType ?? "monthly",
          installment: m.installment ? parseFloat(m.installment) : 0,
          tokens: [],
        });
      }
      const tokList = membershipMap.get(commId).tokens;
      if (m.cm.tokenNumber && !tokList.includes(m.cm.tokenNumber)) {
        tokList.push(m.cm.tokenNumber);
      }
    }
    const memberships = Array.from(membershipMap.values());

    const tokens = tokenRows.map(t => ({
      id: t.t.id,
      tokenNumber: t.t.tokenNumber,
      committeeName: t.commName ?? "General Bissi Scheme",
      status: t.t.status,
    }));

    const collections = collectionRows.map((c: any) => ({
      id: c.id,
      amount: parseFloat(c.amount || "0"),
      paymentMode: c.paymentMode,
      date: safeIso(c.collectedAt),
      notes: c.notes,
      committeeId: c.committeeId,
    }));

    const totalPaid = collectionRows.reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0);
    const totalLoanAmount = loanRows.reduce((s: number, l: any) => s + (parseFloat(l.principalAmount) || 0), 0);
    const totalLoanPaid = loanRows.reduce((s: number, l: any) => s + (parseFloat(l.paidAmount) || 0), 0);

    res.json({
      customer: {
        ...row.c,
        branchName: row.branchName,
        createdAt: safeIso(row.c.createdAt),
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
      loans: loanRows.map((l: any) => ({
        ...l,
        principalAmount: parseFloat(l.principalAmount || "0"),
        interestRate: parseFloat(l.interestRate || "0"),
        paidAmount: parseFloat(l.paidAmount || "0"),
        emiAmount: l.emiAmount ? parseFloat(l.emiAmount) : null,
        totalAmount: l.totalAmount ? parseFloat(l.totalAmount) : null,
        createdAt: safeIso(l.createdAt),
      })),
      gifts: giftRows.map((g: any) => ({
        id: g.gd?.id,
        giftName: g.giftName ?? "Association Gift",
        quantity: g.gd?.quantity ?? 1,
        date: safeIso(g.gd?.distributionDate),
        status: g.gd?.status ?? "distributed",
      })),
      interestAccounts: interestRows.map((a: any) => ({
        ...a,
        principalAmount: parseFloat(a.principalAmount || "0"),
        interestRate: parseFloat(a.interestRate || "0"),
        monthlyInterest: parseFloat(a.monthlyInterest ?? "0"),
        totalInterestPaid: parseFloat(a.totalInterestPaid || "0"),
        pendingInterest: parseFloat(a.pendingInterest || "0"),
        createdAt: safeIso(a.createdAt),
      })),
      recoveryTasks: recoveryRows.map((r: any) => ({
        ...r,
        createdAt: safeIso(r.createdAt),
      })),
    });
  } catch (err: any) {
    console.error("[GET /customers/:id/history ERROR]", err);
    res.status(500).json({ error: "Failed to load customer history", details: err?.message });
  }
});

// POST /customers/check-duplicate — Scans database for potential duplicate customer entries
router.post("/customers/check-duplicate", async (req, res): Promise<void> => {
  try {
    const { name, mobile, aadhaar } = req.body;
    if (!name && !mobile && !aadhaar) {
      res.json({ matchFound: false, candidates: [] });
      return;
    }

    const cleanMobile = mobile ? String(mobile).replace(/\D/g, "").slice(-10) : "";
    const cleanAadhaar = aadhaar ? String(aadhaar).replace(/\D/g, "") : "";
    const nameStr = name ? String(name).trim() : "";

    const candidates = await db
      .select({
        c: customersTable,
        branchName: branchesTable.name,
      })
      .from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(
        or(
          cleanMobile ? ilike(customersTable.mobile, `%${cleanMobile}%`) : sql`false`,
          cleanAadhaar ? eq(customersTable.aadhaar, cleanAadhaar) : sql`false`,
          nameStr ? ilike(customersTable.name, `%${nameStr}%`) : sql`false`
        )
      )
      .limit(10);

    const scored = candidates.map((row) => {
      let score = 0;
      if (cleanMobile && row.c.mobile && row.c.mobile.includes(cleanMobile)) score += 50;
      if (cleanAadhaar && row.c.aadhaar === cleanAadhaar) score += 40;
      if (nameStr && row.c.name.toLowerCase() === nameStr.toLowerCase()) score += 30;
      else if (nameStr && row.c.name.toLowerCase().includes(nameStr.toLowerCase())) score += 15;

      return {
        customer: {
          ...row.c,
          branchName: row.branchName,
          createdAt: safeIso(row.c.createdAt),
        },
        matchScore: score,
        isExactMatch: score >= 70,
      };
    });

    const sorted = scored.sort((a, b) => b.matchScore - a.matchScore);
    res.json({
      matchFound: sorted.length > 0 && sorted[0].matchScore >= 30,
      candidates: sorted,
    });
  } catch (err: any) {
    console.error("[CHECK DUPLICATE ERROR]", err);
    res.status(500).json({ error: "Failed to check duplicates" });
  }
});

// POST /customers/merge — Merge duplicate source customer into target canonical customer
router.post("/customers/merge", async (req, res): Promise<void> => {
  try {
    const { targetCustomerId, sourceCustomerId } = req.body;
    if (!targetCustomerId || !sourceCustomerId || targetCustomerId === sourceCustomerId) {
      res.status(400).json({ error: "Valid targetCustomerId and sourceCustomerId required (must be different)" });
      return;
    }

    const targetId = parseInt(String(targetCustomerId), 10);
    const sourceId = parseInt(String(sourceCustomerId), 10);

    const [targetCust] = await db.select().from(customersTable).where(eq(customersTable.id, targetId));
    const [sourceCust] = await db.select().from(customersTable).where(eq(customersTable.id, sourceId));

    if (!targetCust || !sourceCust) {
      res.status(404).json({ error: "Target or Source customer record not found" });
      return;
    }

    // Execute safe merge across all child tables
    await Promise.all([
      db.update(tokensTable).set({ customerId: targetId }).where(eq(tokensTable.customerId, sourceId)),
      db.update(loansTable).set({ customerId: targetId }).where(eq(loansTable.customerId, sourceId)),
      db.update(collectionsTable).set({ customerId: targetId }).where(eq(collectionsTable.customerId, sourceId)),
      db.update(committeeMembersTable).set({ customerId: targetId }).where(eq(committeeMembersTable.customerId, sourceId)),
      db.update(giftDistributionsTable).set({ customerId: targetId }).where(eq(giftDistributionsTable.customerId, sourceId)),
      db.update(interestAccountsTable).set({ customerId: targetId }).where(eq(interestAccountsTable.customerId, sourceId)),
      db.update(recoveryTasksTable).set({ customerId: targetId }).where(eq(recoveryTasksTable.customerId, sourceId)),
    ]);

    // Mark source customer as merged
    await db
      .update(customersTable)
      .set({
        status: "merged" as any,
        recoveryNotes: `Merged into Canonical Customer #${targetId} (${targetCust.referenceNumber}) on ${new Date().toISOString()}`,
      })
      .where(eq(customersTable.id, sourceId));

    res.json({
      message: `Successfully merged Customer #${sourceId} (${sourceCust.name}) into Customer #${targetId} (${targetCust.name})`,
      targetCustomer: {
        ...targetCust,
        createdAt: safeIso(targetCust.createdAt),
      },
    });
  } catch (err: any) {
    console.error("[CUSTOMER MERGE ERROR]", err);
    res.status(500).json({ error: "Failed to merge customer records" });
  }
});

export default router;
