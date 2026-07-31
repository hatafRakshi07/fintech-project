import { pgTable, uuid, numeric, integer, date, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { loanStatusEnum, paymentModeEnum } from './enums';
import { organizations } from './organizations';
import { committees } from './committees';
import { customers } from './customers';
import { tokens } from './tokens';

export { loanStatusEnum };

export const loans = pgTable('loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeId: uuid('committee_id')
    .notNull()
    .references(() => committees.id),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  tokenId: uuid('token_id')
    .notNull()
    .references(() => tokens.id),
  principalAmount: numeric('principal_amount', { precision: 12, scale: 2 }).notNull(),
  interestRatePct: numeric('interest_rate_pct', { precision: 5, scale: 2 }).default('0').notNull(),
  tenureMonths: integer('tenure_months').default(12).notNull(),
  disbursalDate: date('disbursal_date').notNull(),
  status: loanStatusEnum('status').default('DISBURSED').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const loanRepayments = pgTable('loan_repayments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id')
    .notNull()
    .references(() => loans.id, { onDelete: 'cascade' }),
  repaymentDate: date('repayment_date').notNull(),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull(),
  principalPaid: numeric('principal_paid', { precision: 12, scale: 2 }).notNull(),
  interestPaid: numeric('interest_paid', { precision: 12, scale: 2 }).default('0').notNull(),
  receiptNumber: varchar('receipt_number', { length: 100 }).notNull().unique(),
  paymentMode: paymentModeEnum('payment_mode').default('CASH').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type LoanRepayment = typeof loanRepayments.$inferSelect;
