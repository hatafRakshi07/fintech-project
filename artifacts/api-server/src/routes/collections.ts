import { Router, type IRouter } from "express";
import { db, collectionsTable, customersTable, collectorsTable, committeesTable, branchesTable, loansTable, usersTable, tokensTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { createNotification, notifyManagers } from "./notifications";

const router: IRouter = Router();

function safeIso(d: any): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  return new Date().toISOString();
}

// Helper to get linked customerId for customer role
async function getCustomerLimitId(userId: number, role: string): Promise<number | null | undefined> {
  if (role !== "customer") return undefined;
  const [user] = await db.select({ customerId: usersTable.customerId }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.customerId;
}

function genReceipt(): string {
  return `RCP${Date.now()}`;
}

router.get("/collections", async (req, res): Promise<void> => {
  const customerLimitId = await getCustomerLimitId(req.userId, req.userRole);
  if (customerLimitId === null) {
    res.status(403).json({ error: "Access Denied: Customer profile not linked." });
    return;
  }

  const { customerId, collectorId, branchId, committeeId, loanId, date, status, page = "1", limit = "20" } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);
  const offset = (pageNum - 1) * limitNum;

  let rows = await db
    .select({
      c: collectionsTable,
      customerName: customersTable.name,
      customerMobile: customersTable.mobile,
      collectorName: collectorsTable.name,
      committeeName: committeesTable.name,
    })
    .from(collectionsTable)
    .leftJoin(customersTable, eq(collectionsTable.customerId, customersTable.id))
    .leftJoin(collectorsTable, eq(collectionsTable.collectorId, collectorsTable.id))
    .leftJoin(committeesTable, eq(collectionsTable.committeeId, committeesTable.id))
    .orderBy(collectionsTable.collectedAt);

  const targetCustomerId = customerLimitId !== undefined ? customerLimitId : (customerId ? parseInt(customerId as string, 10) : undefined);

  if (targetCustomerId !== undefined) rows = rows.filter((r) => r.c.customerId === targetCustomerId);
  if (collectorId) rows = rows.filter((r) => r.c.collectorId === parseInt(collectorId as string, 10));
  if (committeeId) rows = rows.filter((r) => r.c.committeeId === parseInt(committeeId as string, 10));
  if (loanId) rows = rows.filter((r) => r.c.loanId === parseInt(loanId as string, 10));
  if (branchId) rows = rows.filter((r) => r.c.branchId === parseInt(branchId as string, 10));
  if (date) {
    const d = new Date(date as string);
    rows = rows.filter((r) => {
      const cd = new Date(r.c.collectedAt);
      return cd.toDateString() === d.toDateString();
    });
  }

  const total = rows.length;
  const sliced = rows.slice(offset, offset + limitNum);

  const data = sliced.map((r) => ({
    ...r.c,
    customerName: r.customerName,
    customerMobile: r.customerMobile,
    collectorName: r.collectorName,
    committeeName: r.committeeName,
    amount: parseFloat(r.c.amount),
    collectedAt: safeIso(r.c.collectedAt),
    createdAt: safeIso(r.c.createdAt),
  }));

  res.json({ data, total, page: pageNum, limit: limitNum });
});

