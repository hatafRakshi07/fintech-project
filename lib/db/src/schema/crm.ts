import { pgTable, uuid, varchar, timestamp, text } from 'drizzle-orm/pg-core';
import { customerStatusEnum } from './enums';
import { timestamps } from './utils';

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).unique().notNull(),
  dob: timestamp('dob'),
  avatarUrl: text('avatar_url'),
  status: customerStatusEnum('status').default('ACTIVE').notNull(),
  ...timestamps
});

export const customerAddresses = pgTable('customer_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // HOME, OFFICE
  addressLine: text('address_line').notNull(),
  city: varchar('city', { length: 100 }),
  pincode: varchar('pincode', { length: 20 }),
  ...timestamps
});

export const customerDocuments = pgTable('customer_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  documentType: varchar('document_type', { length: 50 }).notNull(), // AADHAR, PAN
  documentNumber: varchar('document_number', { length: 100 }),
  fileUrl: text('file_url'),
  ...timestamps
});

export const customerReferences = pgTable('customer_references', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  referenceName: varchar('reference_name', { length: 255 }).notNull(),
  referencePhone: varchar('reference_phone', { length: 20 }).notNull(),
  relation: varchar('relation', { length: 50 }).notNull(), // Nominee, Guarantor
  ...timestamps
});
