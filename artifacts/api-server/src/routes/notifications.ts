import { Router, type IRouter } from "express";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// List notifications for the current user
// ---------------------------------------------------------------------------
router.get("/notifications", async (req, res): Promise<void> => {
  const userId = req.userId;
  const { limit = "30", unreadOnly } = req.query;
  const limitNum = Math.min(parseInt(limit as string, 10), 100);

  const conditions = [eq(notificationsTable.userId, userId)];
  if (unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limitNum);

  res.json(rows);
});

// ---------------------------------------------------------------------------
// Unread count — polled by the bell icon
// ---------------------------------------------------------------------------
router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, req.userId), eq(notificationsTable.isRead, false)));
  res.json({ count: row?.count ?? 0 });
});

// ---------------------------------------------------------------------------
// Mark single notification as read
// ---------------------------------------------------------------------------
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json(row);
});

// ---------------------------------------------------------------------------
// Mark all as read
// ---------------------------------------------------------------------------
router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, req.userId), eq(notificationsTable.isRead, false)));
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Helper exported for use by other route modules
// ---------------------------------------------------------------------------
export async function createNotification(params: {
  userId: number;
  title: string;
  message: string;
  type: string;
  entityId?: number;
  entityType?: string;
}): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      entityId: params.entityId ?? null,
      entityType: params.entityType ?? null,
      isRead: false,
    });
  } catch {
    // Never let notification failures break the main flow
  }
}

/** Send a notification to every branch_manager / owner / super_admin in the given branch */
export async function notifyManagers(branchId: number | null, title: string, message: string, type: string, entityId?: number): Promise<void> {
  const managerRoles = ["branch_manager", "owner", "super_admin"] as const;
  let query = db.select({ id: usersTable.id }).from(usersTable).$dynamic();
  if (branchId) {
    query = (query as any).where(
      sql`${usersTable.role} = ANY(ARRAY['branch_manager','owner','super_admin']::user_role[])
          AND (${usersTable.branchId} = ${branchId} OR ${usersTable.role} IN ('owner','super_admin'))`
    );
  } else {
    query = (query as any).where(
      sql`${usersTable.role} = ANY(ARRAY['branch_manager','owner','super_admin']::user_role[])`
    );
  }
  const managers = await (query as any);
  await Promise.all(
    managers.map((m: { id: number }) =>
      createNotification({ userId: m.id, title, message, type, entityId, entityType: "collection" }),
    ),
  );
}

export default router;
