import { Router } from "express";
import fs from "fs";
import path from "path";
import { pool, queryWithRetry } from "@workspace/db";

const router = Router();

// Ensure DB tables exist on demand
async function ensureDailyDiaryTablesExist() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_diary_loans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID,
        customer_name VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(50) NOT NULL,
        reference_mobile_numbers TEXT,
        address TEXT,
        security TEXT,
        loan_amount NUMERIC(12, 2) NOT NULL,
        start_date TEXT NOT NULL,
        expected_complete_date TEXT,
        collection_plan VARCHAR(100) DEFAULT 'Custom' NOT NULL,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_diary_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID,
        loan_id UUID NOT NULL REFERENCES daily_diary_loans(id) ON DELETE CASCADE,
        payment_date TEXT NOT NULL,
        amount_deposited NUMERIC(12, 2) NOT NULL,
        payment_mode VARCHAR(50) DEFAULT 'Cash' NOT NULL,
        notes TEXT,
        created_by TEXT DEFAULT 'Admin',
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);
  } catch (err) {
    console.error("[Daily Diary] Error ensuring tables exist:", err);
  }
}

// Helper to extract expected daily collection from plan string
function parseDailyExpectedAmount(planStr: string): number {
  if (!planStr) return 100;
  const lower = planStr.toLowerCase().trim();
  if (lower.includes("100/day") || lower.includes("100/per day")) return 100;
  if (lower.includes("250/day") || lower.includes("250/per day")) return 250;
  if (lower.includes("500/day") || lower.includes("500/per day")) return 500;
  if (lower.includes("1400/week") || lower.includes("1400/per week")) return 200;
  if (lower.includes("3500/week") || lower.includes("3500/per week")) return 500;

  const dayMatch = lower.match(/(\d+)\s*\/\s*(?:day|per day)/);
  if (dayMatch) return parseFloat(dayMatch[1]) || 100;

  const weekMatch = lower.match(/(\d+)\s*\/\s*(?:week|per week)/);
  if (weekMatch) return Math.round((parseFloat(weekMatch[1]) || 0) / 7);

  const numMatch = lower.match(/\d+/);
  if (numMatch) {
    const val = parseFloat(numMatch[0]);
    if (val > 0 && val <= 5000) return val;
  }

  return 100; // default daily expected
}

