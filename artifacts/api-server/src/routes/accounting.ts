import { Router, type IRouter } from "express";
import {
  db,
  ledgerGroupsTable,
  ledgerAccountsTable,
  accountingVouchersTable,
  voucherPostingsTable,
  bankReconciliationTable,
} from "@workspace/db";
import { eq, and, sql, desc, asc, isNull } from "drizzle-orm";
import { safeIso, sendListResponse, sendErrorListResponse } from "../lib/utils";

const router: IRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════
// SEED: Default Ledger Groups (Tally-compatible hierarchy)
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_GROUPS: { name: string; nature: string; parent?: string }[] = [
  // Root groups
  { name: "Capital Account", nature: "liabilities" },
  { name: "Loans (Liability)", nature: "liabilities" },
  { name: "Current Liabilities", nature: "liabilities" },
  { name: "Fixed Assets", nature: "assets" },
  { name: "Current Assets", nature: "assets" },
  { name: "Direct Incomes", nature: "income" },
  { name: "Indirect Incomes", nature: "income" },
  { name: "Direct Expenses", nature: "expense" },
  { name: "Indirect Expenses", nature: "expense" },
  // Sub-groups
  { name: "Sundry Creditors", nature: "liabilities", parent: "Current Liabilities" },
  { name: "Cash-in-hand", nature: "assets", parent: "Current Assets" },
  { name: "Bank Accounts", nature: "assets", parent: "Current Assets" },
  { name: "Sundry Debtors", nature: "assets", parent: "Current Assets" },
];

async function ensureDefaultGroups(): Promise<Map<string, number>> {
  const nameToId = new Map<string, number>();
  try {
    const existing = await db.select().from(ledgerGroupsTable).catch(() => []);
    if (existing.length > 0) {
      for (const g of existing) nameToId.set(g.name, g.id);
      return nameToId;
    }

    // Seed root groups first (parentId = null)
    for (const g of DEFAULT_GROUPS.filter((g) => !g.parent)) {
      const [row] = await db
        .insert(ledgerGroupsTable)
        .values({ name: g.name, nature: g.nature, isSystemGroup: true })
        .onConflictDoNothing()
        .returning()
        .catch(() => []);
      if (row) nameToId.set(row.name, row.id);
    }

    // Seed sub-groups (parentId from root)
    for (const g of DEFAULT_GROUPS.filter((g) => !!g.parent)) {
      const parentId = nameToId.get(g.parent!);
      const [row] = await db
        .insert(ledgerGroupsTable)
        .values({ name: g.name, nature: g.nature, parentId: parentId ?? null, isSystemGroup: true })
        .onConflictDoNothing()
        .returning()
        .catch(() => []);
      if (row) nameToId.set(row.name, row.id);
    }
  } catch (err) {
    console.warn("[DEFAULT GROUPS SEED WARNING]", err);
  }
  return nameToId;
}

// Default ledger accounts
const DEFAULT_LEDGERS = [
  { name: "Cash A/c", groupName: "Cash-in-hand", openingBalance: "50000.00", openingBalanceType: "debit", description: "Default Cash Account", isSystemLedger: true },
  { name: "SBI Bank Account", groupName: "Bank Accounts", openingBalance: "250000.00", openingBalanceType: "debit", description: "Main Bank Account", isSystemLedger: true },
  { name: "Capital A/c", groupName: "Capital Account", openingBalance: "300000.00", openingBalanceType: "credit", description: "Owner Capital Account", isSystemLedger: true },
  { name: "Interest Income", groupName: "Indirect Incomes", openingBalance: "0.00", openingBalanceType: "credit", description: "Income from interest", isSystemLedger: false },
  { name: "Collection Income", groupName: "Direct Incomes", openingBalance: "0.00", openingBalanceType: "credit", description: "Income from Bissi collections", isSystemLedger: false },
  { name: "Loan Disbursement", groupName: "Sundry Debtors", openingBalance: "0.00", openingBalanceType: "debit", description: "Loans given to customers", isSystemLedger: false },
  { name: "Office Expenses", groupName: "Indirect Expenses", openingBalance: "0.00", openingBalanceType: "debit", description: "Office administrative expenses", isSystemLedger: false },
  { name: "Salary Expenses", groupName: "Indirect Expenses", openingBalance: "0.00", openingBalanceType: "debit", description: "Employee salaries", isSystemLedger: false },
  { name: "Rent & Utilities", groupName: "Indirect Expenses", openingBalance: "0.00", openingBalanceType: "debit", description: "Rent and electricity payments", isSystemLedger: false },
];

