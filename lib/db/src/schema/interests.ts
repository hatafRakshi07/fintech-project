import { pgTable, serial, text, integer, timestamp, pgEnum, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Interest Accounts — customers who keep savings that earn monthly interest
// ---------------------------------------------------------------------------

export const interestAccountStatusEnum = pgEnum("interest_account_status", ["active", "closed", "paused"]);

export const interestAccountsTable = pgTable("interest_accounts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  principalAmount: numeric("principal_amount", { precision: 12, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(), // % per month
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  totalInterestPaid: numeric("total_interest_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  pendingInterest: numeric("pending_interest", { precision: 12, scale: 2 }).notNull().default("0"),
  monthlyInterest: numeric("monthly_interest", { precision: 12, scale: 2 }).default("0"),
  outstandingAmount: numeric("outstanding_amount", { precision: 12, scale: 2 }),
  reminderStatus: text("reminder_status"),
  status: interestAccountStatusEnum("status").notNull().default("active"),
  branchId: integer("branch_id").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const interestTransactionTypeEnum = pgEnum("interest_transaction_type", ["credit", "debit", "adjustment"]);

export const interestTransactionsTable = pgTable("interest_transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  customerId: integer("customer_id").notNull(),
  type: interestTransactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  paymentDate: date("payment_date", { mode: "string" }),
  receiptNumber: text("receipt_number"),
  notes: text("notes"),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInterestAccountSchema = createInsertSchema(interestAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInterestTransactionSchema = createInsertSchema(interestTransactionsTable).omit({ id: true, createdAt: true });

export type InterestAccount = typeof interestAccountsTable.$inferSelect;
export type InterestTransaction = typeof interestTransactionsTable.$inferSelect;
export type InsertInterestAccount = z.infer<typeof insertInterestAccountSchema>;
export type InsertInterestTransaction = z.infer<typeof insertInterestTransactionSchema>;
