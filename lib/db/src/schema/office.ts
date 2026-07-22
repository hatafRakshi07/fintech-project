import { pgTable, serial, text, integer, timestamp, pgEnum, date, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Office Diary — daily log entries
// ---------------------------------------------------------------------------

export const officeDiaryTable = pgTable("office_diary", {
  id: serial("id").primaryKey(),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"), // "general", "meeting", "event", "note"
  authorUserId: integer("author_user_id").notNull(),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Office Tasks
// ---------------------------------------------------------------------------

export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "done", "cancelled"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high"]);

export const officeTasksTable = pgTable("office_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedToUserId: integer("assigned_to_user_id"),
  createdByUserId: integer("created_by_user_id").notNull(),
  dueDate: date("due_date", { mode: "string" }),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  branchId: integer("branch_id").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Complaints / Help Desk
// ---------------------------------------------------------------------------

export const complaintStatusEnum = pgEnum("complaint_status", ["open", "in_review", "resolved", "closed"]);

export const complaintsTable = pgTable("complaints", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category"), // "payment", "service", "staff", "other"
  status: complaintStatusEnum("status").notNull().default("open"),
  assignedToUserId: integer("assigned_to_user_id"),
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Donation Register
// ---------------------------------------------------------------------------

export const donationsTable = pgTable("donations", {
  id: serial("id").primaryKey(),
  donorName: text("donor_name").notNull(),
  customerId: integer("customer_id"), // optional — may be a non-customer donor
  amount: text("amount").notNull(), // store as text to match numeric pattern
  purpose: text("purpose"),
  donationDate: date("donation_date", { mode: "string" }).notNull(),
  receiptNumber: text("receipt_number"),
  notes: text("notes"),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const officeExpensesTable = pgTable("office_expenses", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // "Office Rent", "Electricity Bill", or custom manually entered
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: date("expense_date", { mode: "string" }).notNull(),
  description: text("description"),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOfficeDiarySchema = createInsertSchema(officeDiaryTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export const insertOfficeTaskSchema = createInsertSchema(officeTasksTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export const insertComplaintSchema = createInsertSchema(complaintsTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export const insertDonationSchema = createInsertSchema(donationsTable).omit({ id: true, createdAt: true }) as any;
export const insertOfficeExpenseSchema = createInsertSchema(officeExpensesTable).omit({ id: true, createdAt: true }) as any;

export type OfficeDiary = typeof officeDiaryTable.$inferSelect;
export type OfficeTask = typeof officeTasksTable.$inferSelect;
export type Complaint = typeof complaintsTable.$inferSelect;
export type Donation = typeof donationsTable.$inferSelect;
export type OfficeExpense = typeof officeExpensesTable.$inferSelect;

export type InsertOfficeDiary = z.infer<typeof insertOfficeDiarySchema>;
export type InsertOfficeTask = z.infer<typeof insertOfficeTaskSchema>;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type InsertOfficeExpense = z.infer<typeof insertOfficeExpenseSchema>;
