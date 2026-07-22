import { Router, type IRouter } from "express";
import {
  db,
  ledgerAccountsTable,
  accountingVouchersTable,
  voucherPostingsTable,
  type LedgerAccount,
  type AccountingVoucher,
  type VoucherPosting,
} from "@workspace/db";
import { eq, and, sql, desc, asc } from "drizzle-orm";

const router: IRouter = Router();

// Default Ledgers to Seed
const DEFAULT_LEDGERS = [
  { name: "Cash A/c", groupName: "Cash-in-hand", openingBalance: "50000.00", openingBalanceType: "debit", description: "Default Cash Account" },
  { name: "SBI Bank Account", groupName: "Bank Accounts", openingBalance: "250000.00", openingBalanceType: "debit", description: "Main Bank Account" },
  { name: "Capital A/c", groupName: "Capital Account", openingBalance: "300000.00", openingBalanceType: "credit", description: "Owner Capital Account" },
  { name: "Interest Income", groupName: "Indirect Incomes", openingBalance: "0.00", openingBalanceType: "credit", description: "Income from interest" },
  { name: "Office Expenses", groupName: "Indirect Expenses", openingBalance: "0.00", openingBalanceType: "debit", description: "Office administrative expenses" },
  { name: "Salary Expenses", groupName: "Indirect Expenses", openingBalance: "0.00", openingBalanceType: "debit", description: "Employee salaries" },
  { name: "Rent & Utilities", groupName: "Indirect Expenses", openingBalance: "0.00", openingBalanceType: "debit", description: "Rent and electricity payments" },
];