// ---------------------------------------------------------------------------
// GET /api/daily-diary/dashboard
// ---------------------------------------------------------------------------
router.get("/dashboard", async (req, res) => {
  await ensureDailyDiaryTablesExist();
  try {
    const loansRes = await queryWithRetry(
      () => pool.query(`SELECT id, loan_amount, collection_plan, status FROM daily_diary_loans`),
      { routeName: "GET /daily-diary/dashboard (loans)", retries: 2, delayMs: 300 }
    );
    const paymentsRes = await queryWithRetry(
      () => pool.query(`SELECT loan_id, amount_deposited, payment_date, created_at FROM daily_diary_payments`),
      { routeName: "GET /daily-diary/dashboard (payments)", retries: 2, delayMs: 300 }
    );

    const loans = loansRes.rows;
    const payments = paymentsRes.rows;

    const totalCustomers = loans.length;
    let activeCustomers = 0;
    let completedCustomers = 0;
    let totalLoanAmount = 0;
    let todayTargetCollection = 0;

    // Track active loans
    const activeLoanMap = new Map<string, { loanAmount: number; collectionPlan: string }>();

    loans.forEach(l => {
      const amt = parseFloat(l.loan_amount) || 0;
      totalLoanAmount += amt;

      if (l.status === "COMPLETED") {
        completedCustomers++;
      } else {
        activeCustomers++;
        activeLoanMap.set(l.id, { loanAmount: amt, collectionPlan: l.collection_plan || "Custom" });
        todayTargetCollection += parseDailyExpectedAmount(l.collection_plan || "Custom");
      }
    });

    let totalAmountCollected = 0;
    let todayCollection = 0;
    let weekCollection = 0;
    let monthCollection = 0;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const paidTodayCustomerIds = new Set<string>();

    payments.forEach(p => {
      const amt = parseFloat(p.amount_deposited) || 0;
      totalAmountCollected += amt;

      const pDateStr = p.payment_date || (p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "");
      if (pDateStr.startsWith(todayStr)) {
        todayCollection += amt;
        paidTodayCustomerIds.add(p.loan_id);
      }

      const pDateObj = new Date(pDateStr);
      if (!isNaN(pDateObj.getTime())) {
        if (pDateObj >= weekAgo) {
          weekCollection += amt;
        }
        if (pDateObj >= firstDayOfMonth) {
          monthCollection += amt;
        }
      }
    });

    const totalRemainingAmount = Math.max(0, totalLoanAmount - totalAmountCollected);
    const todayPendingCollection = Math.max(0, todayTargetCollection - todayCollection);
    const todayAchievementPct = todayTargetCollection > 0 
      ? Math.min(100, Math.round((todayCollection / todayTargetCollection) * 100 * 10) / 10) 
      : 0;

    const todayPaidCustomersCount = paidTodayCustomerIds.size;
    const todayUnpaidActiveCustomersCount = Math.max(0, activeCustomers - todayPaidCustomersCount);

    res.json({
      success: true,
      stats: {
        totalCustomers,
        activeCustomers,
        completedCustomers,
        totalLoanAmount,
        totalAmountCollected,
        totalRemainingAmount,
        todayCollection,
        todayTargetCollection,
        todayPendingCollection,
        todayAchievementPct,
        todayPaidCustomersCount,
        todayUnpaidActiveCustomersCount,
        weekCollection,
        monthCollection,
      }
    });
  } catch (err: any) {
    console.error("[Daily Diary] Dashboard error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ---------------------------------------------------------------------------
// GET /api/daily-diary/loans
// ---------------------------------------------------------------------------
router.get("/loans", async (req, res) => {
  await ensureDailyDiaryTablesExist();
  const search = ((req.query.search as string) || "").trim().toLowerCase();
  const statusFilter = (req.query.status as string) || "ALL";
  const collectionPlanFilter = (req.query.plan as string) || "ALL";

  try {
    const loansRes = await queryWithRetry(
      () => pool.query(`SELECT * FROM daily_diary_loans ORDER BY created_at DESC`),
      { routeName: "GET /daily-diary/loans", retries: 2, delayMs: 300 }
    );

    const paymentsRes = await queryWithRetry(
      () => pool.query(`SELECT loan_id, amount_deposited, payment_date, created_at FROM daily_diary_payments ORDER BY created_at DESC`),
      { routeName: "GET /daily-diary/loans (payments)", retries: 2, delayMs: 300 }
    );

    const paymentsByLoan = new Map<string, { total: number; count: number; lastDate: string }>();

    paymentsRes.rows.forEach(p => {
      const loanId = p.loan_id;
      const amt = parseFloat(p.amount_deposited) || 0;
      const pDate = p.payment_date || (p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "");

      if (!paymentsByLoan.has(loanId)) {
        paymentsByLoan.set(loanId, { total: amt, count: 1, lastDate: pDate });
      } else {
        const cur = paymentsByLoan.get(loanId)!;
        cur.total += amt;
        cur.count += 1;
        // keep latest date if current is empty or newer
        if (!cur.lastDate || (pDate && pDate > cur.lastDate)) {
          cur.lastDate = pDate;
        }
      }
    });

    let loans = loansRes.rows.map(l => {
      const loanAmount = parseFloat(l.loan_amount) || 0;
      const pInfo = paymentsByLoan.get(l.id) || { total: 0, count: 0, lastDate: "-" };
      const totalCollected = pInfo.total;
      const remainingAmount = Math.max(0, loanAmount - totalCollected);

      // Auto update status if remaining <= 0
      const computedStatus = remainingAmount <= 0 ? "COMPLETED" : (l.status || "ACTIVE");

      const completionPct = loanAmount > 0 
        ? Math.min(100, Math.round((totalCollected / loanAmount) * 100 * 100) / 100) 
        : 0;

      // Fetch Bissi Committee Tokens & Other Active Daily Loans for cross-module pending alert
      const cleanName = (l.customer_name || "").split("(")[0].trim().toLowerCase();
      const cleanMobile = (l.mobile_number || "").trim();

      return {
        id: l.id,
        customerName: l.customer_name,
        mobileNumber: l.mobile_number,
        referenceMobileNumbers: l.reference_mobile_numbers || "",
        address: l.address || "",
        security: l.security || "",
        loanAmount,
        startDate: l.start_date,
        expectedCompleteDate: l.expected_complete_date || "",
        collectionPlan: l.collection_plan || "Custom",
        notes: l.notes || "",
        status: computedStatus,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
        // Calculated fields
        totalCollected,
        remainingAmount,
        completionPct,
        totalPaymentsCount: pInfo.count,
        lastPaymentDate: pInfo.lastDate,
        // Clean customer search name for cross-module dues
        searchCleanName: cleanName,
        searchCleanMobile: cleanMobile
      };
    });

    // Cross-module Bissi & Loans Dues Map
    let bissiTokensByCust: any[] = [];
    try {
      const bRes = await pool.query(
        `SELECT t.raw_token_number, c.name AS committee_name, c.monthly_installment, cust.name AS customer_name, cust.mobile 
         FROM tokens t 
         JOIN committees c ON t.committee_id = c.id 
         JOIN customers cust ON t.customer_id = cust.id`
      );
      bissiTokensByCust = bRes.rows;
    } catch (e) {}

    loans = loans.map(l => {
      const matchedBissi = bissiTokensByCust.filter(bt => {
        const btName = (bt.customer_name || "").toLowerCase();
        return (l.searchCleanName && btName.includes(l.searchCleanName.slice(0, 5))) || (l.searchCleanMobile && l.searchCleanMobile.length > 5 && bt.mobile && bt.mobile.includes(l.searchCleanMobile));
      }).map(bt => ({
        committeeName: bt.committee_name,
        tokenNumber: bt.raw_token_number,
        monthlyAmount: parseFloat(bt.monthly_installment) || 3000
      }));

      const otherDailyLoans = loans
        .filter(ol => ol.id !== l.id && (ol.customerName.toLowerCase().includes(l.searchCleanName.slice(0, 5)) || (l.searchCleanMobile.length > 5 && ol.mobileNumber.includes(l.searchCleanMobile))))
        .map(ol => ({
          id: ol.id,
          customerName: ol.customerName,
          remainingAmount: ol.remainingAmount
        }));

      return {
        ...l,
        otherDues: {
          bissiCommittees: matchedBissi,
          otherDailyLoans: otherDailyLoans,
          totalOtherDuesCount: matchedBissi.length + otherDailyLoans.length
        }
      };
    });

    // Apply Search Filtering
    if (search) {
      loans = loans.filter(l =>
        l.customerName.toLowerCase().includes(search) ||
        l.mobileNumber.toLowerCase().includes(search) ||
        l.referenceMobileNumbers.toLowerCase().includes(search) ||
        l.collectionPlan.toLowerCase().includes(search) ||
        l.status.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== "ALL") {
      loans = loans.filter(l => l.status === statusFilter);
    }

    if (collectionPlanFilter !== "ALL") {
      loans = loans.filter(l => l.collectionPlan === collectionPlanFilter);
    }

    res.json({ success: true, loans });
  } catch (err: any) {
    console.error("[Daily Diary] Error fetching loans:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/daily-diary/loans
// ---------------------------------------------------------------------------
router.post("/loans", async (req, res) => {
  await ensureDailyDiaryTablesExist();
  try {
    const {
      customerName,
      mobileNumber,
      referenceMobileNumbers,
      address,
      security,
      loanAmount,
      startDate,
      expectedCompleteDate,
      collectionPlan,
      notes,
      initialPaymentAmount
    } = req.body;

    if (!customerName || !mobileNumber || !loanAmount || !startDate) {
      res.status(400).json({ success: false, error: "Missing required fields: Customer Name, Mobile Number, Loan Amount, Start Date" });
      return;
    }

    const numLoanAmount = parseFloat(loanAmount);
    if (isNaN(numLoanAmount) || numLoanAmount <= 0) {
      res.status(400).json({ success: false, error: "Loan Amount must be greater than 0" });
      return;
    }

    const insertRes = await pool.query(
      `INSERT INTO daily_diary_loans 
       (customer_name, mobile_number, reference_mobile_numbers, address, security, loan_amount, start_date, expected_complete_date, collection_plan, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        customerName.trim(),
        mobileNumber.trim(),
        referenceMobileNumbers ? String(referenceMobileNumbers).trim() : null,
        address ? String(address).trim() : null,
        security ? String(security).trim() : null,
        numLoanAmount,
        startDate,
        expectedCompleteDate || null,
        collectionPlan || "Custom",
        notes || null,
        "ACTIVE"
      ]
    );

    const newLoan = insertRes.rows[0];

    // If initial payment provided
    if (initialPaymentAmount && parseFloat(initialPaymentAmount) > 0) {
      const initAmt = parseFloat(initialPaymentAmount);
      await pool.query(
        `INSERT INTO daily_diary_payments (loan_id, payment_date, amount_deposited, payment_mode, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newLoan.id, startDate, initAmt, "Cash", "Initial Deposit", "Admin"]
      );

      if (initAmt >= numLoanAmount) {
        await pool.query(`UPDATE daily_diary_loans SET status = 'COMPLETED' WHERE id = $1`, [newLoan.id]);
        newLoan.status = "COMPLETED";
      }
    }

    res.json({ success: true, loan: newLoan });
  } catch (err: any) {
    console.error("[Daily Diary] Error creating loan:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/daily-diary/loans/:id
// ---------------------------------------------------------------------------
router.get("/loans/:id", async (req, res) => {
  await ensureDailyDiaryTablesExist();
  try {
    const { id } = req.params;
    const loanRes = await pool.query(`SELECT * FROM daily_diary_loans WHERE id = $1`, [id]);
    if (loanRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Loan customer not found" });
      return;
    }

    const l = loanRes.rows[0];
    const loanAmount = parseFloat(l.loan_amount) || 0;

    const paymentsRes = await pool.query(
      `SELECT id, payment_date, amount_deposited, payment_mode, notes, created_by, created_at 
       FROM daily_diary_payments 
       WHERE loan_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    let accumulatedCollected = 0;
    const paymentsChronological = paymentsRes.rows.map(p => {
      const depositAmt = parseFloat(p.amount_deposited) || 0;
      accumulatedCollected += depositAmt;
      const runningRemainingBalance = Math.max(0, loanAmount - accumulatedCollected);

      return {
        id: p.id,
        paymentDate: p.payment_date,
        amountDeposited: depositAmt,
        paymentMode: p.payment_mode,
        notes: p.notes || "",
        createdBy: p.created_by || "Admin",
        createdAt: p.created_at,
        runningRemainingBalance
      };
    });

    // Latest first for display
    const payments = [...paymentsChronological].reverse();

    const totalCollected = accumulatedCollected;
    const remainingAmount = Math.max(0, loanAmount - totalCollected);
    const completionPct = loanAmount > 0 
      ? Math.min(100, Math.round((totalCollected / loanAmount) * 100 * 100) / 100) 
      : 0;

    const computedStatus = remainingAmount <= 0 ? "COMPLETED" : (l.status || "ACTIVE");

    // Auto sync status in database if completed
    if (computedStatus === "COMPLETED" && l.status !== "COMPLETED") {
      await pool.query(`UPDATE daily_diary_loans SET status = 'COMPLETED' WHERE id = $1`, [id]);
    }

    const loanProfile = {
      id: l.id,
      customerName: l.customer_name,
      mobileNumber: l.mobile_number,
      referenceMobileNumbers: l.reference_mobile_numbers || "",
      address: l.address || "",
      security: l.security || "",
      loanAmount,
      startDate: l.start_date,
      expectedCompleteDate: l.expected_complete_date || "",
      collectionPlan: l.collection_plan || "Custom",
      notes: l.notes || "",
      status: computedStatus,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
      // Calculations
      totalCollected,
      remainingAmount,
      completionPct,
      totalPaymentsCount: payments.length,
      lastPaymentDate: payments.length > 0 ? payments[0].paymentDate : "-",
      payments
    };


    res.json({ success: true, loan: loanProfile });
  } catch (err: any) {
    console.error("[Daily Diary] Error fetching loan detail:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/daily-diary/loans/:id
// ---------------------------------------------------------------------------
router.put("/loans/:id", async (req, res) => {
  await ensureDailyDiaryTablesExist();
  try {
    const { id } = req.params;
    const {
      customerName,
      mobileNumber,
      referenceMobileNumbers,
      address,
      security,
      expectedCompleteDate,
      collectionPlan,
      notes
    } = req.body;

    const updateRes = await pool.query(
      `UPDATE daily_diary_loans 
       SET customer_name = COALESCE($1, customer_name),
           mobile_number = COALESCE($2, mobile_number),
           reference_mobile_numbers = COALESCE($3, reference_mobile_numbers),
           address = COALESCE($4, address),
           security = COALESCE($5, security),
           expected_complete_date = COALESCE($6, expected_complete_date),
           collection_plan = COALESCE($7, collection_plan),
           notes = COALESCE($8, notes),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [customerName, mobileNumber, referenceMobileNumbers, address, security, expectedCompleteDate, collectionPlan, notes, id]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Loan customer not found" });
      return;
    }

    res.json({ success: true, loan: updateRes.rows[0] });
  } catch (err: any) {
    console.error("[Daily Diary] Error updating loan:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/daily-diary/loans/:id/payments
// ---------------------------------------------------------------------------
router.post("/loans/:id/payments", async (req, res) => {
  await ensureDailyDiaryTablesExist();
  try {
    const { id } = req.params;
    const { paymentDate, amountDeposited, paymentMode, notes, createdBy, allowAdminOverride } = req.body;

    const depositAmount = parseFloat(amountDeposited);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      res.status(400).json({ success: false, error: "Payment amount must be greater than 0" });
      return;
    }

    // Fetch current loan & existing payments sum
    const loanRes = await pool.query(`SELECT loan_amount, status FROM daily_diary_loans WHERE id = $1`, [id]);
    if (loanRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Loan customer not found" });
      return;
    }

    const loanAmount = parseFloat(loanRes.rows[0].loan_amount) || 0;

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(amount_deposited), 0) as total FROM daily_diary_payments WHERE loan_id = $1`,
      [id]
    );
    const currentCollected = parseFloat(sumRes.rows[0].total) || 0;
    const currentRemaining = Math.max(0, loanAmount - currentCollected);

    // Validation: Warn if payment exceeds remaining amount unless admin override provided
    if (depositAmount > currentRemaining && currentRemaining > 0 && !allowAdminOverride) {
      res.status(400).json({
        success: false,
        warning: true,
        message: `Payment amount (₹${depositAmount.toLocaleString('en-IN')}) exceeds the remaining loan balance (₹${currentRemaining.toLocaleString('en-IN')}). Require admin override to proceed.`,
        remainingAmount: currentRemaining,
        attemptedAmount: depositAmount
      });
      return;
    }

    const pDate = paymentDate || new Date().toISOString().slice(0, 10);
    const pMode = paymentMode || "Cash";
    const pNotes = notes || null;
    const pCreatedBy = createdBy || "Admin";

    const insertPaymentRes = await pool.query(
      `INSERT INTO daily_diary_payments (loan_id, payment_date, amount_deposited, payment_mode, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, pDate, depositAmount, pMode, pNotes, pCreatedBy]
    );

    const newPayment = insertPaymentRes.rows[0];

    // Recompute total collected & updated status
    const newTotalCollected = currentCollected + depositAmount;
    const newRemaining = Math.max(0, loanAmount - newTotalCollected);
    const newStatus = newRemaining <= 0 ? "COMPLETED" : "ACTIVE";

    await pool.query(
      `UPDATE daily_diary_loans SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, id]
    );

    res.json({
      success: true,
      payment: {
        id: newPayment.id,
        paymentDate: newPayment.payment_date,
        amountDeposited: parseFloat(newPayment.amount_deposited),
        paymentMode: newPayment.payment_mode,
        notes: newPayment.notes || "",
        createdBy: newPayment.created_by || "Admin",
        createdAt: newPayment.created_at
      },
      updatedStats: {
        totalCollected: newTotalCollected,
        remainingAmount: newRemaining,
        completionPct: loanAmount > 0 ? Math.min(100, Math.round((newTotalCollected / loanAmount) * 100 * 100) / 100) : 0,
        status: newStatus
      }
    });
  } catch (err: any) {
    console.error("[Daily Diary] Error adding payment:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/daily-diary/seed-csv
// ---------------------------------------------------------------------------
router.post("/seed-csv", async (req, res) => {
  await ensureDailyDiaryTablesExist();
  try {
    const defaultCsvPath = "C:\\Users\\lenovo\\Downloads\\Bissi folder - daily diary.csv";
    let csvContent = "";

    if (req.body && req.body.csvText) {
      csvContent = req.body.csvText;
    } else if (fs.existsSync(defaultCsvPath)) {
      csvContent = fs.readFileSync(defaultCsvPath, "utf-8");
    } else {
      res.status(404).json({ success: false, error: `CSV file not found at ${defaultCsvPath}` });
      return;
    }

    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      res.status(400).json({ success: false, error: "CSV file is empty or missing data rows" });
      return;
    }

    let insertedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Helper to parse CSV line handling quoted fields
    function parseCsvLine(line: string): string[] {
      const result: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = "";
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    }

    // Skip header line
    for (let idx = 1; idx < lines.length; idx++) {
      const line = lines[idx];
      const cols = parseCsvLine(line);
      if (cols.length < 5) continue;

      const rawName = cols[0] || "";
      const rawMobile = cols[1] || "";
      const rawRefMobile = cols[2] || "";
      const rawModeOrPlan = cols[3] || "";
      const rawReason = cols[4] || "";
      const rawAddress = cols[5] || "";
      const rawSecurity = cols[6] || "";
      const rawLoanAmt = cols[7] || "0";
      const rawStartDate = cols[8] || "";
      const rawCompleteDate = cols[9] || "";
      const rawAmountTaken = cols[10] || "0";

      if (!rawName || !rawLoanAmt) continue;

      const loanAmt = parseFloat(rawLoanAmt.replace(/[^0-9.]/g, "")) || 0;
      const amtTaken = parseFloat(rawAmountTaken.replace(/[^0-9.]/g, "")) || 0;
      if (loanAmt <= 0) continue;

      const cleanMobile = rawMobile.replace(/[^\d]/g, "") || "0000000000";
      const cleanRefMobile = rawRefMobile.replace(/[^0-9\s]/g, " ").trim();

      const startDate = rawStartDate.trim() || new Date().toISOString().slice(0, 10);
      const completeDate = rawCompleteDate.trim();
      const plan = rawModeOrPlan.includes("/") ? rawModeOrPlan.trim() : "Custom";
      const notes = [rawReason, rawModeOrPlan].filter(x => x && !x.includes("/")).join(" - ");

      // Check if existing loan by name or mobile
      const existingRes = await pool.query(
        `SELECT id FROM daily_diary_loans WHERE customer_name = $1 AND mobile_number = $2`,
        [rawName.trim(), cleanMobile]
      );

      let loanId = "";
      const status = (loanAmt - amtTaken) <= 0 ? "COMPLETED" : "ACTIVE";

      if (existingRes.rows.length > 0) {
        loanId = existingRes.rows[0].id;
        await pool.query(
          `UPDATE daily_diary_loans 
           SET loan_amount = $1, address = $2, security = $3, collection_plan = $4, notes = $5, status = $6, updated_at = NOW() 
           WHERE id = $7`,
          [loanAmt, rawAddress.trim() || null, rawSecurity.trim() || null, plan, notes || null, status, loanId]
        );
        updatedCount++;
      } else {
        const insertRes = await pool.query(
          `INSERT INTO daily_diary_loans 
           (customer_name, mobile_number, reference_mobile_numbers, address, security, loan_amount, start_date, expected_complete_date, collection_plan, notes, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            rawName.trim(),
            cleanMobile,
            cleanRefMobile || null,
            rawAddress.trim() || null,
            rawSecurity.trim() || null,
            loanAmt,
            startDate,
            completeDate || null,
            plan,
            notes || null,
            status
          ]
        );
        loanId = insertRes.rows[0].id;
        insertedCount++;
      }

      // If initial payment (amtTaken) exists, add payment entry if not already logged
      if (amtTaken > 0 && loanId) {
        const pCheck = await pool.query(`SELECT id FROM daily_diary_payments WHERE loan_id = $1`, [loanId]);
        if (pCheck.rows.length === 0) {
          await pool.query(
            `INSERT INTO daily_diary_payments (loan_id, payment_date, amount_deposited, payment_mode, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [loanId, startDate, amtTaken, "Cash", "Initial CSV Deposit", "CSV Seed"]
          );
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully processed CSV file`,
      stats: { insertedCount, updatedCount, totalProcessed: lines.length - 1 }
    });
  } catch (err: any) {
    console.error("[Daily Diary] Seed CSV error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/daily-diary/reports
// ---------------------------------------------------------------------------
router.get("/reports", async (req, res) => {
  await ensureDailyDiaryTablesExist();
  try {
    const type = (req.query.type as string) || "OVERALL"; // OVERALL, DAILY, WEEKLY, MONTHLY
    const loanId = req.query.loanId as string;

    let query = `
      SELECT p.id, p.payment_date, p.amount_deposited, p.payment_mode, p.notes, p.created_by, p.created_at,
             l.id as loan_id, l.customer_name, l.mobile_number, l.loan_amount, l.collection_plan
      FROM daily_diary_payments p
      JOIN daily_diary_loans l ON p.loan_id = l.id
    `;
    const params: any[] = [];

    if (loanId) {
      query += ` WHERE l.id = $1`;
      params.push(loanId);
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await queryWithRetry(
      () => pool.query(query, params),
      { routeName: "GET /daily-diary/reports", retries: 2, delayMs: 300 }
    );

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let payments = result.rows.map(r => ({
      id: r.id,
      loanId: r.loan_id,
      customerName: r.customer_name,
      mobileNumber: r.mobile_number,
      loanAmount: parseFloat(r.loan_amount) || 0,
      collectionPlan: r.collection_plan,
      paymentDate: r.payment_date,
      amountDeposited: parseFloat(r.amount_deposited) || 0,
      paymentMode: r.payment_mode,
      notes: r.notes || "",
      createdBy: r.created_by || "Admin",
      createdAt: r.created_at
    }));

    if (type === "DAILY") {
      payments = payments.filter(p => p.paymentDate === todayStr);
    } else if (type === "WEEKLY") {
      payments = payments.filter(p => new Date(p.paymentDate) >= weekAgo);
    } else if (type === "MONTHLY") {
      payments = payments.filter(p => new Date(p.paymentDate) >= firstDayOfMonth);
    }

    const totalCollected = payments.reduce((acc, p) => acc + p.amountDeposited, 0);

    res.json({
      success: true,
      reportType: type,
      totalCollected,
      totalEntries: payments.length,
      payments
    });
  } catch (err: any) {
    console.error("[Daily Diary] Reports error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
