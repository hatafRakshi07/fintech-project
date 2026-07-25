import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const kycStatusEnum = pgEnum("kyc_status", ["pending", "under_review", "approved", "rejected"]);
export const kycRoleEnum = pgEnum("kyc_role", ["customer", "collector", "agent"]);

export const kycVerificationsTable = pgTable("kyc_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userRole: kycRoleEnum("user_role").notNull().default("customer"),
  referenceId: integer("reference_id"), // customerId, collectorId, or agentId
  aadhaarNumber: text("aadhaar_number"),
  panNumber: text("pan_number"),
  aadhaarFrontUrl: text("aadhaar_front_url"),
  aadhaarBackUrl: text("aadhaar_back_url"),
  panCardUrl: text("pan_card_url"),
  selfieUrl: text("selfie_url"),
  bankAccountNo: text("bank_account_no"),
  bankIfsc: text("bank_ifsc"),
  bankName: text("bank_name"),
  status: kycStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: integer("verified_by"), // Admin user ID who reviewed this KYC
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKycVerificationSchema = createInsertSchema(kycVerificationsTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export type InsertKycVerification = typeof kycVerificationsTable.$inferInsert;
export type KycVerification = typeof kycVerificationsTable.$inferSelect;
