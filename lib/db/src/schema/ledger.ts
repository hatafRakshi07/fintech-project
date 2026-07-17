import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";
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
