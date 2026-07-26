import { pgEnum } from 'drizzle-orm/pg-core';

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
