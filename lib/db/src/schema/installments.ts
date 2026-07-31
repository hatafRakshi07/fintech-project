import { pgTable, uuid, varchar, numeric, date, text, timestamp } from 'drizzle-orm/pg-core';
import { installmentStatusEnum, paymentModeEnum, collectionRegisterStatusEnum } from './enums';
import { organizations } from './organizations';
import { committeeMonths } from './committee_months';
import { tokens } from './tokens';
import { employees } from './employees';

export { installmentStatusEnum, paymentModeEnum, collectionRegisterStatusEnum };

export const installmentSchedules = pgTable('installment_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeMonthId: uuid('committee_month_id')
    .notNull()
    .references(() => committeeMonths.id, { onDelete: 'cascade' }),
  tokenId: uuid('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'cascade' }),
  expectedAmount: numeric('expected_amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  status: installmentStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const collectionRegisters = pgTable('collection_registers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  collectorId: uuid('collector_id')
    .notNull()
    .references(() => employees.id),
  collectionDate: date('collection_date').notNull(),
  totalCash: numeric('total_cash', { precision: 12, scale: 2 }).default('0').notNull(),
  totalOnline: numeric('total_online', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  status: collectionRegisterStatusEnum('status').default('OPEN').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const installments = pgTable('installments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeMonthId: uuid('committee_month_id')
    .notNull()
    .references(() => committeeMonths.id, { onDelete: 'cascade' }),
  tokenId: uuid('token_id')
    .notNull()
    .references(() => tokens.id, { onDelete: 'restrict' }),
  scheduleId: uuid('schedule_id').references(() => installmentSchedules.id),
  collectionRegisterId: uuid('collection_register_id').references(() => collectionRegisters.id),
  receiptNumber: varchar('receipt_number', { length: 100 }).notNull().unique(),
  expectedAmount: numeric('expected_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull(),
  lateFee: numeric('late_fee', { precision: 12, scale: 2 }).default('0').notNull(),
  paymentDate: date('payment_date').notNull(),
  paymentMode: paymentModeEnum('payment_mode').default('CASH').notNull(),
  collectorId: uuid('collector_id').references(() => employees.id),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).unique(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type InstallmentSchedule = typeof installmentSchedules.$inferSelect;
export type Installment = typeof installments.$inferSelect;
export type NewInstallment = typeof installments.$inferInsert;
