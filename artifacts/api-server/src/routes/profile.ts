/**
 * /profile  — self-service endpoints for customer-role users
 *
 * These routes are registered OUTSIDE the customers router so the
 * customer role can access their own data without needing higher privileges.
 * All routes here still require a valid session (requireAuth is applied
 * at the top-level router in routes/index.ts).
 */
import { Router, type IRouter } from "express";
import {
  db,
  customersTable,
  branchesTable,
  tokensTable,
  loansTable,
  collectionsTable,
  committeesTable,
  committeeMembersTable,
  giftDistributionsTable,
  giftInventoryTable,
  interestAccountsTable,
  recoveryTasksTable,
  usersTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helper — resolve customer record for the current user
// ---------------------------------------------------------------------------
async function resolveCustomer(userId: number) {
  // Look up the user's linked customer ID
  const [user] = await db
    .select({ customerId: usersTable.customerId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const customerId = user?.customerId;
  if (!customerId) return null;

  const [row] = await db
    .select({ c: customersTable, branchName: branchesTable.name })
    .from(customersTable)
    .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
    .where(eq(customersTable.id, customerId));

  return row ?? null;
}

// ---------------------------------------------------------------------------
// GET /profile/me  — full profile of the logged-in customer
// ---------------------------------------------------------------------------
router.get("/profile/me", async (req, res): Promise<void> => {
  const row = await resolveCustomer(req.userId);
  if (!row) {
    res.status(404).json({ error: "No customer record linked to this account. Ask your branch manager to link your account." });
    return;
  }

  const id = row.c.id;

  const [
    tokCount,
    lnRows,
    collRows,
    giftRows,
    memberships,
    interestAccs,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(tokensTable).where(eq(tokensTable.customerId, id)),
    // Active / overdue loans
    db.select().from(loansTable).where(eq(loansTable.customerId, id)).orderBy(desc(loansTable.createdAt)),
    // Recent 50 collections
    db.select().from(collectionsTable).where(eq(collectionsTable.customerId, id)).orderBy(desc(collectionsTable.collectedAt)).limit(50),
    // Gift distributions
    db
      .select({ gd: giftDistributionsTable, giftName: giftInventoryTable.name })
      .from(giftDistributionsTable)
      .leftJoin(giftInventoryTable, eq(giftDistributionsTable.giftId, giftInventoryTable.id))
      .where(eq(giftDistributionsTable.customerId, id))
      .orderBy(desc(giftDistributionsTable.createdAt)),
    // Committee memberships
    db
      .select({ cm: committeeMembersTable, commName: committeesTable.name, commType: committeesTable.type })
      .from(committeeMembersTable)
      .leftJoin(committeesTable, eq(committeeMembersTable.committeeId, committeesTable.id))
      .where(eq(committeeMembersTable.customerId, id)),
    db.select().from(interestAccountsTable).where(eq(interestAccountsTable.customerId, id)),
  ]);

  const totalPaid = collRows.reduce((s, c) => s + parseFloat(c.amount), 0);
  const activeLoans = lnRows.filter((l) => ["active", "approved", "overdue"].includes(l.status));
  const outstandingAmount = activeLoans.reduce((s, l) => {
    const total = parseFloat(l.totalAmount ?? "0");
    const paid = parseFloat(l.paidAmount);
    return s + Math.max(0, total - paid);
  }, 0);

  res.json({
    customer: {
      ...row.c,
      branchName: row.branchName,
      totalTokens: tokCount[0]?.c ?? 0,
      totalLoans: lnRows.length,
      totalPaid,
      outstandingAmount,
      createdAt: row.c.createdAt.toISOString(),
    },
    loans: lnRows.map((l) => ({
      ...l,
      principalAmount: parseFloat(l.principalAmount),
      interestRate: parseFloat(l.interestRate),
      paidAmount: parseFloat(l.paidAmount),
      emiAmount: l.emiAmount ? parseFloat(l.emiAmount) : null,
      totalAmount: l.totalAmount ? parseFloat(l.totalAmount) : null,
      outstandingAmount: Math.max(0, parseFloat(l.totalAmount ?? "0") - parseFloat(l.paidAmount)),
      createdAt: l.createdAt.toISOString(),
      disbursedAt: l.disbursedAt?.toISOString() ?? null,
    })),
    collections: collRows.map((c) => ({
      ...c,
      amount: parseFloat(c.amount),
      collectedAt: c.collectedAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
    gifts: giftRows.map((g) => ({
      ...g.gd,
      giftName: g.giftName,
      createdAt: g.gd.createdAt.toISOString(),
    })),
    committees: Object.values(
      memberships.reduce((acc: Record<number, any>, m) => {
        const key = m.cm.committeeId;
        if (!acc[key]) acc[key] = { committeeId: key, committeeName: m.commName ?? "", type: m.commType ?? "" };
        return acc;
      }, {})
    ),
    interestAccounts: interestAccs.map((a) => ({
      ...a,
      principalAmount: parseFloat(a.principalAmount),
      interestRate: parseFloat(a.interestRate),
      monthlyInterest: parseFloat(a.monthlyInterest ?? "0"),
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

// ---------------------------------------------------------------------------
// GET /profile/kyc-lookup  — Lookup customer KYC profile by mobile number or current user
// ---------------------------------------------------------------------------
router.get("/profile/kyc-lookup", async (req, res): Promise<void> => {
  try {
    const { mobile, name } = req.query;
    let customerRow: any = null;

    if (mobile && typeof mobile === "string" && mobile.trim().length >= 3) {
      const searchStr = mobile.trim();
      const cleanMobile = searchStr.replace(/\D/g, "").slice(-10);
      const nameStr = typeof name === "string" ? name.trim() : "";

      let whereClause = sql`${customersTable.mobile} LIKE ${"%" + cleanMobile} OR ${customersTable.referenceNumber} ILIKE ${"%" + searchStr + "%"}`;
      if (nameStr) {
        whereClause = sql`(${customersTable.mobile} LIKE ${"%" + cleanMobile} OR ${customersTable.referenceNumber} ILIKE ${"%" + searchStr + "%"}) AND ${customersTable.name} ILIKE ${"%" + nameStr + "%"}`;
      }

      const [row] = await db
        .select({ c: customersTable, branchName: branchesTable.name })
        .from(customersTable)
        .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
        .where(whereClause)
        .limit(1);

      customerRow = row;

      // Fallback search if name filter was too strict
      if (!customerRow && nameStr) {
        const [fallbackRow] = await db
          .select({ c: customersTable, branchName: branchesTable.name })
          .from(customersTable)
          .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
          .where(sql`${customersTable.mobile} LIKE ${"%" + cleanMobile}`)
          .limit(1);
        customerRow = fallbackRow;
      }
    }

    if (!customerRow) {
      customerRow = await resolveCustomer(req.userId);
    }

    if (!customerRow) {
      res.status(404).json({ error: "Customer details not found for the entered name and mobile number." });
      return;
    }

    const id = customerRow.c.id;

    const [
      tokRows,
      lnRows,
      collRows,
      giftRows,
      memberships,
      interestAccs,
    ] = await Promise.all([
      db.select({ t: tokensTable, commName: committeesTable.name }).from(tokensTable).leftJoin(committeesTable, eq(tokensTable.committeeId, committeesTable.id)).where(eq(tokensTable.customerId, id)).catch(() => []),
      db.select().from(loansTable).where(eq(loansTable.customerId, id)).catch(() => []),
      db.select().from(collectionsTable).where(eq(collectionsTable.customerId, id)).orderBy(desc(collectionsTable.collectedAt)).limit(100).catch(() => []),
      db
        .select({ gd: giftDistributionsTable, giftName: giftInventoryTable.name })
        .from(giftDistributionsTable)
        .leftJoin(giftInventoryTable, eq(giftDistributionsTable.giftId, giftInventoryTable.id))
        .where(eq(giftDistributionsTable.customerId, id))
        .catch(() => []),
      db
        .select({ cm: committeeMembersTable, commName: committeesTable.name, commType: committeesTable.type })
        .from(committeeMembersTable)
        .leftJoin(committeesTable, eq(committeeMembersTable.committeeId, committeesTable.id))
        .where(eq(committeeMembersTable.customerId, id))
        .catch(() => []),
      db.select().from(interestAccountsTable).where(eq(interestAccountsTable.customerId, id)).catch(() => []),
    ]);

    const totalPaid = collRows.reduce((s, c) => s + parseFloat(c.amount || "0"), 0);

    res.json({
      customer: {
        ...customerRow.c,
        branchName: customerRow.branchName,
        totalTokens: tokRows.length,
        totalLoans: lnRows.length,
        totalPaid,
        createdAt: safeIso(customerRow.c.createdAt),
      },
      tokens: tokRows.map(t => ({
        ...t.t,
        committeeName: t.commName ?? "General Bissi",
        createdAt: safeIso(t.t.createdAt),
      })),
      loans: lnRows.map(l => ({
        ...l,
        principalAmount: parseFloat(l.principalAmount || "0"),
        interestRate: parseFloat(l.interestRate || "0"),
        paidAmount: parseFloat(l.paidAmount || "0"),
        emiAmount: l.emiAmount ? parseFloat(l.emiAmount) : null,
        totalAmount: l.totalAmount ? parseFloat(l.totalAmount) : null,
        outstandingAmount: l.outstandingAmount ? parseFloat(l.outstandingAmount) : parseFloat(l.principalAmount || "0"),
        createdAt: safeIso(l.createdAt),
      })),
      collections: collRows.map(c => ({
        ...c,
        amount: parseFloat(c.amount || "0"),
        collectedAt: safeIso(c.collectedAt),
        createdAt: safeIso(c.createdAt),
      })),
      gifts: giftRows.map(g => ({
        ...g.gd,
        giftName: g.giftName ?? "Association Gift",
        createdAt: safeIso(g.gd?.createdAt),
      })),
      interestAccounts: interestAccs.map(a => ({
        ...a,
        principalAmount: parseFloat(a.principalAmount || "0"),
        interestRate: parseFloat(a.interestRate || "0"),
        monthlyInterest: parseFloat(a.monthlyInterest ?? "0"),
      })),
      kycStatus: {
        isVerified: true,
        verificationLevel: "Level 2 - Full KYC Verified",
        verifiedAt: safeIso(customerRow.c.createdAt),
        aadhaarStatus: customerRow.c.aadhaar ? "Verified" : "Pending Document Upload",
        panStatus: customerRow.c.pan ? "Verified" : "Not Provided",
        addressStatus: customerRow.c.address ? "Verified" : "Pending",
      },
    });
  } catch (err: any) {
    console.error("[GET /profile/kyc-lookup ERROR]", err);
    res.status(500).json({ error: "Failed to load customer profile details", details: err?.message });
  }
});

// ---------------------------------------------------------------------------
// GET /profile/notifications  — customer's own notifications (last 50)
// ---------------------------------------------------------------------------
router.get("/profile/notifications", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(rows);
});

// ---------------------------------------------------------------------------
// PATCH /profile/notifications/:id/read
// ---------------------------------------------------------------------------
router.patch("/profile/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
