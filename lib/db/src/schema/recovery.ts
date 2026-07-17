import { pgTable, serial, text, integer, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const recoveryStatusEnum = pgEnum("recovery_status", [
  "pending",
  "in_progress",
  "resolved",
  "escalated",
  "written_off",
]);

export const recoveryPriorityEnum = pgEnum("recovery_priority", ["low", "medium", "high", "critical"]);

export const recoveryTasksTable = pgTable("recovery_tasks", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  collectionId: integer("collection_id"), // the overdue collection/installment
  loanId: integer("loan_id"), // if related to a loan
  assignedCollectorId: integer("assigned_collector_id"),
  status: recoveryStatusEnum("status").notNull().default("pending"),
  priority: recoveryPriorityEnum("priority").notNull().default("medium"),
  dueDate: date("due_date", { mode: "string" }),
  overdueAmount: text("overdue_amount"),
  notes: text("notes"),
  reason: text("reason"),
  reply: text("reply"),
  lastContactDate: date("last_contact_date", { mode: "string" }),
  nextFollowUpDate: date("next_follow_up_date", { mode: "string" }),
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const recoveryCallLogsTable = pgTable("recovery_call_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  customerId: integer("customer_id").notNull(),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  outcome: text("outcome"), // "answered", "no_answer", "callback_promised", etc.
  notes: text("notes"),
  nextAction: text("next_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecoveryTaskSchema = createInsertSchema(recoveryTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRecoveryCallLogSchema = createInsertSchema(recoveryCallLogsTable).omit({ id: true, createdAt: true });

export type RecoveryTask = typeof recoveryTasksTable.$inferSelect;
export type RecoveryCallLog = typeof recoveryCallLogsTable.$inferSelect;
export type InsertRecoveryTask = z.infer<typeof insertRecoveryTaskSchema>;
export type InsertRecoveryCallLog = z.infer<typeof insertRecoveryCallLogSchema>;