async function ensureDefaultLedgers() {
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(ledgerAccountsTable);
  if (existing[0]?.count === 0) {
    for (const led of DEFAULT_LEDGERS) {
      await db.insert(ledgerAccountsTable).values(led);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Get Ledgers with current balances
// ---------------------------------------------------------------------------
router.get("/accounting/ledgers", async (req, res): Promise<void> => {
  try {
    await ensureDefaultLedgers();

    // Fetch all ledgers
    const ledgers = await db.select().from(ledgerAccountsTable).orderBy(asc(ledgerAccountsTable.name));

    // Get sums of debits/credits grouped by ledger account
    const postingsSummary = await db
      .select({
        ledgerAccountId: voucherPostingsTable.ledgerAccountId,
        debitSum: sql<string>`coalesce(sum(case when entry_type = 'debit' then amount else 0 end), 0)`,
        creditSum: sql<string>`coalesce(sum(case when entry_type = 'credit' then amount else 0 end), 0)`,
      })
      .from(voucherPostingsTable)
      .groupBy(voucherPostingsTable.ledgerAccountId);

    const summariesMap = new Map(postingsSummary.map(s => [s.ledgerAccountId, s]));

    const data = ledgers.map((l) => {
      const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
      const opBal = parseFloat(l.openingBalance);
      const debits = parseFloat(summary.debitSum);
      const credits = parseFloat(summary.creditSum);

      let totalDebit = l.openingBalanceType === "debit" ? opBal + debits : debits;
      let totalCredit = l.openingBalanceType === "credit" ? opBal + credits : credits;

      let netBalance = 0;
      let balanceType: "debit" | "credit" = "debit";

      if (totalDebit >= totalCredit) {
        netBalance = totalDebit - totalCredit;
        balanceType = "debit";
      } else {
        netBalance = totalCredit - totalDebit;
        balanceType = "credit";
      }

      return {
        ...l,
        debits,
        credits,
        netBalance,
        balanceType,
      };
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. Create Ledger
// ---------------------------------------------------------------------------
router.post("/accounting/ledgers", async (req, res): Promise<void> => {
  const { name, groupName, openingBalance = "0.00", openingBalanceType = "debit", description } = req.body;
  if (!name || !groupName) {
    res.status(400).json({ error: "name and groupName are required" });
    return;
  }

  try {
    const [row] = await db
      .insert(ledgerAccountsTable)
      .values({
        name,
        groupName,
        openingBalance: String(openingBalance),
        openingBalanceType,
        description,
      })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err.message?.includes("unique")) {
      res.status(400).json({ error: `Ledger account "${name}" already exists` });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Get Day Book Vouchers
// ---------------------------------------------------------------------------
router.get("/accounting/vouchers", async (req, res): Promise<void> => {
  try {
    const vouchers = await db
      .select()
      .from(accountingVouchersTable)
      .orderBy(desc(accountingVouchersTable.date), desc(accountingVouchersTable.id));

    const postings = await db
      .select({
        p: voucherPostingsTable,
        ledgerName: ledgerAccountsTable.name,
        ledgerGroup: ledgerAccountsTable.groupName,
      })
      .from(voucherPostingsTable)
      .leftJoin(ledgerAccountsTable, eq(voucherPostingsTable.ledgerAccountId, ledgerAccountsTable.id));

    // Group postings by voucher ID
    const postingsByVoucher = new Map<number, any[]>();
    for (const p of postings) {
      if (!p.p.voucherId) continue;
      const list = postingsByVoucher.get(p.p.voucherId) || [];
      list.push({
        id: p.p.id,
        ledgerAccountId: p.p.ledgerAccountId,
        ledgerName: p.ledgerName,
        ledgerGroup: p.ledgerGroup,
        amount: parseFloat(p.p.amount),
        entryType: p.p.entryType,
      });
      postingsByVoucher.set(p.p.voucherId, list);
    }

    const data = vouchers.map((v) => ({
      ...v,
      postings: postingsByVoucher.get(v.id) || [],
    }));

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. Post Voucher (Receipt, Payment, Journal, Contra)
// ---------------------------------------------------------------------------
router.post("/accounting/vouchers", async (req, res): Promise<void> => {
  const { voucherType, date, narration, postings } = req.body;

  if (!voucherType || !postings || !Array.isArray(postings) || postings.length < 2) {
    res.status(400).json({ error: "voucherType and at least 2 postings are required" });
    return;
  }

  // Validate debits vs credits sum
  let totalDebits = 0;
  let totalCredits = 0;

  for (const p of postings) {
    const amt = parseFloat(p.amount);
    if (isNaN(amt) || amt <= 0) {
      res.status(400).json({ error: "All posting amounts must be positive numbers" });
      return;
    }
    if (p.entryType === "debit") {
      totalDebits += amt;
    } else if (p.entryType === "credit") {
      totalCredits += amt;
    } else {
      res.status(400).json({ error: "entryType must be 'debit' or 'credit'" });
      return;
    }
  }

  // Allow tiny float mismatch up to 0.01
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    res.status(400).json({
      error: `Double entry mismatch: Total Debits (₹${totalDebits.toFixed(2)}) must equal Total Credits (₹${totalCredits.toFixed(2)})`,
    });
    return;
  }

  try {
    // Generate unique Voucher Number
    const datePrefix = (date ? new Date(date) : new Date()).toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    const typeCode = voucherType.substring(0, 3).toUpperCase();
    const voucherNumber = `VCH-${typeCode}-${datePrefix}-${randomHex}`;

    // Use transaction to insert voucher and postings
    const result = await db.transaction(async (tx) => {
      const [vRow] = await tx
        .insert(accountingVouchersTable)
        .values({
          voucherType,
          voucherNumber,
          date: date ? new Date(date) : new Date(),
          narration,
        })
        .returning();

      const savedPostings = [];
      for (const p of postings) {
        const [pRow] = await tx
          .insert(voucherPostingsTable)
          .values({
            voucherId: vRow.id,
            ledgerAccountId: p.ledgerAccountId,
            amount: String(p.amount),
            entryType: p.entryType,
          })
          .returning();
        savedPostings.push(pRow);
      }

      return { ...vRow, postings: savedPostings };
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 5. Get Ledger statement
// ---------------------------------------------------------------------------
router.get("/accounting/ledgers/:id/statement", async (req, res): Promise<void> => {
  const ledgerId = parseInt(req.params.id, 10);
  if (isNaN(ledgerId)) {
    res.status(400).json({ error: "Invalid ledger ID" });
    return;
  }

  try {
    const [ledger] = await db.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.id, ledgerId));
    if (!ledger) {
      res.status(404).json({ error: "Ledger account not found" });
      return;
    }

    // Fetch postings for this ledger along with their vouchers
    const postings = await db
      .select({
        p: voucherPostingsTable,
        v: accountingVouchersTable,
      })
      .from(voucherPostingsTable)
      .innerJoin(accountingVouchersTable, eq(voucherPostingsTable.voucherId, accountingVouchersTable.id))
      .where(eq(voucherPostingsTable.ledgerAccountId, ledgerId))
      .orderBy(asc(accountingVouchersTable.date), asc(voucherPostingsTable.id));

    // Calculate running balance
    const opBal = parseFloat(ledger.openingBalance);
    let runningBalance = opBal;
    let runningBalanceType = ledger.openingBalanceType;

    const entries = postings.map((item) => {
      const amt = parseFloat(item.p.amount);
      const isDebit = item.p.entryType === "debit";

      // Calculate running balance adjustment based on normal ledger balance rules
      if (runningBalanceType === "debit") {
        if (isDebit) {
          runningBalance += amt;
        } else {
          runningBalance -= amt;
        }
      } else {
        if (isDebit) {
          runningBalance -= amt;
        } else {
          runningBalance += amt;
        }
      }

      // If running balance flips below zero, change normal balance type
      let finalBalance = runningBalance;
      let finalType = runningBalanceType;
      if (runningBalance < 0) {
        finalBalance = Math.abs(runningBalance);
        finalType = runningBalanceType === "debit" ? "credit" : "debit";
      }

      return {
        postingId: item.p.id,
        voucherId: item.v.id,
        voucherNumber: item.v.voucherNumber,
        voucherType: item.v.voucherType,
        date: item.v.date.toISOString(),
        narration: item.v.narration,
        amount: amt,
        entryType: item.p.entryType,
        runningBalance: Math.round(finalBalance * 100) / 100,
        runningBalanceType: finalType,
      };
    });

    res.json({
      ledger,
      openingBalance: opBal,
      openingBalanceType: ledger.openingBalanceType,
      entries,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 6. Report: Trial Balance
// ---------------------------------------------------------------------------
router.get("/accounting/reports/trial-balance", async (req, res): Promise<void> => {
  try {
    const ledgers = await db.select().from(ledgerAccountsTable).orderBy(asc(ledgerAccountsTable.name));

    const postingsSummary = await db
      .select({
        ledgerAccountId: voucherPostingsTable.ledgerAccountId,
        debitSum: sql<string>`coalesce(sum(case when entry_type = 'debit' then amount else 0 end), 0)`,
        creditSum: sql<string>`coalesce(sum(case when entry_type = 'credit' then amount else 0 end), 0)`,
      })
      .from(voucherPostingsTable)
      .groupBy(voucherPostingsTable.ledgerAccountId);

    const summariesMap = new Map(postingsSummary.map(s => [s.ledgerAccountId, s]));

    let totalOpDebit = 0;
    let totalOpCredit = 0;
    let totalTransactionDebit = 0;
    let totalTransactionCredit = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;

    const rows = ledgers.map((l) => {
      const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
      const opBal = parseFloat(l.openingBalance);
      const debits = parseFloat(summary.debitSum);
      const credits = parseFloat(summary.creditSum);

      const opDebit = l.openingBalanceType === "debit" ? opBal : 0;
      const opCredit = l.openingBalanceType === "credit" ? opBal : 0;

      const totalDebit = opDebit + debits;
      const totalCredit = opCredit + credits;

      let closingDebit = 0;
      let closingCredit = 0;

      if (totalDebit >= totalCredit) {
        closingDebit = totalDebit - totalCredit;
      } else {
        closingCredit = totalCredit - totalDebit;
      }

      totalOpDebit += opDebit;
      totalOpCredit += opCredit;
      totalTransactionDebit += debits;
      totalTransactionCredit += credits;
      totalClosingDebit += closingDebit;
      totalClosingCredit += closingCredit;

      return {
        ledgerId: l.id,
        name: l.name,
        groupName: l.groupName,
        opDebit,
        opCredit,
        debits,
        credits,
        closingDebit,
        closingCredit,
      };
    });

    res.json({
      rows,
      totals: {
        opDebit: totalOpDebit,
        opCredit: totalOpCredit,
        debits: totalTransactionDebit,
        credits: totalTransactionCredit,
        closingDebit: totalClosingDebit,
        closingCredit: totalClosingCredit,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 7. Report: Profit & Loss A/c
// ---------------------------------------------------------------------------
router.get("/accounting/reports/profit-loss", async (req, res): Promise<void> => {
  try {
    const ledgers = await db.select().from(ledgerAccountsTable);

    const postingsSummary = await db
      .select({
        ledgerAccountId: voucherPostingsTable.ledgerAccountId,
        debitSum: sql<string>`coalesce(sum(case when entry_type = 'debit' then amount else 0 end), 0)`,
        creditSum: sql<string>`coalesce(sum(case when entry_type = 'credit' then amount else 0 end), 0)`,
      })
      .from(voucherPostingsTable)
      .groupBy(voucherPostingsTable.ledgerAccountId);

    const summariesMap = new Map(postingsSummary.map(s => [s.ledgerAccountId, s]));

    const incomeLedgers = [];
    const expenseLedgers = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const l of ledgers) {
      const isIncome = ["Indirect Incomes", "Direct Incomes"].includes(l.groupName);
      const isExpense = ["Indirect Expenses", "Direct Expenses"].includes(l.groupName);

      if (!isIncome && !isExpense) continue;

      const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
      const opBal = parseFloat(l.openingBalance);
      const debits = parseFloat(summary.debitSum);
      const credits = parseFloat(summary.creditSum);

      if (isIncome) {
        // Income is Credit normal: credits - debits + openingBalance (credit)
        const amount = credits - debits + (l.openingBalanceType === "credit" ? opBal : -opBal);
        totalIncome += amount;
        incomeLedgers.push({ id: l.id, name: l.name, groupName: l.groupName, amount });
      } else if (isExpense) {
        // Expense is Debit normal: debits - credits + openingBalance (debit)
        const amount = debits - credits + (l.openingBalanceType === "debit" ? opBal : -opBal);
        totalExpense += amount;
        expenseLedgers.push({ id: l.id, name: l.name, groupName: l.groupName, amount });
      }
    }

    const netProfit = totalIncome - totalExpense;

    res.json({
      incomes: incomeLedgers,
      expenses: expenseLedgers,
      totalIncome,
      totalExpense,
      netProfit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 8. Report: Balance Sheet
// ---------------------------------------------------------------------------
router.get("/accounting/reports/balance-sheet", async (req, res): Promise<void> => {
  try {
    const ledgers = await db.select().from(ledgerAccountsTable);

    const postingsSummary = await db
      .select({
        ledgerAccountId: voucherPostingsTable.ledgerAccountId,
        debitSum: sql<string>`coalesce(sum(case when entry_type = 'debit' then amount else 0 end), 0)`,
        creditSum: sql<string>`coalesce(sum(case when entry_type = 'credit' then amount else 0 end), 0)`,
      })
      .from(voucherPostingsTable)
      .groupBy(voucherPostingsTable.ledgerAccountId);

    const summariesMap = new Map(postingsSummary.map(s => [s.ledgerAccountId, s]));

    // We also need net profit from P&L to represent retained earnings
    let totalIncome = 0;
    let totalExpense = 0;

    const assets = [];
    const liabilities = [];
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const l of ledgers) {
      const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
      const opBal = parseFloat(l.openingBalance);
      const debits = parseFloat(summary.debitSum);
      const credits = parseFloat(summary.creditSum);

      const opDebit = l.openingBalanceType === "debit" ? opBal : 0;
      const opCredit = l.openingBalanceType === "credit" ? opBal : 0;
      const closingDebit = (opDebit + debits) >= (opCredit + credits) ? (opDebit + debits) - (opCredit + credits) : 0;
      const closingCredit = (opCredit + credits) > (opDebit + debits) ? (opCredit + credits) - (opDebit + debits) : 0;

      // Accumulate P&L totals
      const isIncome = ["Indirect Incomes", "Direct Incomes"].includes(l.groupName);
      const isExpense = ["Indirect Expenses", "Direct Expenses"].includes(l.groupName);
      if (isIncome) {
        totalIncome += (credits - debits + opCredit - opDebit);
      } else if (isExpense) {
        totalExpense += (debits - credits + opDebit - opCredit);
      }

      // Group for Balance Sheet (Ignore P&L statement accounts, they are aggregated into Net Profit)
      if (isIncome || isExpense) continue;

      const isAssetGroup = ["Cash-in-hand", "Bank Accounts", "Sundry Debtors", "Fixed Assets", "Current Assets"].includes(l.groupName);
      // Otherwise, treat as Liability / Equity

      if (isAssetGroup) {
        const balance = closingDebit - closingCredit;
        totalAssets += balance;
        assets.push({ id: l.id, name: l.name, groupName: l.groupName, balance });
      } else {
        const balance = closingCredit - closingDebit;
        totalLiabilities += balance;
        liabilities.push({ id: l.id, name: l.name, groupName: l.groupName, balance });
      }
    }

    const netProfit = totalIncome - totalExpense;

    // Add Net Profit as Liability/Equity (retained earnings)
    liabilities.push({ id: -1, name: "Profit & Loss A/c (Net Profit)", groupName: "Retained Earnings", balance: netProfit });
    totalLiabilities += netProfit;

    res.json({
      assets,
      liabilities,
      totalAssets,
      totalLiabilities,
      netProfit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
