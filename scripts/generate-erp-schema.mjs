import fs from 'fs';
import path from 'path';

const schemaDir = 'lib/db/src/schema';
if (!fs.existsSync(schemaDir)) {
  fs.mkdirSync(schemaDir, { recursive: true });
}

const files = {
  'enums.ts': `import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role_enum', ['ADMIN', 'MANAGER', 'CLERK', 'COLLECTOR']);
export const customerStatusEnum = pgEnum('customer_status_enum', ['ACTIVE', 'INACTIVE', 'BLACKLISTED']);
export const membershipStatusEnum = pgEnum('membership_status_enum', ['ACTIVE', 'LUCKY', 'SETTLED', 'MATURED', 'CANCELLED']);
export const loanTypeEnum = pgEnum('loan_type_enum', ['SECURED', 'UNSECURED']);
export const loanStatusEnum = pgEnum('loan_status_enum', ['ACTIVE', 'CLOSED', 'DEFAULTED']);
export const paymentMethodEnum = pgEnum('payment_method_enum', ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']);
export const paymentItemTypeEnum = pgEnum('payment_item_type_enum', [
  'INSTALLMENT', 'LOAN_EMI', 'INTEREST', 'PENALTY', 
  'SECURITY_DEPOSIT', 'REGISTRATION_FEE', 'GIFT_PAYMENT', 'REFUND', 'SETTLEMENT'
]);
export const giftSelectionEnum = pgEnum('gift_selection_enum', ['GIFT_TAKEN', 'CASH_TAKEN']);
export const visitStatusEnum = pgEnum('visit_status_enum', ['COLLECTED', 'NOT_AVAILABLE', 'PROMISE_TO_PAY', 'REFUSED']);
`,
  'utils.ts': `import { timestamp } from 'drizzle-orm/pg-core';

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};
`,
  'iam.ts': `import { pgTable, uuid, varchar, text, decimal } from 'drizzle-orm/pg-core';
import { roleEnum } from './enums';
import { timestamps } from './utils';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 20 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').default('CLERK').notNull(),
  ...timestamps
});

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  salary: decimal('salary', { precision: 12, scale: 2 }),
  ...timestamps
});

export const collectors = pgTable('collectors', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'restrict' }).notNull(),
  maxCashLimit: decimal('max_cash_limit', { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});
`,
  'crm.ts': `import { pgTable, uuid, varchar, timestamp, text } from 'drizzle-orm/pg-core';
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
`,
  'schemes.ts': `import { pgTable, uuid, varchar, timestamp, integer, decimal } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';

export const schemes = pgTable('schemes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  ...timestamps
});

export const schemeConfigs = pgTable('scheme_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'cascade' }).notNull(),
  durationMonths: integer('duration_months').notNull(),
  installmentAmount: decimal('installment_amount', { precision: 12, scale: 2 }).notNull(),
  securityDepositAmount: decimal('security_deposit_amount', { precision: 12, scale: 2 }).notNull(),
  drawDayOfMonth: integer('draw_day_of_month').notNull(),
  settlementPercentage: decimal('settlement_percentage', { precision: 5, scale: 2 }).notNull(),
  ...timestamps
});

export const schemePrizeCatalog = pgTable('scheme_prize_catalog', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'cascade' }).notNull(),
  monthNo: integer('month_no').notNull(),
  giftName: varchar('gift_name', { length: 255 }).notNull(),
  cashAlternative: decimal('cash_alternative', { precision: 12, scale: 2 }),
  ...timestamps
});
`,
  'memberships.ts': `import { pgTable, uuid, varchar, timestamp, boolean, decimal } from 'drizzle-orm/pg-core';
import { membershipStatusEnum } from './enums';
import { timestamps } from './utils';
import { schemes } from './schemes';
import { customers } from './crm';

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'restrict' }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }).notNull(),
  joiningDate: timestamp('joining_date').notNull(),
  status: membershipStatusEnum('status').default('ACTIVE').notNull(),
  ...timestamps
});

export const tokens = pgTable('tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }).notNull(),
  schemeId: uuid('scheme_id').references(() => schemes.id, { onDelete: 'restrict' }).notNull(),
  tokenNumber: varchar('token_number', { length: 50 }).notNull(),
  ...timestamps
});

export const securityDeposits = pgTable('security_deposits', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean('is_paid').default(false).notNull(),
  ...timestamps
});
`,
  'finance.ts': `import { pgTable, uuid, varchar, timestamp, text, integer, boolean, decimal } from 'drizzle-orm/pg-core';
import { paymentMethodEnum, paymentItemTypeEnum } from './enums';
import { timestamps } from './utils';
import { customers } from './crm';
import { collectors } from './iam';
import { collectionVisits } from './operations';
import { memberships } from './memberships';

export const paymentReceipts = pgTable('payment_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptNo: varchar('receipt_no', { length: 50 }).unique().notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  collectorId: uuid('collector_id').references(() => collectors.id),
  visitId: uuid('visit_id').references(() => collectionVisits.id),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});

export const paymentItems = pgTable('payment_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptId: uuid('receipt_id').references(() => paymentReceipts.id, { onDelete: 'cascade' }).notNull(),
  type: paymentItemTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  referenceId: uuid('reference_id'), // Connects to installments, loans, penalties
  ...timestamps
});

export const installments = pgTable('installments', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'restrict' }).notNull(),
  monthNo: integer('month_no').notNull(),
  amountDue: decimal('amount_due', { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  isPaid: boolean('is_paid').default(false).notNull(),
  ...timestamps
});

export const penalties = pgTable('penalties', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason'),
  isPaid: boolean('is_paid').default(false).notNull(),
  ...timestamps
});

export const ledgerAccounts = pgTable('ledger_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // ASSET, LIABILITY, INCOME, EXPENSE
  ...timestamps
});

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => ledgerAccounts.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  isDebit: boolean('is_debit').notNull(),
  receiptId: uuid('receipt_id').references(() => paymentReceipts.id),
  description: text('description'),
  ...timestamps
});
`,
  'operations.ts': `import { pgTable, uuid, text, timestamp, decimal } from 'drizzle-orm/pg-core';
import { visitStatusEnum } from './enums';
import { timestamps } from './utils';
import { collectors } from './iam';
import { customers } from './crm';

export const collectionVisits = pgTable('collection_visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectorId: uuid('collector_id').references(() => collectors.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  status: visitStatusEnum('status').notNull(),
  notes: text('notes'),
  locationLat: decimal('location_lat', { precision: 10, scale: 6 }),
  locationLng: decimal('location_lng', { precision: 10, scale: 6 }),
  ...timestamps
});

export const collectorDailyClosings = pgTable('collector_daily_closings', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectorId: uuid('collector_id').references(() => collectors.id).notNull(),
  closingDate: timestamp('closing_date').notNull(),
  totalCollected: decimal('total_collected', { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});

export const collectorCashHandovers = pgTable('collector_cash_handovers', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectorId: uuid('collector_id').references(() => collectors.id).notNull(),
  closingId: uuid('closing_id').references(() => collectorDailyClosings.id).notNull(),
  amountHandedOver: decimal('amount_handed_over', { precision: 12, scale: 2 }).notNull(),
  receiverId: uuid('receiver_id'), // Admin receiving cash
  ...timestamps
});
`,
  'draws.ts': `import { pgTable, uuid, timestamp, integer, decimal, varchar } from 'drizzle-orm/pg-core';
import { giftSelectionEnum } from './enums';
import { timestamps } from './utils';
import { schemes } from './schemes';
import { memberships } from './memberships';

export const draws = pgTable('draws', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeId: uuid('scheme_id').references(() => schemes.id).notNull(),
  drawDate: timestamp('draw_date').notNull(),
  monthNo: integer('month_no').notNull(),
  ...timestamps
});

export const drawResults = pgTable('draw_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  drawId: uuid('draw_id').references(() => draws.id, { onDelete: 'cascade' }).notNull(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  prizeAmount: decimal('prize_amount', { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});

export const giftInventory = pgTable('gift_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  stockQuantity: integer('stock_quantity').default(0).notNull(),
  ...timestamps
});

export const giftSelections = pgTable('gift_selections', {
  id: uuid('id').defaultRandom().primaryKey(),
  resultId: uuid('result_id').references(() => drawResults.id, { onDelete: 'cascade' }).notNull(),
  selection: giftSelectionEnum('selection').notNull(),
  itemId: uuid('item_id').references(() => giftInventory.id),
  cashAmount: decimal('cash_amount', { precision: 12, scale: 2 }),
  ...timestamps
});

export const giftDeliveries = pgTable('gift_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  selectionId: uuid('selection_id').references(() => giftSelections.id, { onDelete: 'cascade' }).notNull(),
  deliveryDate: timestamp('delivery_date'),
  photoUrl: varchar('photo_url', { length: 1024 }),
  ...timestamps
});

export const giftHistory = pgTable('gift_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').references(() => giftInventory.id, { onDelete: 'cascade' }).notNull(),
  changeQuantity: integer('change_quantity').notNull(),
  reason: varchar('reason', { length: 255 }),
  ...timestamps
});
`,
  'loans.ts': `import { pgTable, uuid, timestamp, decimal } from 'drizzle-orm/pg-core';
import { loanTypeEnum, loanStatusEnum } from './enums';
import { timestamps } from './utils';
import { customers } from './crm';
import { memberships } from './memberships';

export const loans = pgTable('loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  membershipId: uuid('membership_id').references(() => memberships.id), // Nullable for UNSECURED
  type: loanTypeEnum('type').notNull(),
  status: loanStatusEnum('status').default('ACTIVE').notNull(),
  principalAmount: decimal('principal_amount', { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal('interest_rate', { precision: 5, scale: 2 }).notNull(),
  ...timestamps
});

export const loanEmis = pgTable('loan_emis', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id, { onDelete: 'cascade' }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  principalComponent: decimal('principal_component', { precision: 12, scale: 2 }).notNull(),
  interestComponent: decimal('interest_component', { precision: 12, scale: 2 }).notNull(),
  isPaid: timestamp('is_paid'),
  ...timestamps
});
`,
  'exits.ts': `import { pgTable, uuid, decimal, text } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { memberships } from './memberships';

export const settlements = pgTable('settlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  refundCalculated: decimal('refund_calculated', { precision: 12, scale: 2 }).notNull(),
  deductions: decimal('deductions', { precision: 12, scale: 2 }).default('0').notNull(),
  finalAmount: decimal('final_amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  ...timestamps
});

export const maturityPayments = pgTable('maturity_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  calculatedAmount: decimal('calculated_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  ...timestamps
});

export const refunds = pgTable('refunds', {
  id: uuid('id').defaultRandom().primaryKey(),
  membershipId: uuid('membership_id').references(() => memberships.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason'),
  ...timestamps
});
`,
  'system.ts': `import { pgTable, uuid, varchar, text, jsonb } from 'drizzle-orm/pg-core';
import { timestamps } from './utils';
import { users } from './iam';

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  isRead: text('is_read'),
  ...timestamps
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  action: varchar('action', { length: 100 }).notNull(),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  recordId: uuid('record_id').notNull(),
  changes: jsonb('changes'),
  ...timestamps
});

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 100 }).unique().notNull(),
  value: jsonb('value').notNull(),
  ...timestamps
});
`,
  'index.ts': `export * from './enums';
export * from './iam';
export * from './crm';
export * from './schemes';
export * from './memberships';
export * from './finance';
export * from './operations';
export * from './draws';
export * from './loans';
export * from './exits';
export * from './system';
`
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(schemaDir, filename), content);
  console.log(\`Generated \${filename}\`);
}
