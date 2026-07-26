import { pgTable, uuid, varchar, timestamp, text, integer, boolean, decimal } from 'drizzle-orm/pg-core';
import { paymentMethodEnum, paymentItemTypeEnum } from './enums';
import { timestamps } from './utils';
import { customers } from './crm';
import { collectors } from './iam';
import { collectionVisits } from './operations';
import { memberships } from './memberships';

export const paymentReceipts = pgTable('payment_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptNo: varchar('receipt_no', { length: 50 }).unique().notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  collectorId: uuid('collector_id').references(() => collectors.id),
  visitId: uuid('visit_id').references(() => collectionVisits.id),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});

export const paymentItems = pgTable('payment_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptId: uuid('receipt_id').references(() => paymentReceipts.id, { onDelete: 'cascade' }).notNull(),
  type: paymentItemTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  referenceId: uuid('reference_id'), // Connects to installments, loans, penalties
  ...timestamps
});

export const installments = pgTable('installments', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'restrict' }).notNull(),
  monthNo: integer('month_no').notNull(),
  amountDue: decimal('amount_due', { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  isPaid: boolean('is_paid').default(false).notNull(),
  ...timestamps
});

export const penalties = pgTable('penalties', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason'),
  isPaid: boolean('is_paid').default(false).notNull(),
  ...timestamps
});

export const ledgerAccounts = pgTable('ledger_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // ASSET, LIABILITY, INCOME, EXPENSE
  ...timestamps
});

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => ledgerAccounts.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  isDebit: boolean('is_debit').notNull(),
  receiptId: uuid('receipt_id').references(() => paymentReceipts.id),
  description: text('description'),
  ...timestamps
});
