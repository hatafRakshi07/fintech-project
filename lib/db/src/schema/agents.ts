import { pgTable, serial, text, integer, timestamp, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const agentStatusEnum = pgEnum("agent_status", ["active", "inactive", "suspended"]);

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  agentCode: text("agent_code").notNull().unique(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  email: text("email"),
  branchId: integer("branch_id").notNull(),
  commissionRate: numeric("commission_rate").notNull().default("2.5"), // Percentage e.g. 2.5%
  status: agentStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export type InsertAgent = typeof agentsTable.$inferInsert;
export type Agent = typeof agentsTable.$inferSelect;