router.post("/collections", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot create collections." });
    return;
  }

  const {
    customerId,
    collectorId,
    committeeId,
    loanId,
    tokenId,
    accountId,
    accountName,
    amount,
    paymentMode,
    notes,
    collectedAt,
    billingName,
    billingPhone,
    billingAddress,
    billingGstin,
    tokenAllocations, // Optional array of multi-token split allocations [{ tokenId, committeeId, amount, notes }]
  } = req.body;

  if (!customerId || (!amount && (!tokenAllocations || tokenAllocations.length === 0)) || !paymentMode) {
    res.status(400).json({ error: "customerId, amount/tokenAllocations, paymentMode required" });
    return;
  }

  // Determine branchId from customer
  const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));

  // Multi-token batch allocation mode
  if (Array.isArray(tokenAllocations) && tokenAllocations.length > 0) {
    const createdRecords: any[] = [];
    for (const alloc of tokenAllocations) {
      if (!alloc.amount || parseFloat(String(alloc.amount)) <= 0) continue;
      const [record] = await db
        .insert(collectionsTable)
        .values({
          customerId,
          collectorId: collectorId ?? (req.userRole === "collector" ? req.userId : null),
          committeeId: alloc.committeeId ?? committeeId ?? null,
          loanId: loanId ?? null,
          tokenId: alloc.tokenId ?? null,
          accountId: accountId ?? null,
          accountName: accountName ?? null,
          branchId: cust?.branchId ?? null,
          amount: String(alloc.amount),
          paymentMode,
          receiptNumber: genReceipt(),
          notes: alloc.notes || notes || `Token Allocation #${alloc.tokenId || ""}`,
          collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
          billingName: billingName ?? null,
          billingPhone: billingPhone ?? null,
          billingAddress: billingAddress ?? null,
          billingGstin: billingGstin ?? null,
        })
        .returning();
      createdRecords.push(record);
    }

    const totalAllocated = createdRecords.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const amtFmtBatch = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalAllocated);
    notifyManagers(
      cust?.branchId ?? null,
      "Multi-Token Collection Recorded",
      `${amtFmtBatch} collected across ${createdRecords.length} tokens for ${cust?.name ?? "customer"}. Account: ${accountName || "Default"}.`,
      "collection_recorded",
      createdRecords[0]?.id ?? 0,
    );

    res.status(201).json({
      message: "Multi-token collections recorded successfully",
      records: createdRecords,
      totalAmount: totalAllocated,
    });
    return;
  }

  // Single collection mode
  const [col] = await db
    .insert(collectionsTable)
    .values({
      customerId,
      collectorId: collectorId ?? (req.userRole === "collector" ? req.userId : null),
      committeeId: committeeId ?? null,
      loanId: loanId ?? null,
      tokenId: tokenId ?? null,
      accountId: accountId ?? null,
      accountName: accountName ?? null,
      branchId: cust?.branchId ?? null,
      amount: String(amount),
      paymentMode,
      receiptNumber: genReceipt(),
      notes,
      collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
      billingName: billingName ?? null,
      billingPhone: billingPhone ?? null,
      billingAddress: billingAddress ?? null,
      billingGstin: billingGstin ?? null,
    })
    .returning();

  // If this is a loan repayment, update the loan's paid amount and status
  if (loanId) {
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, loanId));
    if (loan) {
      const newPaid = parseFloat(loan.paidAmount) + parseFloat(String(amount));
      const total = loan.totalAmount ? parseFloat(loan.totalAmount) : null;
      const newStatus = total !== null && newPaid >= total ? "closed" : loan.status === "overdue" ? "active" : loan.status;
      await db
        .update(loansTable)
        .set({ paidAmount: String(newPaid), status: newStatus as any })
        .where(eq(loansTable.id, loanId));
    }
  }

  res.status(201).json({
    ...col,
    amount: parseFloat(col.amount),
    collectedAt: safeIso(col.collectedAt),
    createdAt: safeIso(col.createdAt),
  });

  // Fire-and-forget notifications
  const amtFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(parseFloat(String(amount)));
  notifyManagers(
    cust?.branchId ?? null,
    "New Collection Recorded",
    `${amtFmt} collected from ${cust?.name ?? "customer"} via ${paymentMode} into ${accountName || "Account"}.`,
    "collection_recorded",
    col.id,
  );
});

router.get("/collections/today-summary", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot access collections summaries." });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await db.select().from(collectionsTable).where(gte(collectionsTable.collectedAt, today));

  const totalAmount = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const totalCount = rows.length;
  const cashAmount = rows.filter((r) => r.paymentMode === "cash").reduce((s, r) => s + parseFloat(r.amount), 0);
  const upiAmount = rows.filter((r) => r.paymentMode === "upi").reduce((s, r) => s + parseFloat(r.amount), 0);
  const bankAmount = rows.filter((r) => r.paymentMode === "bank").reduce((s, r) => s + parseFloat(r.amount), 0);
  const cardAmount = rows.filter((r) => r.paymentMode === "card").reduce((s, r) => s + parseFloat(r.amount), 0);

  res.json({ totalAmount, totalCount, cashAmount, upiAmount, bankAmount, cardAmount });
});

router.get("/collections/today-target-summary", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot access target summaries." });
    return;
  }

  const { branchId } = req.query;
  let customers = await db.select().from(customersTable).where(eq(customersTable.status, "active"));
  if (branchId) {
    const bId = parseInt(branchId as string, 10);
    if (!isNaN(bId)) customers = customers.filter(c => c.branchId === bId);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCollections = await db.select().from(collectionsTable).where(gte(collectionsTable.collectedAt, today));
  const paidCustomerIds = new Set(todayCollections.map(c => c.customerId));

  const committees = await db.select().from(committeesTable).where(eq(committeesTable.status, "active"));
  const defaultCommittee = committees[0];
  const unitDue = defaultCommittee ? parseFloat(defaultCommittee.installmentAmount) : 500;

  const totalTargetCustomers = customers.length;
  const paidCount = customers.filter(c => paidCustomerIds.has(c.id)).length;
  const pendingCount = totalTargetCustomers - paidCount;

  const totalTargetAmount = totalTargetCustomers * unitDue;
  const collectedAmount = todayCollections.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const remainingAmount = Math.max(0, totalTargetAmount - collectedAmount);
  const progressPercentage = totalTargetCustomers > 0 ? Math.round((paidCount / totalTargetCustomers) * 100) : 100;

  res.json({
    totalTargetCustomers,
    paidCount,
    pendingCount,
    totalTargetAmount,
    collectedAmount,
    remainingAmount,
    progressPercentage,
  });
});

