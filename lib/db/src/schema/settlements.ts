import { pgTable, uuid, numeric, date, text, timestamp } from 'drizzle-orm/pg-core';
import { settlementStatusEnum } from './enums';
import { organizations } from './organizations';
import { committees } from './committees';
import { tokens } from './tokens';
import { customers } from './customers';

export { settlementStatusEnum };

export const settlements = pgTable('settlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  committeeId: uuid('committee_id')
    .notNull()
    .references(() => committees.id),
  tokenId: uuid('token_id')
    .notNull()
    .references(() => tokens.id)
    .unique(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  totalPaid: numeric('total_paid', { precision: 12, scale: 2 }).notNull(),
  deductions: numeric('deductions', { precision: 12, scale: 2 }).default('0').notNull(),
  outstandingLoans: numeric('outstanding_loans', { precision: 12, scale: 2 }).default('0').notNull(),
  bonusAmount: numeric('bonus_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  netSettlementAmount: numeric('net_settlement_amount', { precision: 12, scale: 2 }).notNull(),
  status: settlementStatusEnum('status').default('CALCULATED').notNull(),
  settledAt: date('settled_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
