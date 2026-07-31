import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { organizations } from './iam';

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  fatherName: varchar('father_name', { length: 100 }),
  mobile: varchar('mobile', { length: 20 }).notNull(),
  altMobile: varchar('alt_mobile', { length: 20 }),
  aadhaar: varchar('aadhaar', { length: 20 }),
  address: text('address'),
  city: varchar('city', { length: 50 }),
  photoUrl: text('photo_url'),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps
});
