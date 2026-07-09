import { Router, type IRouter } from "express";
import { db, collectionsTable, customersTable, collectorsTable, committeesTable, branchesTable, loansTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { createNotification, notifyManagers } from "./notifications";

const router: IRouter = Router();

function genReceipt(): string {
  return `RCP${Date.now()}`;
}

router.get("/collections", async (req, res): Promise<void> => {
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

  if (customerId) rows = rows.filter((r) => r.c.customerId === parseInt(customerId as string, 10));
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
    collectedAt: r.c.collectedAt.toISOString(),
    createdAt: r.c.createdAt.toISOString(),
  }));

  res.json({ data, total, page: pageNum, limit: limitNum });
});

router.post("/collections", async (req, res): Promise<void> => {
  const { customerId, collectorId, committeeId, loanId, amount, paymentMode, notes, collectedAt } = req.body;
  if (!customerId || !amount || !paymentMode) {
    res.status(400).json({ error: "customerId, amount, paymentMode required" });
    return;
  }

  // Determine branchId from customer
  const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));

  const [col] = await db
    .insert(collectionsTable)
    .values({
      customerId,
      collectorId: collectorId ?? null,
      committeeId: committeeId ?? null,
      loanId: loanId ?? null,
      branchId: cust?.branchId ?? null,
      amount: String(amount),
      paymentMode,
      receiptNumber: genReceipt(),
      notes,
      collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
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
    collectedAt: col.collectedAt.toISOString(),
    createdAt: col.createdAt.toISOString(),
  });

  // Fire-and-forget notifications — do NOT await so the response is already sent
  const amtFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(parseFloat(String(amount)));
  notifyManagers(
    cust?.branchId ?? null,
    "New Collection Recorded",
    `${amtFmt} collected from ${cust?.name ?? "customer"} via ${paymentMode}. Awaiting verification.`,
    "collection_recorded",
    col.id,
  );
});

router.get("/collections/today-summary", async (req, res): Promise<void> => {
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

router.get("/collections/due-today", async (req, res): Promise<void> => {
  // Return customers who haven't paid today
  const customers = await db.select().from(customersTable).where(eq(customersTable.status, "active")).limit(20);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCollections = await db.select().from(collectionsTable).where(gte(collectionsTable.collectedAt, today));
  const paidToday = new Set(todayCollections.map((c) => c.customerId));

  const committees = await db.select().from(committeesTable).where(eq(committeesTable.status, "active"));
  const defaultCommittee = committees[0];

  const dueList = customers
    .filter((c) => !paidToday.has(c.id))
    .slice(0, 10)
    .map((c) => ({
      customerId: c.id,
      customerName: c.name,
      mobile: c.mobile,
      referenceNumber: c.referenceNumber,
      dueAmount: defaultCommittee ? parseFloat(defaultCommittee.installmentAmount) : 500,
      committeeId: defaultCommittee?.id ?? 1,
      committeeName: defaultCommittee?.name ?? "General Committee",
      lastPaidAt: null,
    }));

  res.json(dueList);
});

router.get("/collections/:id", async (req, res): Promise<void> => {
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
  res.json({
    ...row.c,
    customerName: row.customerName,
    customerMobile: row.customerMobile,
    collectorName: row.collectorName,
    committeeName: row.committeeName,
    amount: parseFloat(row.c.amount),
    collectedAt: row.c.collectedAt.toISOString(),
    createdAt: row.c.createdAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Verify / Reject a collection (branch_manager, owner, super_admin only)
// ---------------------------------------------------------------------------
router.patch("/collections/:id/verify", async (req, res): Promise<void> => {
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

  res.json({ ...col, amount: parseFloat(col.amount), collectedAt: col.collectedAt.toISOString(), createdAt: col.createdAt.toISOString() });

  // Notify the collector who recorded this (find user by collector mobile match)
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

// ---------------------------------------------------------------------------
// Pending verifications count (for manager dashboard badge)
// ---------------------------------------------------------------------------
router.get("/collections/pending-verifications", async (req, res): Promise<void> => {
  const { branchId } = req.query;
  const conditions: any[] = [eq(collectionsTable.verificationStatus, "pending")];
  if (branchId) conditions.push(eq(collectionsTable.branchId, parseInt(branchId as string, 10)));
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectionsTable)
    .where(and(...conditions));
  res.json({ count: row?.count ?? 0 });
});

export default router;
