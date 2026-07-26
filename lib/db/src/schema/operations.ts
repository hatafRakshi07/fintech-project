import { pgTable, uuid, text, timestamp, decimal } from 'drizzle-orm/pg-core';
import { visitStatusEnum } from './enums';
import { timestamps } from './utils';
import { collectors } from './iam';
import { customers } from './crm';

export const collectionVisits = pgTable('collection_visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectorId: uuid('collector_id').references(() => collectors.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  status: visitStatusEnum('status').notNull(),
  notes: text('notes'),
  locationLat: decimal('location_lat', { precision: 10, scale: 6 }),
  locationLng: decimal('location_lng', { precision: 10, scale: 6 }),
  ...timestamps
});

export const collectorDailyClosings = pgTable('collector_daily_closings', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectorId: uuid('collector_id').references(() => collectors.id).notNull(),
  closingDate: timestamp('closing_date').notNull(),
  totalCollected: decimal('total_collected', { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});

export const collectorCashHandovers = pgTable('collector_cash_handovers', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectorId: uuid('collector_id').references(() => collectors.id).notNull(),
  closingId: uuid('closing_id').references(() => collectorDailyClosings.id).notNull(),
  amountHandedOver: decimal('amount_handed_over', { precision: 12, scale: 2 }).notNull(),
  receiverId: uuid('receiver_id'), // Admin receiving cash
  ...timestamps
});
