import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const collectorStatusEnum = pgEnum("collector_status", ["active", "inactive"]);

export const collectorsTable = pgTable("collectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  email: text("email"),
  branchId: integer("branch_id").notNull(),
  status: collectorStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCollectorSchema = createInsertSchema(collectorsTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export type InsertCollector = z.infer<typeof insertCollectorSchema>;
export type Collector = typeof collectorsTable.$inferSelect;
