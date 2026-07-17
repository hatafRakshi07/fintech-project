import { pgTable, serial, text, integer, timestamp, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive", "blocked"]);

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  alternateMobile: text("alternate_mobile"),
  email: text("email"),
  aadhaar: text("aadhaar"),
  pan: text("pan"),
  address: text("address"),
  city: text("city"),
  nomineeName: text("nominee_name"),
  nomineeRelation: text("nominee_relation"),
  photoUrl: text("photo_url"),
  referenceName: text("reference_name"),
  recoveryNotes: text("recovery_notes"),
  documents: text("documents"),
  branchId: integer("branch_id").notNull(),
  status: customerStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
