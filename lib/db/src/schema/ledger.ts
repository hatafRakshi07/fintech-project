import { pgTable, serial, text, timestamp, numeric, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// New Tally-style Accounting Ledgers
export const ledgerAccountsTable = pgTable("ledger_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  groupName: text("group_name").notNull(), // e.g., "Cash-in-hand", "Bank Accounts", "Indirect Expenses", "Indirect Incomes", "Capital Account", "Loans & Liabilities", "Sundry Debtors", "Sundry Creditors"
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  openingBalanceType: text("opening_balance_type").notNull().default("debit"), // "debit" | "credit"
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// New Tally-style Accounting Vouchers
export const accountingVouchersTable = pgTable("accounting_vouchers", {
  id: serial("id").primaryKey(),
  voucherNumber: text("voucher_number").notNull().unique(),
  voucherType: text("voucher_type").notNull(), // "Receipt", "Payment", "Journal", "Contra", "Sales", "Purchase"
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  narration: text("narration"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// New Tally-style Voucher Postings (Journal Entries)
export const voucherPostingsTable = pgTable("voucher_postings", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull(),
  ledgerAccountId: integer("ledger_account_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  entryType: text("entry_type").notNull(), // "debit" | "credit"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_voucher_postings_voucher_id").on(t.voucherId),
  index("idx_voucher_postings_ledger_account_id").on(t.ledgerAccountId),
]);

export const insertLedgerAccountSchema = createInsertSchema(ledgerAccountsTable).omit({ id: true, createdAt: true }) as any;
export const insertAccountingVoucherSchema = createInsertSchema(accountingVouchersTable).omit({ id: true, createdAt: true }) as any;
export const insertVoucherPostingSchema = createInsertSchema(voucherPostingsTable).omit({ id: true, createdAt: true }) as any;

export type LedgerAccount = typeof ledgerAccountsTable.$inferSelect;
export type AccountingVoucher = typeof accountingVouchersTable.$inferSelect;
export type VoucherPosting = typeof voucherPostingsTable.$inferSelect;

