
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
