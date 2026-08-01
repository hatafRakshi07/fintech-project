import { pgTable, uuid, text, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { committees } from './committees';
import { tokens } from './tokens';
import { customers } from './customers';

export const lotterySessions = pgTable('lottery_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' }),
  bissiName: varchar('bissi_name', { length: 255 }).notNull(),
  committeeId: uuid('committee_id').references(() => committees.id, { onDelete: 'set null' }),
  lotteryDate: text('lottery_date').notNull(),
  lotteryMonth: varchar('lottery_month', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const lotteryGifts = pgTable('lottery_gifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => lotterySessions.id, { onDelete: 'cascade' }),
  tokenNumber: varchar('token_number', { length: 50 }).notNull(),
  tokenId: uuid('token_id').references(() => tokens.id, { onDelete: 'set null' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  mobileNumber: varchar('mobile_number', { length: 50 }),
  bissiName: varchar('bissi_name', { length: 255 }),
  giftName: varchar('gift_name', { length: 255 }).notNull(),
  giftCategory: varchar('gift_category', { length: 100 }),
  giftValue: numeric('gift_value', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 20 }).default('Pending').notNull(), // 'Pending' or 'Collected'
  collectionDate: text('collection_date'),
  collectedBy: text('collected_by'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LotterySession = typeof lotterySessions.$inferSelect;
export type NewLotterySession = typeof lotterySessions.$inferInsert;
export type LotteryGift = typeof lotteryGifts.$inferSelect;
export type NewLotteryGift = typeof lotteryGifts.$inferInsert;
