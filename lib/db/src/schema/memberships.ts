import { pgTable, uuid, varchar, timestamp, boolean, decimal } from 'drizzle-orm/pg-core';
import { membershipStatusEnum } from './enums';
import { timestamps } from './utils';
import { schemes } from './schemes';
import { customers } from './crm';

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'restrict' }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }).notNull(),
  joiningDate: timestamp('joining_date').notNull(),
  status: membershipStatusEnum('status').default('ACTIVE').notNull(),
  ...timestamps
});

export const tokens = pgTable('tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }).notNull(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'restrict' }).notNull(),
  tokenNumber: varchar('token_number', { length: 50 }).notNull(),
  ...timestamps
});

export const securityDeposits = pgTable('security_deposits', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean('is_paid').default(false).notNull(),
  ...timestamps
});
