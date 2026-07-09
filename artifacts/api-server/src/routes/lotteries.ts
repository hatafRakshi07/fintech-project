import { Router, type IRouter } from "express";
import { db, lotteriesTable, committeesTable, customersTable, committeeMembersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/lotteries", async (req, res): Promise<void> => {
  const { committeeId, status } = req.query;
  let rows = await db
    .select({ l: lotteriesTable, committeeName: committeesTable.name })
    .from(lotteriesTable)
    .leftJoin(committeesTable, eq(lotteriesTable.committeeId, committeesTable.id))
    .orderBy(lotteriesTable.drawDate);

  if (committeeId) rows = rows.filter((r: (typeof rows)[number]) => r.l.committeeId === parseInt(committeeId as string, 10));
  if (status) rows = rows.filter((r: (typeof rows)[number]) => r.l.status === status);

  const result = await Promise.all(
    rows.map(async (row: (typeof rows)[number]) => {
      let winnerName = null;
      let winnerToken = null;
      if (row.l.winnerId) {
        const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, row.l.winnerId));
        winnerName = cust?.name ?? null;
        const [mem] = await db.select().from(committeeMembersTable)
          .where(eq(committeeMembersTable.customerId, row.l.winnerId));
        winnerToken = mem?.tokenNumber ?? null;
      }
      return {
        ...row.l,
        committeeName: row.committeeName,
        winnerName,
        winnerToken,
        prizeAmount: row.l.prizeAmount ? parseFloat(row.l.prizeAmount) : null,
        createdAt: row.l.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/lotteries", async (req, res): Promise<void> => {
  const { committeeId, drawDate, prizeAmount, notes } = req.body;
  if (!committeeId || !drawDate) {
    res.status(400).json({ error: "committeeId, drawDate required" });
    return;
  }
  const [lottery] = await db
    .insert(lotteriesTable)
    .values({ committeeId, drawDate, prizeAmount: prizeAmount ? String(prizeAmount) : null, notes, status: "scheduled" })
    .returning();
  res.status(201).json({ ...lottery, committeeName: null, winnerName: null, winnerToken: null, prizeAmount: lottery.prizeAmount ? parseFloat(lottery.prizeAmount) : null, createdAt: lottery.createdAt.toISOString() });
});

router.get("/lotteries/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({ l: lotteriesTable, committeeName: committeesTable.name })
    .from(lotteriesTable)
    .leftJoin(committeesTable, eq(lotteriesTable.committeeId, committeesTable.id))
    .where(eq(lotteriesTable.id, id));
  if (!row) { res.status(404).json({ error: "Lottery not found" }); return; }
  res.json({ ...row.l, committeeName: row.committeeName, winnerName: null, winnerToken: null, prizeAmount: row.l.prizeAmount ? parseFloat(row.l.prizeAmount) : null, createdAt: row.l.createdAt.toISOString() });
});

router.patch("/lotteries/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { status, winnerId, prizeAmount, notes, rewardType, cashTaken } = req.body;
  const update: any = {};
  if (status !== undefined) update.status = status;
  if (winnerId !== undefined) update.winnerId = winnerId;
  if (prizeAmount !== undefined) update.prizeAmount = String(prizeAmount);
  if (notes !== undefined) update.notes = notes;
  if (rewardType !== undefined) update.rewardType = rewardType;
  if (cashTaken !== undefined) update.cashTaken = cashTaken !== null ? String(cashTaken) : null;
  const [lottery] = await db.update(lotteriesTable).set(update).where(eq(lotteriesTable.id, id)).returning();
  if (!lottery) { res.status(404).json({ error: "Lottery not found" }); return; }
  res.json({ ...lottery, committeeName: null, winnerName: null, winnerToken: null, prizeAmount: lottery.prizeAmount ? parseFloat(lottery.prizeAmount) : null, cashTaken: lottery.cashTaken ? parseFloat(lottery.cashTaken) : null, createdAt: lottery.createdAt.toISOString() });
});

router.post("/lotteries/:id/draw", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { rewardType, cashTaken } = req.body as { rewardType?: "cash" | "gift"; cashTaken?: number };
  const [lottery] = await db.select().from(lotteriesTable).where(eq(lotteriesTable.id, id));
  if (!lottery) { res.status(404).json({ error: "Lottery not found" }); return; }

  // Get eligible members
  const members = await db
    .select()
    .from(committeeMembersTable)
    .where(eq(committeeMembersTable.committeeId, lottery.committeeId));

  if (members.length === 0) {
    res.status(400).json({ error: "No members in committee" });
    return;
  }

  const winner = members[Math.floor(Math.random() * members.length)];
  const [updated] = await db
    .update(lotteriesTable)
    .set({
      winnerId: winner.customerId,
      status: "completed",
      rewardType: rewardType ?? null,
      cashTaken: (rewardType === "cash" && cashTaken) ? String(cashTaken) : null,
    })
    .where(eq(lotteriesTable.id, id))
    .returning();

  const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, winner.customerId));

  res.json({
    ...updated,
    committeeName: null,
    winnerName: cust?.name ?? null,
    winnerToken: winner.tokenNumber,
    prizeAmount: updated.prizeAmount ? parseFloat(updated.prizeAmount) : null,
    cashTaken: updated.cashTaken ? parseFloat(updated.cashTaken) : null,
    createdAt: updated.createdAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Committee members for a lottery (to show who is in this draw)
// ---------------------------------------------------------------------------
router.get("/lotteries/:id/members", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [lottery] = await db.select({ committeeId: lotteriesTable.committeeId }).from(lotteriesTable).where(eq(lotteriesTable.id, id));
  if (!lottery) { res.status(404).json({ error: "Lottery not found" }); return; }

  const members = await db
    .select({ cm: committeeMembersTable, customerName: customersTable.name, customerMobile: customersTable.mobile })
    .from(committeeMembersTable)
    .leftJoin(customersTable, eq(committeeMembersTable.customerId, customersTable.id))
    .where(eq(committeeMembersTable.committeeId, lottery.committeeId));

  res.json(members.map((m) => ({
    ...m.cm,
    customerName: m.customerName,
    customerMobile: m.customerMobile,
  })));
});

export default router;
