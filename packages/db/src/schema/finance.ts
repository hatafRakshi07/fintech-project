import { pgTable, uuid, date, varchar, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { cashbookTypeEnum, expenseStatusEnum, paymentModeEnum } from './enums';
import { organizations } from './organizations';
import { tokens } from './tokens';
import { customers } from './customers';
import { employees } from './employees';

export { cashbookTypeEnum, expenseStatusEnum };

export const financialTransactions = pgTable('financial_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  transactionDate: date('transaction_date').notNull(),
  type: cashbookTypeEnum('type').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  tokenId: uuid('token_id').references(() => tokens.id),
  customerId: uuid('customer_id').references(() => customers.id),
  referenceId: uuid('reference_id'),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).unique(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cashbookEntries = pgTable('cashbook_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  entryDate: date('entry_date').notNull(),
  type: cashbookTypeEnum('type').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  closingBalance: numeric('closing_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  transactionId: uuid('transaction_id').references(() => financialTransactions.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => expenseCategories.id),
  expenseDate: date('expense_date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMode: paymentModeEnum('payment_mode').default('CASH').notNull(),
  status: expenseStatusEnum('status').default('APPROVED').notNull(),
  spentById: uuid('spent_by_id').references(() => employees.id),
  receiptUrl: text('receipt_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type CashbookEntry = typeof cashbookEntries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
