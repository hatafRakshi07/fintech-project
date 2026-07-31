import { pgTable, uuid, varchar, text, numeric, integer, boolean, date, timestamp } from 'drizzle-orm/pg-core';
import { giftClaimStatusEnum } from './enums';
import { organizations } from './organizations';
import { committeeMonths } from './committee_months';
import { drawResults } from './draws';
import { tokens } from './tokens';
import { customers } from './customers';

export { giftClaimStatusEnum };

export const giftCatalog = pgTable('gift_catalog', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  category: varchar('category', { length: 50 }),
  description: text('description'),
  defaultCashAlternative: numeric('default_cash_alternative', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const committeeMonthGifts = pgTable('committee_month_gifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeMonthId: uuid('committee_month_id')
    .notNull()
    .references(() => committeeMonths.id, { onDelete: 'cascade' }),
  giftCatalogId: uuid('gift_catalog_id')
    .notNull()
    .references(() => giftCatalog.id),
  quantity: integer('quantity').notNull(),
  priority: integer('priority').default(1).notNull(),
  cashAlternativeOverride: numeric('cash_alternative_override', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const giftWinners = pgTable('gift_winners', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  drawResultId: uuid('draw_result_id')
    .notNull()
    .references(() => drawResults.id, { onDelete: 'cascade' }),
  committeeMonthGiftId: uuid('committee_month_gift_id').references(() => committeeMonthGifts.id),
  tokenId: uuid('token_id')
    .notNull()
    .references(() => tokens.id),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  isCashOpted: boolean('is_cash_opted').default(false).notNull(),
  cashAmount: numeric('cash_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  claimStatus: giftClaimStatusEnum('claim_status').default('PENDING').notNull(),
  deliveryDate: date('delivery_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type GiftCatalog = typeof giftCatalog.$inferSelect;
export type GiftWinner = typeof giftWinners.$inferSelect;
export type NewGiftWinner = typeof giftWinners.$inferInsert;
