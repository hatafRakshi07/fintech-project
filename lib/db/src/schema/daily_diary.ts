import { pgTable, uuid, numeric, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const dailyDiaryLoans = pgTable('daily_diary_loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' }),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  mobileNumber: varchar('mobile_number', { length: 50 }).notNull(),
  referenceMobileNumbers: text('reference_mobile_numbers'),
  address: text('address'),
  security: text('security'),
  loanAmount: numeric('loan_amount', { precision: 12, scale: 2 }).notNull(),
  startDate: text('start_date').notNull(),
  expectedCompleteDate: text('expected_complete_date'),
  collectionPlan: varchar('collection_plan', { length: 100 }).default('Custom').notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dailyDiaryPayments = pgTable('daily_diary_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id')
    .notNull()
    .references(() => dailyDiaryLoans.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull(),
  amountDeposited: numeric('amount_deposited', { precision: 12, scale: 2 }).notNull(),
  paymentMode: varchar('payment_mode', { length: 50 }).default('Cash').notNull(),
  notes: text('notes'),
  createdBy: text('created_by').default('Admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DailyDiaryLoan = typeof dailyDiaryLoans.$inferSelect;
export type NewDailyDiaryLoan = typeof dailyDiaryLoans.$inferInsert;
export type DailyDiaryPayment = typeof dailyDiaryPayments.$inferSelect;
export type NewDailyDiaryPayment = typeof dailyDiaryPayments.$inferInsert;
