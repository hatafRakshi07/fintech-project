import { Router } from "express";
import { pool, queryWithRetry } from "@workspace/db";

const router = Router();

// Ensure tables exist with correct schema
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_diary_loans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID,
      customer_name TEXT NOT NULL,
      mobile_number TEXT,
      reference_mobile_numbers TEXT,
      address TEXT,
      security TEXT,
      loan_amount NUMERIC(12,2) NOT NULL,
      start_date TEXT,
      expected_complete_date TEXT,
      collection_plan VARCHAR(50) DEFAULT '500/day',
      notes TEXT,
      status VARCHAR(20) DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS daily_diary_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID,
      loan_id UUID NOT NULL REFERENCES daily_diary_loans(id) ON DELETE CASCADE,
      payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      amount_deposited NUMERIC(12,2) NOT NULL,
      payment_mode VARCHAR(50) DEFAULT 'Cash',
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ddl_status ON daily_diary_loans(status);
    CREATE INDEX IF NOT EXISTS idx_ddl_mobile ON daily_diary_loans(mobile_number);
    CREATE INDEX IF NOT EXISTS idx_ddp_loan ON daily_diary_payments(loan_id);
    CREATE INDEX IF NOT EXISTS idx_ddp_date ON daily_diary_payments(payment_date);
  `);
}

// ─── Computed stats per loan ──────────────────────────────────────────────
function parsePlanAmount(plan: string): number {
  if (!plan) return 500;
  const m = plan.match(/(\d+)\s*\/?\s*day/i);
  if (m) return parseInt(m[1], 10);
  const w = plan.match(/(\d+)\s*\/?\s*week/i);
  if (w) return Math.round(parseInt(w[1], 10) / 7);
  return 500;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /daily-diary/dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard", async (_req, res) => {
  try {
    await ensureTables();
    const result = await pool.query(`
      SELECT
        COUNT(l.id)::int                                                AS "totalLoans",
        COUNT(l.id) FILTER(WHERE l.status='ACTIVE')::int               AS "activeLoans",
        COUNT(l.id) FILTER(WHERE l.status='COMPLETED')::int            AS "completedLoans",
        COALESCE(SUM(l.loan_amount), 0)::numeric                       AS "totalLoanAmount",
        COALESCE(SUM(p.total_collected), 0)::numeric                   AS "totalAmountCollected",
        COALESCE(SUM(l.loan_amount - COALESCE(p.total_collected, 0)), 0)::numeric AS "totalRemaining",
        COALESCE(SUM(p.today_collected), 0)::numeric                   AS "todayCollection"
      FROM daily_diary_loans l
      LEFT JOIN (
        SELECT loan_id,
          SUM(amount_deposited) AS total_collected,
          SUM(amount_deposited) FILTER(WHERE DATE(payment_date) = CURRENT_DATE) AS today_collected
        FROM daily_diary_payments GROUP BY loan_id
      ) p ON p.loan_id = l.id
    `);
    const stats = result.rows[0];

    // Per-loan list for stats computation
    const loansRes = await pool.query(`
      SELECT l.id, l.loan_amount, l.collection_plan, l.status,
        COALESCE(p.total_collected, 0)::numeric AS collected
      FROM daily_diary_loans l
      LEFT JOIN (SELECT loan_id, SUM(amount_deposited) AS total_collected FROM daily_diary_payments GROUP BY loan_id) p ON p.loan_id = l.id
    `);

    let todayPending = 0;
    let todayExpected = 0;
    for (const ln of loansRes.rows) {
      if (ln.status === 'ACTIVE') {
        const daily = parsePlanAmount(ln.collection_plan || '500/day');
        todayExpected += daily;
      }
    }

    res.json({
      success: true,
      stats: {
        totalLoans: Number(stats.totalLoans || 0),
        activeLoans: Number(stats.activeLoans || 0),
        completedLoans: Number(stats.completedLoans || 0),
        totalLoanAmount: Number(stats.totalLoanAmount || 0),
        totalAmountCollected: Number(stats.totalAmountCollected || 0),
        totalRemainingAmount: Number(stats.totalRemaining || 0),
        todayCollection: Number(stats.todayCollection || 0),
        todayExpected,
        activeCustomers: Number(stats.activeLoans || 0),
        totalCustomers: Number(stats.totalLoans || 0),
      }
    });
  } catch (err: any) {
    console.error("[Daily Diary] dashboard error:", err.message);
    res.json({ success: true, stats: { totalLoans: 0, activeLoans: 0, completedLoans: 0, totalLoanAmount: 0, totalAmountCollected: 0, totalRemainingAmount: 0, todayCollection: 0, todayExpected: 0, activeCustomers: 0, totalCustomers: 0 } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /daily-diary/loans
// ─────────────────────────────────────────────────────────────────────────────
router.get("/loans", async (req, res) => {
  try {
    await ensureTables();
    const { status, search, plan } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    if (plan && plan !== 'ALL') {
      params.push(`%${plan}%`);
      conditions.push(`l.collection_plan ILIKE $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(l.customer_name ILIKE $${params.length} OR l.mobile_number ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        l.id, l.customer_name AS "customerName", l.mobile_number AS "mobileNumber",
        l.reference_mobile_numbers AS "referenceMobileNumbers",
        l.address, l.security, l.loan_amount::numeric AS "loanAmount",
        l.start_date AS "startDate", l.expected_complete_date AS "expectedCompleteDate",
        l.collection_plan AS "collectionPlan", l.notes, l.status,
        l.created_at AS "createdAt", l.updated_at AS "updatedAt",
        COALESCE(p.total_collected, 0)::numeric AS "totalCollected",
        COALESCE(p.today_collected, 0)::numeric AS "todayCollected",
        (l.loan_amount - COALESCE(p.total_collected, 0))::numeric AS "remainingAmount",
        CASE WHEN l.loan_amount > 0 THEN
          ROUND((COALESCE(p.total_collected, 0)::numeric / l.loan_amount::numeric) * 100, 1)
        ELSE 0 END AS "completionPct",
        COALESCE(p.last_payment, NULL) AS "lastPaymentDate"
      FROM daily_diary_loans l
      LEFT JOIN (
        SELECT loan_id,
          SUM(amount_deposited) AS total_collected,
          SUM(amount_deposited) FILTER(WHERE DATE(payment_date) = CURRENT_DATE) AS today_collected,
          MAX(payment_date) AS last_payment
        FROM daily_diary_payments GROUP BY loan_id
      ) p ON p.loan_id = l.id
      ${where}
      ORDER BY l.created_at DESC
    `, params);

    res.json({
      success: true,
      loans: result.rows.map((r: any) => ({
        ...r,
        loanAmount: Number(r.loanAmount),
        totalCollected: Number(r.totalCollected),
        todayCollected: Number(r.todayCollected),
        remainingAmount: Math.max(0, Number(r.remainingAmount)),
        completionPct: Number(r.completionPct),
      }))
    });
  } catch (err: any) {
    console.error("[Daily Diary] loans list error:", err.message);
    res.json({ success: true, loans: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /daily-diary/loans — create new loan
// ─────────────────────────────────────────────────────────────────────────────
router.post("/loans", async (req, res) => {
  try {
    await ensureTables();
    const { customerName, mobileNumber, referenceMobileNumbers, address, security,
            loanAmount, startDate, expectedCompleteDate, collectionPlan,
            customPlanAmount, notes, initialPaymentAmount } = req.body;

    if (!customerName || !loanAmount) {
      res.status(400).json({ success: false, error: "customerName and loanAmount are required" });
      return;
    }

    const finalPlan = collectionPlan === 'Custom' && customPlanAmount
      ? `${customPlanAmount}/day`
      : (collectionPlan || '500/day');

    const result = await pool.query(`
      INSERT INTO daily_diary_loans
        (customer_name, mobile_number, reference_mobile_numbers, address, security,
         loan_amount, start_date, expected_complete_date, collection_plan, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE')
      RETURNING id, customer_name AS "customerName", mobile_number AS "mobileNumber",
        loan_amount::numeric AS "loanAmount", status, created_at AS "createdAt"
    `, [customerName, mobileNumber || null, referenceMobileNumbers || null,
        address || null, security || null, loanAmount,
        startDate || null, expectedCompleteDate || null, finalPlan, notes || null]);

    const loan = result.rows[0];

    // Add initial payment if provided
    if (initialPaymentAmount && Number(initialPaymentAmount) > 0) {
      await pool.query(`
        INSERT INTO daily_diary_payments (loan_id, payment_date, amount_deposited, payment_mode, notes)
        VALUES ($1, $2, $3, 'Cash', 'Initial payment')
      `, [loan.id, startDate || new Date().toISOString().slice(0, 10), initialPaymentAmount]);
    }

    res.json({ success: true, loan });
  } catch (err: any) {
    console.error("[Daily Diary] create loan error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /daily-diary/loans/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get("/loans/:id", async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;

    const loanRes = await pool.query(`
      SELECT l.*,
        l.customer_name AS "customerName", l.mobile_number AS "mobileNumber",
        l.reference_mobile_numbers AS "referenceMobileNumbers",
        l.loan_amount::numeric AS "loanAmount",
        l.start_date AS "startDate", l.expected_complete_date AS "expectedCompleteDate",
        l.collection_plan AS "collectionPlan", l.created_at AS "createdAt",
        COALESCE(p.total_collected, 0)::numeric AS "totalCollected",
        (l.loan_amount - COALESCE(p.total_collected, 0))::numeric AS "remainingAmount",
        CASE WHEN l.loan_amount > 0 THEN
          ROUND((COALESCE(p.total_collected, 0) / l.loan_amount::numeric) * 100, 1)
        ELSE 0 END AS "completionPct"
      FROM daily_diary_loans l
      LEFT JOIN (SELECT loan_id, SUM(amount_deposited) AS total_collected FROM daily_diary_payments GROUP BY loan_id) p ON p.loan_id = l.id
      WHERE l.id = $1
    `, [id]);

    if (!loanRes.rows.length) {
      res.status(404).json({ success: false, error: "Loan not found" });
      return;
    }

    const paymentsRes = await pool.query(`
      SELECT id, payment_date AS "paymentDate", amount_deposited AS "amountDeposited",
        payment_mode AS "paymentMode", notes, created_at AS "createdAt"
      FROM daily_diary_payments
      WHERE loan_id = $1
      ORDER BY payment_date ASC, created_at ASC
    `, [id]);

    // Compute running balance for each payment
    let running = Number(loanRes.rows[0].loanAmount);
    const payments = paymentsRes.rows.map((p: any) => {
      running = Math.max(0, running - Number(p.amountDeposited));
      return { ...p, amountDeposited: Number(p.amountDeposited), runningRemainingBalance: running };
    });

    const loan = {
      ...loanRes.rows[0],
      loanAmount: Number(loanRes.rows[0].loanAmount),
      totalCollected: Number(loanRes.rows[0].totalCollected),
      remainingAmount: Math.max(0, Number(loanRes.rows[0].remainingAmount)),
      completionPct: Number(loanRes.rows[0].completionPct),
      payments
    };

    res.json({ success: true, loan });
  } catch (err: any) {
    console.error("[Daily Diary] get loan error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /daily-diary/loans/:id — update loan
// ─────────────────────────────────────────────────────────────────────────────
router.put("/loans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, mobileNumber, referenceMobileNumbers, address, security,
            loanAmount, startDate, expectedCompleteDate, collectionPlan, notes, status } = req.body;

    await pool.query(`
      UPDATE daily_diary_loans SET
        customer_name = COALESCE($1, customer_name),
        mobile_number = COALESCE($2, mobile_number),
        reference_mobile_numbers = $3,
        address = $4, security = $5,
        loan_amount = COALESCE($6, loan_amount),
        start_date = $7, expected_complete_date = $8,
        collection_plan = COALESCE($9, collection_plan),
        notes = $10,
        status = COALESCE($11, status),
        updated_at = NOW()
      WHERE id = $12
    `, [customerName, mobileNumber, referenceMobileNumbers, address, security,
        loanAmount, startDate, expectedCompleteDate, collectionPlan, notes, status, id]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /daily-diary/loans/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/loans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM daily_diary_loans WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /daily-diary/loans/:id/payments — record a payment
// ─────────────────────────────────────────────────────────────────────────────
router.post("/loans/:id/payments", async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate, amountDeposited, paymentMode = 'Cash', notes } = req.body;

    if (!amountDeposited || Number(amountDeposited) <= 0) {
      res.status(400).json({ success: false, error: "Valid amountDeposited required" });
      return;
    }

    // Check loan exists
    const loanRes = await pool.query(
      'SELECT id, loan_amount, status FROM daily_diary_loans WHERE id = $1', [id]
    );
    if (!loanRes.rows.length) {
      res.status(404).json({ success: false, error: "Loan not found" });
      return;
    }

    await pool.query(`
      INSERT INTO daily_diary_payments (loan_id, payment_date, amount_deposited, payment_mode, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, paymentDate || new Date().toISOString().slice(0, 10), amountDeposited, paymentMode, notes || null]);

    // Check if loan is now fully paid and update status
    const collected = await pool.query(
      'SELECT COALESCE(SUM(amount_deposited),0)::numeric AS total FROM daily_diary_payments WHERE loan_id = $1', [id]
    );
    const total = Number(collected.rows[0].total);
    const loanAmt = Number(loanRes.rows[0].loan_amount);
    if (total >= loanAmt) {
      await pool.query("UPDATE daily_diary_loans SET status='COMPLETED', updated_at=NOW() WHERE id=$1", [id]);
    }

    res.json({ success: true, totalCollected: total, remainingAmount: Math.max(0, loanAmt - total) });
  } catch (err: any) {
    console.error("[Daily Diary] payment error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /daily-diary/payments/:paymentId
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/payments/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    await pool.query('DELETE FROM daily_diary_payments WHERE id = $1', [paymentId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
