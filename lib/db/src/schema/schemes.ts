import { pgTable, uuid, varchar, timestamp, integer, decimal } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';

export const schemes = pgTable('schemes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  ...timestamps
});

export const schemeConfigs = pgTable('scheme_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'cascade' }).notNull(),
  durationMonths: integer('duration_months').notNull(),
  installmentAmount: decimal('installment_amount', { precision: 12, scale: 2 }).notNull(),
  securityDepositAmount: decimal('security_deposit_amount', { precision: 12, scale: 2 }).notNull(),
  drawDayOfMonth: integer('draw_day_of_month').notNull(),
  settlementPercentage: decimal('settlement_percentage', { precision: 5, scale: 2 }).notNull(),
  ...timestamps
});

export const schemePrizeCatalog = pgTable('scheme_prize_catalog', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'cascade' }).notNull(),
  monthNo: integer('month_no').notNull(),
  giftName: varchar('gift_name', { length: 255 }).notNull(),
  cashAlternative: decimal('cash_alternative', { precision: 12, scale: 2 }),
  ...timestamps
});
