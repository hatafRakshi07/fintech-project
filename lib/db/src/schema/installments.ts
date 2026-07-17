import { pgTable, serial, text, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const installmentsTable = pgTable("installments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  tokenId: integer("token_id").notNull(),
  committeeId: integer("committee_id").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
  collectorId: integer("collector_id"),
  paymentMode: text("payment_mode").notNull().default("cash"), // "cash" | "upi" | "bank" | "cheque"
  receiptNumber: text("receipt_number"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInstallmentSchema = createInsertSchema(installmentsTable).omit({ id: true, createdAt: true }) as any;
export type InsertInstallment = z.infer<typeof insertInstallmentSchema>;
export type Installment = typeof installmentsTable.$inferSelect;
