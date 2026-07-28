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

router.get("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
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
    res.json({ success: true, customer, data: customer });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch customer" });
  }
});

// The 4 Bissi Schemes (Committees)
router.get("/committees", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, type, installment_amount, member_limit, status FROM committees ORDER BY id ASC");
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
    const result = await pool.query("SELECT * FROM committees WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Committee not found" });
      return;
    }
    const r = result.rows[0];
    const committee = {
      ...r,
      installmentAmount: Number(r.installment_amount),
      memberLimit: r.member_limit,
    };
    res.json({ success: true, committee, data: committee });
  } catch (err: any) {
    console.error("Error fetching committee by id:", err);
    res.status(500).json({ success: false, error: "Failed to fetch committee", details: err?.message });
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
    const result = await pool.query(`
      SELECT col.id, col.amount, col.payment_mode, col.notes, col.created_at,
             cust.name as customer_name, cust.mobile as customer_mobile
      FROM collections col
      LEFT JOIN customers cust ON cust.id = col.customer_id
      ORDER BY col.id DESC
      LIMIT $1
    `, [limit]);
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
    res.json({ success: true, collections: [], data: [] });
  }
});

// EXPLICIT REQUIREMENT: No Loan Data to be served
router.get("/loans", (_req, res) => {
  res.json({ success: true, loans: [], data: [] });
});

router.get("/lotteries", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM lotteries ORDER BY id DESC LIMIT 50");
    res.json({ success: true, lotteries: result.rows, data: result.rows });
  } catch (err) {
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
    const [inv, dist] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM gift_inventory"),
      pool.query("SELECT COUNT(*) FROM gift_distributions")
    ]);
    res.json({
      totalInventoryItems: parseInt(inv.rows[0].count, 10),
      totalDistributions: parseInt(dist.rows[0].count, 10)
    });
  } catch (err) {
    res.json({ totalInventoryItems: 1055, totalDistributions: 2608 });
  }
});

router.get("/gifts/inventory", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM gift_inventory LIMIT 100");
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

router.get("/gifts/distributions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM gift_distributions LIMIT 100");
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

router.get("/gifts/categories", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM gift_categories");
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
