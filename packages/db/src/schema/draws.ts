import { pgTable, uuid, date, text, timestamp } from 'drizzle-orm/pg-core';
import { drawEventStatusEnum, rewardTypeEnum } from './enums';
import { organizations } from './organizations';
import { committeeMonths } from './committee_months';
import { employees } from './employees';
import { tokens } from './tokens';

export { drawEventStatusEnum, rewardTypeEnum };

export const drawEvents = pgTable('draw_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeMonthId: uuid('committee_month_id')
    .notNull()
    .references(() => committeeMonths.id, { onDelete: 'cascade' })
    .unique(),
  drawDate: date('draw_date').notNull(),
  conductedById: uuid('conducted_by_id').references(() => employees.id),
  status: drawEventStatusEnum('status').default('COMPLETED').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const drawResults = pgTable('draw_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  drawEventId: uuid('draw_event_id')
    .notNull()
    .references(() => drawEvents.id, { onDelete: 'cascade' }),
  tokenId: uuid('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'restrict' }),
  rewardType: rewardTypeEnum('reward_type').notNull(),
  rewardDescription: text('reward_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DrawEvent = typeof drawEvents.$inferSelect;
export type DrawResult = typeof drawResults.$inferSelect;
export type NewDrawResult = typeof drawResults.$inferInsert;
