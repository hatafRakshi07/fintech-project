import { Router } from "express";
import { db } from "@workspace/db";
import { drawEvents, collectionRegisters, customers, committees, committeeMonths } from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

const router = Router();

/**
 * GET /v2/calendar/events
 * Retrieves upcoming/past draws and promise-to-pay field visits
 */
router.get("/events", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date(new Date().setMonth(new Date().getMonth() + 2));
    end.setHours(23, 59, 59, 999);

    // 1. Fetch Draw Events
    const drawRecords = await db.select({
      id: drawEvents.id,
      date: drawEvents.drawDate,
      committeeId: committeeMonths.committeeId,
      committeeName: committees.name,
      monthNo: committeeMonths.monthNumber,
    })
    .from(drawEvents)
    .leftJoin(committeeMonths, eq(drawEvents.committeeMonthId, committeeMonths.id))
    .leftJoin(committees, eq(committeeMonths.committeeId, committees.id))
    .where(and(gte(drawEvents.drawDate, start.toISOString().split('T')[0]), lte(drawEvents.drawDate, end.toISOString().split('T')[0])));

    // 2. Fetch Collection Registers
    const registerRecords = await db.select({
      id: collectionRegisters.id,
      date: collectionRegisters.collectionDate,
      collectorId: collectionRegisters.collectorId,
      notes: collectionRegisters.notes
    })
    .from(collectionRegisters)
    .where(and(
      gte(collectionRegisters.collectionDate, start.toISOString().split('T')[0]),
      lte(collectionRegisters.collectionDate, end.toISOString().split('T')[0])
    ));

    const events = [
      ...drawRecords.map(d => ({
        id: `draw-${d.id}`,
        type: 'DRAW',
        date: d.date,
        title: `Draw: ${d.committeeName || 'Committee'}`,
        description: `Month ${d.monthNo || 1} draw for ${d.committeeName || 'Committee'}`,
        meta: { committeeId: d.committeeId }
      })),
      ...registerRecords.map(r => ({
        id: `visit-${r.id}`,
        type: 'COLLECTION_REGISTER',
        date: r.date,
        title: `Collection Register`,
        description: `Notes: ${r.notes || 'None'}`,
        meta: { collectorId: r.collectorId }
      }))
    ];

    events.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error("Calendar events error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as calendarV2Router };
