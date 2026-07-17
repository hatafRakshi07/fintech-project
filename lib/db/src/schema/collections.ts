import { pgTable, serial, text, integer, timestamp, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const paymentModeEnum = pgEnum("payment_mode", ["cash", "upi", "bank", "card", "cheque"]);
export const collectionVerificationStatusEnum = pgEnum("collection_verification_status", ["pending", "verified", "rejected"]);

export const collectionsTable = pgTable("collections", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  collectorId: integer("collector_id"),
  branchId: integer("branch_id"),
  committeeId: integer("committee_id"),
  loanId: integer("loan_id"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMode: paymentModeEnum("payment_mode").notNull().default("cash"),
  receiptNumber: text("receipt_number"),
  notes: text("notes"),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Verification workflow
  verificationStatus: collectionVerificationStatusEnum("verification_status").notNull().default("pending"),
  verifiedById: integer("verified_by_id"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationNotes: text("verification_notes"),
  // Billing recipient details
  billingName: text("billing_name"),
  billingPhone: text("billing_phone"),
  billingAddress: text("billing_address"),
  billingGstin: text("billing_gstin"),
});

export const insertCollectionSchema = createInsertSchema(collectionsTable).omit({ id: true, createdAt: true }) as any;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collectionsTable.$inferSelect;
