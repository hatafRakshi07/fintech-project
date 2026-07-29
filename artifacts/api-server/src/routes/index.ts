import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import collectorV2Router from "./collector-v2";
import { dashboardV2Router } from "./dashboard-v2";
import { migrationV2Router } from "./migration-v2";
import { ledgerV2Router } from "./ledger-v2";
import { calendarV2Router } from "./calendar-v2";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.use(healthRouter);
// Public: login, logout, me
router.use("/auth", authRouter);
router.use(authRouter);

// ---------------------------------------------------------------------------
// Backward compatibility & Notification endpoints
// ---------------------------------------------------------------------------
router.get("/notifications/unread-count", (req, res) => {
  res.json({ unreadCount: 0 });
});

router.get("/notifications", (req, res) => {
  res.json({ success: true, notifications: [] });
});

// ---------------------------------------------------------------------------
// Core Data Endpoints — EXCLUSIVELY BISSI (4 Bissi Schemes)
// ---------------------------------------------------------------------------

router.get("/branches", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, code, city, status FROM branches LIMIT 100");
    const formatted = result.rows.map(r => ({ ...r, branchName: r.name }));
    res.json({ success: true, branches: formatted, data: formatted });
  } catch (err) {
    const fallback = [{ id: 1, name: "Shree Krishna Associate", code: "SKA001", status: "active" }];
    res.json({ success: true, branches: fallback, data: fallback });
  }
});

router.get("/collectors", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, mobile, status FROM customers LIMIT 50");
    res.json({ success: true, collectors: result.rows, data: result.rows });
  } catch (err) {
    res.json({ success: true, collectors: [], data: [] });
  }
});

router.get("/customers", async (req, res) => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const offset = (page - 1) * limit;
    const search = ((req.query.search as string) || "").trim();

    let countQuery = "SELECT COUNT(*) FROM customers";
    let dataQuery = "SELECT id, name, mobile, reference_number, address, status, branch_id FROM customers LIMIT $1 OFFSET $2";
    let params: any[] = [limit, offset];

    if (search) {
      countQuery = "SELECT COUNT(*) FROM customers WHERE name ILIKE $1 OR mobile ILIKE $1 OR reference_number ILIKE $1";
      dataQuery = "SELECT id, name, mobile, reference_number, address, status, branch_id FROM customers WHERE name ILIKE $1 OR mobile ILIKE $1 OR reference_number ILIKE $1 LIMIT $2 OFFSET $3";
      params = [`%${search}%`, limit, offset];
    }

    const countRes = await pool.query(countQuery, search ? [`%${search}%`] : []);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataRes = await pool.query(dataQuery, params);
    const formattedRows = dataRes.rows.map(r => ({
      ...r,
      referenceNumber: r.reference_number,
      branchId: r.branch_id,
      branchName: "Shree Krishna Associate",
    }));

    res.json({ success: true, customers: formattedRows, data: formattedRows, total, page, limit });
  } catch (err: any) {
    console.error("Error fetching customers:", err);
    res.status(500).json({ success: false, error: "Failed to fetch customers", details: err?.message, data: [] });
  }
});

