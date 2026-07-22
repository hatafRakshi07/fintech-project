import { Router, type IRouter } from "express";
import { db, tokensTable, customersTable, committeesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// Helper to get linked customerId for customer role
async function getCustomerLimitId(userId: number, role: string): Promise<number | null | undefined> {
  if (role !== "customer") return undefined;
  const [user] = await db.select({ customerId: usersTable.customerId }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.customerId;
}

router.get("/tokens", async (req, res): Promise<void> => {
  const customerLimitId = await getCustomerLimitId(req.userId, req.userRole);
  if (customerLimitId === null) {
    res.status(403).json({ error: "Access Denied: Customer profile not linked." });
    return;
  }

  const { customerId, committeeId, status } = req.query;
  let rows = await db
    .select({ t: tokensTable, customerName: customersTable.name, committeeName: committeesTable.name })
    .from(tokensTable)
    .leftJoin(customersTable, eq(tokensTable.customerId, customersTable.id))
    .leftJoin(committeesTable, eq(tokensTable.committeeId, committeesTable.id))
    .orderBy(tokensTable.createdAt);

  // Enforce customer restriction or general query filter
  const targetCustomerId = customerLimitId !== undefined ? customerLimitId : (customerId ? parseInt(customerId as string, 10) : undefined);

  if (targetCustomerId !== undefined) rows = rows.filter((r) => r.t.customerId === targetCustomerId);
  if (committeeId) rows = rows.filter((r) => r.t.committeeId === parseInt(committeeId as string, 10));
  if (status) rows = rows.filter((r) => r.t.status === status);

  res.json(rows.map((r) => ({ ...r.t, customerName: r.customerName, committeeName: r.committeeName, createdAt: r.t.createdAt.toISOString() })));
});

router.post("/tokens", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot create tokens." });
    return;
  }
  const { customerId, committeeId, tokenNumber } = req.body;
  if (!customerId || !committeeId) {
    res.status(400).json({ error: "customerId, committeeId required" });
    return;
  }
  const autoToken = tokenNumber ?? `TK${Date.now()}`;
  const [token] = await db.insert(tokensTable).values({ customerId, committeeId, tokenNumber: autoToken, status: "active" }).returning();
  res.status(201).json({ ...token, customerName: null, committeeName: null, createdAt: token.createdAt.toISOString() });
});

router.get("/tokens/:id", async (req, res): Promise<void> => {
  const customerLimitId = await getCustomerLimitId(req.userId, req.userRole);
  if (customerLimitId === null) {
    res.status(403).json({ error: "Access Denied: Customer profile not linked." });
    return;
  }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({ t: tokensTable, customerName: customersTable.name, committeeName: committeesTable.name })
    .from(tokensTable)
    .leftJoin(customersTable, eq(tokensTable.customerId, customersTable.id))
    .leftJoin(committeesTable, eq(tokensTable.committeeId, committeesTable.id))
    .where(eq(tokensTable.id, id));
  if (!row) { res.status(404).json({ error: "Token not found" }); return; }

  // Enforce customer restriction
  if (customerLimitId !== undefined && row.t.customerId !== customerLimitId) {
    res.status(403).json({ error: "Forbidden: You do not have permission to view this token." });
    return;
  }

  res.json({ ...row.t, customerName: row.customerName, committeeName: row.committeeName, createdAt: row.t.createdAt.toISOString() });
});

router.patch("/tokens/:id", async (req, res): Promise<void> => {
  if (req.userRole === "customer") {
    res.status(403).json({ error: "Forbidden: Customers cannot modify tokens." });
    return;
  }
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { status, transferToCustomerId } = req.body;
  const update: any = {};
  if (status !== undefined) update.status = status;
  if (transferToCustomerId !== undefined) update.customerId = transferToCustomerId;
  const [token] = await db.update(tokensTable).set(update).where(eq(tokensTable.id, id)).returning();
  if (!token) { res.status(404).json({ error: "Token not found" }); return; }
  res.json({ ...token, customerName: null, committeeName: null, createdAt: token.createdAt.toISOString() });
});

export default router;
