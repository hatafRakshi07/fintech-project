import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { notificationChannelEnum, notificationStatusEnum } from './enums';
import { organizations } from './organizations';
import { customers } from './customers';

export { notificationChannelEnum, notificationStatusEnum };

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  channel: notificationChannelEnum('channel').default('SMS').notNull(),
  templateName: varchar('template_name', { length: 100 }).notNull(),
  message: text('message').notNull(),
  status: notificationStatusEnum('status').default('QUEUED').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