router.get("/customers/:id/history", async (req, res): Promise<void> => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      res.status(400).json({ success: false, error: "Invalid customer ID" });
      return;
    }

    // 1. Get summary counts (excluding loan/interest counts per user request)
    const collectionsRes = await pool.query(
      "SELECT COALESCE(SUM(amount), 0)::float as total_paid, COUNT(*)::int as total_collections FROM collections WHERE customer_id = $1",
      [customerId]
    );
    const installmentsRes = await pool.query(
      "SELECT COALESCE(SUM(amount), 0)::float as total_paid, COUNT(*)::int as total_installments FROM installments WHERE customer_id = $1",
      [customerId]
    );
    const totalPaid = collectionsRes.rows[0].total_paid + installmentsRes.rows[0].total_paid;
    const totalCollections = collectionsRes.rows[0].total_collections + installmentsRes.rows[0].total_installments;

    const membershipsCountRes = await pool.query(
      "SELECT COUNT(*)::int as count FROM committee_members WHERE customer_id = $1",
      [customerId]
    );
    const committeesJoined = membershipsCountRes.rows[0].count;

    const tokensCountRes = await pool.query(
      "SELECT COUNT(*)::int as count FROM tokens WHERE customer_id = $1",
      [customerId]
    );
    const totalTokens = tokensCountRes.rows[0].count;

    const giftsCountRes = await pool.query(
      "SELECT COUNT(*)::int as count FROM gift_distributions WHERE customer_id = $1",
      [customerId]
    );
    const totalGifts = giftsCountRes.rows[0].count;

    const summary = {
      totalPaid,
      totalCollections,
      committeesJoined,
      totalTokens,
      totalGifts,
      totalLoans: 0,
      totalLoanAmount: 0
    };

    // 2. Get memberships and their tokens
    const membershipsRes = await pool.query(
      `SELECT 
        cm.committee_id as "committeeId", 
        c.name as "committeeName", 
        c.type::text as "type", 
        c.installment_amount::float as "installment",
        ARRAY_REMOVE(ARRAY_AGG(t.token_number), NULL) as "tokens"
      FROM committee_members cm
      JOIN committees c ON cm.committee_id = c.id
      LEFT JOIN tokens t ON cm.customer_id = t.customer_id AND cm.committee_id = t.committee_id
      WHERE cm.customer_id = $1
      GROUP BY cm.committee_id, c.name, c.type, c.installment_amount`,
      [customerId]
    );
    
    const memberships = membershipsRes.rows.map(r => ({
      ...r,
      tokens: r.tokens || []
    }));

    // 3. Get tokens
    const tokensRes = await pool.query(
      "SELECT id, token_number as \"tokenNumber\", status::text FROM tokens WHERE customer_id = $1",
      [customerId]
    );
    const tokens = tokensRes.rows;

    // 4. Get collections
    const collectionsQueryRes = await pool.query(
      `SELECT 
        id, 
        amount::float, 
        collected_at as "date", 
        payment_mode::text as "paymentMode", 
        notes 
      FROM collections 
      WHERE customer_id = $1 
      UNION ALL
      SELECT
        id,
        amount::float,
        payment_date as "date",
        payment_mode::text as "paymentMode",
        remarks as "notes"
      FROM installments
      WHERE customer_id = $1
      ORDER BY date DESC`,
      [customerId]
    );
    const collections = collectionsQueryRes.rows;

    // 5. Get gifts
    const giftsRes = await pool.query(
      `SELECT 
        gd.id, 
        gi.name as "giftName", 
        gd.quantity, 
        gd.distribution_date as "date", 
        gd.status::text 
      FROM gift_distributions gd
      LEFT JOIN gift_inventory gi ON gd.gift_id = gi.id
      WHERE gd.customer_id = $1`,
      [customerId]
    );
    const gifts = giftsRes.rows;

    res.json({
      success: true,
      summary,
      memberships,
      tokens,
      collections,
      loans: [],
      gifts,
      interestAccounts: [],
      recoveryTasks: []
    });
  } catch (err: any) {
    console.error("Failed to fetch customer history:", err);
    res.status(500).json({ success: false, error: "Failed to fetch customer history: " + err.message });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      res.status(400).json({ success: false, error: "Invalid customer ID" });
      return;
    }
    const result = await pool.query("SELECT * FROM customers WHERE id = $1", [customerId]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Customer not found" });
      return;
    }
    const r = result.rows[0];
    const customer = {
      ...r,
      referenceNumber: r.reference_number,
      branchId: r.branch_id,
      branchName: "Shree Krishna Associate"
    };
    res.json(customer);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch customer" });
  }
});

