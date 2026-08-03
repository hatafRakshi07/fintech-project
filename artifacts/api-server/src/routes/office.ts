import { Router } from "express";
import { pool, queryWithRetry } from "@workspace/db";

const router = Router();

// Auto-create all office tables on first use
async function ensureOfficeTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS office_diary (
      id SERIAL PRIMARY KEY,
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      author_name TEXT,
      branch_id INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS office_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'todo',
      due_date DATE,
      assigned_name TEXT,
      branch_id INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS complaints (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      status TEXT DEFAULT 'open',
      customer_name TEXT,
      branch_id INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      donor_name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      purpose TEXT,
      donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
      receipt_number TEXT,
      notes TEXT,
      customer_name TEXT,
      branch_id INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS office_expenses (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      description TEXT,
      branch_id INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// ---------------------------------------------------------------------------
// GET /office/summary
// ---------------------------------------------------------------------------
router.get("/summary", async (_req, res) => {
  try {
    await ensureOfficeTables();
    const today = new Date().toISOString().split("T")[0];
    const [complaintsRes, tasksRes, diaryRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM complaints WHERE status = 'open'`),
      pool.query(`SELECT
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress
        FROM office_tasks`),
      pool.query(`SELECT COUNT(*) FROM office_diary WHERE entry_date = $1`, [today]),
    ]);
    res.json({
      success: true,
      openComplaints: parseInt(complaintsRes.rows[0].count, 10),
      pendingTasks: parseInt(tasksRes.rows[0].pending || "0", 10),
      inProgressTasks: parseInt(tasksRes.rows[0].in_progress || "0", 10),
      todayDiaryEntries: parseInt(diaryRes.rows[0].count, 10),
    });
  } catch (err: any) {
    res.json({ success: true, openComplaints: 0, pendingTasks: 0, inProgressTasks: 0, todayDiaryEntries: 0 });
  }
});

// ---------------------------------------------------------------------------
// GET /office/diary
// ---------------------------------------------------------------------------
router.get("/diary", async (_req, res) => {
  try {
    await ensureOfficeTables();
    const result = await queryWithRetry(
      () => pool.query(`SELECT id, entry_date AS "entryDate", title, content, category, author_name AS "authorName" FROM office_diary ORDER BY entry_date DESC, id DESC LIMIT 200`),
      { routeName: "GET /office/diary", retries: 2, delayMs: 300 }
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /office/diary
// ---------------------------------------------------------------------------
router.post("/diary", async (req, res) => {
  try {
    await ensureOfficeTables();
    const { entryDate, title, content, category = "general", branchId = 1 } = req.body;
    if (!title || !content) {
      res.status(400).json({ success: false, error: "title and content are required" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO office_diary (entry_date, title, content, category, branch_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, entry_date AS "entryDate", title, content, category`,
      [entryDate || new Date().toISOString().split("T")[0], title.trim(), content.trim(), category, branchId]
    );
    res.json({ success: true, entry: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /office/diary/:id
// ---------------------------------------------------------------------------
router.delete("/diary/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid id" }); return; }
    await pool.query(`DELETE FROM office_diary WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /office/tasks
// ---------------------------------------------------------------------------
router.get("/tasks", async (_req, res) => {
  try {
    await ensureOfficeTables();
    const result = await queryWithRetry(
      () => pool.query(`SELECT id, title, description, priority, status, due_date AS "dueDate", assigned_name AS "assignedName" FROM office_tasks ORDER BY created_at DESC LIMIT 200`),
      { routeName: "GET /office/tasks", retries: 2, delayMs: 300 }
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /office/tasks
// ---------------------------------------------------------------------------
router.post("/tasks", async (req, res) => {
  try {
    await ensureOfficeTables();
    const { title, description, priority = "medium", dueDate, branchId = 1 } = req.body;
    if (!title) { res.status(400).json({ success: false, error: "title is required" }); return; }
    const result = await pool.query(
      `INSERT INTO office_tasks (title, description, priority, due_date, branch_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, description, priority, status, due_date AS "dueDate"`,
      [title.trim(), description || null, priority, dueDate || null, branchId]
    );
    res.json({ success: true, task: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /office/tasks/:id
// ---------------------------------------------------------------------------
router.patch("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid id" }); return; }
    const { status } = req.body;
    const allowed = ["todo", "in_progress", "done", "cancelled"];
    if (!allowed.includes(status)) { res.status(400).json({ success: false, error: "Invalid status" }); return; }
    await pool.query(`UPDATE office_tasks SET status = $1 WHERE id = $2`, [status, id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /office/complaints
// ---------------------------------------------------------------------------
router.get("/complaints", async (_req, res) => {
  try {
    await ensureOfficeTables();
    const result = await queryWithRetry(
      () => pool.query(`SELECT id, title, description, category, status, customer_name AS "customerName", created_at AS "createdAt" FROM complaints ORDER BY created_at DESC LIMIT 200`),
      { routeName: "GET /office/complaints", retries: 2, delayMs: 300 }
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /office/complaints
// ---------------------------------------------------------------------------
router.post("/complaints", async (req, res) => {
  try {
    await ensureOfficeTables();
    const { title, description, category = "other", branchId = 1 } = req.body;
    if (!title || !description) { res.status(400).json({ success: false, error: "title and description are required" }); return; }
    const result = await pool.query(
      `INSERT INTO complaints (title, description, category, branch_id) VALUES ($1, $2, $3, $4) RETURNING id, title, description, category, status, created_at AS "createdAt"`,
      [title.trim(), description.trim(), category, branchId]
    );
    res.json({ success: true, complaint: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /office/complaints/:id
// ---------------------------------------------------------------------------
router.patch("/complaints/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid id" }); return; }
    const { status } = req.body;
    const allowed = ["open", "in_review", "resolved", "closed"];
    if (!allowed.includes(status)) { res.status(400).json({ success: false, error: "Invalid status" }); return; }
    await pool.query(`UPDATE complaints SET status = $1 WHERE id = $2`, [status, id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /office/donations
// ---------------------------------------------------------------------------
router.get("/donations", async (_req, res) => {
  try {
    await ensureOfficeTables();
    const result = await queryWithRetry(
      () => pool.query(`SELECT id, donor_name AS "donorName", amount::text, purpose, donation_date AS "donationDate", receipt_number AS "receiptNumber", notes, customer_name AS "customerName" FROM donations ORDER BY donation_date DESC, id DESC LIMIT 200`),
      { routeName: "GET /office/donations", retries: 2, delayMs: 300 }
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /office/donations
// ---------------------------------------------------------------------------
router.post("/donations", async (req, res) => {
  try {
    await ensureOfficeTables();
    const { donorName, amount, purpose, donationDate, receiptNumber, notes, branchId = 1 } = req.body;
    if (!donorName || !amount) { res.status(400).json({ success: false, error: "donorName and amount are required" }); return; }
    const result = await pool.query(
      `INSERT INTO donations (donor_name, amount, purpose, donation_date, receipt_number, notes, branch_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [donorName.trim(), amount, purpose || null, donationDate || new Date().toISOString().split("T")[0], receiptNumber || null, notes || null, branchId]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /office/expenses
// ---------------------------------------------------------------------------
router.get("/expenses", async (_req, res) => {
  try {
    await ensureOfficeTables();
    const result = await queryWithRetry(
      () => pool.query(`SELECT id, category, amount::text, expense_date AS "expenseDate", description, branch_id AS "branchId", created_at AS "createdAt" FROM office_expenses ORDER BY expense_date DESC, id DESC LIMIT 200`),
      { routeName: "GET /office/expenses", retries: 2, delayMs: 300 }
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /office/expenses
// ---------------------------------------------------------------------------
router.post("/expenses", async (req, res) => {
  try {
    await ensureOfficeTables();
    const { category, amount, expenseDate, description, branchId = 1 } = req.body;
    if (!category || !amount || !expenseDate) { res.status(400).json({ success: false, error: "category, amount and expenseDate are required" }); return; }
    const result = await pool.query(
      `INSERT INTO office_expenses (category, amount, expense_date, description, branch_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [category.trim(), amount, expenseDate, description || null, branchId]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /office/expenses/:id
// ---------------------------------------------------------------------------
router.delete("/expenses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid id" }); return; }
    await pool.query(`DELETE FROM office_expenses WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
