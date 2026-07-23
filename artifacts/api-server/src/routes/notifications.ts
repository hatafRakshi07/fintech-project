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
// Admin Message Broadcasting (Broadcast to All, Customers, Collectors, Branch)
// ---------------------------------------------------------------------------
router.post("/notifications/broadcast", async (req, res): Promise<void> => {
  const { title, message, type = "announcement", target = "all", branchId } = req.body;
  if (!title || !message) {
    res.status(400).json({ error: "Title and message are required" });
    return;
  }

  // Fetch target user IDs
  let targetUsers: { id: number }[] = [];

  if (target === "customers") {
    targetUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "customer"));
  } else if (target === "collectors") {
    targetUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "collector"));
  } else if (target === "branch" && branchId) {
    targetUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.branchId, parseInt(branchId, 10)));
  } else {
    // All users
    targetUsers = await db.select({ id: usersTable.id }).from(usersTable);
  }

  if (targetUsers.length === 0) {
    res.json({ success: true, count: 0, message: "No recipient users found for selected target" });
    return;
  }

  // Batch insert notifications
  const valuesToInsert = targetUsers.map((u) => ({
    userId: u.id,
    title: String(title).trim(),
    message: String(message).trim(),
    type: String(type).trim(),
    entityType: "broadcast",
    isRead: false,
  }));

  // Insert in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < valuesToInsert.length; i += chunkSize) {
    const chunk = valuesToInsert.slice(i, i + chunkSize);
    await db.insert(notificationsTable).values(chunk);
  }

  console.log(`[BROADCAST] Sent broadcast "${title}" to ${targetUsers.length} users (Target: ${target})`);

  res.json({
    success: true,
    count: targetUsers.length,
    message: `Message successfully broadcasted to ${targetUsers.length} users`,
  });
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