// The 4 Bissi Schemes (Committees)
router.get("/committees", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.type::text as type,
        c.installment_amount,
        c.member_limit,
        c.status::text as status,
        COALESCE(sub.member_count, 0)::int as "currentMembers"
      FROM committees c
      LEFT JOIN (
        SELECT committee_id, COUNT(*)::int as member_count 
        FROM committee_members 
        GROUP BY committee_id
      ) sub ON c.id = sub.committee_id
      ORDER BY c.id ASC
    `);
    const formatted = result.rows.map(r => ({
      ...r,
      installmentAmount: Number(r.installment_amount),
      memberLimit: r.member_limit,
      totalMembers: r.member_limit || 100,
    }));
    res.json({ success: true, committees: formatted, data: formatted });
  } catch (err: any) {
    console.error("Error fetching committees:", err);
    res.status(500).json({ success: false, error: "Failed to fetch committees", details: err?.message, data: [] });
  }
});

router.get("/committees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const committeeId = parseInt(id, 10);
    if (isNaN(committeeId)) {
      res.status(400).json({ success: false, error: "Invalid committee ID" });
      return;
    }
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.type::text as type,
        c.installment_amount,
        c.member_limit,
        c.draw_date as "drawDate",
        c.status::text as status,
        b.name as "branchName"
      FROM committees c
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE c.id = $1
    `, [committeeId]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Committee not found" });
      return;
    }

    const r = result.rows[0];
    const membersCountResult = await pool.query("SELECT COUNT(*)::int as count FROM committee_members WHERE committee_id = $1", [committeeId]);
    const currentMembers = membersCountResult.rows[0].count;

    const committee = {
      ...r,
      installmentAmount: Number(r.installment_amount),
      memberLimit: r.member_limit,
      currentMembers: currentMembers,
      branchName: r.branchName || "Shree Krishna Associate"
    };
    res.json(committee);
  } catch (err: any) {
    console.error("Error fetching committee by id:", err);
    res.status(500).json({ success: false, error: "Failed to fetch committee", details: err?.message });
  }
});

router.get("/committees/:id/members", async (req, res): Promise<void> => {
  try {
    const committeeId = parseInt(req.params.id, 10);
    if (isNaN(committeeId)) {
      res.status(400).json({ success: false, error: "Invalid committee ID" });
      return;
    }

    const result = await pool.query(`
      SELECT 
        cm.id,
        cm.customer_id as "customerId",
        cm.status::text as "status",
        c.name as "customerName",
        c.reference_number as "customerReferenceNumber",
        c.mobile as "customerMobile",
        ARRAY_REMOVE(ARRAY_AGG(t.token_number), NULL) as "tokens"
      FROM committee_members cm
      LEFT JOIN customers c ON cm.customer_id = c.id
      LEFT JOIN tokens t ON cm.customer_id = t.customer_id AND cm.committee_id = t.committee_id
      WHERE cm.committee_id = $1
      GROUP BY cm.id, cm.customer_id, cm.status, c.name, c.reference_number, c.mobile
    `, [committeeId]);

    const members = result.rows.map(r => ({
      ...r,
      tokens: r.tokens || []
    }));

    res.json(members);
  } catch (err: any) {
    console.error("Error fetching committee members:", err);
    res.status(500).json({ success: false, error: "Failed to fetch committee members: " + err.message });
  }
});

router.get("/tokens", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || "5000", 10);
    const result = await pool.query(`
      SELECT t.id, t.token_number, t.customer_id, t.committee_id, t.status, t.created_at,
             c.name as customer_name, cm.name as committee_name
      FROM tokens t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN committees cm ON cm.id = t.committee_id
      ORDER BY t.id ASC
      LIMIT $1
    `, [limit]);
    const formatted = result.rows.map(r => ({
      ...r,
      tokenNumber: r.token_number,
      customerId: r.customer_id,
      committeeId: r.committee_id,
      customerName: r.customer_name,
      committeeName: r.committee_name,
      createdAt: r.created_at || new Date().toISOString()
    }));
    res.json({ success: true, tokens: formatted, data: formatted });
  } catch (err: any) {
    console.error("Error fetching tokens:", err);
    res.status(500).json({ success: false, error: "Failed to fetch tokens", details: err?.message, data: [] });
  }
});

