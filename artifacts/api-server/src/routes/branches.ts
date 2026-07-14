import { Router, type IRouter } from "express";
import { db, branchesTable, customersTable, collectorsTable } from "@workspace/db";
import { eq, ilike, sql, or } from "drizzle-orm";

const router: IRouter = Router();

router.get("/branches", async (req, res): Promise<void> => {
  const { search } = req.query;
  let query = db.select().from(branchesTable).$dynamic();
  if (search && typeof search === "string") {
    query = (query as any).where(
      or(
        ilike(branchesTable.name, `%${search}%`),
        ilike(branchesTable.city, `%${search}%`),
        ilike(branchesTable.code, `%${search}%`)
      )
    );
  }
  const rows = await (query as any).orderBy(branchesTable.name) as Array<typeof branchesTable.$inferSelect>;

  const customerCounts = await db
    .select({ branchId: customersTable.branchId, count: sql<number>`count(*)::int` })
    .from(customersTable)
    .groupBy(customersTable.branchId);

  const collectorCounts = await db
    .select({ branchId: collectorsTable.branchId, count: sql<number>`count(*)::int` })
    .from(collectorsTable)
    .groupBy(collectorsTable.branchId);

  const result = rows.map((b) => ({
    ...b,
    totalCustomers: customerCounts.find((c) => c.branchId === b.id)?.count ?? 0,
    totalCollectors: collectorCounts.find((c) => c.branchId === b.id)?.count ?? 0,
    createdAt: b.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/branches", async (req, res): Promise<void> => {
  const { name, code, city, address, phone, managerName, status } = req.body;
  if (!name || !code || !city) {
    res.status(400).json({ error: "name, code, city required" });
    return;
  }
  const [branch] = await db
    .insert(branchesTable)
    .values({ name, code, city, address, phone, managerName, status: status ?? "active" })
    .returning();
  res.status(201).json({ ...branch, totalCustomers: 0, totalCollectors: 0, createdAt: branch.createdAt.toISOString() });
});

router.get("/branches/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, id));
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }

  const [custCount] = await db.select({ count: sql<number>`count(*)::int` }).from(customersTable).where(eq(customersTable.branchId, id));
  const [collCount] = await db.select({ count: sql<number>`count(*)::int` }).from(collectorsTable).where(eq(collectorsTable.branchId, id));

  res.json({
    ...branch,
    totalCustomers: custCount?.count ?? 0,
    totalCollectors: collCount?.count ?? 0,
    createdAt: branch.createdAt.toISOString(),
  });
});

router.patch("/branches/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, code, city, address, phone, managerName, status } = req.body;
  const [branch] = await db
    .update(branchesTable)
    .set({ name, code, city, address, phone, managerName, status })
    .where(eq(branchesTable.id, id))
    .returning();
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }
  res.json({ ...branch, totalCustomers: 0, totalCollectors: 0, createdAt: branch.createdAt.toISOString() });
});

router.delete("/branches/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(branchesTable).where(eq(branchesTable.id, id));
  res.sendStatus(204);
});

export default router;
