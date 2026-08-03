import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

// Ensure table exists
async function ensureCalendarTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      event_type TEXT DEFAULT 'DRAW',
      event_date DATE NOT NULL,
      description TEXT,
      committee_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
}

ensureCalendarTable();

/**
 * GET /v2/calendar/events
 * Unified operational calendar for Bissi draws, collection promises, & custom events
 */
router.get("/events", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    const now = new Date();
    const startStr = startDate || new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
    const endStr = endDate || new Date(now.getFullYear(), now.getMonth() + 4, 1).toISOString().split('T')[0];

    const events: any[] = [];

    // 1. Fetch custom events from DB
    try {
      const customRes = await pool.query(
        `SELECT id, title, event_type as type, event_date as date, description, committee_id as "committeeId" 
         FROM calendar_events 
         WHERE event_date >= $1 AND event_date <= $2 
         ORDER BY event_date ASC`,
        [startStr, endStr]
      );
      for (const r of customRes.rows) {
        events.push({
          id: `custom-${r.id}`,
          type: r.type || 'DRAW',
          date: r.date,
          title: r.title,
          description: r.description || '',
          meta: { committeeId: r.committeeId }
        });
      }
    } catch (e) {}

    // 2. Automatically generate Bissi Scheme Draw Dates (5th, 15th, 20th of each month)
    const schemeDrawSchedule = [
      { id: "a3d68b9c-63df-4884-a5ad-eb8a17e3be31", name: "Sawariya Seth Bissi (5th Date)", drawDay: 5 },
      { id: "33333333-3333-3333-3333-333333333333", name: "Pyare Mohan Bissi (15th Date)", drawDay: 15 },
      { id: "11111111-1111-1111-1111-111111111111", name: "Hare Ka Sahara Bissi (20th Date)", drawDay: 20 },
      { id: "22222222-2222-2222-2222-222222222222", name: "Shree Krishna Bissi (20th Date)", drawDay: 20 },
    ];

    const startYear = now.getFullYear() - 1;
    const endYear = now.getFullYear() + 1;

    for (let y = startYear; y <= endYear; y++) {
      for (let m = 0; m < 12; m++) {
        for (const sch of schemeDrawSchedule) {
          const drawDateObj = new Date(y, m, sch.drawDay);
          const dateISO = drawDateObj.toISOString().split('T')[0];
          
          if (dateISO >= startStr && dateISO <= endStr) {
            // Avoid duplicate if custom exists
            if (!events.some(e => e.date === dateISO && e.title.includes(sch.name))) {
              events.push({
                id: `bissi-draw-${sch.id}-${y}-${m}`,
                type: 'DRAW',
                date: dateISO,
                title: `🎉 Monthly Lucky Draw: ${sch.name}`,
                description: `Official Lucky Draw Date (${sch.drawDay}th) for ${sch.name}`,
                meta: { committeeId: sch.id, drawDay: sch.drawDay }
              });
            }
          }
        }
      }
    }

    // 3. Fetch past lotteries from DB
    try {
      const lotRes = await pool.query(`
        SELECT l.id, l.draw_date as date, l.reward_description as reward, c.name as "committeeName"
        FROM lotteries l
        LEFT JOIN committees c ON c.id::text = l.committee_id::text
        WHERE l.draw_date >= $1 AND l.draw_date <= $2
        ORDER BY l.draw_date ASC
      `, [startStr, endStr]);

      for (const r of lotRes.rows) {
        const dateISO = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
        if (dateISO && !events.some(e => e.id === `lottery-${r.id}`)) {
          events.push({
            id: `lottery-${r.id}`,
            type: 'DRAW',
            date: dateISO,
            title: `🏆 Lucky Draw Winner Announced: ${r.committeeName || 'Bissi'}`,
            description: `Reward: ${r.reward || 'Special Gift / Cash Prize'}`,
            meta: { lotteryId: r.id }
          });
        }
      }
    } catch (e) {}

    events.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error("Calendar events error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /v2/calendar/events
 * Add new custom calendar event or draw date
 */
router.post("/events", async (req, res) => {
  try {
    const { title, type, date, description, committeeId } = req.body;
    if (!title || !date) {
      res.status(400).json({ success: false, error: "Title and date are required" });
      return;
    }

    await ensureCalendarTable();

    const result = await pool.query(
      `INSERT INTO calendar_events (title, event_type, event_date, description, committee_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, event_type as type, event_date as date, description, committee_id as "committeeId"`,
      [title, type || 'DRAW', date, description || '', committeeId || null]
    );

    res.json({ success: true, message: "Calendar event added successfully!", event: result.rows[0] });
  } catch (error: any) {
    console.error("Error adding calendar event:", error);
    res.status(500).json({ success: false, error: "Failed to add calendar event: " + error.message });
  }
});

export { router as calendarV2Router };
