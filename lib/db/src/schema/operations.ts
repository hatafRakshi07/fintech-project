
import { pgTable, uuid, text, timestamp, date } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { visitOutcomeEnum } from './enums';
import { collectors } from './iam';
import { customers } from './crm';

export const collectionVisits = pgTable('collection_visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectorId: uuid('collector_id').references(() => collectors.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  visitTime: timestamp('visit_time', { withTimezone: true }).notNull().defaultNow(),
  outcome: visitOutcomeEnum('outcome').notNull(),
  promiseDate: date('promise_date'),
  notes: text('notes'),
  ...timestamps
});