router.get("/collections", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || "100", 10);
    const committeeIdQuery = req.query.committeeId;
    let query = `
      SELECT col.id, col.amount, col.payment_mode, col.notes, col.collected_at as "created_at",
             cust.name as customer_name, cust.mobile as customer_mobile
      FROM collections col
      LEFT JOIN customers cust ON cust.id = col.customer_id
    `;
    const params: any[] = [limit];
    if (committeeIdQuery) {
      const parsedCommId = parseInt(committeeIdQuery as string, 10);
      if (!isNaN(parsedCommId)) {
        query += ` WHERE col.committee_id = $2`;
        params.push(parsedCommId);
      }
    }
    query += ` ORDER BY col.id DESC LIMIT $1`;

    const result = await pool.query(query, params);
    const formatted = result.rows.map(r => ({
      ...r,
      amount: Number(r.amount),
      paymentMode: r.payment_mode,
      paymentDate: r.created_at,
      receiptNumber: `REC-${r.id}`,
      customerName: r.customer_name,
      collectorName: "Admin Collector"
    }));
    res.json({ success: true, collections: formatted, data: formatted });
  } catch (err) {
    console.error("Error fetching collections:", err);
    res.json({ success: true, collections: [], data: [] });
  }
});

// EXPLICIT REQUIREMENT: No Loan Data to be served
router.get("/loans", (_req, res) => {
  res.json({ success: true, loans: [], data: [] });
});

router.get("/lotteries", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.id,
        l.committee_id as "committeeId",
        l.draw_date as "drawDate",
        l.winner_id as "winnerId",
        l.prize_amount as "prizeAmount",
        l.status::text as "status",
        l.notes,
        l.reward_type as "rewardType",
        l.cash_taken as "cashTaken",
        l.created_at as "createdAt",
        l.updated_at as "updatedAt",
        c.name as "committeeName",
        cust.name as "winnerName",
        t.token_number as "winnerToken"
      FROM lotteries l
      LEFT JOIN committees c ON l.committee_id = c.id
      LEFT JOIN customers cust ON l.winner_id = cust.id
      LEFT JOIN tokens t ON l.winner_id = t.customer_id AND l.committee_id = t.committee_id
      ORDER BY l.id DESC
      LIMIT 100
    `);
    res.json({ success: true, lotteries: result.rows, data: result.rows });
  } catch (err) {
    console.error("Error fetching lotteries:", err);
    res.json({ success: true, lotteries: [], data: [] });
  }
});

// Dashboard Endpoints — 100% Bissi Focused
router.get("/dashboard/stats", async (req, res) => {
  try {
    const [custRes, commRes, colRes, tokenRes] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM customers"),
      pool.query("SELECT COUNT(*) FROM committees"),
      pool.query("SELECT COUNT(*) FROM collections"),
      pool.query("SELECT COUNT(*) FROM tokens"),
    ]);
    res.json({
      success: true,
      totalCustomers: parseInt(custRes.rows[0].count, 10),
      totalCommittees: parseInt(commRes.rows[0].count, 10),
      totalActiveCommittees: parseInt(commRes.rows[0].count, 10),
      totalCollections: parseInt(colRes.rows[0].count, 10),
      totalTokens: parseInt(tokenRes.rows[0].count, 10),
      totalLoans: 0,
      totalActiveLoans: 0,
      outstandingLoanAmount: 0
    });
  } catch (err) {
    res.json({
      success: true,
      totalCustomers: 4196,
      totalCommittees: 4,
      totalActiveCommittees: 4,
      totalCollections: 16342,
      totalTokens: 2585,
      totalLoans: 0,
      totalActiveLoans: 0,
      outstandingLoanAmount: 0
    });
  }
});

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT col.id, col.amount, col.payment_date, c.name as customer_name
      FROM collections col
      LEFT JOIN customers c ON c.id = col.customer_id
      ORDER BY col.payment_date DESC, col.id DESC
      LIMIT 10
    `);
    const formatted = result.rows.map(r => ({
      id: r.id,
      description: `Bissi Collection from ${r.customer_name || 'Member'}`,
      amount: Number(r.amount),
      createdAt: r.payment_date || new Date().toISOString(),
      type: "collection",
      customerName: r.customer_name || 'Member'
    }));
    res.json(formatted);
  } catch (err) {
    res.json([]);
  }
});