router.get("/collections/due-today", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot access due lists." });
    return;
  }

  const { branchId, filter } = req.query;

  let customers = await db.select().from(customersTable).where(eq(customersTable.status, "active"));
  if (branchId) {
    const bId = parseInt(branchId as string, 10);
    if (!isNaN(bId)) customers = customers.filter(c => c.branchId === bId);
  }

  // Load all active tokens
  const tokens = await db.select().from(tokensTable).where(eq(tokensTable.status, "active"));
  const tokensMap = new Map<number, string[]>();
  tokens.forEach((t) => {
    const list = tokensMap.get(t.customerId) || [];
    list.push(t.tokenNumber);
    tokensMap.set(t.customerId, list);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCollections = await db.select().from(collectionsTable).where(gte(collectionsTable.collectedAt, today));
  const paidMap = new Map<number, any>();
  todayCollections.forEach(c => paidMap.set(c.customerId, c));

  const committees = await db.select().from(committeesTable).where(eq(committeesTable.status, "active"));
  const defaultCommittee = committees[0];
  const unitDue = defaultCommittee ? parseFloat(defaultCommittee.installmentAmount) : 500;

  let targetList = customers.map((c) => {
    const payment = paidMap.get(c.id);
    const customerTokens = tokensMap.get(c.id) || [];
    return {
      customerId: c.id,
      customerName: c.name,
      customerMobile: c.mobile,
      referenceNumber: c.referenceNumber,
      amountDue: unitDue,
      dueAmount: unitDue,
      committeeId: defaultCommittee?.id ?? 1,
      committeeName: defaultCommittee?.name ?? "General Committee",
      isPaidToday: !!payment,
      paidAmountToday: payment ? parseFloat(payment.amount) : 0,
      paymentModeToday: payment ? payment.paymentMode : null,
      paidAtToday: payment ? safeIso(payment.collectedAt) : null,
      lastPaymentDate: payment ? safeIso(payment.collectedAt) : null,
      tokens: customerTokens,
    };
  });

  if (filter === "pending") {
    targetList = targetList.filter((item) => !item.isPaidToday);
  } else if (filter === "paid") {
    targetList = targetList.filter((item) => item.isPaidToday);
  }

  res.json(targetList);
});

router.get("/collections/:id", async (req, res): Promise<void> => {
  const customerLimitId = await getCustomerLimitId(req.userId, req.userRole);
  if (customerLimitId === null) {
    res.status(403).json({ error: "Access Denied: Customer profile not linked." });
    return;
  }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({
      c: collectionsTable,
      customerName: customersTable.name,
      customerMobile: customersTable.mobile,
      collectorName: collectorsTable.name,
      committeeName: committeesTable.name,
    })
    .from(collectionsTable)
    .leftJoin(customersTable, eq(collectionsTable.customerId, customersTable.id))
    .leftJoin(collectorsTable, eq(collectionsTable.collectorId, collectorsTable.id))
    .leftJoin(committeesTable, eq(collectionsTable.committeeId, committeesTable.id))
    .where(eq(collectionsTable.id, id));
  if (!row) { res.status(404).json({ error: "Collection not found" }); return; }

  // Enforce customer restriction
  if (customerLimitId !== undefined && row.c.customerId !== customerLimitId) {
    res.status(403).json({ error: "Forbidden: You do not have permission to view this collection record." });
    return;
  }

  res.json({
    ...row.c,
    customerName: row.customerName,
    customerMobile: row.customerMobile,
    collectorName: row.collectorName,
    committeeName: row.committeeName,
    amount: parseFloat(row.c.amount),
    collectedAt: safeIso(row.c.collectedAt),
    createdAt: safeIso(row.c.createdAt),
  });
});

