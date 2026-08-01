import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

const NEON_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }
});

async function runSeed() {
  console.log("Starting Daily Diary CSV Seed process...");

  // 1. Ensure tables exist
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
  console.log("Database tables verified/created.");

  const csvPath = "C:\\Users\\lenovo\\Downloads\\Bissi folder - daily diary.csv";
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);

  function parseCsvLine(line) {
    const result = [];
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

  let insertedCount = 0;
  let updatedCount = 0;
  let paymentCount = 0;

  for (let idx = 1; idx < lines.length; idx++) {
    const cols = parseCsvLine(lines[idx]);
    if (cols.length < 8) continue;

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

    const status = (loanAmt - amtTaken) <= 0 ? "COMPLETED" : "ACTIVE";

    const existing = await pool.query(
      `SELECT id FROM daily_diary_loans WHERE customer_name = $1 AND mobile_number = $2`,
      [rawName.trim(), cleanMobile]
    );

    let loanId = "";
    if (existing.rows.length > 0) {
      loanId = existing.rows[0].id;
      await pool.query(
        `UPDATE daily_diary_loans 
         SET loan_amount = $1, address = $2, security = $3, collection_plan = $4, notes = $5, status = $6, updated_at = NOW() 
         WHERE id = $7`,
        [loanAmt, rawAddress.trim() || null, rawSecurity.trim() || null, plan, notes || null, status, loanId]
      );
      updatedCount++;
    } else {
      const ins = await pool.query(
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
      loanId = ins.rows[0].id;
      insertedCount++;
    }

    if (amtTaken > 0 && loanId) {
      const pCheck = await pool.query(`SELECT id FROM daily_diary_payments WHERE loan_id = $1`, [loanId]);
      if (pCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO daily_diary_payments (loan_id, payment_date, amount_deposited, payment_mode, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [loanId, startDate, amtTaken, "Cash", "Initial CSV Deposit", "CSV Seed"]
        );
        paymentCount++;
      }
    }
  }

  console.log(`Seed finished! Inserted: ${insertedCount}, Updated: ${updatedCount}, Payments logged: ${paymentCount}`);
  await pool.end();
}

runSeed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
