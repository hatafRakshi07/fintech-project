import { pgTable, uuid, varchar, integer, numeric, date, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { committeeStatusEnum } from './enums';
import { organizations } from './organizations';

export { committeeStatusEnum };

export const committees = pgTable('committees', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  totalMembers: integer('total_members').notNull(),
  totalMonths: integer('total_months').notNull(),
  monthlyInstallment: numeric('monthly_installment', { precision: 12, scale: 2 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  status: committeeStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const committeeRules = pgTable('committee_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeId: uuid('committee_id')
    .notNull()
    .references(() => committees.id, { onDelete: 'cascade' })
    .unique(),
  rulesJsonb: jsonb('rules_jsonb').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Committee = typeof committees.$inferSelect;
export type NewCommittee = typeof committees.$inferInsert;
export type CommitteeRule = typeof committeeRules.$inferSelect;
