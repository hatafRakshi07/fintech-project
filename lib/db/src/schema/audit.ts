import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Immutable audit log for tracking all mutations to financial records.
 * Rows in this table should NEVER be updated or deleted.
 */
export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  /** The database table that was modified (e.g. "collections", "ledger", "loans") */
  tableName: text("table_name").notNull(),
  /** The ID of the record that was modified */
  recordId: integer("record_id").notNull(),
  /** The type of mutation: "INSERT", "UPDATE", or "DELETE" */
  action: text("action").notNull(), // "INSERT" | "UPDATE" | "DELETE"
  /** The user ID who performed the action (from req.userId) */
  performedBy: integer("performed_by").notNull(),
  /** Snapshot of the old values before the change (null for INSERTs) */
  oldValues: jsonb("old_values"),
  /** Snapshot of the new values after the change (null for DELETEs) */
  newValues: jsonb("new_values"),
  /** Optional description of why the change was made */
  reason: text("reason"),
  /** IP address of the request */
  ipAddress: text("ip_address"),
  /** Timestamp — immutable, set on insert */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogTable).omit({ id: true, createdAt: true }) as any;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogTable.$inferSelect;
