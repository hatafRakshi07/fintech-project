import { pgTable, serial, text, timestamp, numeric, integer, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Legacy Ledger (simple credit/debit log — kept for backward compatibility)
// ---------------------------------------------------------------------------
export const ledgerTable = pgTable("ledger", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "credit" | "debit"
  category: text("category").notNull(), // "cash" | "online" | "gift_distribution" | "loan" | "office_expenses"
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  runningBalance: numeric("running_balance", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLedgerSchema = createInsertSchema(ledgerTable).omit({ id: true, createdAt: true }) as any;
export type InsertLedger = z.infer<typeof insertLedgerSchema>;
export type Ledger = typeof ledgerTable.$inferSelect;

// ---------------------------------------------------------------------------
// Ledger Groups — Tally-style hierarchical group tree
// ---------------------------------------------------------------------------
export const ledgerGroupsTable = pgTable("ledger_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  /** Parent group ID for sub-groups (null = root group) */
  parentId: integer("parent_id"),
  /** Accounting nature: assets, liabilities, income, expense */
  nature: text("nature").notNull(), // "assets" | "liabilities" | "income" | "expense"
  /** System groups cannot be deleted or renamed */
  isSystemGroup: boolean("is_system_group").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_ledger_groups_parent_id").on(t.parentId),
]);

// ---------------------------------------------------------------------------
// Ledger Accounts — individual accounts under groups
// ---------------------------------------------------------------------------
export const ledgerAccountsTable = pgTable("ledger_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  /** FK reference to ledger_groups.id (preferred over groupName) */
  groupId: integer("group_id"),
  /** Legacy text group name — kept for backward compat during migration */
  groupName: text("group_name").notNull(),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  openingBalanceType: text("opening_balance_type").notNull().default("debit"), // "debit" | "credit"
  description: text("description"),
  /** Branch-specific sub-ledger */
  branchId: integer("branch_id"),
  /** Committee-specific sub-ledger */
  committeeId: integer("committee_id"),
  /** System ledgers (Cash A/c, Capital A/c) cannot be deleted */
  isSystemLedger: boolean("is_system_ledger").notNull().default(false),
  /** 'active' | 'frozen' — frozen ledgers cannot receive new postings */
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_ledger_accounts_group_id").on(t.groupId),
  index("idx_ledger_accounts_branch_id").on(t.branchId),
  index("idx_ledger_accounts_committee_id").on(t.committeeId),
]);

// ---------------------------------------------------------------------------
// Accounting Vouchers — Tally-style voucher header
// ---------------------------------------------------------------------------
export const accountingVouchersTable = pgTable("accounting_vouchers", {
  id: serial("id").primaryKey(),
  voucherNumber: text("voucher_number").notNull().unique(),
  voucherType: text("voucher_type").notNull(), // "Receipt", "Payment", "Journal", "Contra"
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  narration: text("narration"),
  /** Voucher lifecycle: draft → posted → cancelled */
  status: text("status").notNull().default("posted"), // "draft" | "posted" | "cancelled"
  /** External reference: cheque no, UTR, receipt ref */
  referenceNumber: text("reference_number"),
  /** Cost centre tagging */
  branchId: integer("branch_id"),
  committeeId: integer("committee_id"),
  /** Audit trail */
  createdBy: integer("created_by"),
  cancelledBy: integer("cancelled_by"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  /** For reversal vouchers — points to the original */
  originalVoucherId: integer("original_voucher_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_accounting_vouchers_date").on(t.date),
  index("idx_accounting_vouchers_type").on(t.voucherType),
  index("idx_accounting_vouchers_status").on(t.status),
  index("idx_accounting_vouchers_branch_id").on(t.branchId),
]);

// ---------------------------------------------------------------------------
// Voucher Postings — individual debit/credit journal lines
// ---------------------------------------------------------------------------
export const voucherPostingsTable = pgTable("voucher_postings", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull(),
  ledgerAccountId: integer("ledger_account_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  entryType: text("entry_type").notNull(), // "debit" | "credit"
  /** Cost centre tagging per posting line */
  costCentreType: text("cost_centre_type"), // "branch" | "committee" | null
  costCentreId: integer("cost_centre_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_voucher_postings_voucher_id").on(t.voucherId),
  index("idx_voucher_postings_ledger_account_id").on(t.ledgerAccountId),
  index("idx_voucher_postings_cost_centre").on(t.costCentreType, t.costCentreId),
]);

// ---------------------------------------------------------------------------
// Bank Reconciliation — BRS table for bank statement import & matching
// ---------------------------------------------------------------------------
export const bankReconciliationTable = pgTable("bank_reconciliation", {
  id: serial("id").primaryKey(),
  ledgerAccountId: integer("ledger_account_id").notNull(),
  postingId: integer("posting_id"),
  bankDate: timestamp("bank_date", { withTimezone: true }).notNull(),
  description: text("description"),
  bankDebit: numeric("bank_debit", { precision: 12, scale: 2 }).notNull().default("0.00"),
  bankCredit: numeric("bank_credit", { precision: 12, scale: 2 }).notNull().default("0.00"),
  status: text("status").notNull().default("unmatched"), // "unmatched" | "matched"
  matchedAt: timestamp("matched_at", { withTimezone: true }),
  importBatchId: text("import_batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_bank_rec_ledger_id").on(t.ledgerAccountId),
  index("idx_bank_rec_posting_id").on(t.postingId),
  index("idx_bank_rec_status").on(t.status),
]);

// ---------------------------------------------------------------------------
// Zod Insert Schemas & Type Exports
// ---------------------------------------------------------------------------
export const insertLedgerGroupSchema = createInsertSchema(ledgerGroupsTable).omit({ id: true, createdAt: true }) as any;
export const insertLedgerAccountSchema = createInsertSchema(ledgerAccountsTable).omit({ id: true, createdAt: true }) as any;
export const insertAccountingVoucherSchema = createInsertSchema(accountingVouchersTable).omit({ id: true, createdAt: true }) as any;
export const insertVoucherPostingSchema = createInsertSchema(voucherPostingsTable).omit({ id: true, createdAt: true }) as any;
export const insertBankReconciliationSchema = createInsertSchema(bankReconciliationTable).omit({ id: true, createdAt: true }) as any;

export type LedgerGroup = typeof ledgerGroupsTable.$inferSelect;
export type InsertLedgerGroup = z.infer<typeof insertLedgerGroupSchema>;
export type LedgerAccount = typeof ledgerAccountsTable.$inferSelect;
export type AccountingVoucher = typeof accountingVouchersTable.$inferSelect;
export type VoucherPosting = typeof voucherPostingsTable.$inferSelect;
export type BankReconciliation = typeof bankReconciliationTable.$inferSelect;
