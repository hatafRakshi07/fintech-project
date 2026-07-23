import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const otpsTable = pgTable("otps", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOtpSchema = createInsertSchema(otpsTable).omit({ id: true, createdAt: true }) as any;
export type InsertOtp = z.infer<typeof insertOtpSchema>;
export type Otp = typeof otpsTable.$inferSelect;
