import { pgTable, serial, text, integer, timestamp, pgEnum, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const committeeTypeEnum = pgEnum("committee_type", ["daily", "weekly", "monthly", "festival", "special"]);
export const committeeStatusEnum = pgEnum("committee_status", ["active", "completed", "cancelled"]);

export const committeesTable = pgTable("committees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: committeeTypeEnum("type").notNull().default("monthly"),
  installmentAmount: numeric("installment_amount", { precision: 12, scale: 2 }).notNull(),
  memberLimit: integer("member_limit").notNull(),
  drawDate: date("draw_date", { mode: "string" }),
  duration: integer("duration"),
  status: committeeStatusEnum("status").notNull().default("active"),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const committeeMembersTable = pgTable("committee_members", {
  id: serial("id").primaryKey(),
  committeeId: integer("committee_id").notNull(),
  customerId: integer("customer_id").notNull(),
  tokenNumber: text("token_number").notNull(),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommitteeSchema = createInsertSchema(committeesTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export type InsertCommittee = z.infer<typeof insertCommitteeSchema>;
export type Committee = typeof committeesTable.$inferSelect;
export type CommitteeMember = typeof committeeMembersTable.$inferSelect;
