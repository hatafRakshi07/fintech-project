
import { pgTable, uuid, varchar, text, integer, numeric, date, time } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { schemeStatusEnum } from './enums';

export const schemes = pgTable('schemes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  drawDay: integer('draw_day').notNull(), // 1-31
  drawTime: time('draw_time').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  monthlyInstallment: numeric('monthly_installment', { precision: 12, scale: 2 }).notNull(),
  durationMonths: integer('duration_months').notNull(),
  securityDeposit: numeric('security_deposit', { precision: 12, scale: 2 }).default('0'),
  graceDays: integer('grace_days').default(0),
  lateFee: numeric('late_fee', { precision: 12, scale: 2 }).default('0'),
  cancellationPercentage: numeric('cancellation_percentage', { precision: 5, scale: 2 }).default('0'),
  settlementPercentage: numeric('settlement_percentage', { precision: 5, scale: 2 }).default('0'),
  status: schemeStatusEnum('status').default('DRAFT').notNull(),
  ...timestamps
});

export const schemePrizes = pgTable('scheme_prizes', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'cascade' }).notNull(),
  monthNumber: integer('month_number').notNull(),
  giftName: varchar('gift_name', { length: 100 }).notNull(),
  giftValue: numeric('gift_value', { precision: 12, scale: 2 }),
  giftQuantity: integer('gift_quantity').default(1),
  cashAlternative: numeric('cash_alternative', { precision: 12, scale: 2 }),
  prizeCategory: varchar('prize_category', { length: 50 }),
  ...timestamps
});
