
import { pgTable, uuid, varchar, text, numeric, date } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { paymentMethodEnum, paymentItemTypeEnum, depositStatusEnum, ledgerTypeEnum } from './enums';
import { customers } from './crm';
import { collectors } from './iam';
import { memberships } from './memberships';

export const paymentReceipts = pgTable('payment_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptNo: varchar('receipt_no', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  collectorId: uuid('collector_id').references(() => collectors.id),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  referenceNo: varchar('reference_no', { length: 100 }),
  notes: text('notes'),
  ...timestamps
});

export const paymentItems = pgTable('payment_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptId: uuid('receipt_id').references(() => paymentReceipts.id, { onDelete: 'cascade' }).notNull(),
  type: paymentItemTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  referenceId: uuid('reference_id'), // polymorphic: membership_id, draw_id, etc.
  ...timestamps
});

export const securityDeposits = pgTable('security_deposits', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }).notNull(),
  depositDate: date('deposit_date').notNull(),
  adjustmentAmount: numeric('adjustment_amount', { precision: 12, scale: 2 }).default('0'),
  refundAmount: numeric('refund_amount', { precision: 12, scale: 2 }).default('0'),
  status: depositStatusEnum('status').default('HELD').notNull(),
  ...timestamps
});

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id),
  type: ledgerTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // INSTALLMENT, PENALTY, etc
  referenceId: uuid('reference_id'),
  notes: text('notes'),
  ...timestamps
});
