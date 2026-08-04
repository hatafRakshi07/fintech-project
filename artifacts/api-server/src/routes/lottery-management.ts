import { Router } from "express";
import { pool, queryWithRetry } from "@workspace/db";

const router = Router();

const DEFAULT_BISSI_SCHEMES = [
  { name: "Sawariya Seth Bissi (5th Date)", date: "5th Date", month: "Monthly Draw", uuid: "a3d68b9c-63df-4884-a5ad-eb8a17e3be31" },
  { name: "Pyare Mohan Bissi (15th Date)", date: "15th Date", month: "Monthly Draw", uuid: "33333333-3333-3333-3333-333333333333" },
  { name: "Hare Ka Sahara Bissi (20th Date)", date: "20th Date", month: "Monthly Draw", uuid: "11111111-1111-1111-1111-111111111111" },
  { name: "Shree Krishna Associate Bissi (10th Date)", date: "10th Date", month: "Monthly Draw", uuid: "22222222-2222-2222-2222-222222222222" },
];

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

async function ensureDefaultBissiSessions() {
  await ensureLotteryTablesExist();
  try {
    for (const b of DEFAULT_BISSI_SCHEMES) {
      const firstWord = b.name.split(' ')[0];
      const existing = await pool.query(
        `SELECT id FROM lottery_sessions WHERE bissi_name ILIKE $1 OR committee_id::text = $2`,
        [`%${firstWord}%`, b.uuid]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO lottery_sessions (bissi_name, committee_id, lottery_date, lottery_month, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [b.name, b.uuid, b.date, b.month, `Default session for ${b.name}`]
        );
      }
    }
  } catch (err) {
    console.error("[Lottery Management] Error ensuring default Bissi sessions:", err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/lottery/dashboard
// ---------------------------------------------------------------------------
router.get("/dashboard", async (req, res) => {
  await ensureDefaultBissiSessions();
  try {
    const sessionsRes = await pool.query(`SELECT id FROM lottery_sessions`);
    
    // Count gifts from gift_distributions + lotteries + lottery_gifts
    const giftsCountRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_gifts,
        COUNT(CASE WHEN status ILIKE 'distributed' OR status ILIKE 'collected' OR status ILIKE 'completed' THEN 1 END)::int as collected_gifts,
        COUNT(CASE WHEN status ILIKE 'pending' THEN 1 END)::int as pending_gifts
      FROM (
        SELECT status FROM gift_distributions
        UNION ALL
        SELECT status FROM lotteries
        UNION ALL
        SELECT status FROM lottery_gifts
      ) sub
    `);

    const row = giftsCountRes.rows[0] || {};
    const totalSessions = Math.max(4, sessionsRes.rows.length);
    const totalGiftsDistributed = Number(row.total_gifts || 0);
    const collectedGifts = Number(row.collected_gifts || totalGiftsDistributed);
    const pendingGifts = Number(row.pending_gifts || 0);

    res.json({
      success: true,
      stats: {
        totalSessions,
        totalGiftsDistributed,
        collectedGifts,
        pendingGifts,
        todayCollectedGifts: 0
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
  await ensureDefaultBissiSessions();
  try {
    const search = ((req.query.search as string) || "").trim().toLowerCase();
    const bissiFilter = ((req.query.bissi as string) || "ALL").trim();

    const sessionsRes = await pool.query(`SELECT * FROM lottery_sessions ORDER BY created_at ASC`);

    // Calculate gifts count per Bissi scheme
    const countsRes = await pool.query(`
      SELECT 
        COALESCE(cm.name, gd.notes, 'Other') as bissi_name,
        cm.id::text as committee_id,
        COUNT(*)::int as total,
        COUNT(CASE WHEN gd.status ILIKE 'distributed' OR gd.status ILIKE 'collected' OR gd.status ILIKE 'completed' THEN 1 END)::int as collected,
        COUNT(CASE WHEN gd.status ILIKE 'pending' THEN 1 END)::int as pending
      FROM gift_distributions gd
      LEFT JOIN committees cm ON cm.id = gd.committee_uuid
      GROUP BY cm.name, cm.id, gd.notes
    `);

    const countsByBissi = new Map<string, { total: number; collected: number; pending: number }>();
    for (const r of countsRes.rows) {
      const name = r.bissi_name || "";
      const cid = r.committee_id || "";
      const val = { total: Number(r.total || 0), collected: Number(r.collected || 0), pending: Number(r.pending || 0) };
      if (name) countsByBissi.set(name.toLowerCase(), val);
      if (cid) countsByBissi.set(cid, val);
    }

    let sessions = sessionsRes.rows.map(s => {
      const bName = s.bissi_name || "";
      const cId = s.committee_id || "";
      const counts = countsByBissi.get(cId) || countsByBissi.get(bName.toLowerCase()) || { total: 0, collected: 0, pending: 0 };
      
      let matchedCounts = counts;
      if (matchedCounts.total === 0) {
        for (const [k, v] of countsByBissi.entries()) {
          const firstKeyWord = k.split(' ')[0].toLowerCase();
          if (firstKeyWord && bName.toLowerCase().includes(firstKeyWord)) {
            matchedCounts = v;
            break;
          }
        }
      }

      return {
        id: s.id,
        bissiName: s.bissi_name,
        committeeId: s.committee_id,
        lotteryDate: s.lottery_date,
        lotteryMonth: s.lottery_month || "",
        notes: s.notes || "",
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        totalGifts: matchedCounts.total,
        collectedGifts: matchedCounts.collected,
        pendingGifts: matchedCounts.pending
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
      sessions = sessions.filter(s => s.bissiName.toLowerCase().includes(bissiFilter.toLowerCase()));
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
  await ensureDefaultBissiSessions();
  try {
    const { id } = req.params;
    const sessionRes = await pool.query(`SELECT * FROM lottery_sessions WHERE id::text = $1 OR committee_id::text = $1 LIMIT 1`, [id]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Lottery session not found" });
      return;
    }

    const s = sessionRes.rows[0];
    const commUuid = s.committee_id;
    const bissiName = s.bissi_name || "";
    const firstWord = bissiName ? bissiName.split(' ')[0] : '';

    // 1. Fetch from gift_distributions
    const gdRes = await pool.query(`
      SELECT 
        gd.id::text,
        gd.token_number::text as token_number,
        gd.customer_name,
        c.mobile as mobile_number,
        COALESCE(cm.name, $1) as bissi_name,
        gd.gift_name,
        'General Gift' as gift_category,
        gd.status,
        gd.distribution_date::text as collection_date,
        'Admin' as collected_by,
        gd.notes as remarks,
        gd.created_at
      FROM gift_distributions gd
      LEFT JOIN committees cm ON cm.id = gd.committee_uuid
      LEFT JOIN customers c ON c.id = gd.customer_uuid
      WHERE (gd.committee_uuid::text = $2 OR cm.name ILIKE $3 OR gd.notes ILIKE $3)
      ORDER BY gd.distribution_date DESC LIMIT 1500
    `, [bissiName, String(commUuid), `%${firstWord}%`]);

    // 2. Fetch from lotteries
    const lotRes = await pool.query(`
      SELECT 
        l.id::text,
        l.token_number::text as token_number,
        COALESCE(c.name, 'Winner') as customer_name,
        c.mobile as mobile_number,
        COALESCE(cm.name, $1) as bissi_name,
        l.reward_description as gift_name,
        'Lottery Winner' as gift_category,
        l.status,
        l.draw_date::text as collection_date,
        'Admin' as collected_by,
        l.notes as remarks,
        l.created_at
      FROM lotteries l
      LEFT JOIN committees cm ON cm.id = l.committee_uuid
      LEFT JOIN customers c ON c.id = l.winner_customer_uuid
      WHERE (l.committee_uuid::text = $2 OR cm.name ILIKE $3)
      ORDER BY l.draw_date DESC LIMIT 1500
    `, [bissiName, String(commUuid), `%${firstWord}%`]);

    // 3. Fetch from lottery_gifts
    const lgRes = await pool.query(
      `SELECT * FROM lottery_gifts WHERE session_id::text = $1 ORDER BY created_at DESC`,
      [s.id]
    );

    const rawGifts = [...lgRes.rows, ...gdRes.rows, ...lotRes.rows];

    const gifts = rawGifts.map(g => ({
      id: g.id,
      sessionId: s.id,
      tokenNumber: String(g.token_number || ""),
      customerName: g.customer_name || "Member",
      mobileNumber: g.mobile_number || "",
      bissiName: g.bissi_name || s.bissi_name,
      giftName: g.gift_name || "Gift Record",
      giftCategory: g.gift_category || "General",
      giftValue: g.gift_value ? parseFloat(g.gift_value) : null,
      status: (g.status === "distributed" || g.status === "completed" || g.status === "Collected") ? "Collected" : "Pending",
      collectionDate: g.collection_date || "",
      collectedBy: g.collected_by || "Admin",
      remarks: g.remarks || "",
      createdAt: g.created_at
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
      params.push(`%${bissiName.split(' ')[0]}%`);
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

    let finalCustomerName = customerName ? String(customerName).trim() : "";
    let finalMobile = mobileNumber ? String(mobileNumber).trim() : "";
    let finalBissi = bissiName ? String(bissiName).trim() : "";
    let tokenId: string | null = null;
    let customerId: string | null = null;

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

    await pool.query(`
      INSERT INTO gift_distributions (
        token_number, customer_name, gift_name, status, distribution_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      parseInt(String(tokenNumber).replace(/\D/g, ''), 10) || 0,
      finalCustomerName,
      String(giftName).trim(),
      giftStatus === "Collected" ? "distributed" : "pending",
      colDate || new Date().toISOString().slice(0, 10),
      remarks ? String(remarks).trim() : null
    ]).catch(() => {});

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
       WHERE id::text = $4
       RETURNING *`,
      [cDate, collectedBy || null, remarks || null, String(id)]
    );

    await pool.query(
      `UPDATE gift_distributions SET status = 'distributed', distribution_date = $1 WHERE id::text = $2`,
      [cDate, String(id)]
    ).catch(() => {});

    res.json({ success: true, gift: updateRes.rows[0] || { id, status: 'Collected' } });
  } catch (err: any) {
    console.error("[Lottery Management] Collect gift error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function resolveCustomerUuid(identifier: string | number | undefined | null): Promise<string | null> {
  if (identifier === undefined || identifier === null || identifier === "") return null;
  const idStr = String(identifier).trim();

  if (/^[0-9a-f-]{36}$/i.test(idStr)) {
    const res = await pool.query("SELECT id::text FROM customers WHERE id::text = $1 AND deleted_at IS NULL LIMIT 1", [idStr]);
    if (res.rows.length > 0) return res.rows[0].id;
  }

  const resByMeta = await pool.query(
    "SELECT id::text FROM customers WHERE (mobile = $1 OR aadhaar = $1) AND deleted_at IS NULL LIMIT 1",
    [idStr]
  );
  if (resByMeta.rows.length > 0) return resByMeta.rows[0].id;

  const num = parseInt(idStr, 10);
  if (!isNaN(num)) {
    const resByToken = await pool.query(
      "SELECT customer_id::text FROM tokens WHERE normalized_token_number = $1 AND customer_id IS NOT NULL AND deleted_at IS NULL LIMIT 1",
      [num]
    );
    if (resByToken.rows.length > 0) return resByToken.rows[0].customer_id;

    const resNth = await pool.query(
      "SELECT id::text FROM customers WHERE deleted_at IS NULL ORDER BY created_at ASC OFFSET $1 LIMIT 1",
      [Math.max(0, num - 1)]
    );
    if (resNth.rows.length > 0) return resNth.rows[0].id;
  }

  return null;
}

// ---------------------------------------------------------------------------
// GET /api/lottery/customer/:customerId/history
// ---------------------------------------------------------------------------
router.get("/customer/:customerId/history", async (req, res) => {
  await ensureLotteryTablesExist();
  try {
    const { customerId } = req.params;
    const targetUuid = await resolveCustomerUuid(customerId);

    if (!targetUuid) {
      res.json({ success: true, gifts: [] });
      return;
    }

    const custRes = await pool.query(`SELECT name, mobile FROM customers WHERE id::text = $1`, [targetUuid]);
    const custName = custRes.rows.length > 0 ? custRes.rows[0].name : "";

    const query = `
      SELECT gd.id::text as id, gd.token_number::text as token_number, gd.customer_name,
             c.mobile as mobile_number, COALESCE(cm.name, 'Bissi Scheme') as bissi_name,
             gd.gift_name, 'General' as gift_category, gd.status, gd.distribution_date::text as collection_date,
             'Admin' as collected_by, gd.notes as remarks, gd.created_at
      FROM gift_distributions gd
      LEFT JOIN committees cm ON cm.id::text = gd.committee_uuid::text
      LEFT JOIN customers c ON c.id::text = gd.customer_uuid::text
      WHERE (gd.customer_uuid::text = $1 ${custName ? "OR gd.customer_name ILIKE $2" : ""})
      ORDER BY gd.distribution_date DESC
    `;
    const params = custName ? [targetUuid, `%${custName}%`] : [targetUuid];

    const result = await pool.query(query, params);

    const gifts = result.rows.map(r => ({
      id: r.id,
      bissiName: r.bissi_name,
      tokenNumber: r.token_number,
      giftName: r.gift_name,
      giftCategory: r.gift_category || "",
      giftValue: null,
      status: (r.status === "distributed" || r.status === "completed" || r.status === "Collected") ? "Collected" : "Pending",
      collectionDate: r.collection_date || "",
      collectedBy: r.collected_by || "Admin",
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
  await ensureDefaultBissiSessions();
  try {
    const type = (req.query.type as string) || "LOTTERY_WISE";
    const bissi = (req.query.bissi as string) || "ALL";

    let query = `
      SELECT 
        gd.id::text as id,
        COALESCE(cm.name, 'Bissi Scheme') as bissi_name,
        gd.distribution_date::text as lottery_date,
        'Monthly' as lottery_month,
        gd.token_number::text as token_number,
        gd.customer_name,
        c.mobile as mobile_number,
        gd.gift_name,
        'General' as gift_category,
        gd.status,
        gd.distribution_date::text as collection_date,
        'Admin' as collected_by,
        gd.notes as remarks,
        gd.created_at
      FROM gift_distributions gd
      LEFT JOIN committees cm ON cm.id = gd.committee_uuid
      LEFT JOIN customers c ON c.id = gd.customer_uuid
    `;
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (type === "PENDING") {
      whereConditions.push(`gd.status ILIKE 'pending'`);
    } else if (type === "COLLECTED") {
      whereConditions.push(`(gd.status ILIKE 'distributed' OR gd.status ILIKE 'collected' OR gd.status ILIKE 'completed')`);
    }

    if (bissi !== "ALL") {
      params.push(`%${bissi}%`);
      whereConditions.push(`(cm.name ILIKE $${params.length} OR gd.notes ILIKE $${params.length})`);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ` + whereConditions.join(" AND ");
    }

    query += ` ORDER BY gd.distribution_date DESC LIMIT 2500`;

    const result = await pool.query(query, params);

    const gifts = result.rows.map(r => ({
      id: r.id,
      bissiName: r.bissi_name,
      lotteryDate: r.lottery_date || "",
      lotteryMonth: r.lottery_month || "",
      tokenNumber: r.token_number,
      customerName: r.customer_name,
      mobileNumber: r.mobile_number || "",
      giftName: r.gift_name,
      giftCategory: r.gift_category || "General",
      giftValue: null,
      status: (r.status === "distributed" || r.status === "completed" || r.status === "Collected") ? "Collected" : "Pending",
      collectionDate: r.collection_date || "",
      collectedBy: r.collected_by || "Admin",
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
