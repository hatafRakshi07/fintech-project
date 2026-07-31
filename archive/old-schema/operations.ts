import { pgTable, uuid, varchar, text, integer, jsonb, date, timestamp } from 'drizzle-orm/pg-core';
import { importStatusEnum } from './enums';
import { organizations } from './iam';
import { tokens } from './memberships';
import { customers } from './crm';

export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }),
  totalRows: integer('total_rows').default(0).notNull(),
  processedRows: integer('processed_rows').default(0).notNull(),
  successfulRows: integer('successful_rows').default(0).notNull(),
  errorRows: integer('error_rows').default(0).notNull(),
  status: importStatusEnum('status').default('PENDING').notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const importBatches = pgTable('import_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  importJobId: uuid('import_job_id').references(() => importJobs.id, { onDelete: 'cascade' }).notNull(),
  batchNumber: integer('batch_number').notNull(),
  status: importStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const importRows = pgTable('import_rows', {
  id: uuid('id').defaultRandom().primaryKey(),
  importJobId: uuid('import_job_id').references(() => importJobs.id, { onDelete: 'cascade' }).notNull(),
  batchId: uuid('batch_id').references(() => importBatches.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  rawData: jsonb('raw_data').notNull(),
  status: importStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const importErrors = pgTable('import_errors', {
  id: uuid('id').defaultRandom().primaryKey(),
  importJobId: uuid('import_job_id').references(() => importJobs.id, { onDelete: 'cascade' }).notNull(),
  rowNumber: integer('row_number').notNull(),
  errorCode: varchar('error_code', { length: 50 }).notNull(),
  errorMessage: text('error_message').notNull(),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const tokenTransferHistory = pgTable('token_transfer_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  tokenId: uuid('token_id').references(() => tokens.id).notNull(),
  fromCustomerId: uuid('from_customer_id').references(() => customers.id).notNull(),
  toCustomerId: uuid('to_customer_id').references(() => customers.id).notNull(),
  transferDate: date('transfer_date').notNull(),
  reason: text('reason'),
  approvedById: uuid('approved_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  templateName: varchar('template_name', { length: 100 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).default('QUEUED').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 20 }).notNull(),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  actorId: uuid('actor_id'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Alias export for backwards compatibility
export const collectionVisits = importRows;
