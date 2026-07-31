import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { tokenStatusEnum } from './enums';
import { organizations } from './iam';
import { committees, committeeMonths } from './schemes';
import { customers } from './crm';

export const tokens = pgTable('tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  committeeId: uuid('committee_id').references(() => committees.id, { onDelete: 'cascade' }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  rawTokenNumber: varchar('raw_token_number', { length: 50 }).notNull(),
  normalizedTokenNumber: integer('normalized_token_number').notNull(),
  duplicateSuffix: varchar('duplicate_suffix', { length: 10 }).default('').notNull(),
  status: tokenStatusEnum('status').default('ACTIVE').notNull(),
  joiningMonthId: uuid('joining_month_id').references(() => committeeMonths.id),
  exitMonthId: uuid('exit_month_id').references(() => committeeMonths.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps
});

export const tokenStatusHistory = pgTable('token_status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  tokenId: uuid('token_id').references(() => tokens.id, { onDelete: 'cascade' }).notNull(),
  fromStatus: tokenStatusEnum('from_status'),
  toStatus: tokenStatusEnum('to_status').notNull(),
  reason: varchar('reason', { length: 255 }),
  actorId: uuid('actor_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Alias export for backwards compatibility
export const memberships = tokens;
