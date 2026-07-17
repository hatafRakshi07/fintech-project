import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tokenStatusEnum = pgEnum("token_status", ["active", "lucky", "completed", "pending", "cancelled", "reserved", "blocked", "transferred", "closed"]);

export const tokensTable = pgTable("tokens", {
  id: serial("id").primaryKey(),
  tokenNumber: text("token_number").notNull(),
  customerId: integer("customer_id").notNull(),
  committeeId: integer("committee_id").notNull(),
  status: tokenStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTokenSchema = createInsertSchema(tokensTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokensTable.$inferSelect;
