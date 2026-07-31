import { pgTable, uuid, varchar, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { committeeMonthStatusEnum } from './enums';
import { organizations } from './organizations';
import { committees } from './committees';

export { committeeMonthStatusEnum };

export const committeeMonths = pgTable('committee_months', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeId: uuid('committee_id')
    .notNull()
    .references(() => committees.id, { onDelete: 'cascade' }),
  monthNumber: integer('month_number').notNull(),
  monthName: varchar('month_name', { length: 50 }).notNull(),
  dueDate: date('due_date').notNull(),
  drawDate: date('draw_date'),
  status: committeeMonthStatusEnum('status').default('UPCOMING').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CommitteeMonth = typeof committeeMonths.$inferSelect;
export type NewCommitteeMonth = typeof committeeMonths.$inferInsert;
