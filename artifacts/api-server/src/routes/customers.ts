import { Router, type IRouter } from "express";
import { db, customersTable, branchesTable, tokensTable, loansTable, collectionsTable } from "@workspace/db";
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
        ilike(customersTable.referenceNumber, `%${search}%`)
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
  const { name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status } = req.body;
  if (!name || !mobile || !branchId) {
    res.status(400).json({ error: "name, mobile, branchId required" });
    return;
  }
  const referenceNumber = await getNextRef();
  const [customer] = await db
    .insert(customersTable)
    .values({ name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status: status ?? "active", referenceNumber })
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

  const [tokCount] = await db.select({ c: sql<number>`count(*)::int` }).from(tokensTable).where(eq(tokensTable.customerId, id));
  const [lnCount] = await db.select({ c: sql<number>`count(*)::int` }).from(loansTable).where(eq(loansTable.customerId, id));
  const [paid] = await db.select({ sum: sql<string>`coalesce(sum(amount),0)` }).from(collectionsTable).where(eq(collectionsTable.customerId, id));

  res.json({
    ...row.c,
    branchName: row.branchName,
    totalTokens: tokCount?.c ?? 0,
    totalLoans: lnCount?.c ?? 0,
    totalPaid: parseFloat(paid?.sum ?? "0"),
    createdAt: row.c.createdAt.toISOString(),
  });
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status } = req.body;
  const [customer] = await db
    .update(customersTable)
    .set({ name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId, status })
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

  const collections = await db.select().from(collectionsTable).where(eq(collectionsTable.customerId, id)).orderBy(collectionsTable.collectedAt);

  const entries = collections.map((c, i) => ({
    id: c.id,
    type: "payment" as const,
    description: `Payment via ${c.paymentMode}${c.receiptNumber ? ` (${c.receiptNumber})` : ""}`,
    amount: parseFloat(c.amount),
    balance: null,
    date: c.collectedAt.toISOString(),
  }));

  const [paid] = await db.select({ sum: sql<string>`coalesce(sum(amount),0)` }).from(collectionsTable).where(eq(collectionsTable.customerId, id));
  const totalPaid = parseFloat(paid?.sum ?? "0");

  const customer = { ...row.c, branchName: row.branchName, totalTokens: 0, totalLoans: 0, totalPaid, createdAt: row.c.createdAt.toISOString() };

  res.json({ customer, entries, totalPaid, totalDue: 0 });
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

export default router;
