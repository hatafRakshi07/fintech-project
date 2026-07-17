import { pgTable, serial, text, integer, timestamp, pgEnum, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const loanInterestTypeEnum = pgEnum("loan_interest_type", ["flat", "reducing"]);
export const loanStatusEnum = pgEnum("loan_status", ["pending", "approved", "active", "closed", "rejected", "overdue"]);

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  principalAmount: numeric("principal_amount", { precision: 12, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  interestType: loanInterestTypeEnum("interest_type").notNull().default("flat"),
  tenure: integer("tenure").notNull(), // months
  emiAmount: numeric("emi_amount", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  monthlyInterest: numeric("monthly_interest", { precision: 12, scale: 2 }).default("0"),
  penalty: numeric("penalty", { precision: 12, scale: 2 }).default("0"),
  outstandingAmount: numeric("outstanding_amount", { precision: 12, scale: 2 }),
  status: loanStatusEnum("status").notNull().default("pending"),
  branchId: integer("branch_id").notNull(),
  purpose: text("purpose"),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  dueDate: date("due_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loansTable.$inferSelect;
