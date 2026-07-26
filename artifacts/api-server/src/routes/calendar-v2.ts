import { Router } from "express";
import { db } from "@workspace/db";
import { draws, collectionVisits, customers, schemes } from "@workspace/db/schema";
import { desc, eq, and, sql, gte, lte } from "drizzle-orm";

const router = Router();

/**
 * GET /v2/calendar/events
 * Retrieves upcoming/past draws and promise-to-pay field visits
 */
router.get("/events", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    // Default to a 3-month window if not provided
    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date(new Date().setMonth(new Date().getMonth() + 2));
    end.setHours(23, 59, 59, 999);

    // 1. Fetch Draws
    const drawRecords = await db.select({
      id: draws.id,
      date: draws.drawDate,
      schemeId: draws.schemeId,
      schemeName: schemes.name,
      monthNo: draws.drawMonth,
    })
    .from(draws)
    .leftJoin(schemes, eq(draws.schemeId, schemes.id))
    .where(and(gte(draws.drawDate, start.toISOString().split('T')[0]), lte(draws.drawDate, end.toISOString().split('T')[0])));

    // 2. Fetch Promise-to-Pay visits
    // We'll filter collectionVisits where outcome = 'PROMISE_TO_PAY'
    const visitRecords = await db.select({
      id: collectionVisits.id,
      date: collectionVisits.promiseDate, 
      customerId: collectionVisits.customerId,
      customerName: customers.name,
      customerPhone: customers.phone,
      notes: collectionVisits.notes
    })
    .from(collectionVisits)
    .leftJoin(customers, eq(collectionVisits.customerId, customers.id))
    .where(and(
      eq(collectionVisits.outcome, 'PROMISE_TO_PAY'),
      gte(collectionVisits.promiseDate, start.toISOString().split('T')[0]),
      lte(collectionVisits.promiseDate, end.toISOString().split('T')[0])
    ));

    // Combine them into a unified format for the calendar
    const events = [
      ...drawRecords.map(d => ({
        id: `draw-${d.id}`,
        type: 'DRAW',
        date: d.date,
        title: `Draw: ${d.schemeName}`,
        description: `Month ${d.monthNo} draw for ${d.schemeName}`,
        meta: { schemeId: d.schemeId }
      })),
      ...visitRecords.map(v => ({
        id: `visit-${v.id}`,
        type: 'PROMISE',
        date: v.date,
        title: `Promise: ${v.customerName}`,
        description: `Follow up with ${v.customerName} (${v.customerPhone}). Notes: ${v.notes || 'None'}`,
        meta: { customerId: v.customerId }
      }))
    ];

    // Sort by date ascending
    events.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error("Calendar events error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as calendarV2Router };
