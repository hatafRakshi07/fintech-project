import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { customerStatusEnum } from './enums';
import { organizations } from './organizations';

export { customerStatusEnum };

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  fatherName: varchar('father_name', { length: 100 }),
  mobile: varchar('mobile', { length: 20 }).notNull(),
  altMobile: varchar('alt_mobile', { length: 20 }),
  aadhaar: varchar('aadhaar', { length: 20 }),
  address: text('address'),
  city: varchar('city', { length: 50 }),
  photoUrl: text('photo_url'),
  status: customerStatusEnum('status').default('ACTIVE').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
