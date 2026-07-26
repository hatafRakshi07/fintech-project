import { pgTable, uuid, timestamp, decimal } from 'drizzle-orm/pg-core';
import { loanTypeEnum, loanStatusEnum } from './enums';
import { timestamps } from './utils';
import { customers } from './crm';
import { memberships } from './memberships';

export const loans = pgTable('loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  membershipId: uuid('membership_id').references(() => memberships.id), // Nullable for UNSECURED
  type: loanTypeEnum('type').notNull(),
  status: loanStatusEnum('status').default('ACTIVE').notNull(),
  principalAmount: decimal('principal_amount', { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal('interest_rate', { precision: 5, scale: 2 }).notNull(),
  ...timestamps
});

export const loanEmis = pgTable('loan_emis', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id, { onDelete: 'cascade' }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  principalComponent: decimal('principal_component', { precision: 12, scale: 2 }).notNull(),
  interestComponent: decimal('interest_component', { precision: 12, scale: 2 }).notNull(),
  isPaid: timestamp('is_paid'),
  ...timestamps
});
