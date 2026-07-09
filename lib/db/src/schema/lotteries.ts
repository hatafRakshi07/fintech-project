import { pgTable, serial, text, integer, timestamp, pgEnum, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lotteryStatusEnum = pgEnum("lottery_status", ["scheduled", "completed", "cancelled"]);
export const lotteryRewardTypeEnum = pgEnum("lottery_reward_type", ["cash", "gift"]);

export const lotteriesTable = pgTable("lotteries", {
  id: serial("id").primaryKey(),
  committeeId: integer("committee_id").notNull(),
  drawDate: date("draw_date", { mode: "string" }).notNull(),
  winnerId: integer("winner_id"),
  prizeAmount: numeric("prize_amount", { precision: 12, scale: 2 }),
  status: lotteryStatusEnum("status").notNull().default("scheduled"),
  notes: text("notes"),
  // Reward details
  rewardType: lotteryRewardTypeEnum("reward_type"),
  cashTaken: numeric("cash_taken", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLotterySchema = createInsertSchema(lotteriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLottery = z.infer<typeof insertLotterySchema>;
export type Lottery = typeof lotteriesTable.$inferSelect;
