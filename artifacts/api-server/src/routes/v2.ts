/**
 * V2 API Routes — read from new normalized tables.
 * All routes under /api/v2/
 */
import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

router.get("/dashboard", async (_req, res) => {
  try {
    const [todayRes, monthRes, miPendingRes, byajPendingRes] = await Promise.all([
      pool.query(`SELECT module, payment_count::int, total_amount::numeric, cash_amount::numeric, online_amount::numeric FROM v2_dashboard_today`),
      pool.query(`SELECT module, payment_count::int, total_amount::numeric FROM v2_dashboard_month`),
      pool.query(`SELECT COUNT(*)::int AS cnt, SUM(installment_amount)::numeric AS amt FROM v2_mi_pending WHERE is_pending`),
      pool.query(`SELECT COUNT(*)::int AS cnt, SUM(interest_amount)::numeric AS amt FROM v2_byaj_pending WHERE is_pending`),
    ]);

    const todayByModule: Record<string,any> = {};
    for (const r of todayRes.rows) todayByModule[r.module] = r;

    const monthByModule: Record<string,any> = {};
    for (const r of monthRes.rows) monthByModule[r.module] = r;

    const sum = (m: string, f: string) => parseFloat(todayByModule[m]?.[f] || 0);

    res.json({
      success: true,
      today: {
        totalCollection:   todayRes.rows.reduce((s, r) => s + parseFloat(r.total_amount||0), 0),
        bissiCollection:   sum('BISSI', 'total_amount'),
        miCollection:      sum('MONTHLY_INSTALLMENT', 'total_amount'),
        byajCollection:    sum('BYAJ', 'total_amount'),
        loanCollection:    sum('LOAN', 'total_amount'),
        cashAmount:        todayRes.rows.reduce((s,r) => s + parseFloat(r.cash_amount||0), 0),
        onlineAmount:      todayRes.rows.reduce((s,r) => s + parseFloat(r.online_amount||0), 0),
        paymentCount:      todayRes.rows.reduce((s,r) => s + (r.payment_count||0), 0),
      },
      month: {
        totalCollection:   monthRes.rows.reduce((s, r) => s + parseFloat(r.total_amount||0), 0),
        bissiCollection:   parseFloat(monthByModule['BISSI']?.total_amount || 0),
        miCollection:      parseFloat(monthByModule['MONTHLY_INSTALLMENT']?.total_amount || 0),
        byajCollection:    parseFloat(monthByModule['BYAJ']?.total_amount || 0),
        loanCollection:    parseFloat(monthByModule['LOAN']?.total_amount || 0),
      },
      pending: {
        miCount:    miPendingRes.rows[0]?.cnt || 0,
        miAmount:   parseFloat(miPendingRes.rows[0]?.amt || 0),
        byajCount:  byajPendingRes.rows[0]?.cnt || 0,
        byajAmount: parseFloat(byajPendingRes.rows[0]?.amt || 0),
      },
      modules: { today: todayByModule, month: monthByModule },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// MONTHLY INSTALLMENT
// ---------------------------------------------------------------------------

router.get("/mi/accounts", async (req, res) => {
  const search = ((req.query.search as string) || "").trim();
  const page   = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const limit  = Math.min(200, parseInt((req.query.limit as string) || "50", 10));
  const offset = (page - 1) * limit;
  try {
    let where = "WHERE ma.status = 'ACTIVE'";
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.name ILIKE $${params.length} OR c.mobile ILIKE $${params.length} OR ma.excel_token_label ILIKE $${params.length})`;
    }
    params.push(limit, offset);

    const [dataRes, countRes] = await Promise.all([
      pool.query(`
        SELECT ma.id, ma.customer_id, COALESCE(c.name,'') AS customer_name, COALESCE(c.mobile,'') AS mobile,
               ma.excel_token_label, ma.token_serial, ma.installment_amount,
               ma.due_day, ma.start_date, ma.complete_date, ma.status,
               (SELECT mp.amount FROM mi_payments mp
                WHERE mp.account_id = ma.id
                  AND mp.period_month = DATE_TRUNC('month', CURRENT_DATE)::date
                LIMIT 1) AS paid_this_month
        FROM mi_accounts ma
        LEFT JOIN customers c ON c.id::text = ma.customer_id
        ${where}
        ORDER BY ma.token_serial ASC NULLS LAST, c.name ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      pool.query(`SELECT COUNT(*) FROM mi_accounts ma LEFT JOIN customers c ON c.id::text = ma.customer_id ${where}`,
        params.slice(0, -2)),
    ]);

    res.json({
      success: true,
      accounts: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page, limit,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/mi/pending", async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM v2_mi_pending WHERE is_pending ORDER BY due_day ASC NULLS LAST, token_serial ASC NULLS LAST`);
    res.json({ success: true, pending: r.rows, total: r.rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/mi/accounts/:id/history", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT mp.*, TO_CHAR(mp.period_month, 'Mon YYYY') AS period_label
       FROM mi_payments mp
       WHERE mp.account_id = $1
       ORDER BY mp.period_month DESC`,
      [req.params.id]
    );
    res.json({ success: true, history: r.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/mi/accounts/:id/pay", async (req, res) => {
  const { amount, paymentMode = "CASH", collector, notes, periodMonth } = req.body;
  if (!amount) { res.status(400).json({ success: false, error: "amount required" }); return; }

  try {
    const acct = await pool.query(`SELECT ma.*, ma.customer_id AS cid FROM mi_accounts ma WHERE ma.id=$1`, [req.params.id]);
    if (!acct.rows.length) { res.status(404).json({ success: false, error: "Account not found" }); return; }
    const a = acct.rows[0];

    const month = periodMonth || new Date().toISOString().slice(0,7) + '-01';
    await pool.query(
      `INSERT INTO mi_payments (account_id, customer_id, period_month, payment_date, amount, payment_mode, collector, notes)
       VALUES ($1,$2,$3::date,CURRENT_DATE,$4,$5::pay_mode,$6,$7)
       ON CONFLICT (account_id, period_month) DO UPDATE SET amount=$4, payment_mode=$5::pay_mode, collector=$6, notes=$7`,
      [a.id, a.cid, month, amount, paymentMode.toUpperCase(), collector||null, notes||null]
    );
    await pool.query(
      `INSERT INTO payment_ledger (customer_id, module, source_table, amount, payment_date, period_month, notes)
       VALUES ($1,'MONTHLY_INSTALLMENT','mi_payments',$2,CURRENT_DATE,$3::date,$4)`,
      [a.cid, amount, month, a.excel_token_label]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// BYAJ (INTEREST)
// ---------------------------------------------------------------------------

router.get("/byaj/accounts", async (req, res) => {
  const search = ((req.query.search as string) || "").trim();
  const page   = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const limit  = Math.min(200, parseInt((req.query.limit as string) || "50", 10));
  const offset = (page - 1) * limit;
  try {
    let where = "WHERE ba.status = 'ACTIVE'";
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.name ILIKE $${params.length} OR c.mobile ILIKE $${params.length})`;
    }
    params.push(limit, offset);

    const [dataRes, countRes] = await Promise.all([
      pool.query(`
        SELECT ba.id, ba.customer_id, COALESCE(c.name,'') AS customer_name, COALESCE(c.mobile,'') AS mobile,
               ba.byaj_serial, ba.interest_amount, ba.due_day, ba.status,
               ba.reason1, ba.reply,
               (SELECT bp.amount FROM byaj_payments bp
                WHERE bp.account_id = ba.id
                  AND bp.period_month = DATE_TRUNC('month', CURRENT_DATE)::date
                LIMIT 1) AS paid_this_month
        FROM byaj_accounts ba
        LEFT JOIN customers c ON c.id::text = ba.customer_id
        ${where}
        ORDER BY ba.byaj_serial ASC NULLS LAST, c.name ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      pool.query(`SELECT COUNT(*) FROM byaj_accounts ba LEFT JOIN customers c ON c.id::text = ba.customer_id ${where}`, params.slice(0,-2)),
    ]);

    res.json({ success: true, accounts: dataRes.rows, total: parseInt(countRes.rows[0].count, 10), page, limit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/byaj/pending", async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM v2_byaj_pending WHERE is_pending ORDER BY due_day ASC NULLS LAST, byaj_serial ASC NULLS LAST`);
    res.json({ success: true, pending: r.rows, total: r.rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/byaj/accounts/:id/history", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT bp.*, TO_CHAR(bp.period_month, 'Mon YYYY') AS period_label
       FROM byaj_payments bp WHERE bp.account_id = $1 ORDER BY bp.period_month DESC`,
      [req.params.id]
    );
    res.json({ success: true, history: r.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/byaj/accounts/:id/pay", async (req, res) => {
  const { amount, paymentMode = "CASH", collector, notes, periodMonth } = req.body;
  if (!amount) { res.status(400).json({ success: false, error: "amount required" }); return; }
  try {
    const acct = await pool.query(`SELECT ba.*, ba.customer_id AS cid FROM byaj_accounts ba WHERE ba.id=$1`, [req.params.id]);
    if (!acct.rows.length) { res.status(404).json({ success: false, error: "Account not found" }); return; }
    const a = acct.rows[0];
    const month = periodMonth || new Date().toISOString().slice(0,7) + '-01';
    await pool.query(
      `INSERT INTO byaj_payments (account_id, customer_id, period_month, payment_date, amount, payment_mode, collector, notes)
       VALUES ($1,$2,$3::date,CURRENT_DATE,$4,$5::pay_mode,$6,$7)
       ON CONFLICT (account_id, period_month) DO UPDATE SET amount=$4, payment_mode=$5::pay_mode, collector=$6, notes=$7`,
      [a.id, a.cid, month, amount, paymentMode.toUpperCase(), collector||null, notes||null]
    );
    await pool.query(
      `INSERT INTO payment_ledger (customer_id, module, source_table, amount, payment_date, period_month, notes)
       VALUES ($1,'BYAJ','byaj_payments',$2,CURRENT_DATE,$3::date,$4)`,
      [a.cid, amount, month, `BYAJ-${a.byaj_serial}`]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// LOANS (schema only — read endpoints)
// ---------------------------------------------------------------------------

router.get("/loans", async (req, res) => {
  const search = ((req.query.search as string) || "").trim();
  try {
    let where = "WHERE 1=1";
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.name ILIKE $1 OR c.mobile ILIKE $1)`;
    }
    const r = await pool.query(`
      SELECT la.id, la.customer_id, COALESCE(c.name,'') AS customer_name, COALESCE(c.mobile,'') AS mobile,
             la.principal_amount, la.interest_rate_pct, la.disbursal_date,
             la.stage, la.security, la.notes
      FROM loan_accounts la
      LEFT JOIN customers c ON c.id::text = la.customer_id
      ${where}
      ORDER BY la.created_at DESC LIMIT 200
    `, params);
    res.json({ success: true, loans: r.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/loans/:id", async (req, res) => {
  try {
    const [loanRes, paymentsRes] = await Promise.all([
      pool.query(`SELECT la.*, COALESCE(c.name,'') AS customer_name, COALESCE(c.mobile,'') AS mobile FROM loan_accounts la LEFT JOIN customers c ON c.id::text = la.customer_id WHERE la.id=$1`, [req.params.id]),
      pool.query(`SELECT * FROM loan_payments WHERE loan_id=$1 ORDER BY payment_date DESC`, [req.params.id]),
    ]);
    if (!loanRes.rows.length) { res.status(404).json({ success: false, error: "Not found" }); return; }
    res.json({ success: true, loan: loanRes.rows[0], payments: paymentsRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// CUSTOMER SEARCH (global — all modules)
// ---------------------------------------------------------------------------

router.get("/customer-search", async (req, res) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q || q.length < 2) { res.json({ success: true, results: [] }); return; }
  try {
    const r = await pool.query(`
      SELECT
        c.id, c.name, c.mobile, c.alt_mobile, c.address, c.customer_type, c.status, c.reference_number,
        -- Count active accounts per module
        (SELECT COUNT(*)::int FROM tokens t WHERE t.customer_id=c.id AND t.deleted_at IS NULL)             AS bissi_count,
        (SELECT COUNT(*)::int FROM mi_accounts ma WHERE ma.customer_id=c.id AND ma.status='ACTIVE')        AS mi_count,
        (SELECT COUNT(*)::int FROM byaj_accounts ba WHERE ba.customer_id=c.id AND ba.status='ACTIVE')      AS byaj_count,
        (SELECT COUNT(*)::int FROM loan_accounts la WHERE la.customer_id=c.id AND la.stage NOT IN ('CLOSED','DEFAULTED')) AS loan_count
      FROM customers c
      WHERE c.deleted_at IS NULL
        AND (c.name ILIKE $1 OR c.mobile ILIKE $1 OR c.alt_mobile ILIKE $1
             OR c.reference_number ILIKE $1 OR c.reference_mobile ILIKE $1)
      ORDER BY
        CASE WHEN c.mobile = $2 OR c.name ILIKE $2 THEN 0 ELSE 1 END,
        c.name ASC
      LIMIT 30
    `, [`%${q}%`, q]);
    res.json({ success: true, results: r.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// CUSTOMER FULL PROFILE
// ---------------------------------------------------------------------------

router.get("/customers/:id/profile", async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM v2_customer_full WHERE id=$1::uuid`, [req.params.id]);
    if (!r.rows.length) { res.status(404).json({ success: false, error: "Not found" }); return; }
    const profile = r.rows[0];

    // Recent payments from ledger
    const ledger = await pool.query(
      `SELECT module, source_table, amount, payment_mode, payment_date, period_month, notes
       FROM payment_ledger WHERE customer_id=$1::uuid
       ORDER BY payment_date DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ success: true, profile, recentPayments: ledger.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PAYMENT LEDGER (daily diary / reports)
// ---------------------------------------------------------------------------

router.get("/ledger", async (req, res) => {
  const date   = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const module = (req.query.module as string) || null;
  try {
    const params: any[] = [date];
    let moduleFilter = '';
    if (module) { params.push(module.toUpperCase()); moduleFilter = `AND module=$${params.length}::payment_module`; }

    const r = await pool.query(`
      SELECT pl.*, c.name AS customer_name, c.mobile
      FROM payment_ledger pl
      LEFT LEFT JOIN customers c ON c.id::text = pl.customer_id
      WHERE pl.payment_date = $1::date ${moduleFilter}
      ORDER BY pl.created_at DESC
      LIMIT 500
    `, params);
    res.json({ success: true, entries: r.rows, total: r.rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/ledger/monthly-summary", async (req, res) => {
  const month = (req.query.month as string) || new Date().toISOString().slice(0,7) + '-01';
  try {
    const r = await pool.query(`
      SELECT
        module,
        COUNT(*)::int               AS count,
        SUM(amount)::numeric        AS total,
        SUM(CASE WHEN payment_mode='CASH' THEN amount ELSE 0 END)::numeric   AS cash,
        SUM(CASE WHEN payment_mode!='CASH' THEN amount ELSE 0 END)::numeric  AS online
      FROM payment_ledger
      WHERE DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', $1::date)
      GROUP BY module
      ORDER BY total DESC
    `, [month]);
    res.json({ success: true, month, summary: r.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/admin/clear-and-reimport", async (req, res) => {
  const { secret, byaj_accounts = [], byaj_payments = [], mi_accounts = [], mi_payments = [] } = req.body;
  if (secret !== (process.env.IMPORT_SECRET || 'ska-import-2026')) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  try {
    // Truncate existing data (cascade handles payments)
    await pool.query(`TRUNCATE byaj_payments, byaj_accounts, mi_payments, mi_accounts, payment_ledger RESTART IDENTITY CASCADE`);

    const results: Record<string, number> = { byaj_accounts: 0, byaj_payments: 0, mi_accounts: 0, mi_payments: 0 };

    for (const acc of byaj_accounts) {
      try {
        await pool.query(
          `INSERT INTO byaj_accounts (id, customer_id, byaj_serial, interest_amount, due_day, address, reason1, reason2, reply, notes, status, customer_name, customer_mobile, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [acc.id, acc.customer_id, acc.byaj_serial||null, acc.interest_amount||0, acc.due_day||null,
           acc.address||null, acc.reason1||null, acc.reason2||null, acc.reply||null, acc.notes||null,
           acc.status||'ACTIVE', acc.customer_name||null, acc.customer_mobile||null,
           acc.created_at||new Date(), acc.updated_at||new Date()]
        );
        results.byaj_accounts++;
      } catch {}
    }

    for (const pay of byaj_payments) {
      try {
        await pool.query(
          `INSERT INTO byaj_payments (id, account_id, customer_id, period_month, payment_date, amount, raw_value, created_at)
           VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8)`,
          [pay.id, pay.account_id, pay.customer_id, pay.period_month, pay.payment_date,
           pay.amount, pay.raw_value||null, pay.created_at||new Date()]
        );
        results.byaj_payments++;
      } catch {}
    }

    for (const acc of mi_accounts) {
      try {
        await pool.query(
          `INSERT INTO mi_accounts (id, customer_id, excel_token_label, token_serial, installment_amount, due_day, start_date, complete_date, address, notes, status, customer_name, customer_mobile, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [acc.id, acc.customer_id, acc.excel_token_label||null, acc.token_serial||null,
           acc.installment_amount||0, acc.due_day||null, acc.start_date||null, acc.complete_date||null,
           acc.address||null, acc.notes||null, acc.status||'ACTIVE', acc.customer_name||null, acc.customer_mobile||null,
           acc.created_at||new Date(), acc.updated_at||new Date()]
        );
        results.mi_accounts++;
      } catch {}
    }

    for (const pay of mi_payments) {
      try {
        await pool.query(
          `INSERT INTO mi_payments (id, account_id, customer_id, period_month, payment_date, amount, raw_value, created_at)
           VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8)`,
          [pay.id, pay.account_id, pay.customer_id, pay.period_month, pay.payment_date,
           pay.amount, pay.raw_value||null, pay.created_at||new Date()]
        );
        results.mi_payments++;
      } catch {}
    }

    res.json({ success: true, inserted: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// BULK IMPORT (one-time data migration via API)
// Body: { secret, byaj_accounts, byaj_payments, mi_accounts, mi_payments }
// ---------------------------------------------------------------------------

router.post("/admin/bulk-import", async (req, res) => {
  const { secret, byaj_accounts = [], byaj_payments = [], mi_accounts = [], mi_payments = [] } = req.body;

  // Simple secret check so this endpoint can't be called anonymously
  if (secret !== (process.env.IMPORT_SECRET || 'ska-import-2026')) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  const results: Record<string, number> = { byaj_accounts: 0, byaj_payments: 0, mi_accounts: 0, mi_payments: 0 };

  try {
    for (const acc of byaj_accounts) {
      try {
        await pool.query(
          `INSERT INTO byaj_accounts (id, customer_id, byaj_serial, interest_amount, due_day, address, reason1, reason2, reply, notes, status, customer_name, customer_mobile, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO UPDATE SET customer_name=EXCLUDED.customer_name, customer_mobile=EXCLUDED.customer_mobile`,
          [acc.id, acc.customer_id, acc.byaj_serial||null, acc.interest_amount||0, acc.due_day||null,
           acc.address||null, acc.reason1||null, acc.reason2||null, acc.reply||null, acc.notes||null,
           acc.status||'ACTIVE', acc.customer_name||null, acc.customer_mobile||null,
           acc.created_at||new Date(), acc.updated_at||new Date()]
        );
        results.byaj_accounts++;
      } catch {}
    }

    for (const pay of byaj_payments) {
      try {
        await pool.query(
          `INSERT INTO byaj_payments (id, account_id, customer_id, period_month, payment_date, amount, raw_value, created_at)
           VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8)
           ON CONFLICT (account_id, period_month) DO NOTHING`,
          [pay.id, pay.account_id, pay.customer_id, pay.period_month, pay.payment_date, pay.amount,
           pay.raw_value||null, pay.created_at||new Date()]
        );
        results.byaj_payments++;
      } catch {}
    }

    for (const acc of mi_accounts) {
      try {
        await pool.query(
          `INSERT INTO mi_accounts (id, customer_id, excel_token_label, token_serial, installment_amount, due_day, start_date, complete_date, address, notes, status, customer_name, customer_mobile, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO UPDATE SET customer_name=EXCLUDED.customer_name, customer_mobile=EXCLUDED.customer_mobile`,
          [acc.id, acc.customer_id, acc.excel_token_label||null, acc.token_serial||null,
           acc.installment_amount||0, acc.due_day||null, acc.start_date||null, acc.complete_date||null,
           acc.address||null, acc.notes||null, acc.status||'ACTIVE', acc.customer_name||null, acc.customer_mobile||null,
           acc.created_at||new Date(), acc.updated_at||new Date()]
        );
        results.mi_accounts++;
      } catch {}
    }

    for (const pay of mi_payments) {
      try {
        await pool.query(
          `INSERT INTO mi_payments (id, account_id, customer_id, period_month, payment_date, amount, raw_value, created_at)
           VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8)
           ON CONFLICT (account_id, period_month) DO NOTHING`,
          [pay.id, pay.account_id, pay.customer_id, pay.period_month, pay.payment_date, pay.amount,
           pay.raw_value||null, pay.created_at||new Date()]
        );
        results.mi_payments++;
      } catch {}
    }

    res.json({ success: true, inserted: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;



