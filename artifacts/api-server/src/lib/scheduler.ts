/**
 * Hourly alert scheduler
 *
 * Two recurring alert types:
 *  1. loan_overdue   — sent every hour while loan is active/overdue and unpaid
 *  2. gift_win       — sent every hour for 4 days (96 h) after a gift is distributed
 *
 * Deduplication: before sending we check if a notification of the same type +
 * entityId was already sent in the last 55 minutes. This prevents duplicates
 * even if the scheduler runs slightly off-schedule.
 *
 * The recipient is the customer-role user whose `customerId` matches the
 * loan/gift customer. If no linked user account exists, we skip silently.
 */

import { db, loansTable, giftDistributionsTable, giftInventoryTable, usersTable, notificationsTable, sessionsTable } from "@workspace/db";
import { eq, and, sql, gte, lt } from "drizzle-orm";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GIFT_ALERT_DURATION_MS = 4 * 24 * 60 * 60 * 1000; // 4 days
const DEDUP_WINDOW_MINUTES = 55;                          // don't re-send within 55 min

// ---------------------------------------------------------------------------
// Helper: has a notification already been sent recently for this entity?
// ---------------------------------------------------------------------------
async function recentlySent(
  userId: number,
  type: string,
  entityId: number,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000);
  const [row] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.type, type),
        eq(notificationsTable.entityId, entityId),
        gte(notificationsTable.createdAt, since),
      ),
    )
    .limit(1);
  return !!row;
}

// ---------------------------------------------------------------------------
// Helper: insert one notification (swallows errors so scheduler never crashes)
// ---------------------------------------------------------------------------
async function send(params: {
  userId: number;
  title: string;
  message: string;
  type: string;
  entityId: number;
  entityType: string;
}) {
  try {
    await db.insert(notificationsTable).values({
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      entityId: params.entityId,
      entityType: params.entityType,
      isRead: false,
    });
  } catch (err) {
    logger.warn({ err, params }, "[scheduler] Failed to insert notification");
  }
}

// ---------------------------------------------------------------------------
// Find the user account linked to a customer (role=customer)
// ---------------------------------------------------------------------------
async function findCustomerUserId(customerId: number): Promise<number | null> {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.customerId, customerId),
        eq(usersTable.role, "customer"),
      ),
    )
    .limit(1);
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// 1. Loan overdue alerts
// ---------------------------------------------------------------------------
async function runLoanOverdueAlerts() {
  // Find all loans that are overdue OR active with a due date in the past
  const today = new Date().toISOString().split("T")[0];
  const overdueLoans = await db
    .select({ id: loansTable.id, customerId: loansTable.customerId, paidAmount: loansTable.paidAmount, totalAmount: loansTable.totalAmount, status: loansTable.status })
    .from(loansTable)
    .where(
      sql`(${loansTable.status} = 'overdue')
          OR (${loansTable.status} IN ('active', 'approved') AND ${loansTable.dueDate} IS NOT NULL AND ${loansTable.dueDate} < ${today})`,
    );

  for (const loan of overdueLoans) {
    const userId = await findCustomerUserId(loan.customerId);
    if (!userId) continue; // no linked user account — skip

    const already = await recentlySent(userId, "loan_overdue", loan.id);
    if (already) continue;

    const outstanding = Math.max(
      0,
      parseFloat(loan.totalAmount ?? "0") - parseFloat(loan.paidAmount),
    );

    await send({
      userId,
      title: "⚠️ Loan Payment Reminder",
      message: `Aapka loan payment pending hai. Outstanding amount: ₹${outstanding.toLocaleString("en-IN")}. Kripya jaldi se apna payment jama karein.`,
      type: "loan_overdue",
      entityId: loan.id,
      entityType: "loan",
    });

    logger.info({ loanId: loan.id, userId }, "[scheduler] Loan overdue notification sent");
  }
}

// ---------------------------------------------------------------------------
// 2. Gift win alerts
// ---------------------------------------------------------------------------
async function runGiftWinAlerts() {
  const cutoff = new Date(Date.now() - GIFT_ALERT_DURATION_MS);

  // Find all gift distributions (not returned) within the last 4 days
  const distributions = await db
    .select({
      gd: giftDistributionsTable,
      giftName: giftInventoryTable.name,
    })
    .from(giftDistributionsTable)
    .leftJoin(giftInventoryTable, eq(giftDistributionsTable.giftId, giftInventoryTable.id))
    .where(
      and(
        eq(giftDistributionsTable.isReturned, false),
        gte(giftDistributionsTable.createdAt, cutoff),
      ),
    );

  for (const { gd, giftName } of distributions) {
    const userId = await findCustomerUserId(gd.customerId);
    if (!userId) continue;

    const already = await recentlySent(userId, "gift_win", gd.id);
    if (already) continue;

    // Calculate how many hours remain (for the message)
    const elapsed = Date.now() - gd.createdAt.getTime();
    const remainingHours = Math.max(0, Math.ceil((GIFT_ALERT_DURATION_MS - elapsed) / (60 * 60 * 1000)));

    await send({
      userId,
      title: "🎁 Gift Jeet Liya! — Congratulations!",
      message: `Aapne "${giftName ?? "Gift"}" jeeta hai! Branch se apna gift collect karein. Yeh notification agle ${remainingHours} ghante tak aati rahegi.`,
      type: "gift_win",
      entityId: gd.id,
      entityType: "gift_distribution",
    });

    logger.info({ distributionId: gd.id, userId }, "[scheduler] Gift win notification sent");
  }
}

// ---------------------------------------------------------------------------
// 3. Session cleanup
// ---------------------------------------------------------------------------
async function runSessionCleanup() {
  if (process.env.ENABLE_SESSION_CLEANUP === "true") {
    try {
      await db
        .delete(sessionsTable)
        .where(lt(sessionsTable.expiresAt, new Date()));
      logger.info("[scheduler] Expired sessions cleaned up");
    } catch (err) {
      logger.error({ err }, "[scheduler] Error during session cleanup");
    }
  }
}

// ---------------------------------------------------------------------------
// Main runner — called every hour
// ---------------------------------------------------------------------------
async function runScheduler() {
  logger.info("[scheduler] Running hourly alerts…");
  try {
    await runLoanOverdueAlerts();
  } catch (err) {
    logger.error({ err }, "[scheduler] Error in loan overdue alerts");
  }
  try {
    await runGiftWinAlerts();
  } catch (err) {
    logger.error({ err }, "[scheduler] Error in gift win alerts");
  }
  await runSessionCleanup();
  logger.info("[scheduler] Done");
}

// ---------------------------------------------------------------------------
// Bootstrap — call this from index.ts on server start
// ---------------------------------------------------------------------------
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startScheduler() {
  // Run once immediately after a short delay (let DB pool warm up)
  setTimeout(() => { runScheduler().catch(() => {}); }, 30_000);

  // Then every hour
  schedulerTimer = setInterval(() => {
    runScheduler().catch(() => {});
  }, 60 * 60 * 1000);

  // Ensure the interval doesn't prevent graceful shutdown
  schedulerTimer.unref();

  logger.info("[scheduler] Hourly alert scheduler started");
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
