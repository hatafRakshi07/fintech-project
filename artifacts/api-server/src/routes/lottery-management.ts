import { Router } from "express";
import { pool, queryWithRetry } from "@workspace/db";

const router = Router();

// Ensure DB tables exist on demand
async function ensureLotteryTablesExist() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lottery_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID,
        bissi_name VARCHAR(255) NOT NULL,
        committee_id UUID,
        lottery_date TEXT NOT NULL,
        lottery_month VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lottery_gifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES lottery_sessions(id) ON DELETE CASCADE,
        token_number VARCHAR(50) NOT NULL,
        token_id UUID,
        customer_id UUID,
        customer_name VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(50),
        bissi_name VARCHAR(255),
        gift_name VARCHAR(255) NOT NULL,
        gift_category VARCHAR(100),
        gift_value NUMERIC(12, 2),
        status VARCHAR(20) DEFAULT 'Pending' NOT NULL,
        collection_date TEXT,
        collected_by TEXT,
        remarks TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);
  } catch (err) {
    console.error("[Lottery Management] Error ensuring tables exist:", err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/lottery/dashboard
// ---------------------------------------------------------------------------
router.get("/dashboard", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const sessionsRes = await queryWithRetry(
      () => pool.query(`SELECT id FROM lottery_sessions`),
      { routeName: "GET /lottery/dashboard (sessions)", retries: 2, delayMs: 300 }
    );
    const giftsRes = await queryWithRetry(
      () => pool.query(`SELECT status, collection_date, created_at FROM lottery_gifts`),
      { routeName: "GET /lottery/dashboard (gifts)", retries: 2, delayMs: 300 }
    );

    const totalSessions = sessionsRes.rows.length;
    const totalGiftsDistributed = giftsRes.rows.length;
    let collectedGifts = 0;
    let pendingGifts = 0;
    let todayCollectedGifts = 0;

    const todayStr = new Date().toISOString().slice(0, 10);

    giftsRes.rows.forEach(g => {
      if (g.status === "Collected") {
        collectedGifts++;
        const cDate = g.collection_date || (g.created_at ? new Date(g.created_at).toISOString().slice(0, 10) : "");
        if (cDate.startsWith(todayStr)) {
          todayCollectedGifts++;
        }
      } else {
        pendingGifts++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalSessions,
        totalGiftsDistributed,
        collectedGifts,
        pendingGifts,
        todayCollectedGifts
      }
    });
  } catch (err: any) {
    console.error("[Lottery Management] Dashboard error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/lottery/sessions
// ---------------------------------------------------------------------------
router.get("/sessions", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const search = ((req.query.search as string) || "").trim().toLowerCase();
    const bissiFilter = ((req.query.bissi as string) || "ALL").trim();

    const sessionsRes = await queryWithRetry(
      () => pool.query(`SELECT * FROM lottery_sessions ORDER BY created_at DESC`),
      { routeName: "GET /lottery/sessions", retries: 2, delayMs: 300 }
    );

    const giftsRes = await queryWithRetry(
      () => pool.query(`SELECT session_id, status FROM lottery_gifts`),
      { routeName: "GET /lottery/sessions (gifts)", retries: 2, delayMs: 300 }
    );

    const giftCountsBySession = new Map<string, { total: number; collected: number; pending: number }>();

    giftsRes.rows.forEach(g => {
      const sId = g.session_id;
      if (!giftCountsBySession.has(sId)) {
        giftCountsBySession.set(sId, { total: 0, collected: 0, pending: 0 });
      }
      const cur = giftCountsBySession.get(sId)!;
      cur.total++;
      if (g.status === "Collected") {
        cur.collected++;
      } else {
        cur.pending++;
      }
    });

    let sessions = sessionsRes.rows.map(s => {
      const counts = giftCountsBySession.get(s.id) || { total: 0, collected: 0, pending: 0 };
      return {
        id: s.id,
        bissiName: s.bissi_name,
        committeeId: s.committee_id,
        lotteryDate: s.lottery_date,
        lotteryMonth: s.lottery_month || "",
        notes: s.notes || "",
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        totalGifts: counts.total,
        collectedGifts: counts.collected,
        pendingGifts: counts.pending
      };
    });

    if (search) {
      sessions = sessions.filter(s =>
        s.bissiName.toLowerCase().includes(search) ||
        s.lotteryDate.toLowerCase().includes(search) ||
        s.lotteryMonth.toLowerCase().includes(search)
      );
    }

    if (bissiFilter !== "ALL") {
      sessions = sessions.filter(s => s.bissiName === bissiFilter);
    }

    res.json({ success: true, sessions });
  } catch (err: any) {
    console.error("[Lottery Management] Error fetching sessions:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/lottery/sessions
// ---------------------------------------------------------------------------
router.post("/sessions", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const { bissiName, lotteryDate, lotteryMonth, notes } = req.body;
    if (!bissiName || !lotteryDate) {
      res.status(400).json({ success: false, error: "Bissi Name and Lottery Date are required" });
      return;
    }

    const insertRes = await pool.query(
      `INSERT INTO lottery_sessions (bissi_name, lottery_date, lottery_month, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [bissiName.trim(), lotteryDate.trim(), lotteryMonth ? lotteryMonth.trim() : null, notes ? notes.trim() : null]
    );

    const s = insertRes.rows[0];
    res.json({
      success: true,
      session: {
        id: s.id,
        bissiName: s.bissi_name,
        committeeId: s.committee_id,
        lotteryDate: s.lottery_date,
        lotteryMonth: s.lottery_month || "",
        notes: s.notes || "",
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        totalGifts: 0,
        collectedGifts: 0,
        pendingGifts: 0
      }
    });
  } catch (err: any) {
    console.error("[Lottery Management] Error creating session:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/lottery/sessions/:id
// ---------------------------------------------------------------------------
router.get("/sessions/:id", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const { id } = req.params;
    const sessionRes = await pool.query(`SELECT * FROM lottery_sessions WHERE id = $1`, [id]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Lottery session not found" });
      return;
    }

    const s = sessionRes.rows[0];

    const giftsRes = await pool.query(
      `SELECT * FROM lottery_gifts WHERE session_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    const gifts = giftsRes.rows.map(g => ({
      id: g.id,
      sessionId: g.session_id,
      tokenNumber: g.token_number,
      tokenId: g.token_id,
      customerId: g.customer_id,
      customerName: g.customer_name,
      mobileNumber: g.mobile_number || "",
      bissiName: g.bissi_name || s.bissi_name,
      giftName: g.gift_name,
      giftCategory: g.gift_category || "",
      giftValue: g.gift_value ? parseFloat(g.gift_value) : null,
      status: g.status || "Pending",
      collectionDate: g.collection_date || "",
      collectedBy: g.collected_by || "",
      remarks: g.remarks || "",
      createdAt: g.created_at,
      updatedAt: g.updated_at
    }));

    const totalGifts = gifts.length;
    const collectedGifts = gifts.filter(g => g.status === "Collected").length;
    const pendingGifts = totalGifts - collectedGifts;

    res.json({
      success: true,
      session: {
        id: s.id,
        bissiName: s.bissi_name,
        committeeId: s.committee_id,
        lotteryDate: s.lottery_date,
        lotteryMonth: s.lottery_month || "",
        notes: s.notes || "",
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        totalGifts,
        collectedGifts,
        pendingGifts,
        gifts
      }
    });
  } catch (err: any) {
    console.error("[Lottery Management] Error fetching session detail:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/lottery/detect-token
// ---------------------------------------------------------------------------
router.get("/detect-token", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const tokenNumber = ((req.query.tokenNumber as string) || "").trim();
    const bissiName = ((req.query.bissiName as string) || "").trim();

    if (!tokenNumber) {
      res.json({ found: false });
      return;
    }

    // Attempt token lookup in tokens table joined with customers and committees
    let query = `
      SELECT t.id as token_id, t.raw_token_number, t.normalized_token_number,
             c.id as customer_id, c.name as customer_name, c.mobile as mobile_number,
             cm.name as committee_name
      FROM tokens t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN committees cm ON t.committee_id = cm.id
      WHERE (t.raw_token_number = $1 OR t.normalized_token_number::text = $1)
    `;
    const params: any[] = [tokenNumber];

    if (bissiName) {
      query += ` AND cm.name ILIKE $2`;
      params.push(`%${bissiName}%`);
    }

    query += ` LIMIT 1`;

    const tokenRes = await pool.query(query, params);

    if (tokenRes.rows.length > 0) {
      const row = tokenRes.rows[0];
      res.json({
        found: true,
        tokenId: row.token_id,
        tokenNumber: row.raw_token_number || tokenNumber,
        customerId: row.customer_id,
        customerName: row.customer_name,
        mobileNumber: row.mobile_number || "",
        bissiName: row.committee_name || bissiName || ""
      });
      return;
    }

    // Fallback: search by customer name / reference matching token if entered
    const custRes = await pool.query(
      `SELECT id, name, mobile FROM customers WHERE name ILIKE $1 OR reference_number ILIKE $1 LIMIT 1`,
      [`%${tokenNumber}%`]
    );

    if (custRes.rows.length > 0) {
      const c = custRes.rows[0];
      res.json({
        found: true,
        tokenId: null,
        tokenNumber,
        customerId: c.id,
        customerName: c.name,
        mobileNumber: c.mobile || "",
        bissiName: bissiName || ""
      });
      return;
    }

    res.json({ found: false });
  } catch (err: any) {
    console.error("[Lottery Management] Detect token error:", err);
    res.json({ found: false });
  }
});

// ---------------------------------------------------------------------------
// POST /api/lottery/sessions/:id/gifts
// ---------------------------------------------------------------------------
router.post("/sessions/:id/gifts", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const { id: sessionId } = req.params;
    const {
      tokenNumber,
      customerName,
      mobileNumber,
      bissiName,
      giftName,
      giftCategory,
      giftValue,
      status,
      collectionDate,
      collectedBy,
      remarks
    } = req.body;

    if (!tokenNumber || !giftName) {
      res.status(400).json({ success: false, error: "Token Number and Gift Name are required" });
      return;
    }

    // Check duplicate token in this lottery session
    const dupCheck = await pool.query(
      `SELECT id FROM lottery_gifts WHERE session_id = $1 AND token_number = $2`,
      [sessionId, String(tokenNumber).trim()]
    );

    if (dupCheck.rows.length > 0) {
      res.status(400).json({
        success: false,
        error: `Token #${tokenNumber} already received a gift in this lottery session. Each token can receive only one gift per session.`
      });
      return;
    }

    let finalCustomerName = customerName ? String(customerName).trim() : "";
    let finalMobile = mobileNumber ? String(mobileNumber).trim() : "";
    let finalBissi = bissiName ? String(bissiName).trim() : "";
    let tokenId: string | null = null;
    let customerId: string | null = null;

    // Auto-detect customer if not provided
    if (!finalCustomerName) {
      const detectRes = await pool.query(
        `SELECT t.id as token_id, c.id as customer_id, c.name as customer_name, c.mobile, cm.name as committee_name
         FROM tokens t
         JOIN customers c ON t.customer_id = c.id
         LEFT JOIN committees cm ON t.committee_id = cm.id
         WHERE t.raw_token_number = $1 OR t.normalized_token_number::text = $1
         LIMIT 1`,
        [String(tokenNumber).trim()]
      );

      if (detectRes.rows.length > 0) {
        const d = detectRes.rows[0];
        finalCustomerName = d.customer_name;
        finalMobile = d.mobile || "";
        finalBissi = d.committee_name || finalBissi;
        tokenId = d.token_id;
        customerId = d.customer_id;
      } else {
        finalCustomerName = `Token Holder #${tokenNumber}`;
      }
    }

    const giftStatus = status === "Collected" ? "Collected" : "Pending";
    const colDate = giftStatus === "Collected" ? (collectionDate || new Date().toISOString().slice(0, 10)) : null;

    const insertRes = await pool.query(
      `INSERT INTO lottery_gifts 
       (session_id, token_number, token_id, customer_id, customer_name, mobile_number, bissi_name, gift_name, gift_category, gift_value, status, collection_date, collected_by, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        sessionId,
        String(tokenNumber).trim(),
        tokenId,
        customerId,
        finalCustomerName,
        finalMobile || null,
        finalBissi || null,
        String(giftName).trim(),
        giftCategory ? String(giftCategory).trim() : null,
        giftValue ? parseFloat(giftValue) : null,
        giftStatus,
        colDate,
        collectedBy ? String(collectedBy).trim() : null,
        remarks ? String(remarks).trim() : null
      ]
    );

    res.json({ success: true, gift: insertRes.rows[0] });
  } catch (err: any) {
    console.error("[Lottery Management] Add gift error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/lottery/gifts/:id/collect
// ---------------------------------------------------------------------------
router.post("/gifts/:id/collect", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const { id } = req.params;
    const { collectionDate, collectedBy, remarks } = req.body;

    const cDate = collectionDate || new Date().toISOString().slice(0, 10);

    const updateRes = await pool.query(
      `UPDATE lottery_gifts 
       SET status = 'Collected',
           collection_date = $1,
           collected_by = COALESCE($2, collected_by, 'Admin'),
           remarks = COALESCE($3, remarks),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [cDate, collectedBy || null, remarks || null, id]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Lottery gift entry not found" });
      return;
    }

    res.json({ success: true, gift: updateRes.rows[0] });
  } catch (err: any) {
    console.error("[Lottery Management] Collect gift error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/lottery/customer/:customerId/history
// ---------------------------------------------------------------------------
router.get("/customer/:customerId/history", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const { customerId } = req.params;

    // Search by customer_id or matching customer name
    const custRes = await pool.query(`SELECT name, mobile FROM customers WHERE id = $1`, [customerId]);
    const custName = custRes.rows.length > 0 ? custRes.rows[0].name : "";

    const query = `
      SELECT g.*, s.lottery_date, s.lottery_month, s.bissi_name as session_bissi_name
      FROM lottery_gifts g
      JOIN lottery_sessions s ON g.session_id = s.id
      WHERE g.customer_id = $1 ${custName ? "OR g.customer_name ILIKE $2" : ""}
      ORDER BY s.created_at DESC
    `;
    const params = custName ? [customerId, `%${custName}%`] : [customerId];

    const result = await pool.query(query, params);

    const gifts = result.rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      bissiName: r.bissi_name || r.session_bissi_name,
      lotteryDate: r.lottery_date,
      lotteryMonth: r.lottery_month || "",
      tokenNumber: r.token_number,
      giftName: r.gift_name,
      giftCategory: r.gift_category || "",
      giftValue: r.gift_value ? parseFloat(r.gift_value) : null,
      status: r.status,
      collectionDate: r.collection_date || "",
      collectedBy: r.collected_by || "",
      remarks: r.remarks || "",
      createdAt: r.created_at
    }));

    res.json({ success: true, gifts });
  } catch (err: any) {
    console.error("[Lottery Management] Customer history error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/lottery/reports
// ---------------------------------------------------------------------------
router.get("/reports", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const type = (req.query.type as string) || "LOTTERY_WISE"; // LOTTERY_WISE, CUSTOMER_WISE, PENDING, COLLECTED, BISSI_WISE
    const bissi = (req.query.bissi as string) || "ALL";

    let query = `
      SELECT g.*, s.bissi_name as session_bissi_name, s.lottery_date, s.lottery_month
      FROM lottery_gifts g
      JOIN lottery_sessions s ON g.session_id = s.id
    `;
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (type === "PENDING") {
      whereConditions.push(`g.status = 'Pending'`);
    } else if (type === "COLLECTED") {
      whereConditions.push(`g.status = 'Collected'`);
    }

    if (bissi !== "ALL") {
      params.push(`%${bissi}%`);
      whereConditions.push(`(g.bissi_name ILIKE $${params.length} OR s.bissi_name ILIKE $${params.length})`);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ` + whereConditions.join(" AND ");
    }

    query += ` ORDER BY s.created_at DESC, g.token_number ASC`;

    const result = await pool.query(query, params);

    const gifts = result.rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      bissiName: r.bissi_name || r.session_bissi_name,
      lotteryDate: r.lottery_date,
      lotteryMonth: r.lottery_month || "",
      tokenNumber: r.token_number,
      customerName: r.customer_name,
      mobileNumber: r.mobile_number || "",
      giftName: r.gift_name,
      giftCategory: r.gift_category || "",
      giftValue: r.gift_value ? parseFloat(r.gift_value) : null,
      status: r.status,
      collectionDate: r.collection_date || "",
      collectedBy: r.collected_by || "",
      remarks: r.remarks || "",
      createdAt: r.created_at
    }));

    res.json({
      success: true,
      reportType: type,
      totalGifts: gifts.length,
      collectedCount: gifts.filter(g => g.status === "Collected").length,
      pendingCount: gifts.filter(g => g.status === "Pending").length,
      gifts
    });
  } catch (err: any) {
    console.error("[Lottery Management] Reports error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