router.patch("/collections/:id/verify", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot verify collections." });
    return;
  }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { verificationStatus, verificationNotes } = req.body as {
    verificationStatus: "verified" | "rejected";
    verificationNotes?: string;
  };

  if (!verificationStatus || !["verified", "rejected"].includes(verificationStatus)) {
    res.status(400).json({ error: "verificationStatus must be 'verified' or 'rejected'" });
    return;
  }

  const [col] = await db
    .update(collectionsTable)
    .set({
      verificationStatus,
      verifiedById: req.userId,
      verifiedAt: new Date(),
      verificationNotes: verificationNotes ?? null,
    })
    .where(eq(collectionsTable.id, id))
    .returning();

  if (!col) { res.status(404).json({ error: "Collection not found" }); return; }

  res.json({ ...col, amount: parseFloat(col.amount), collectedAt: safeIso(col.collectedAt), createdAt: safeIso(col.createdAt) });

  // Notify the collector who recorded this
  if (col.collectorId) {
    const [collector] = await db.select({ mobile: collectorsTable.mobile }).from(collectorsTable).where(eq(collectorsTable.id, col.collectorId));
    if (collector?.mobile) {
      const [collectorUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, collector.mobile));
      if (collectorUser) {
        const [cust] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, col.customerId));
        const amtFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(parseFloat(col.amount));
        const isVerified = verificationStatus === "verified";
        createNotification({
          userId: collectorUser.id,
          title: isVerified ? "Collection Approved ✓" : "Collection Rejected ✗",
          message: isVerified
            ? `Your collection of ${amtFmt} from ${cust?.name ?? "customer"} has been approved.`
            : `Your collection of ${amtFmt} from ${cust?.name ?? "customer"} was rejected. ${verificationNotes ?? ""}`,
          type: isVerified ? "collection_verified" : "collection_rejected",
          entityId: id,
          entityType: "collection",
        });
      }
    }
  }
});

router.get("/collections/pending-verifications", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot access pending verification details." });
    return;
  }

  const { branchId } = req.query;
  const conditions: any[] = [eq(collectionsTable.verificationStatus, "pending")];
  if (branchId) conditions.push(eq(collectionsTable.branchId, parseInt(branchId as string, 10)));
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectionsTable)
    .where(and(...conditions));
  res.json({ count: row?.count ?? 0 });
});

// GET /collections/verification-queue — Returns pending collections with Collector Name attribution & Collector aggregates
router.get("/collections/verification-queue", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot access verification queue." });
    return;
  }

  try {
    const { branchId } = req.query;
    let rows = await db
      .select({
        c: collectionsTable,
        customerName: customersTable.name,
        customerMobile: customersTable.mobile,
        customerRef: customersTable.referenceNumber,
        collectorName: collectorsTable.name,
        collectorMobile: collectorsTable.mobile,
        committeeName: committeesTable.name,
        branchName: branchesTable.name,
      })
      .from(collectionsTable)
      .leftJoin(customersTable, eq(collectionsTable.customerId, customersTable.id))
      .leftJoin(collectorsTable, eq(collectionsTable.collectorId, collectorsTable.id))
      .leftJoin(committeesTable, eq(collectionsTable.committeeId, committeesTable.id))
      .leftJoin(branchesTable, eq(collectionsTable.branchId, branchesTable.id))
      .where(eq(collectionsTable.verificationStatus, "pending"))
      .orderBy(desc(collectionsTable.collectedAt));

    if (branchId) {
      const bId = parseInt(branchId as string, 10);
      if (!isNaN(bId)) rows = rows.filter((r) => r.c.branchId === bId);
    }

    // Compute Collector Aggregates (total collections & total unique customers per collector)
    const collectorStatsMap = new Map<string, { totalAmount: number; customerSet: Set<number> }>();

    rows.forEach((r) => {
      const colName = r.collectorName || "Field Collector";
      if (!collectorStatsMap.has(colName)) {
        collectorStatsMap.set(colName, { totalAmount: 0, customerSet: new Set() });
      }
      const stat = collectorStatsMap.get(colName)!;
      stat.totalAmount += parseFloat(r.c.amount || "0");
      if (r.c.customerId) stat.customerSet.add(r.c.customerId);
    });

    const collectorSummary = Array.from(collectorStatsMap.entries()).map(([collectorName, stat]) => ({
      collectorName,
      totalPendingAmount: stat.totalAmount,
      totalCustomersCollected: stat.customerSet.size,
    }));

    const queue = rows.map((r) => ({
      ...r.c,
      customerName: r.customerName ?? "Customer",
      customerMobile: r.customerMobile,
      customerRef: r.customerRef,
      collectorName: r.collectorName ?? "Field Collector",
      collectorMobile: r.collectorMobile,
      committeeName: r.committeeName ?? "General Scheme",
      branchName: r.branchName ?? "Main Branch",
      amount: parseFloat(r.c.amount || "0"),
      collectedAt: safeIso(r.c.collectedAt),
      createdAt: safeIso(r.c.createdAt),
    }));

    res.json({
      totalPending: queue.length,
      collectorSummary,
      queue,
    });
  } catch (err: any) {
    console.error("[VERIFICATION QUEUE ERROR]", err);
    res.status(500).json({ error: "Failed to fetch verification queue" });
  }
});

export default router;
