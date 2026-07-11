import { Router, type IRouter } from "express";
import { db, committeesTable, committeeMembersTable, branchesTable, customersTable, collectionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/committees", async (req, res): Promise<void> => {
  const { branchId, status, type } = req.query;
  let rows = await db
    .select({ com: committeesTable, branchName: branchesTable.name })
    .from(committeesTable)
    .leftJoin(branchesTable, eq(committeesTable.branchId, branchesTable.id))
    .orderBy(committeesTable.createdAt);

  if (branchId) rows = rows.filter((r) => r.com.branchId === parseInt(branchId as string, 10));
  if (status) rows = rows.filter((r) => r.com.status === status);
  if (type) rows = rows.filter((r) => r.com.type === type);

  const result = await Promise.all(
    rows.map(async (row) => {
      const [memberCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(committeeMembersTable)
        .where(eq(committeeMembersTable.committeeId, row.com.id));
      const [collected] = await db
        .select({ sum: sql<string>`coalesce(sum(amount),0)` })
        .from(collectionsTable)
        .where(eq(collectionsTable.committeeId, row.com.id));
      return {
        ...row.com,
        branchName: row.branchName,
        installmentAmount: parseFloat(row.com.installmentAmount),
        currentMembers: memberCount?.count ?? 0,
        totalCollected: parseFloat(collected?.sum ?? "0"),
        createdAt: row.com.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/committees", async (req, res): Promise<void> => {
  const { name, type, installmentAmount, memberLimit, drawDate, branchId, status } = req.body;
  if (!name || !type || !installmentAmount || !memberLimit || !branchId) {
    res.status(400).json({ error: "name, type, installmentAmount, memberLimit, branchId required" });
    return;
  }
  const [com] = await db
    .insert(committeesTable)
    .values({ name, type, installmentAmount: String(installmentAmount), memberLimit, drawDate, branchId, status: status ?? "active" })
    .returning();
  res.status(201).json({ ...com, installmentAmount: parseFloat(com.installmentAmount), currentMembers: 0, totalCollected: 0, createdAt: com.createdAt.toISOString() });
});

router.get("/committees/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({ com: committeesTable, branchName: branchesTable.name })
    .from(committeesTable)
    .leftJoin(branchesTable, eq(committeesTable.branchId, branchesTable.id))
    .where(eq(committeesTable.id, id));
  if (!row) { res.status(404).json({ error: "Committee not found" }); return; }
  const [memberCount] = await db.select({ count: sql<number>`count(*)::int` }).from(committeeMembersTable).where(eq(committeeMembersTable.committeeId, id));
  const [collected] = await db.select({ sum: sql<string>`coalesce(sum(amount),0)` }).from(collectionsTable).where(eq(collectionsTable.committeeId, id));
  res.json({
    ...row.com,
    branchName: row.branchName,
    installmentAmount: parseFloat(row.com.installmentAmount),
    currentMembers: memberCount?.count ?? 0,
    totalCollected: parseFloat(collected?.sum ?? "0"),
    createdAt: row.com.createdAt.toISOString(),
  });
});

router.patch("/committees/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, installmentAmount, memberLimit, drawDate, status } = req.body;
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (installmentAmount !== undefined) updateData.installmentAmount = String(installmentAmount);
  if (memberLimit !== undefined) updateData.memberLimit = memberLimit;
  if (drawDate !== undefined) updateData.drawDate = drawDate;
  if (status !== undefined) updateData.status = status;
  const [com] = await db.update(committeesTable).set(updateData).where(eq(committeesTable.id, id)).returning();
  if (!com) { res.status(404).json({ error: "Committee not found" }); return; }
  res.json({ ...com, installmentAmount: parseFloat(com.installmentAmount), currentMembers: 0, totalCollected: 0, createdAt: com.createdAt.toISOString() });
});

router.get("/committees/:id/members", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const members = await db
    .select({
      m: committeeMembersTable,
      customerName: customersTable.name,
      customerMobile: customersTable.mobile,
      referenceNumber: customersTable.referenceNumber,
    })
    .from(committeeMembersTable)
    .leftJoin(customersTable, eq(committeeMembersTable.customerId, customersTable.id))
    .where(eq(committeeMembersTable.committeeId, id))
    .orderBy(committeeMembersTable.customerId);
  res.json(members.map((m) => ({
    id: m.m.id,
    committeeId: m.m.committeeId,
    customerId: m.m.customerId,
    customerName: m.customerName ?? "",
    customerMobile: m.customerMobile,
    referenceNumber: m.referenceNumber ?? "",
    tokenNumber: m.m.tokenNumber,
    status: m.m.status,
    joinedAt: m.m.joinedAt.toISOString(),
  })));
});

router.post("/committees/:id/members", async (req, res): Promise<void> => {
  const committeeId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { customerId, tokenNumber } = req.body;
  if (!customerId) { res.status(400).json({ error: "customerId required" }); return; }

  const [count] = await db.select({ c: sql<number>`count(*)::int` }).from(committeeMembersTable).where(eq(committeeMembersTable.committeeId, committeeId));
  const autoToken = tokenNumber ?? `T${String((count?.c ?? 0) + 1).padStart(4, "0")}`;

  const [member] = await db.insert(committeeMembersTable).values({ committeeId, customerId, tokenNumber: autoToken }).returning();
  const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  res.status(201).json({
    id: member.id,
    committeeId: member.committeeId,
    customerId: member.customerId,
    customerName: cust?.name ?? "",
    customerMobile: cust?.mobile,
    tokenNumber: member.tokenNumber,
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
  });
});

export default router;
