
import { pgTable, uuid, varchar, text, date } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { docTypeEnum } from './enums';
import { users } from './iam';

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id), // Optional login
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  address: text('address'),
  city: varchar('city', { length: 50 }),
  dob: date('dob'),
  ...timestamps
});

export const customerDocuments = pgTable('customer_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  docType: docTypeEnum('doc_type').notNull(),
  docNumber: varchar('doc_number', { length: 50 }),
  fileUrl: text('file_url'),
  ...timestamps
});

export const customerReferences = pgTable('customer_references', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  relation: varchar('relation', { length: 50 }),
  ...timestamps
});
