
import { pgTable, uuid, varchar, numeric, date } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { membershipStatusEnum, tokenStatusEnum } from './enums';
import { customers } from './crm';
import { schemes } from './schemes';

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  schemeId: uuid('scheme_id').references(() => schemes.id).notNull(),
  joiningDate: date('joining_date').notNull(),
  securityDeposit: numeric('security_deposit', { precision: 12, scale: 2 }).default('0'),
  status: membershipStatusEnum('status').default('ACTIVE').notNull(),
  luckyStatus: varchar('lucky_status', { length: 50 }),
  exitDate: date('exit_date'),
  ...timestamps
});

export const tokens = pgTable('tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }).notNull(),
  tokenNumber: varchar('token_number', { length: 20 }).notNull(),
  status: tokenStatusEnum('status').default('ACTIVE').notNull(),
  ...timestamps
});
