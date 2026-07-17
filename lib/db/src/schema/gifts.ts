import { pgTable, serial, text, integer, timestamp, pgEnum, numeric, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const giftStatusEnum = pgEnum("gift_status", ["available", "reserved", "distributed", "returned", "damaged"]);
export const giftDistributionStatusEnum = pgEnum("gift_distribution_status", ["pending", "given", "returned"]);

export const giftCategoriesTable = pgTable("gift_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const giftInventoryTable = pgTable("gift_inventory", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  quantityTotal: integer("quantity_total").notNull().default(0),
  quantityAvailable: integer("quantity_available").notNull().default(0),
  quantityDistributed: integer("quantity_distributed").notNull().default(0),
  status: giftStatusEnum("status").notNull().default("available"),
  branchId: integer("branch_id").notNull(),
  addedAt: date("added_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const giftDistributionsTable = pgTable("gift_distributions", {
  id: serial("id").primaryKey(),
  giftId: integer("gift_id").notNull(),
  customerId: integer("customer_id").notNull(),
  committeeId: integer("committee_id"),
  tokenId: integer("token_id"),
  lotteryId: integer("lottery_id"),
  quantity: integer("quantity").notNull().default(1),
  distributionDate: date("distribution_date", { mode: "string" }).notNull(),
  status: giftDistributionStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  isReturned: boolean("is_returned").notNull().default(false),
  returnDate: date("return_date", { mode: "string" }),
  returnNotes: text("return_notes"),
  branchId: integer("branch_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGiftCategorySchema = createInsertSchema(giftCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export const insertGiftInventorySchema = createInsertSchema(giftInventoryTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;
export const insertGiftDistributionSchema = createInsertSchema(giftDistributionsTable).omit({ id: true, createdAt: true, updatedAt: true }) as any;

export type GiftCategory = typeof giftCategoriesTable.$inferSelect;
export type GiftInventory = typeof giftInventoryTable.$inferSelect;
export type GiftDistribution = typeof giftDistributionsTable.$inferSelect;
export type InsertGiftCategory = z.infer<typeof insertGiftCategorySchema>;
export type InsertGiftInventory = z.infer<typeof insertGiftInventorySchema>;
export type InsertGiftDistribution = z.infer<typeof insertGiftDistributionSchema>;
