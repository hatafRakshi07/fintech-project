
import { pgTable, uuid, varchar, text, integer, numeric, date, boolean } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { giftStatusEnum } from './enums';
import { schemes, schemePrizes } from './schemes';
import { memberships } from './memberships';
import { customers } from './crm';

export const draws = pgTable('draws', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id).notNull(),
  drawMonth: integer('draw_month').notNull(),
  drawDate: date('draw_date').notNull(),
  notes: text('notes'),
  ...timestamps
});

export const drawResults = pgTable('draw_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  drawId: uuid('draw_id').references(() => draws.id, { onDelete: 'cascade' }).notNull(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  prizeId: uuid('prize_id').references(() => schemePrizes.id).notNull(),
  isCashAlternative: boolean('is_cash_alternative').default(false).notNull(),
  ...timestamps
});

export const giftInventory = pgTable('gift_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemName: varchar('item_name', { length: 100 }).notNull(),
  stockCount: integer('stock_count').default(0).notNull(),
  unitValue: numeric('unit_value', { precision: 12, scale: 2 }),
  ...timestamps
});

export const giftDeliveries = pgTable('gift_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  drawResultId: uuid('draw_result_id').references(() => drawResults.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  status: giftStatusEnum('status').default('PENDING').notNull(),
  deliveryDate: date('delivery_date'),
  notes: text('notes'),
  ...timestamps
});
