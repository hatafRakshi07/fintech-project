import { Router, type IRouter } from "express";
import {
  db,
  officeDiaryTable,
  officeTasksTable,
  complaintsTable,
  donationsTable,
  customersTable,
  usersTable,
  officeExpensesTable,
} from "@workspace/db";
import { eq, and, desc, ilike, sql, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Office Diary
// ---------------------------------------------------------------------------

router.get("/office/diary", async (req, res): Promise<void> => {
  const { branchId, from, to, category } = req.query;
  const conditions: any[] = [];
  if (branchId) conditions.push(eq(officeDiaryTable.branchId, parseInt(branchId as string, 10)));
  if (category) conditions.push(eq(officeDiaryTable.category, category as string));
  if (from) conditions.push(gte(officeDiaryTable.entryDate, from as string));
  if (to) conditions.push(lte(officeDiaryTable.entryDate, to as string));

  let query = db
    .select({ d: officeDiaryTable, authorName: usersTable.name })
    .from(officeDiaryTable)
    .leftJoin(usersTable, eq(officeDiaryTable.authorUserId, usersTable.id))
    .$dynamic();
  if (conditions.length) query = (query as any).where(and(...conditions));
  const rows = await (query as any).orderBy(desc(officeDiaryTable.entryDate));
  res.json(rows.map((r: any) => ({ ...r.d, authorName: r.authorName })));
});

router.post("/office/diary", async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { entryDate, title, content, category, branchId } = req.body;
  if (!entryDate || !title || !content || !branchId) {
    res.status(400).json({ error: "entryDate, title, content, branchId required" });
    return;
  }
  const [row] = await db
    .insert(officeDiaryTable)
    .values({ entryDate, title, content, category, branchId, authorUserId: user?.id ?? 1 })
    .returning();
  res.status(201).json(row);
});