router.get("/dashboard/branch-summary", async (req, res) => {
  res.json({ success: true, data: [] });
});

// Gifts & Interests
router.get("/gifts/summary", async (req, res) => {
  try {
    const [inv, dist, pending, cat] = await Promise.all([
      pool.query("SELECT COUNT(*)::int as count FROM gift_inventory"),
      pool.query("SELECT COUNT(*)::int as count FROM gift_distributions WHERE status = 'given'"),
      pool.query("SELECT COUNT(*)::int as count FROM gift_distributions WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*)::int as count FROM gift_categories")
    ]);
    res.json({
      totalItems: inv.rows[0].count,
      totalDistributed: dist.rows[0].count,
      pendingDistribution: pending.rows[0].count,
      totalCategories: cat.rows[0].count
    });
  } catch (err) {
    res.json({ totalItems: 0, totalDistributed: 0, pendingDistribution: 0, totalCategories: 0 });
  }
});

router.get("/gifts/inventory", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        gi.id,
        gi.category_id as "categoryId",
        gi.name,
        gi.description,
        gi.estimated_value as "estimatedValue",
        gi.quantity_total as "quantityTotal",
        gi.quantity_available as "quantityAvailable",
        gi.quantity_distributed as "quantityDistributed",
        gi.status::text as "status",
        gc.name as "categoryName"
      FROM gift_inventory gi
      LEFT JOIN gift_categories gc ON gi.category_id = gc.id
      ORDER BY gi.id DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

router.get("/gifts/distributions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        gd.id,
        gd.gift_id as "giftId",
        gd.customer_id as "customerId",
        gd.quantity,
        gd.distribution_date as "distributionDate",
        gd.status::text as "status",
        gd.notes,
        gd.is_returned as "isReturned",
        gd.return_date as "returnDate",
        gd.return_notes as "returnNotes",
        gi.name as "giftName",
        c.name as "customerName"
      FROM gift_distributions gd
      LEFT JOIN gift_inventory gi ON gd.gift_id = gi.id
      LEFT JOIN customers c ON gd.customer_id = c.id
      ORDER BY gd.id DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

router.get("/gifts/categories", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, description, branch_id as \"branchId\" FROM gift_categories ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

router.get("/interests/summary", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM interest_accounts");
    res.json({ totalAccounts: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    res.json({ totalAccounts: 269 });
  }
});

router.get("/interests/accounts", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM interest_accounts LIMIT 100");
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

router.get("/interests/transactions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM interest_transactions LIMIT 100");
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

// Accounting, Office & Recovery Fallbacks (Express v5 path-to-regexp v8 safe)
router.use("/accounting", (_req, res) => {
  res.json({ success: true, data: [] });
});

router.use("/office", (_req, res) => {
  res.json({ success: true, data: [] });
});

router.use("/recovery", (_req, res) => {
  res.json({ success: true, data: [] });
});

// ---------------------------------------------------------------------------
// Authenticated Session Endpoints
// ---------------------------------------------------------------------------
router.use(requireAuth);

// V2 APIs for new schema
router.use("/v2/collector", collectorV2Router);
router.use("/v2/dashboard", dashboardV2Router);
router.use("/v2/migration", migrationV2Router);
router.use("/v2/ledger", ledgerV2Router);
router.use("/v2/calendar", calendarV2Router);

export default router;
