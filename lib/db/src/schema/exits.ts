import { pgTable, uuid, decimal, text } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { memberships } from './memberships';

export const settlements = pgTable('settlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  refundCalculated: decimal('refund_calculated', { precision: 12, scale: 2 }).notNull(),
  deductions: decimal('deductions', { precision: 12, scale: 2 }).default('0').notNull(),
  finalAmount: decimal('final_amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  ...timestamps
});

export const maturityPayments = pgTable('maturity_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  calculatedAmount: decimal('calculated_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  ...timestamps
});

export const refunds = pgTable('refunds', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason'),
  ...timestamps
});
