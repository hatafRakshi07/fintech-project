
import { pgTable, uuid, text, numeric, date } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { memberships } from './memberships';

export const settlements = pgTable('settlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  settlementDate: date('settlement_date').notNull(),
  totalPaidAmount: numeric('total_paid_amount', { precision: 12, scale: 2 }).notNull(),
  refundPercentage: numeric('refund_percentage', { precision: 5, scale: 2 }).notNull(),
  deductionPercentage: numeric('deduction_percentage', { precision: 5, scale: 2 }).notNull(),
  finalRefundAmount: numeric('final_refund_amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  ...timestamps
});

export const maturities = pgTable('maturities', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  maturityDate: date('maturity_date').notNull(),
  expectedAmount: numeric('expected_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull(),
  pendingAmount: numeric('pending_amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull(), // PENDING, COMPLETED
  ...timestamps
});
