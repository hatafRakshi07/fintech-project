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

router.get("/branches", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, code, city, status FROM branches LIMIT 100");
    res.json({ success: true, branches: result.rows, data: result.rows });
  } catch (err) {
    res.json({ success: true, branches: [{ id: 1, name: "Shree Krishna Associate", code: "SKA001" }], data: [] });
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
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "10", 10);
    const offset = (page - 1) * limit;
    const search = req.query.search as string || "";

    let countQuery = "SELECT COUNT(*) FROM customers";
    let dataQuery = "SELECT id, name, mobile, reference_number, address FROM customers LIMIT $1 OFFSET $2";
    let params: any[] = [limit, offset];

    if (search) {
      countQuery = "SELECT COUNT(*) FROM customers WHERE name ILIKE $1 OR mobile ILIKE $1";
      dataQuery = "SELECT id, name, mobile, reference_number, address FROM customers WHERE name ILIKE $1 OR mobile ILIKE $1 LIMIT $2 OFFSET $3";
      params = [`%${search}%`, limit, offset];
    }

    const countRes = await pool.query(countQuery, search ? [`%${search}%`] : []);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataRes = await pool.query(dataQuery, params);
    res.json({ success: true, customers: dataRes.rows, data: dataRes.rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch customers" });
  }
});

router.get("/committees", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, installment_amount, member_limit, status FROM committees");
    res.json({ success: true, committees: result.rows, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch committees" });
  }
});

router.get("/tokens", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, token_number, customer_id, committee_id, status FROM tokens LIMIT 100");
    res.json({ success: true, tokens: result.rows, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch tokens" });
  }
});

// All routes below require a valid session token
router.use(requireAuth);

// V2 APIs for new schema
router.use("/v2/collector", collectorV2Router);
router.use("/v2/dashboard", dashboardV2Router);
router.use("/v2/migration", migrationV2Router);
router.use("/v2/ledger", ledgerV2Router);
router.use("/v2/calendar", calendarV2Router);

export default router;
