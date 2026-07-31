import { pgTable, uuid, varchar, integer, numeric, date, jsonb } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { organizations } from './iam';

export const committees = pgTable('committees', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  totalMembers: integer('total_members').notNull(),
  totalMonths: integer('total_months').notNull(),
  monthlyInstallment: numeric('monthly_installment', { precision: 12, scale: 2 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  ...timestamps
});

export const committeeMonths = pgTable('committee_months', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  committeeId: uuid('committee_id').references(() => committees.id, { onDelete: 'cascade' }).notNull(),
  monthNumber: integer('month_number').notNull(),
  monthName: varchar('month_name', { length: 50 }).notNull(),
  dueDate: date('due_date').notNull(),
  drawDate: date('draw_date'),
  status: varchar('status', { length: 20 }).default('UPCOMING').notNull(),
  ...timestamps
});

export const committeeRules = pgTable('committee_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  committeeId: uuid('committee_id').references(() => committees.id, { onDelete: 'cascade' }).notNull().unique(),
  rulesJsonb: jsonb('rules_jsonb').notNull(),
  ...timestamps
});

// Alias export for backwards compatibility
export const schemes = committees;
