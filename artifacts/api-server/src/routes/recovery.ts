import { Router, type IRouter } from "express";
import {
  db,
  recoveryTasksTable,
  recoveryCallLogsTable,
  customersTable,
  collectorsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { safeIso } from "../lib/utils";

const router: IRouter = Router();

router.get("/recovery/tasks", async (req, res): Promise<void> => {
  try {
    const { branchId, status, priority, collectorId } = req.query;
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(recoveryTasksTable.branchId, parseInt(branchId as string, 10)));
    if (status) conditions.push(eq(recoveryTasksTable.status, status as any));
    if (priority) conditions.push(eq(recoveryTasksTable.priority, priority as any));
    if (collectorId) conditions.push(eq(recoveryTasksTable.assignedCollectorId, parseInt(collectorId as string, 10)));

    let query = db
      .select({
        t: recoveryTasksTable,
        customerName: customersTable.name,
        customerMobile: customersTable.mobile,
        collectorName: collectorsTable.name,
      })
      .from(recoveryTasksTable)
      .leftJoin(customersTable, eq(recoveryTasksTable.customerId, customersTable.id))
      .leftJoin(collectorsTable, eq(recoveryTasksTable.assignedCollectorId, collectorsTable.id))
      .$dynamic();
    if (conditions.length) query = (query as any).where(and(...conditions));
    const rows = await (query as any).orderBy(desc(recoveryTasksTable.createdAt));
    res.json(
      rows.map((r: any) => ({
        ...r.t,
        customerName: r.customerName,
        customerMobile: r.customerMobile,
        collectorName: r.collectorName,
        createdAt: safeIso(r.t.createdAt),
      }))
    );
  } catch (err: any) {
    console.error("[GET /recovery/tasks ERROR]", err);
    res.json([]);
  }
});

router.post("/recovery/tasks", async (req, res): Promise<void> => {
  try {
    const { customerId, collectionId, loanId, assignedCollectorId, priority, dueDate, overdueAmount, notes, nextFollowUpDate, branchId } = req.body;
    if (!customerId || !branchId) { res.status(400).json({ error: "customerId and branchId required" }); return; }
    const [row] = await db
      .insert(recoveryTasksTable)
      .values({ customerId, collectionId, loanId, assignedCollectorId, priority, dueDate, overdueAmount, notes, nextFollowUpDate, branchId })
      .returning();
    res.status(201).json({ ...row, createdAt: safeIso(row.createdAt) });
  } catch (err: any) {
    console.error("[POST /recovery/tasks ERROR]", err);
    res.status(500).json({ error: err?.message || "Failed to create recovery task" });
  }
});

router.get("/recovery/tasks/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await db
      .select({ t: recoveryTasksTable, customerName: customersTable.name, customerMobile: customersTable.mobile, collectorName: collectorsTable.name })
      .from(recoveryTasksTable)
      .leftJoin(customersTable, eq(recoveryTasksTable.customerId, customersTable.id))
      .leftJoin(collectorsTable, eq(recoveryTasksTable.assignedCollectorId, collectorsTable.id))
      .where(eq(recoveryTasksTable.id, id));
    if (!row) { res.status(404).json({ error: "Task not found" }); return; }
    const logs = await db.select().from(recoveryCallLogsTable).where(eq(recoveryCallLogsTable.taskId, id)).orderBy(desc(recoveryCallLogsTable.calledAt));
    res.json({
      ...row.t,
      customerName: row.customerName,
      customerMobile: row.customerMobile,
      collectorName: row.collectorName,
      createdAt: safeIso(row.t.createdAt),
      logs: logs.map((l: any) => ({ ...l, calledAt: safeIso(l.calledAt) })),
    });
  } catch (err: any) {
    console.error("[GET /recovery/tasks/:id ERROR]", err);
    res.status(500).json({ error: "Task not found" });
  }
});

router.patch("/recovery/tasks/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, assignedCollectorId, notes, priority, nextFollowUpDate, promisedDate } = req.body;
    const updateObj: any = {};
    if (status !== undefined) updateObj.status = status;
    if (assignedCollectorId !== undefined) updateObj.assignedCollectorId = assignedCollectorId;
    if (notes !== undefined) updateObj.notes = notes;
    if (priority !== undefined) updateObj.priority = priority;
    if (nextFollowUpDate !== undefined) updateObj.nextFollowUpDate = nextFollowUpDate;
    if (promisedDate !== undefined) updateObj.promisedDate = promisedDate;
    const [row] = await db.update(recoveryTasksTable).set(updateObj).where(eq(recoveryTasksTable.id, id)).returning();
    res.json({ ...row, createdAt: safeIso(row.createdAt) });
  } catch (err: any) {
    console.error("[PATCH /recovery/tasks/:id ERROR]", err);
    res.status(500).json({ error: "Failed to update recovery task" });
  }
});

router.post("/recovery/tasks/:id/logs", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { callerName, outcome, notes, promisedAmount, promisedDate, nextFollowUpDate } = req.body;
    const [log] = await db.insert(recoveryCallLogsTable).values({ taskId: id, callerName, outcome, notes, promisedAmount, promisedDate, nextFollowUpDate } as any).returning();
    res.status(201).json({ ...log, calledAt: safeIso(log.calledAt) });
  } catch (err: any) {
    console.error("[POST /recovery/tasks/:id/logs ERROR]", err);
    res.status(500).json({ error: "Failed to add call log" });
  }
});

export default router;