router.put("/office/diary/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { title, content, category } = req.body;
  const [row] = await db.update(officeDiaryTable).set({ title, content, category }).where(eq(officeDiaryTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Entry not found" }); return; }
  res.json(row);
});

router.delete("/office/diary/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(officeDiaryTable).where(eq(officeDiaryTable.id, id));
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Office Tasks
// ---------------------------------------------------------------------------

router.get("/office/tasks", async (req, res): Promise<void> => {
  const { branchId, status, priority, assignedTo } = req.query;
  const conditions: any[] = [];
  if (branchId) conditions.push(eq(officeTasksTable.branchId, parseInt(branchId as string, 10)));
  if (status) conditions.push(eq(officeTasksTable.status, status as any));
  if (priority) conditions.push(eq(officeTasksTable.priority, priority as any));
  if (assignedTo) conditions.push(eq(officeTasksTable.assignedToUserId, parseInt(assignedTo as string, 10)));

  let query = db
    .select({
      t: officeTasksTable,
      assignedName: usersTable.name,
    })
    .from(officeTasksTable)
    .leftJoin(usersTable, eq(officeTasksTable.assignedToUserId, usersTable.id))
    .$dynamic();
  if (conditions.length) query = (query as any).where(and(...conditions));
  const rows = await (query as any).orderBy(desc(officeTasksTable.createdAt));
  res.json(rows.map((r: any) => ({ ...r.t, assignedName: r.assignedName })));
});

router.post("/office/tasks", async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { title, description, assignedToUserId, dueDate, priority, branchId } = req.body;
  if (!title || !branchId) { res.status(400).json({ error: "title and branchId required" }); return; }
  const [row] = await db
    .insert(officeTasksTable)
    .values({ title, description, assignedToUserId, dueDate, priority, branchId, createdByUserId: user?.id ?? 1 })
    .returning();
  res.status(201).json(row);
});

router.patch("/office/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { status, priority, assignedToUserId, dueDate, title, description } = req.body;
  const updateData: any = {};
  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority;
  if (assignedToUserId !== undefined) updateData.assignedToUserId = assignedToUserId;
  if (dueDate !== undefined) updateData.dueDate = dueDate;
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status === "done") updateData.completedAt = new Date();

  const [row] = await db.update(officeTasksTable).set(updateData).where(eq(officeTasksTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(row);
});

router.delete("/office/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(officeTasksTable).where(eq(officeTasksTable.id, id));
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

router.get("/office/complaints", async (req, res): Promise<void> => {
  const { branchId, status, customerId } = req.query;
  const conditions: any[] = [];
  if (branchId) conditions.push(eq(complaintsTable.branchId, parseInt(branchId as string, 10)));
  if (status) conditions.push(eq(complaintsTable.status, status as any));
  if (customerId) conditions.push(eq(complaintsTable.customerId, parseInt(customerId as string, 10)));

  let query = db
    .select({ c: complaintsTable, customerName: customersTable.name })
    .from(complaintsTable)
    .leftJoin(customersTable, eq(complaintsTable.customerId, customersTable.id))
    .$dynamic();
  if (conditions.length) query = (query as any).where(and(...conditions));
  const rows = await (query as any).orderBy(desc(complaintsTable.createdAt));
  res.json(rows.map((r: any) => ({ ...r.c, customerName: r.customerName })));
});

router.post("/office/complaints", async (req, res): Promise<void> => {
  const { customerId, title, description, category, branchId } = req.body;
  if (!title || !description || !branchId) { res.status(400).json({ error: "title, description, branchId required" }); return; }
  const [row] = await db.insert(complaintsTable).values({ customerId, title, description, category, branchId }).returning();
  res.status(201).json(row);
});

router.patch("/office/complaints/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const user = (req as any).user;
  const { status, resolutionNotes, assignedToUserId } = req.body;
  const updateData: any = {};
  if (status) updateData.status = status;
  if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
  if (assignedToUserId) updateData.assignedToUserId = assignedToUserId;
  if (status === "resolved" || status === "closed") updateData.resolvedAt = new Date();

  const [row] = await db.update(complaintsTable).set(updateData).where(eq(complaintsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Complaint not found" }); return; }
  res.json(row);
});

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

router.get("/office/donations", async (req, res): Promise<void> => {
  const { branchId, from, to } = req.query;
  const conditions: any[] = [];
  if (branchId) conditions.push(eq(donationsTable.branchId, parseInt(branchId as string, 10)));
  if (from) conditions.push(gte(donationsTable.donationDate, from as string));
  if (to) conditions.push(lte(donationsTable.donationDate, to as string));

  let query = db
    .select({ d: donationsTable, customerName: customersTable.name })
    .from(donationsTable)
    .leftJoin(customersTable, eq(donationsTable.customerId, customersTable.id))
    .$dynamic();
  if (conditions.length) query = (query as any).where(and(...conditions));
  const rows = await (query as any).orderBy(desc(donationsTable.donationDate));
  res.json(rows.map((r: any) => ({ ...r.d, customerName: r.customerName })));
});

router.post("/office/donations", async (req, res): Promise<void> => {
  const { donorName, customerId, amount, purpose, donationDate, receiptNumber, notes, branchId } = req.body;
  if (!donorName || !amount || !donationDate || !branchId) {
    res.status(400).json({ error: "donorName, amount, donationDate, branchId required" });
    return;
  }
  const [row] = await db.insert(donationsTable).values({ donorName, customerId, amount, purpose, donationDate, receiptNumber, notes, branchId }).returning();
  res.status(201).json(row);
});

// ---------------------------------------------------------------------------
// Office Summary
// ---------------------------------------------------------------------------

router.get("/office/summary", async (req, res): Promise<void> => {
  const [openComplaints] = await db.select({ count: sql<number>`count(*)::int` }).from(complaintsTable).where(eq(complaintsTable.status, "open"));
  const [pendingTasks] = await db.select({ count: sql<number>`count(*)::int` }).from(officeTasksTable).where(eq(officeTasksTable.status, "todo"));
  const [inProgressTasks] = await db.select({ count: sql<number>`count(*)::int` }).from(officeTasksTable).where(eq(officeTasksTable.status, "in_progress"));
  const today = new Date().toISOString().split("T")[0];
  const [todayDiary] = await db.select({ count: sql<number>`count(*)::int` }).from(officeDiaryTable).where(eq(officeDiaryTable.entryDate, today));

  res.json({
    openComplaints: openComplaints?.count ?? 0,
    pendingTasks: pendingTasks?.count ?? 0,
    inProgressTasks: inProgressTasks?.count ?? 0,
    todayDiaryEntries: todayDiary?.count ?? 0,
  });
});

// ---------------------------------------------------------------------------
// Office Expenses
// ---------------------------------------------------------------------------

router.get("/office/expenses", async (req, res): Promise<void> => {
  const { branchId, from, to } = req.query;
  const conditions: any[] = [];
  if (branchId) conditions.push(eq(officeExpensesTable.branchId, parseInt(branchId as string, 10)));
  if (from) conditions.push(gte(officeExpensesTable.expenseDate, from as string));
  if (to) conditions.push(lte(officeExpensesTable.expenseDate, to as string));

  let query = db.select().from(officeExpensesTable).$dynamic();
  if (conditions.length) query = (query as any).where(and(...conditions));
  const rows = await (query as any).orderBy(desc(officeExpensesTable.expenseDate));
  res.json(rows);
});

router.post("/office/expenses", async (req, res): Promise<void> => {
  const { category, amount, expenseDate, description, branchId } = req.body;
  if (!category || !amount || !expenseDate || !branchId) {
    res.status(400).json({ error: "category, amount, expenseDate, and branchId are required" });
    return;
  }
  const [row] = await db
    .insert(officeExpensesTable)
    .values({
      category,
      amount: String(amount),
      expenseDate,
      description,
      branchId: parseInt(branchId, 10),
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/office/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(officeExpensesTable).where(eq(officeExpensesTable.id, id));
  res.json({ success: true });
});

export default router;
