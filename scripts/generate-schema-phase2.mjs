import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaDir = path.resolve(__dirname, '../lib/db/src/schema');

// Ensure schema directory exists
if (!fs.existsSync(schemaDir)) {
  fs.mkdirSync(schemaDir, { recursive: true });
}

// 1. Delete all existing schema files
const files = fs.readdirSync(schemaDir);
for (const file of files) {
  fs.unlinkSync(path.join(schemaDir, file));
}
console.log("Deleted old schema files.");

// 2. Generate Enums & Utils
fs.writeFileSync(path.join(schemaDir, 'utils.ts'), `
import { timestamp } from 'drizzle-orm/pg-core';
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
};
`);

fs.writeFileSync(path.join(schemaDir, 'enums.ts'), `
import { pgEnum } from 'drizzle-orm/pg-core';
export const roleEnum = pgEnum('role', ['SUPER_ADMIN', 'OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'COLLECTOR', 'CUSTOMER']);
export const docTypeEnum = pgEnum('doc_type', ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER']);
export const schemeStatusEnum = pgEnum('scheme_status', ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
export const membershipStatusEnum = pgEnum('membership_status', ['ACTIVE', 'LUCKY', 'EXITED', 'SETTLED', 'DEFAULTED']);
export const tokenStatusEnum = pgEnum('token_status', ['ACTIVE', 'INACTIVE']);
export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT']);
export const paymentItemTypeEnum = pgEnum('payment_item_type', ['INSTALLMENT', 'SECURITY_DEPOSIT', 'REGISTRATION_FEE', 'PENALTY', 'GIFT_PAYMENT', 'SETTLEMENT', 'MISC']);
export const visitOutcomeEnum = pgEnum('visit_outcome', ['COLLECTED', 'PROMISE_TO_PAY', 'NOT_AVAILABLE', 'SHOP_CLOSED', 'PHONE_OFF', 'FOLLOW_UP']);
export const depositStatusEnum = pgEnum('deposit_status', ['HELD', 'ADJUSTED', 'REFUNDED', 'FORFEITED']);
export const giftStatusEnum = pgEnum('gift_status', ['PENDING', 'DELIVERED', 'CASH_TAKEN']);
export const ledgerTypeEnum = pgEnum('ledger_type', ['CREDIT', 'DEBIT']);
`);

// 3. Generate IAM (Identity & Access Management)
fs.writeFileSync(path.join(schemaDir, 'iam.ts'), `
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { roleEnum } from './enums';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum('role').default('CUSTOMER').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps
});

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 100 }),
  ...timestamps
});

export const collectors = pgTable('collectors', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  area: varchar('area', { length: 100 }),
  commissionRate: varchar('commission_rate', { length: 10 }),
  ...timestamps
});

export const roles_permissions = pgTable('roles_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: roleEnum('role').notNull(),
  permission: varchar('permission', { length: 50 }).notNull(),
  ...timestamps
});
`);

// 4. Generate CRM (Customer Relationship Management)
fs.writeFileSync(path.join(schemaDir, 'crm.ts'), `
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
`);

// 5. Generate Schemes
fs.writeFileSync(path.join(schemaDir, 'schemes.ts'), `
import { pgTable, uuid, varchar, text, integer, numeric, date, time } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { schemeStatusEnum } from './enums';

export const schemes = pgTable('schemes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  drawDay: integer('draw_day').notNull(), // 1-31
  drawTime: time('draw_time').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  monthlyInstallment: numeric('monthly_installment', { precision: 12, scale: 2 }).notNull(),
  durationMonths: integer('duration_months').notNull(),
  securityDeposit: numeric('security_deposit', { precision: 12, scale: 2 }).default('0'),
  graceDays: integer('grace_days').default(0),
  lateFee: numeric('late_fee', { precision: 12, scale: 2 }).default('0'),
  cancellationPercentage: numeric('cancellation_percentage', { precision: 5, scale: 2 }).default('0'),
  settlementPercentage: numeric('settlement_percentage', { precision: 5, scale: 2 }).default('0'),
  status: schemeStatusEnum('status').default('DRAFT').notNull(),
  ...timestamps
});

export const schemePrizes = pgTable('scheme_prizes', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'cascade' }).notNull(),
  monthNumber: integer('month_number').notNull(),
  giftName: varchar('gift_name', { length: 100 }).notNull(),
  giftValue: numeric('gift_value', { precision: 12, scale: 2 }),
  giftQuantity: integer('gift_quantity').default(1),
  cashAlternative: numeric('cash_alternative', { precision: 12, scale: 2 }),
  prizeCategory: varchar('prize_category', { length: 50 }),
  ...timestamps
});
`);

// 6. Generate Memberships
fs.writeFileSync(path.join(schemaDir, 'memberships.ts'), `
import { pgTable, uuid, varchar, numeric, date } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { membershipStatusEnum, tokenStatusEnum } from './enums';
import { customers } from './crm';
import { schemes } from './schemes';

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  schemeId: uuid('scheme_id').references(() => schemes.id).notNull(),
  joiningDate: date('joining_date').notNull(),
  securityDeposit: numeric('security_deposit', { precision: 12, scale: 2 }).default('0'),
  status: membershipStatusEnum('status').default('ACTIVE').notNull(),
  luckyStatus: varchar('lucky_status', { length: 50 }),
  exitDate: date('exit_date'),
  ...timestamps
});

export const tokens = pgTable('tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }).notNull(),
  tokenNumber: varchar('token_number', { length: 20 }).notNull(),
  status: tokenStatusEnum('status').default('ACTIVE').notNull(),
  ...timestamps
});
`);

