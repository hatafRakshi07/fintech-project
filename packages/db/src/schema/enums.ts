import { pgEnum } from 'drizzle-orm/pg-core';

export const orgRoleEnum = pgEnum('org_role_enum', ['OWNER', 'ADMIN', 'STAFF', 'COLLECTOR']);
export const customerStatusEnum = pgEnum('customer_status_enum', ['ACTIVE', 'MERGED', 'INACTIVE', 'BLOCKED', 'DELETED']);
export const committeeStatusEnum = pgEnum('committee_status_enum', ['ACTIVE', 'COMPLETED', 'CANCELLED']);
export const committeeMonthStatusEnum = pgEnum('committee_month_status_enum', ['UPCOMING', 'OPEN', 'CLOSED', 'COMPLETED']);
export const employeeStatusEnum = pgEnum('employee_status_enum', ['ACTIVE', 'INACTIVE']);
export const tokenStatusEnum = pgEnum('token_status_enum', ['ACTIVE', 'OUT', 'TRANSFERRED', 'CANCELLED', 'SETTLED']);
export const installmentStatusEnum = pgEnum('installment_status_enum', ['PENDING', 'PAID', 'PARTIAL', 'LATE', 'CANCELLED_LUCKY']);
export const paymentModeEnum = pgEnum('payment_mode_enum', ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT']);
export const rewardTypeEnum = pgEnum('reward_type_enum', [
  'LUCKY_WINNER', 
  'GIFT_WINNER', 
  'PREVIOUS_TOKEN_REWARD', 
  'NEXT_TOKEN_REWARD', 
  'WHOLE_LINE_REWARD', 
  'CASH_REWARD', 
  'SPECIAL_REWARD'
]);
export const giftClaimStatusEnum = pgEnum('gift_claim_status_enum', ['PENDING', 'DELIVERED', 'CASH_CLAIMED', 'CANCELLED']);
export const loanStatusEnum = pgEnum('loan_status_enum', ['REQUESTED', 'APPROVED', 'DISBURSED', 'REPAYING', 'CLOSED', 'DEFAULTED']);
export const settlementStatusEnum = pgEnum('settlement_status_enum', ['CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CLOSED']);
export const cashbookTypeEnum = pgEnum('cashbook_type_enum', ['CASH_IN', 'CASH_OUT', 'ADJUSTMENT']);
export const collectionRegisterStatusEnum = pgEnum('collection_register_status_enum', ['OPEN', 'CLOSED', 'VERIFIED']);
export const drawEventStatusEnum = pgEnum('draw_event_status_enum', ['PENDING', 'COMPLETED', 'ROLLED_BACK']);
export const expenseStatusEnum = pgEnum('expense_status_enum', ['PENDING', 'APPROVED', 'PAID', 'CANCELLED']);
export const notificationStatusEnum = pgEnum('notification_status_enum', ['QUEUED', 'SENT', 'FAILED', 'DELIVERED']);
export const notificationChannelEnum = pgEnum('notification_channel_enum', ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH']);
export const importStatusEnum = pgEnum('import_status_enum', ['PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED']);
