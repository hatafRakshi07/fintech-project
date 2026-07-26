import { pgTable, uuid, timestamp, integer, decimal, varchar } from 'drizzle-orm/pg-core';
import { giftSelectionEnum } from './enums';
import { timestamps } from './utils';
import { schemes } from './schemes';
import { memberships } from './memberships';

export const draws = pgTable('draws', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id).notNull(),
  drawDate: timestamp('draw_date').notNull(),
  monthNo: integer('month_no').notNull(),
  ...timestamps
});

export const drawResults = pgTable('draw_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  drawId: uuid('draw_id').references(() => draws.id, { onDelete: 'cascade' }).notNull(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  prizeAmount: decimal('prize_amount', { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});

export const giftInventory = pgTable('gift_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  stockQuantity: integer('stock_quantity').default(0).notNull(),
  ...timestamps
});

export const giftSelections = pgTable('gift_selections', {
  id: uuid('id').defaultRandom().primaryKey(),
  resultId: uuid('result_id').references(() => drawResults.id, { onDelete: 'cascade' }).notNull(),
  selection: giftSelectionEnum('selection').notNull(),
  itemId: uuid('item_id').references(() => giftInventory.id),
  cashAmount: decimal('cash_amount', { precision: 12, scale: 2 }),
  ...timestamps
});

export const giftDeliveries = pgTable('gift_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  selectionId: uuid('selection_id').references(() => giftSelections.id, { onDelete: 'cascade' }).notNull(),
  deliveryDate: timestamp('delivery_date'),
  photoUrl: varchar('photo_url', { length: 1024 }),
  ...timestamps
});

export const giftHistory = pgTable('gift_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').references(() => giftInventory.id, { onDelete: 'cascade' }).notNull(),
  changeQuantity: integer('change_quantity').notNull(),
  reason: varchar('reason', { length: 255 }),
  ...timestamps
});