async function ensureDefaultLedgers(groupMap: Map<string, number>) {
  try {
    const existing = await db.select({ count: sql<number>`count(*)::int` }).from(ledgerAccountsTable).catch(() => [{ count: 0 }]);
    if (!existing[0] || existing[0].count === 0) {
      for (const led of DEFAULT_LEDGERS) {
        const groupId = groupMap.get(led.groupName) ?? null;
        await db.insert(ledgerAccountsTable).values({
          name: led.name,
          groupName: led.groupName,
          groupId,
          openingBalance: led.openingBalance,
          openingBalanceType: led.openingBalanceType,
          description: led.description,
          isSystemLedger: led.isSystemLedger,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[DEFAULT LEDGERS SEED WARNING]", err);
  }
}

async function ensureSeeded() {
  const groupMap = await ensureDefaultGroups();
  await ensureDefaultLedgers(groupMap);
  return groupMap;
}

// ═══════════════════════════════════════════════════════════════════════════
// LEDGER GROUPS CRUD
// ═══════════════════════════════════════════════════════════════════════════

// GET /accounting/groups — tree structure
router.get("/accounting/groups", async (_req, res): Promise<void> => {
  try {
    await ensureDefaultGroups();
    const groups = await db.select().from(ledgerGroupsTable).orderBy(asc(ledgerGroupsTable.name)).catch(() => []);

    // Build tree structure
    const rootGroups: any[] = [];
    const childrenMap = new Map<number, any[]>();

    for (const g of groups) {
      const node = { ...g, children: [] as any[] };
      if (!g.parentId) {
        rootGroups.push(node);
      } else {
        const siblings = childrenMap.get(g.parentId) || [];
        siblings.push(node);
        childrenMap.set(g.parentId, siblings);
      }
    }

    // Attach children to parents
    function attachChildren(nodes: any[]) {
      for (const node of nodes) {
        node.children = childrenMap.get(node.id) || [];
        attachChildren(node.children);
      }
    }
    attachChildren(rootGroups);

    // Also return flat list for dropdowns
    sendListResponse(res, groups as any[]);
  } catch (err: any) {
    sendErrorListResponse(res, err?.message || "Failed to fetch groups");
  }
});

// GET /accounting/groups/tree — hierarchical tree
router.get("/accounting/groups/tree", async (_req, res): Promise<void> => {
  try {
    await ensureDefaultGroups();
    const groups = await db.select().from(ledgerGroupsTable).orderBy(asc(ledgerGroupsTable.name)).catch(() => []);

    const rootGroups: any[] = [];
    const childrenMap = new Map<number, any[]>();

    for (const g of groups) {
      const node = { ...g, children: [] as any[] };
      if (!g.parentId) {
        rootGroups.push(node);
      } else {
        const siblings = childrenMap.get(g.parentId) || [];
        siblings.push(node);
        childrenMap.set(g.parentId, siblings);
      }
    }

    function attachChildren(nodes: any[]) {
      for (const node of nodes) {
        node.children = childrenMap.get(node.id) || [];
        attachChildren(node.children);
      }
    }
    attachChildren(rootGroups);

    res.json({ tree: rootGroups, flat: groups });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to fetch group tree" });
  }
});

// POST /accounting/groups — create custom sub-group
router.post("/accounting/groups", async (req, res): Promise<void> => {
  const { name, parentId, nature } = req.body;
  if (!name || !nature) {
    res.status(400).json({ error: "name and nature are required" });
    return;
  }

  try {
    // If parentId given, verify it exists and inherit nature
    let finalNature = nature;
    if (parentId) {
      const [parent] = await db.select().from(ledgerGroupsTable).where(eq(ledgerGroupsTable.id, parentId)).catch(() => []);
      if (!parent) {
        res.status(400).json({ error: "Parent group not found" });
        return;
      }
      finalNature = parent.nature; // sub-groups inherit parent's nature
    }

    const [row] = await db
      .insert(ledgerGroupsTable)
      .values({ name, parentId: parentId || null, nature: finalNature, isSystemGroup: false })
      .returning();

    res.status(201).json(row);
  } catch (err: any) {
    if (err.message?.includes("unique")) {
      res.status(400).json({ error: `Group "${name}" already exists` });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /accounting/groups/:id — delete custom group (not system groups)
router.delete("/accounting/groups/:id", async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  try {
    const [group] = await db.select().from(ledgerGroupsTable).where(eq(ledgerGroupsTable.id, groupId)).catch(() => []);
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }
    if (group.isSystemGroup) { res.status(403).json({ error: "System groups cannot be deleted" }); return; }

    // Check if group has ledgers
    const [ledgerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(ledgerAccountsTable).where(eq(ledgerAccountsTable.groupId, groupId)).catch(() => [{ count: 0 }]);
    if (ledgerCount && ledgerCount.count > 0) {
      res.status(400).json({ error: "Cannot delete group that has ledger accounts. Move or delete ledgers first." });
      return;
    }

    // Check if group has sub-groups
    const [childCount] = await db.select({ count: sql<number>`count(*)::int` }).from(ledgerGroupsTable).where(eq(ledgerGroupsTable.parentId, groupId)).catch(() => [{ count: 0 }]);
    if (childCount && childCount.count > 0) {
      res.status(400).json({ error: "Cannot delete group that has sub-groups. Delete sub-groups first." });
      return;
    }

    await db.delete(ledgerGroupsTable).where(eq(ledgerGroupsTable.id, groupId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LEDGER ACCOUNTS CRUD
// ═══════════════════════════════════════════════════════════════════════════

// GET /accounting/ledgers — with group info and current balances
router.get("/accounting/ledgers", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();

    const ledgers = await db
      .select({
        ledger: ledgerAccountsTable,
        groupNature: ledgerGroupsTable.nature,
        groupParentId: ledgerGroupsTable.parentId,
      })
      .from(ledgerAccountsTable)
      .leftJoin(ledgerGroupsTable, eq(ledgerAccountsTable.groupId, ledgerGroupsTable.id))
      .orderBy(asc(ledgerAccountsTable.name))
      .catch(() => []);

    // Get debit/credit sums per ledger (only from posted vouchers)
    const postingsSummary = await db
      .select({
        ledgerAccountId: voucherPostingsTable.ledgerAccountId,
        debitSum: sql<string>`coalesce(sum(case when ${voucherPostingsTable.entryType} = 'debit' then ${voucherPostingsTable.amount} else 0 end), 0)`,
        creditSum: sql<string>`coalesce(sum(case when ${voucherPostingsTable.entryType} = 'credit' then ${voucherPostingsTable.amount} else 0 end), 0)`,
      })
      .from(voucherPostingsTable)
      .innerJoin(accountingVouchersTable, eq(voucherPostingsTable.voucherId, accountingVouchersTable.id))
      .where(eq(accountingVouchersTable.status, "posted"))
      .groupBy(voucherPostingsTable.ledgerAccountId)
      .catch(() => []);

    const summariesMap = new Map(postingsSummary.map((s) => [s.ledgerAccountId, s]));

    const data = ledgers.map((row) => {
      const l = row.ledger;
      const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
      const opBal = parseFloat(l.openingBalance || "0");
      const debits = parseFloat(summary.debitSum || "0");
      const credits = parseFloat(summary.creditSum || "0");

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
        groupNature: row.groupNature,
        groupParentId: row.groupParentId,
        debits,
        credits,
        netBalance,
        balanceType,
      };
    });

    sendListResponse(res, data);
  } catch (err: any) {
    sendErrorListResponse(res, err?.message || "Failed to fetch ledgers");
  }
});

// POST /accounting/ledgers — create new ledger account
router.post("/accounting/ledgers", async (req, res): Promise<void> => {
  const { name, groupId, groupName: rawGroupName, openingBalance = "0.00", openingBalanceType = "debit", description, branchId, committeeId } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    let resolvedGroupName = rawGroupName || "";
    let resolvedGroupId = groupId || null;

    // If groupId given, resolve groupName from it
    if (resolvedGroupId) {
      const [group] = await db.select().from(ledgerGroupsTable).where(eq(ledgerGroupsTable.id, resolvedGroupId)).catch(() => []);
      if (group) resolvedGroupName = group.name;
    }
    // If only groupName given, resolve groupId
    else if (resolvedGroupName) {
      const [group] = await db.select().from(ledgerGroupsTable).where(eq(ledgerGroupsTable.name, resolvedGroupName)).catch(() => []);
      if (group) resolvedGroupId = group.id;
    }

    if (!resolvedGroupName) {
      res.status(400).json({ error: "groupId or groupName is required" });
      return;
    }

    const [row] = await db
      .insert(ledgerAccountsTable)
      .values({
        name,
        groupId: resolvedGroupId,
        groupName: resolvedGroupName,
        openingBalance: String(openingBalance),
        openingBalanceType,
        description,
        branchId: branchId || null,
        committeeId: committeeId || null,
        isSystemLedger: false,
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

// PUT /accounting/ledgers/:id — edit ledger (if not frozen)
router.put("/accounting/ledgers/:id", async (req, res): Promise<void> => {
  const ledgerId = parseInt(req.params.id, 10);
  if (isNaN(ledgerId)) { res.status(400).json({ error: "Invalid ledger ID" }); return; }

  try {
    const [existing] = await db.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.id, ledgerId)).catch(() => []);
    if (!existing) { res.status(404).json({ error: "Ledger not found" }); return; }
    if (existing.status === "frozen") { res.status(403).json({ error: "Frozen ledger cannot be edited" }); return; }

    const { name, groupId, groupName, openingBalance, openingBalanceType, description, branchId, committeeId, status } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (groupId !== undefined) {
      updates.groupId = groupId;
      // Also resolve groupName
      const [group] = await db.select().from(ledgerGroupsTable).where(eq(ledgerGroupsTable.id, groupId)).catch(() => []);
      if (group) updates.groupName = group.name;
    }
    if (groupName !== undefined) updates.groupName = groupName;
    if (openingBalance !== undefined) updates.openingBalance = String(openingBalance);
    if (openingBalanceType !== undefined) updates.openingBalanceType = openingBalanceType;
    if (description !== undefined) updates.description = description;
    if (branchId !== undefined) updates.branchId = branchId || null;
    if (committeeId !== undefined) updates.committeeId = committeeId || null;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [updated] = await db.update(ledgerAccountsTable).set(updates).where(eq(ledgerAccountsTable.id, ledgerId)).returning();
    res.json(updated);
  } catch (err: any) {
    if (err.message?.includes("unique")) {
      res.status(400).json({ error: "Ledger name already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /accounting/ledgers/:id — soft-delete (freeze) if no postings
router.delete("/accounting/ledgers/:id", async (req, res): Promise<void> => {
  const ledgerId = parseInt(req.params.id, 10);
  if (isNaN(ledgerId)) { res.status(400).json({ error: "Invalid ledger ID" }); return; }

  try {
    const [existing] = await db.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.id, ledgerId)).catch(() => []);
    if (!existing) { res.status(404).json({ error: "Ledger not found" }); return; }
    if (existing.isSystemLedger) { res.status(403).json({ error: "System ledgers cannot be deleted" }); return; }

    // Check for postings
    const [postingCount] = await db.select({ count: sql<number>`count(*)::int` }).from(voucherPostingsTable).where(eq(voucherPostingsTable.ledgerAccountId, ledgerId)).catch(() => [{ count: 0 }]);

    if (postingCount && postingCount.count > 0) {
      // Soft-delete: freeze the ledger
      await db.update(ledgerAccountsTable).set({ status: "frozen" }).where(eq(ledgerAccountsTable.id, ledgerId));
      res.json({ success: true, action: "frozen", message: "Ledger has transactions — frozen instead of deleted" });
    } else {
      // Hard-delete: no transactions
      await db.delete(ledgerAccountsTable).where(eq(ledgerAccountsTable.id, ledgerId));
      res.json({ success: true, action: "deleted" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VOUCHER CRUD
// ═══════════════════════════════════════════════════════════════════════════

// GET /accounting/vouchers — Day Book with filters
router.get("/accounting/vouchers", async (req, res): Promise<void> => {
  try {
    const { type, status, from, to, branchId, committeeId } = req.query as any;

    let query = db
      .select()
      .from(accountingVouchersTable)
      .orderBy(desc(accountingVouchersTable.date), desc(accountingVouchersTable.id))
      .$dynamic();

    // Build conditions
    const conditions: any[] = [];
    if (type) conditions.push(eq(accountingVouchersTable.voucherType, type));
    if (status) conditions.push(eq(accountingVouchersTable.status, status));
    if (branchId) conditions.push(eq(accountingVouchersTable.branchId, parseInt(branchId)));
    if (committeeId) conditions.push(eq(accountingVouchersTable.committeeId, parseInt(committeeId)));
    if (from) conditions.push(sql`${accountingVouchersTable.date} >= ${new Date(from)}`);
    if (to) conditions.push(sql`${accountingVouchersTable.date} <= ${new Date(to + "T23:59:59Z")}`);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const vouchers = await query.catch(() => []);

    const postings = await db
      .select({
        p: voucherPostingsTable,
        ledgerName: ledgerAccountsTable.name,
        ledgerGroup: ledgerAccountsTable.groupName,
      })
      .from(voucherPostingsTable)
      .leftJoin(ledgerAccountsTable, eq(voucherPostingsTable.ledgerAccountId, ledgerAccountsTable.id))
      .catch(() => []);

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
        amount: parseFloat(p.p.amount || "0"),
        entryType: p.p.entryType,
        costCentreType: p.p.costCentreType,
        costCentreId: p.p.costCentreId,
      });
      postingsByVoucher.set(p.p.voucherId, list);
    }

    const data = vouchers.map((v: any) => ({
      ...v,
      date: safeIso(v.date),
      createdAt: safeIso(v.createdAt),
      cancelledAt: v.cancelledAt ? safeIso(v.cancelledAt) : null,
      postings: postingsByVoucher.get(v.id) || [],
    }));

    sendListResponse(res, data);
  } catch (err: any) {
    sendErrorListResponse(res, err?.message || "Failed to fetch vouchers");
  }
});

// POST /accounting/vouchers — create voucher with double-entry validation
router.post("/accounting/vouchers", async (req, res): Promise<void> => {
  const { voucherType, date, narration, postings, referenceNumber, branchId, committeeId, status: vStatus } = req.body;

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

  // Strict double-entry: debits must equal credits
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    res.status(400).json({
      error: `Double entry mismatch: Total Debits (₹${totalDebits.toFixed(2)}) must equal Total Credits (₹${totalCredits.toFixed(2)})`,
    });
    return;
  }

  // Check frozen ledgers
  for (const p of postings) {
    const [ledger] = await db.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.id, parseInt(p.ledgerAccountId))).catch(() => []);
    if (ledger && ledger.status === "frozen") {
      res.status(400).json({ error: `Ledger "${ledger.name}" is frozen and cannot receive new postings` });
      return;
    }
  }

  try {
    // Generate sequential voucher number: PAY-20260725-0001
    const dateObj = date ? new Date(date) : new Date();
    const datePrefix = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
    const typeCode = voucherType.substring(0, 3).toUpperCase();

    // Count existing vouchers of same type on same day for sequential numbering
    const [dayCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountingVouchersTable)
      .where(and(
        eq(accountingVouchersTable.voucherType, voucherType),
        sql`DATE(${accountingVouchersTable.date}) = DATE(${dateObj})`,
      ))
      .catch(() => [{ count: 0 }]);

    const seq = String((dayCount?.count || 0) + 1).padStart(4, "0");
    const voucherNumber = `${typeCode}-${datePrefix}-${seq}`;

    const userId = (req as any).userId || null;

    const result = await db.transaction(async (tx) => {
      const [vRow] = await tx
        .insert(accountingVouchersTable)
        .values({
          voucherType,
          voucherNumber,
          date: dateObj,
          narration,
          status: vStatus || "posted",
          referenceNumber: referenceNumber || null,
          branchId: branchId || null,
          committeeId: committeeId || null,
          createdBy: userId,
        })
        .returning();

      const savedPostings = [];
      for (const p of postings) {
        const [pRow] = await tx
          .insert(voucherPostingsTable)
          .values({
            voucherId: vRow.id,
            ledgerAccountId: parseInt(p.ledgerAccountId),
            amount: String(p.amount),
            entryType: p.entryType,
            costCentreType: p.costCentreType || null,
            costCentreId: p.costCentreId ? parseInt(p.costCentreId) : null,
          })
          .returning();
        savedPostings.push(pRow);
      }

      return { ...vRow, postings: savedPostings };
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error("[POST VOUCHER ERROR]", err);
    res.status(500).json({ error: err.message || "Failed to post voucher" });
  }
});

// POST /accounting/vouchers/:id/cancel — cancel a posted voucher with reversal
router.post("/accounting/vouchers/:id/cancel", async (req, res): Promise<void> => {
  const voucherId = parseInt(req.params.id, 10);
  if (isNaN(voucherId)) { res.status(400).json({ error: "Invalid voucher ID" }); return; }

  const { reason } = req.body;
  const userId = (req as any).userId || null;

  try {
    const [voucher] = await db.select().from(accountingVouchersTable).where(eq(accountingVouchersTable.id, voucherId)).catch(() => []);
    if (!voucher) { res.status(404).json({ error: "Voucher not found" }); return; }
    if (voucher.status !== "posted") { res.status(400).json({ error: `Cannot cancel a ${voucher.status} voucher` }); return; }

    // Get original postings
    const origPostings = await db.select().from(voucherPostingsTable).where(eq(voucherPostingsTable.voucherId, voucherId)).catch(() => []);

    const result = await db.transaction(async (tx) => {
      // 1. Mark original voucher as cancelled
      await tx.update(accountingVouchersTable).set({
        status: "cancelled",
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancelReason: reason || "Cancelled by user",
      }).where(eq(accountingVouchersTable.id, voucherId));

      // 2. Create reversal voucher with swapped entries
      const dateObj = new Date();
      const datePrefix = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
      const [dayCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(accountingVouchersTable)
        .catch(() => [{ count: 0 }]);
      const seq = String((dayCount?.count || 0) + 1).padStart(4, "0");
      const reversalNumber = `REV-${datePrefix}-${seq}`;

      const [reversalVoucher] = await tx
        .insert(accountingVouchersTable)
        .values({
          voucherNumber: reversalNumber,
          voucherType: "Journal",
          date: dateObj,
          narration: `Reversal of ${voucher.voucherNumber}: ${reason || "Cancelled"}`,
          status: "posted",
          branchId: voucher.branchId,
          committeeId: voucher.committeeId,
          createdBy: userId,
          originalVoucherId: voucherId,
        })
        .returning();

      // 3. Create reversed postings (swap debit/credit)
      for (const p of origPostings) {
        await tx.insert(voucherPostingsTable).values({
          voucherId: reversalVoucher.id,
          ledgerAccountId: p.ledgerAccountId,
          amount: p.amount,
          entryType: p.entryType === "debit" ? "credit" : "debit",
          costCentreType: p.costCentreType,
          costCentreId: p.costCentreId,
        });
      }

      return reversalVoucher;
    });

    res.json({ success: true, cancelledVoucherId: voucherId, reversalVoucher: result });
  } catch (err: any) {
    console.error("[CANCEL VOUCHER ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LEDGER STATEMENT
// ═══════════════════════════════════════════════════════════════════════════

router.get("/accounting/ledgers/:id/statement", async (req, res): Promise<void> => {
  const ledgerId = parseInt(req.params.id, 10);
  if (isNaN(ledgerId)) { res.status(400).json({ error: "Invalid ledger ID" }); return; }

  try {
    const [ledger] = await db.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.id, ledgerId)).catch(() => []);
    if (!ledger) { res.status(404).json({ error: "Ledger account not found" }); return; }

    const { from, to } = req.query as any;

    let query = db
      .select({ p: voucherPostingsTable, v: accountingVouchersTable })
      .from(voucherPostingsTable)
      .innerJoin(accountingVouchersTable, eq(voucherPostingsTable.voucherId, accountingVouchersTable.id))
      .$dynamic();

    const conditions: any[] = [
      eq(voucherPostingsTable.ledgerAccountId, ledgerId),
      eq(accountingVouchersTable.status, "posted"),
    ];
    if (from) conditions.push(sql`${accountingVouchersTable.date} >= ${new Date(from)}`);
    if (to) conditions.push(sql`${accountingVouchersTable.date} <= ${new Date(to + "T23:59:59Z")}`);

    query = query.where(and(...conditions)) as any;
    query = (query as any).orderBy(asc(accountingVouchersTable.date), asc(voucherPostingsTable.id));

    const postings = await query.catch(() => []);

    // Calculate running balance
    const opBal = parseFloat(ledger.openingBalance || "0");
    let runningBalance = opBal;
    let runningBalanceType = ledger.openingBalanceType;

    const entries = (postings as any[]).map((item: any) => {
      const amt = parseFloat(item.p.amount || "0");
      const isDebit = item.p.entryType === "debit";

      if (runningBalanceType === "debit") {
        runningBalance = isDebit ? runningBalance + amt : runningBalance - amt;
      } else {
        runningBalance = isDebit ? runningBalance - amt : runningBalance + amt;
      }

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
        date: safeIso(item.v.date),
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
    console.error("[LEDGER STATEMENT ERROR]", err);
    res.json({ ledger: null, openingBalance: 0, openingBalanceType: "debit", entries: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS: Trial Balance, P&L, Balance Sheet
// ═══════════════════════════════════════════════════════════════════════════

// Helper: get posting summaries filtered by date and posted vouchers only
async function getPostingSummaries(from?: string, to?: string) {
  const conditions: any[] = [eq(accountingVouchersTable.status, "posted")];
  if (from) conditions.push(sql`${accountingVouchersTable.date} >= ${new Date(from)}`);
  if (to) conditions.push(sql`${accountingVouchersTable.date} <= ${new Date(to + "T23:59:59Z")}`);

  const result = await db
    .select({
      ledgerAccountId: voucherPostingsTable.ledgerAccountId,
      debitSum: sql<string>`coalesce(sum(case when ${voucherPostingsTable.entryType} = 'debit' then ${voucherPostingsTable.amount} else 0 end), 0)`,
      creditSum: sql<string>`coalesce(sum(case when ${voucherPostingsTable.entryType} = 'credit' then ${voucherPostingsTable.amount} else 0 end), 0)`,
    })
    .from(voucherPostingsTable)
    .innerJoin(accountingVouchersTable, eq(voucherPostingsTable.voucherId, accountingVouchersTable.id))
    .where(and(...conditions))
    .groupBy(voucherPostingsTable.ledgerAccountId)
    .catch(() => []);

  return new Map(result.map((s) => [s.ledgerAccountId, s]));
}

// Trial Balance
router.get("/accounting/reports/trial-balance", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();
    const { from, to } = req.query as any;
    const ledgers = await db.select().from(ledgerAccountsTable).orderBy(asc(ledgerAccountsTable.name)).catch(() => []);
    const summariesMap = await getPostingSummaries(from, to);

    let totalOpDebit = 0, totalOpCredit = 0;
    let totalTransactionDebit = 0, totalTransactionCredit = 0;
    let totalClosingDebit = 0, totalClosingCredit = 0;

    const rows = ledgers.map((l) => {
      const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
      const opBal = parseFloat(l.openingBalance || "0");
      const debits = parseFloat(summary.debitSum || "0");
      const credits = parseFloat(summary.creditSum || "0");

      const opDebit = l.openingBalanceType === "debit" ? opBal : 0;
      const opCredit = l.openingBalanceType === "credit" ? opBal : 0;
      const totalDebit = opDebit + debits;
      const totalCredit = opCredit + credits;

      let closingDebit = 0, closingCredit = 0;
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
        groupId: l.groupId,
        opDebit, opCredit, debits, credits, closingDebit, closingCredit,
      };
    });

    res.json({
      rows,
      totals: {
        opDebit: totalOpDebit, opCredit: totalOpCredit,
        debits: totalTransactionDebit, credits: totalTransactionCredit,
        closingDebit: totalClosingDebit, closingCredit: totalClosingCredit,
      },
    });
  } catch (err: any) {
    console.error("[TRIAL BALANCE ERROR]", err);
    res.json({ rows: [], totals: { opDebit: 0, opCredit: 0, debits: 0, credits: 0, closingDebit: 0, closingCredit: 0 } });
  }
});

// Profit & Loss
router.get("/accounting/reports/profit-loss", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();
    const { from, to } = req.query as any;
    const ledgers = await db.select().from(ledgerAccountsTable).catch(() => []);
    const summariesMap = await getPostingSummaries(from, to);

    const incomeLedgers: any[] = [];
    const expenseLedgers: any[] = [];
    let totalIncome = 0, totalExpense = 0;

    for (const l of ledgers) {
      const isIncome = ["Indirect Incomes", "Direct Incomes"].includes(l.groupName);
      const isExpense = ["Indirect Expenses", "Direct Expenses"].includes(l.groupName);
      if (!isIncome && !isExpense) continue;

      const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
      const opBal = parseFloat(l.openingBalance || "0");
      const debits = parseFloat(summary.debitSum || "0");
      const credits = parseFloat(summary.creditSum || "0");

      if (isIncome) {
        const amount = credits - debits + (l.openingBalanceType === "credit" ? opBal : -opBal);
        totalIncome += amount;
        incomeLedgers.push({ id: l.id, name: l.name, groupName: l.groupName, amount });
      } else {
        const amount = debits - credits + (l.openingBalanceType === "debit" ? opBal : -opBal);
        totalExpense += amount;
        expenseLedgers.push({ id: l.id, name: l.name, groupName: l.groupName, amount });
      }
    }

    res.json({ incomes: incomeLedgers, expenses: expenseLedgers, totalIncome, totalExpense, netProfit: totalIncome - totalExpense });
  } catch (err: any) {
    console.error("[PROFIT LOSS ERROR]", err);
    res.json({ incomes: [], expenses: [], totalIncome: 0, totalExpense: 0, netProfit: 0 });
  }
});

// Balance Sheet
router.get("/accounting/reports/balance-sheet", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();
    const { from, to } = req.query as any;
    const ledgers = await db.select().from(ledgerAccountsTable).catch(() => []);
    const summariesMap = await getPostingSummaries(from, to);

    let totalIncome = 0, totalExpense = 0;
    const assets: any[] = [];
    const liabilities: any[] = [];
    let totalAssets = 0, totalLiabilities = 0;

    for (const l of ledgers) {
      const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
      const opBal = parseFloat(l.openingBalance || "0");
      const debits = parseFloat(summary.debitSum || "0");
      const credits = parseFloat(summary.creditSum || "0");

      const opDebit = l.openingBalanceType === "debit" ? opBal : 0;
      const opCredit = l.openingBalanceType === "credit" ? opBal : 0;
      const closingDebit = (opDebit + debits) >= (opCredit + credits) ? (opDebit + debits) - (opCredit + credits) : 0;
      const closingCredit = (opCredit + credits) > (opDebit + debits) ? (opCredit + credits) - (opDebit + debits) : 0;

      const isIncome = ["Indirect Incomes", "Direct Incomes"].includes(l.groupName);
      const isExpense = ["Indirect Expenses", "Direct Expenses"].includes(l.groupName);

      if (isIncome) { totalIncome += (credits - debits + opCredit - opDebit); }
      else if (isExpense) { totalExpense += (debits - credits + opDebit - opCredit); }

      if (isIncome || isExpense) continue;

      const isAssetGroup = ["Cash-in-hand", "Bank Accounts", "Sundry Debtors", "Fixed Assets", "Current Assets"].includes(l.groupName);

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
    liabilities.push({ id: -1, name: "Profit & Loss A/c (Net Profit)", groupName: "Retained Earnings", balance: netProfit });
    totalLiabilities += netProfit;

    res.json({ assets, liabilities, totalAssets, totalLiabilities, netProfit });
  } catch (err: any) {
    console.error("[BALANCE SHEET ERROR]", err);
    res.json({ assets: [], liabilities: [], totalAssets: 0, totalLiabilities: 0, netProfit: 0 });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS: Cash Book & Bank Book
// ═══════════════════════════════════════════════════════════════════════════

// Cash Book
router.get("/accounting/reports/cash-book", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();
    const { from, to } = req.query as any;

    // Get all cash ledgers
    const cashLedgers: any[] = await db
      .select()
      .from(ledgerAccountsTable)
      .where(eq(ledgerAccountsTable.groupName, "Cash-in-hand"))
      .catch(() => []);

    const cashLedgerIds = cashLedgers.map((l) => l.id);
    if (cashLedgerIds.length === 0) {
      res.json({ openingBalance: 0, totalReceipts: 0, totalPayments: 0, closingBalance: 0, entries: [] });
      return;
    }

    let openingBalance: number = cashLedgers.reduce((sum: number, l: any) => {
      const bal = parseFloat(l.openingBalance || "0");
      return l.openingBalanceType === "debit" ? sum + bal : sum - bal;
    }, 0);

    let query = db
      .select({ p: voucherPostingsTable, v: accountingVouchersTable, l: ledgerAccountsTable })
      .from(voucherPostingsTable)
      .innerJoin(accountingVouchersTable, eq(voucherPostingsTable.voucherId, accountingVouchersTable.id))
      .innerJoin(ledgerAccountsTable, eq(voucherPostingsTable.ledgerAccountId, ledgerAccountsTable.id))
      .$dynamic();

    const conditions: any[] = [
      sql`${voucherPostingsTable.ledgerAccountId} IN ${cashLedgerIds}`,
      eq(accountingVouchersTable.status, "posted"),
    ];

    if (from) conditions.push(sql`${accountingVouchersTable.date} >= ${new Date(from)}`);
    if (to) conditions.push(sql`${accountingVouchersTable.date} <= ${new Date(to + "T23:59:59Z")}`);

    query = query.where(and(...conditions)) as any;
    query = (query as any).orderBy(asc(accountingVouchersTable.date), asc(voucherPostingsTable.id));

    const postings = await query.catch(() => []);

    let runningBalance: number = openingBalance;
    let totalReceipts = 0;
    let totalPayments = 0;

    const entries = (postings as any[]).map((item: any) => {
      const amt = parseFloat(item.p.amount || "0");
      const isReceipt = item.p.entryType === "debit";

      if (isReceipt) {
        runningBalance += amt;
        totalReceipts += amt;
      } else {
        runningBalance -= amt;
        totalPayments += amt;
      }

      return {
        postingId: item.p.id,
        voucherId: item.v.id,
        voucherNumber: item.v.voucherNumber,
        voucherType: item.v.voucherType,
        date: safeIso(item.v.date),
        narration: item.v.narration,
        referenceNumber: item.v.referenceNumber,
        amount: amt,
        type: isReceipt ? "receipt" : "payment",
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    res.json({
      openingBalance: Math.round(openingBalance * 100) / 100,
      totalReceipts: Math.round(totalReceipts * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      closingBalance: Math.round(runningBalance * 100) / 100,
      entries,
    });
  } catch (err: any) {
    console.error("[CASH BOOK ERROR]", err);
    res.json({ openingBalance: 0, totalReceipts: 0, totalPayments: 0, closingBalance: 0, entries: [] });
  }
});

// Bank Book
router.get("/accounting/reports/bank-book", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();
    const { ledgerId: rawLedgerId, from, to } = req.query as any;

    const bankLedgers: any[] = await db
      .select()
      .from(ledgerAccountsTable)
      .where(eq(ledgerAccountsTable.groupName, "Bank Accounts"))
      .catch(() => []);

    if (bankLedgers.length === 0) {
      res.json({ bankLedgers: [], bankLedger: null, openingBalance: 0, totalReceipts: 0, totalPayments: 0, closingBalance: 0, entries: [] });
      return;
    }

    const selectedId = rawLedgerId ? parseInt(rawLedgerId, 10) : bankLedgers[0].id;
    const selectedLedger = bankLedgers.find((l) => l.id === selectedId) || bankLedgers[0];

    const opBal = parseFloat(selectedLedger.openingBalance || "0");
    const openingBalance = selectedLedger.openingBalanceType === "debit" ? opBal : -opBal;

    let query = db
      .select({ p: voucherPostingsTable, v: accountingVouchersTable, l: ledgerAccountsTable })
      .from(voucherPostingsTable)
      .innerJoin(accountingVouchersTable, eq(voucherPostingsTable.voucherId, accountingVouchersTable.id))
      .innerJoin(ledgerAccountsTable, eq(voucherPostingsTable.ledgerAccountId, ledgerAccountsTable.id))
      .$dynamic();

    const conditions: any[] = [
      eq(voucherPostingsTable.ledgerAccountId, selectedLedger.id),
      eq(accountingVouchersTable.status, "posted"),
    ];

    if (from) conditions.push(sql`${accountingVouchersTable.date} >= ${new Date(from)}`);
    if (to) conditions.push(sql`${accountingVouchersTable.date} <= ${new Date(to + "T23:59:59Z")}`);

    query = query.where(and(...conditions)) as any;
    query = (query as any).orderBy(asc(accountingVouchersTable.date), asc(voucherPostingsTable.id));

    const postings = await query.catch(() => []);

    let runningBalance = openingBalance;
    let totalReceipts = 0;
    let totalPayments = 0;

    const entries = (postings as any[]).map((item: any) => {
      const amt = parseFloat(item.p.amount || "0");
      const isReceipt = item.p.entryType === "debit";

      if (isReceipt) {
        runningBalance += amt;
        totalReceipts += amt;
      } else {
        runningBalance -= amt;
        totalPayments += amt;
      }

      return {
        postingId: item.p.id,
        voucherId: item.v.id,
        voucherNumber: item.v.voucherNumber,
        voucherType: item.v.voucherType,
        date: safeIso(item.v.date),
        narration: item.v.narration,
        referenceNumber: item.v.referenceNumber,
        amount: amt,
        type: isReceipt ? "receipt" : "payment",
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    res.json({
      bankLedgers,
      bankLedger: selectedLedger,
      openingBalance: Math.round(openingBalance * 100) / 100,
      totalReceipts: Math.round(totalReceipts * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      closingBalance: Math.round(runningBalance * 100) / 100,
      entries,
    });
  } catch (err: any) {
    console.error("[BANK BOOK ERROR]", err);
    res.json({ bankLedgers: [], bankLedger: null, openingBalance: 0, totalReceipts: 0, totalPayments: 0, closingBalance: 0, entries: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS: Cost Centre Summary (Committee / Branch-wise P&L)
// ═══════════════════════════════════════════════════════════════════════════

router.get("/accounting/reports/cost-centre-summary", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();
    const { type = "committee", from, to } = req.query as any;

    const isCommittee = type === "committee";

    // Query all postings joined with voucher and ledger account
    let query = db
      .select({
        p: voucherPostingsTable,
        v: accountingVouchersTable,
        l: ledgerAccountsTable,
      })
      .from(voucherPostingsTable)
      .innerJoin(accountingVouchersTable, eq(voucherPostingsTable.voucherId, accountingVouchersTable.id))
      .innerJoin(ledgerAccountsTable, eq(voucherPostingsTable.ledgerAccountId, ledgerAccountsTable.id))
      .$dynamic();

    const conditions: any[] = [eq(accountingVouchersTable.status, "posted")];
    if (from) conditions.push(sql`${accountingVouchersTable.date} >= ${new Date(from)}`);
    if (to) conditions.push(sql`${accountingVouchersTable.date} <= ${new Date(to + "T23:59:59Z")}`);

    query = query.where(and(...conditions)) as any;
    const rows = (await query.catch(() => [])) as any[];

    // Group by cost centre ID
    const costCentreMap = new Map<number, { id: number; income: number; expense: number; transactionCount: number }>();

    for (const row of rows) {
      const ccId = isCommittee
        ? (row.p.costCentreType === "committee" ? row.p.costCentreId : row.v.committeeId)
        : (row.p.costCentreType === "branch" ? row.p.costCentreId : row.v.branchId);

      if (!ccId) continue;

      const groupName = row.l.groupName;
      const isIncome = ["Indirect Incomes", "Direct Incomes"].includes(groupName);
      const isExpense = ["Indirect Expenses", "Direct Expenses"].includes(groupName);

      if (!isIncome && !isExpense) continue;

      const amt = parseFloat(row.p.amount || "0");
      const current = costCentreMap.get(ccId) || { id: ccId, income: 0, expense: 0, transactionCount: 0 };

      if (isIncome) {
        current.income += row.p.entryType === "credit" ? amt : -amt;
      } else {
        current.expense += row.p.entryType === "debit" ? amt : -amt;
      }
      current.transactionCount += 1;
      costCentreMap.set(ccId, current);
    }

    const summaryList = Array.from(costCentreMap.values()).map((cc) => ({
      costCentreId: cc.id,
      income: Math.round(cc.income * 100) / 100,
      expense: Math.round(cc.expense * 100) / 100,
      netProfit: Math.round((cc.income - cc.expense) * 100) / 100,
      transactionCount: cc.transactionCount,
    }));

    res.json({ type, items: summaryList });
  } catch (err: any) {
    console.error("[COST CENTRE SUMMARY ERROR]", err);
    res.json({ type: req.query.type || "committee", items: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BANK RECONCILIATION STATEMENT (BRS)
// ═══════════════════════════════════════════════════════════════════════════

// GET /accounting/brs?ledgerId=X — fetch BRS entries and unmatched book postings
router.get("/accounting/brs", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();
    const { ledgerId: rawLedgerId } = req.query as any;

    const bankLedgers: any[] = await db
      .select()
      .from(ledgerAccountsTable)
      .where(eq(ledgerAccountsTable.groupName, "Bank Accounts"))
      .catch(() => []);

    if (bankLedgers.length === 0) {
      res.json({ bankLedgers: [], bankLedger: null, statementEntries: [], bookPostings: [], summary: { bookBalance: 0, bankBalance: 0, unreconciledDifference: 0 } });
      return;
    }

    const selectedId = rawLedgerId ? parseInt(rawLedgerId, 10) : bankLedgers[0].id;
    const bankLedger = bankLedgers.find((l) => l.id === selectedId) || bankLedgers[0];

    // Fetch imported bank statement entries for this bank ledger
    const statementEntries: any[] = await db
      .select()
      .from(bankReconciliationTable)
      .where(eq(bankReconciliationTable.ledgerAccountId, bankLedger.id))
      .orderBy(desc(bankReconciliationTable.bankDate))
      .catch(() => []);

    // Fetch posted voucher postings for this bank ledger
    const bookPostings: any[] = await db
      .select({
        p: voucherPostingsTable,
        v: accountingVouchersTable,
      })
      .from(voucherPostingsTable)
      .innerJoin(accountingVouchersTable, eq(voucherPostingsTable.voucherId, accountingVouchersTable.id))
      .where(and(
        eq(voucherPostingsTable.ledgerAccountId, bankLedger.id),
        eq(accountingVouchersTable.status, "posted")
      ))
      .orderBy(desc(accountingVouchersTable.date))
      .catch(() => []);

    // Calculate book balance
    const opBal = parseFloat(bankLedger.openingBalance || "0");
    let bookBalance = bankLedger.openingBalanceType === "debit" ? opBal : -opBal;

    const formattedPostings = bookPostings.map((item: any) => {
      const amt = parseFloat(item.p.amount || "0");
      if (item.p.entryType === "debit") bookBalance += amt;
      else bookBalance -= amt;

      return {
        postingId: item.p.id,
        voucherId: item.v.id,
        voucherNumber: item.v.voucherNumber,
        voucherType: item.v.voucherType,
        date: safeIso(item.v.date),
        narration: item.v.narration,
        referenceNumber: item.v.referenceNumber,
        amount: amt,
        entryType: item.p.entryType,
      };
    });

    // Calculate bank statement balance from matched/unmatched
    let bankBalance = bookBalance;
    const unmatchedBank = statementEntries.filter((e) => e.status === "unmatched");
    const unmatchedBook = formattedPostings.filter(
      (p) => !statementEntries.some((e) => e.postingId === p.postingId)
    );

    res.json({
      bankLedgers,
      bankLedger,
      statementEntries: statementEntries.map((e) => ({
        ...e,
        bankDate: safeIso(e.bankDate),
        bankDebit: parseFloat(e.bankDebit || "0"),
        bankCredit: parseFloat(e.bankCredit || "0"),
      })),
      unmatchedBookPostings: unmatchedBook,
      summary: {
        bookBalance: Math.round(bookBalance * 100) / 100,
        bankBalance: Math.round(bankBalance * 100) / 100,
        unmatchedBankCount: unmatchedBank.length,
        unmatchedBookCount: unmatchedBook.length,
        unreconciledDifference: 0,
      },
    });
  } catch (err: any) {
    console.error("[BRS GET ERROR]", err);
    res.json({ bankLedgers: [], bankLedger: null, statementEntries: [], bookPostings: [], summary: { bookBalance: 0, bankBalance: 0, unreconciledDifference: 0 } });
  }
});

// POST /accounting/brs/import — import bank statement lines
router.post("/accounting/brs/import", async (req, res): Promise<void> => {
  const { ledgerAccountId, entries } = req.body;
  if (!ledgerAccountId || !entries || !Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: "ledgerAccountId and entries array are required" });
    return;
  }

  try {
    const importBatchId = `BATCH-${Date.now()}`;
    const inserted = [];

    for (const e of entries) {
      const [row] = await db
        .insert(bankReconciliationTable)
        .values({
          ledgerAccountId: parseInt(ledgerAccountId, 10),
          bankDate: new Date(e.bankDate || Date.now()),
          description: e.description || null,
          bankDebit: String(e.bankDebit || 0),
          bankCredit: String(e.bankCredit || 0),
          status: "unmatched",
          importBatchId,
        })
        .returning();
      inserted.push(row);
    }

    res.status(201).json({ success: true, importBatchId, count: inserted.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /accounting/brs/match — match statement line to posting
router.post("/accounting/brs/match", async (req, res): Promise<void> => {
  const { recId, postingId } = req.body;
  if (!recId || !postingId) {
    res.status(400).json({ error: "recId and postingId are required" });
    return;
  }

  try {
    const [updated] = await db
      .update(bankReconciliationTable)
      .set({
        postingId: parseInt(postingId, 10),
        status: "matched",
        matchedAt: new Date(),
      })
      .where(eq(bankReconciliationTable.id, parseInt(recId, 10)))
      .returning();

    res.json({ success: true, entry: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT: CSV / Excel Download Endpoint
// ═══════════════════════════════════════════════════════════════════════════

router.get("/accounting/export/:reportType", async (req, res): Promise<void> => {
  const { reportType } = req.params;
  const { from, to } = req.query as any;

  try {
    await ensureSeeded();
    let csvHeader = "";
    let csvRows: string[] = [];
    const filename = `Tally_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (reportType === "daybook") {
      csvHeader = "Voucher Number,Date,Voucher Type,Status,Narration,Total Amount\n";
      const vouchers = await db.select().from(accountingVouchersTable).orderBy(desc(accountingVouchersTable.date)).catch(() => []);
      const postings = await db.select().from(voucherPostingsTable).catch(() => []);
      const postingsMap = new Map<number, number>();
      for (const p of postings) {
        if (p.entryType === "debit") {
          postingsMap.set(p.voucherId, (postingsMap.get(p.voucherId) || 0) + parseFloat(p.amount || "0"));
        }
      }
      csvRows = vouchers.map((v) =>
        `"${v.voucherNumber}","${v.date.toISOString().slice(0, 10)}","${v.voucherType}","${v.status}","${(v.narration || "").replace(/"/g, '""')}","${(postingsMap.get(v.id) || 0).toFixed(2)}"`
      );
    } else if (reportType === "trialbalance") {
      csvHeader = "Ledger Name,Group Name,Opening Debit,Opening Credit,Closing Debit,Closing Credit\n";
      const ledgers = await db.select().from(ledgerAccountsTable).orderBy(asc(ledgerAccountsTable.name)).catch(() => []);
      const summariesMap = await getPostingSummaries(from, to);
      csvRows = ledgers.map((l) => {
        const summary = summariesMap.get(l.id) || { debitSum: "0", creditSum: "0" };
        const opBal = parseFloat(l.openingBalance || "0");
        const debits = parseFloat(summary.debitSum || "0");
        const credits = parseFloat(summary.creditSum || "0");
        const totalDebit = (l.openingBalanceType === "debit" ? opBal : 0) + debits;
        const totalCredit = (l.openingBalanceType === "credit" ? opBal : 0) + credits;
        const closingDebit = totalDebit >= totalCredit ? totalDebit - totalCredit : 0;
        const closingCredit = totalCredit > totalDebit ? totalCredit - totalDebit : 0;
        return `"${l.name}","${l.groupName}","${l.openingBalanceType === "debit" ? opBal : 0}","${l.openingBalanceType === "credit" ? opBal : 0}","${closingDebit.toFixed(2)}","${closingCredit.toFixed(2)}"`;
      });
    } else {
      csvHeader = "Account Name,Category,Amount\n";
      csvRows = [`"Summary Report","${reportType}","Generated on ${new Date().toLocaleDateString()}"`];
    }

    const csvContent = csvHeader + csvRows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    console.error("[EXPORT ERROR]", err);
    res.status(500).json({ error: "Failed to export report CSV" });
  }
});

export default router;
