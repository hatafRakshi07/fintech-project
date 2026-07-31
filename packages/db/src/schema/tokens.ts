import { pgTable, uuid, varchar, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { tokenStatusEnum } from './enums';
import { organizations } from './organizations';
import { committees } from './committees';
import { customers } from './customers';
import { committeeMonths } from './committee_months';

export { tokenStatusEnum };

export const tokens = pgTable('tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeId: uuid('committee_id')
    .notNull()
    .references(() => committees.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  rawTokenNumber: varchar('raw_token_number', { length: 50 }).notNull(),
  normalizedTokenNumber: integer('normalized_token_number').notNull(),
  duplicateSuffix: varchar('duplicate_suffix', { length: 10 }).default('').notNull(),
  status: tokenStatusEnum('status').default('ACTIVE').notNull(),
  joiningMonthId: uuid('joining_month_id').references(() => committeeMonths.id),
  exitMonthId: uuid('exit_month_id').references(() => committeeMonths.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tokenStatusHistory = pgTable('token_status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  tokenId: uuid('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'cascade' }),
  fromStatus: tokenStatusEnum('from_status'),
  toStatus: tokenStatusEnum('to_status').notNull(),
  reason: text('reason'),
  actorId: uuid('actor_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