// 7. Generate Operations
fs.writeFileSync(path.join(schemaDir, 'operations.ts'), `
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
`);

// 8. Generate Finance
fs.writeFileSync(path.join(schemaDir, 'finance.ts'), `
import { pgTable, uuid, varchar, text, numeric, date } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { paymentMethodEnum, paymentItemTypeEnum, depositStatusEnum, ledgerTypeEnum } from './enums';
import { customers } from './crm';
import { collectors } from './iam';
import { memberships } from './memberships';

export const paymentReceipts = pgTable('payment_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptNo: varchar('receipt_no', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  collectorId: uuid('collector_id').references(() => collectors.id),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  referenceNo: varchar('reference_no', { length: 100 }),
  notes: text('notes'),
  ...timestamps
});

export const paymentItems = pgTable('payment_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptId: uuid('receipt_id').references(() => paymentReceipts.id, { onDelete: 'cascade' }).notNull(),
  type: paymentItemTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  referenceId: uuid('reference_id'), // polymorphic: membership_id, draw_id, etc.
  ...timestamps
});

export const securityDeposits = pgTable('security_deposits', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }).notNull(),
  depositDate: date('deposit_date').notNull(),
  adjustmentAmount: numeric('adjustment_amount', { precision: 12, scale: 2 }).default('0'),
  refundAmount: numeric('refund_amount', { precision: 12, scale: 2 }).default('0'),
  status: depositStatusEnum('status').default('HELD').notNull(),
  ...timestamps
});

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id),
  type: ledgerTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // INSTALLMENT, PENALTY, etc
  referenceId: uuid('reference_id'),
  notes: text('notes'),
  ...timestamps
});
`);

// 9. Generate Draws & Gifts
fs.writeFileSync(path.join(schemaDir, 'draws.ts'), `
import { pgTable, uuid, varchar, text, integer, numeric, date, boolean } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { giftStatusEnum } from './enums';
import { schemes, schemePrizes } from './schemes';
import { memberships } from './memberships';
import { customers } from './crm';

export const draws = pgTable('draws', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id).notNull(),
  drawMonth: integer('draw_month').notNull(),
  drawDate: date('draw_date').notNull(),
  notes: text('notes'),
  ...timestamps
});

export const drawResults = pgTable('draw_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  drawId: uuid('draw_id').references(() => draws.id, { onDelete: 'cascade' }).notNull(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  prizeId: uuid('prize_id').references(() => schemePrizes.id).notNull(),
  isCashAlternative: boolean('is_cash_alternative').default(false).notNull(),
  ...timestamps
});

export const giftInventory = pgTable('gift_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemName: varchar('item_name', { length: 100 }).notNull(),
  stockCount: integer('stock_count').default(0).notNull(),
  unitValue: numeric('unit_value', { precision: 12, scale: 2 }),
  ...timestamps
});

export const giftDeliveries = pgTable('gift_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  drawResultId: uuid('draw_result_id').references(() => drawResults.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  status: giftStatusEnum('status').default('PENDING').notNull(),
  deliveryDate: date('delivery_date'),
  notes: text('notes'),
  ...timestamps
});
`);

// 10. Generate Exits (Settlement / Maturity)
fs.writeFileSync(path.join(schemaDir, 'exits.ts'), `
import { pgTable, uuid, text, numeric, date } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { memberships } from './memberships';

export const settlements = pgTable('settlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  settlementDate: date('settlement_date').notNull(),
  totalPaidAmount: numeric('total_paid_amount', { precision: 12, scale: 2 }).notNull(),
  refundPercentage: numeric('refund_percentage', { precision: 5, scale: 2 }).notNull(),
  deductionPercentage: numeric('deduction_percentage', { precision: 5, scale: 2 }).notNull(),
  finalRefundAmount: numeric('final_refund_amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  ...timestamps
});

export const maturities = pgTable('maturities', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  maturityDate: date('maturity_date').notNull(),
  expectedAmount: numeric('expected_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull(),
  pendingAmount: numeric('pending_amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull(), // PENDING, COMPLETED
  ...timestamps
});
`);

// 11. Generate System
fs.writeFileSync(path.join(schemaDir, 'system.ts'), `
import { pgTable, uuid, varchar, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { users } from './iam';

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  ...timestamps
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  ...timestamps
});

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value').notNull(),
  ...timestamps
});
`);

// 12. Create Master Index Export
fs.writeFileSync(path.join(schemaDir, 'index.ts'), `
export * from './enums';
export * from './utils';
export * from './iam';
export * from './crm';
export * from './schemes';
export * from './memberships';
export * from './operations';
export * from './finance';
export * from './draws';
export * from './exits';
export * from './system';
`);

console.log("Schema files generated perfectly according to Phase 2 requirements.");
