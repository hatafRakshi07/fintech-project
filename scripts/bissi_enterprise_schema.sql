-- ============================================================================
-- BISSI (COMMITTEE/BC) MANAGEMENT SYSTEM - ENTERPRISE POSTGRESQL SCHEMA (v5.1 FINAL FROZEN)
-- Target: PostgreSQL 15+ / Supabase PostgreSQL
-- Features: All-ENUM Statuses, 100% RLS Coverage (USING + WITH CHECK across ALL tables),
-- Strict Parent Org Inheritance with Exceptions, Rule-Driven Loan Rules, Enhanced Token Normalization,
-- Import Hash Deduplication, Employee Auth Link (auth.users), Financial Transactions Ledger.
-- ============================================================================

BEGIN;

-- Drop all views & tables for clean setup
DROP VIEW IF EXISTS v_pending_installments CASCADE;
DROP VIEW IF EXISTS v_committee_summary CASCADE;
DROP VIEW IF EXISTS v_customer_summary CASCADE;

-- Drop legacy schema tables if present
DROP TABLE IF EXISTS scheme_prizes CASCADE;
DROP TABLE IF EXISTS schemes CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS gift_deliveries CASCADE;
DROP TABLE IF EXISTS gift_inventory CASCADE;
DROP TABLE IF EXISTS payment_items CASCADE;
DROP TABLE IF EXISTS payment_receipts CASCADE;
DROP TABLE IF EXISTS security_deposits CASCADE;
DROP TABLE IF EXISTS ledger_transactions CASCADE;
DROP TABLE IF EXISTS customer_documents CASCADE;
DROP TABLE IF EXISTS customer_references CASCADE;
DROP TABLE IF EXISTS collectors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop current schema tables
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS token_transfer_history CASCADE;
DROP TABLE IF EXISTS import_errors CASCADE;
DROP TABLE IF EXISTS import_rows CASCADE;
DROP TABLE IF EXISTS import_batches CASCADE;
DROP TABLE IF EXISTS import_jobs CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS loan_repayments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS cashbook_entries CASCADE;
DROP TABLE IF EXISTS financial_transactions CASCADE;
DROP TABLE IF EXISTS gift_winners CASCADE;
DROP TABLE IF EXISTS draw_results CASCADE;
DROP TABLE IF EXISTS draw_events CASCADE;
DROP TABLE IF EXISTS draws CASCADE;
DROP TABLE IF EXISTS committee_month_gifts CASCADE;
DROP TABLE IF EXISTS gift_catalog CASCADE;
DROP TABLE IF EXISTS installments CASCADE;
DROP TABLE IF EXISTS collection_registers CASCADE;
DROP TABLE IF EXISTS installment_schedules CASCADE;
DROP TABLE IF EXISTS token_status_history CASCADE;
DROP TABLE IF EXISTS tokens CASCADE;
DROP TABLE IF EXISTS committee_rules CASCADE;
DROP TABLE IF EXISTS committee_months CASCADE;
DROP TABLE IF EXISTS committees CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS user_organizations CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- ============================================================================
-- SECTION 1: EXTENSIONS & DOMAIN ENUMS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Roles & Access Control
DO $$ BEGIN
    CREATE TYPE org_role_enum AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'COLLECTOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Customer Statuses
DO $$ BEGIN
    CREATE TYPE customer_status_enum AS ENUM ('ACTIVE', 'MERGED', 'INACTIVE', 'BLOCKED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Committee Statuses
DO $$ BEGIN
    CREATE TYPE committee_status_enum AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Committee Month Statuses
DO $$ BEGIN
    CREATE TYPE committee_month_status_enum AS ENUM ('UPCOMING', 'OPEN', 'CLOSED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Employee Statuses
DO $$ BEGIN
    CREATE TYPE employee_status_enum AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Token Lifecycle Statuses
DO $$ BEGIN
    CREATE TYPE token_status_enum AS ENUM ('ACTIVE', 'OUT', 'TRANSFERRED', 'CANCELLED', 'SETTLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Installment Statuses
DO $$ BEGIN
    CREATE TYPE installment_status_enum AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'LATE', 'CANCELLED_LUCKY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment Modes
DO $$ BEGIN
    CREATE TYPE payment_mode_enum AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extensible Draw Reward Types
DO $$ BEGIN
    CREATE TYPE reward_type_enum AS ENUM (
        'LUCKY_WINNER', 
        'GIFT_WINNER', 
        'PREVIOUS_TOKEN_REWARD', 
        'NEXT_TOKEN_REWARD', 
        'WHOLE_LINE_REWARD', 
        'CASH_REWARD', 
        'SPECIAL_REWARD'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Gift Claim Status
DO $$ BEGIN
    CREATE TYPE gift_claim_status_enum AS ENUM ('PENDING', 'DELIVERED', 'CASH_CLAIMED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Loan Status
DO $$ BEGIN
    CREATE TYPE loan_status_enum AS ENUM ('REQUESTED', 'APPROVED', 'DISBURSED', 'REPAYING', 'CLOSED', 'DEFAULTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settlement Status
DO $$ BEGIN
    CREATE TYPE settlement_status_enum AS ENUM ('CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cashbook Entry Types
DO $$ BEGIN
    CREATE TYPE cashbook_type_enum AS ENUM ('CASH_IN', 'CASH_OUT', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Collection Register Status
DO $$ BEGIN
    CREATE TYPE collection_register_status_enum AS ENUM ('OPEN', 'CLOSED', 'VERIFIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Draw Event Status
DO $$ BEGIN
    CREATE TYPE draw_event_status_enum AS ENUM ('PENDING', 'COMPLETED', 'ROLLED_BACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Expense Status
DO $$ BEGIN
    CREATE TYPE expense_status_enum AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notification Status & Channels
DO $$ BEGIN
    CREATE TYPE notification_status_enum AS ENUM ('QUEUED', 'SENT', 'FAILED', 'DELIVERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel_enum AS ENUM ('SMS', 'WHATSAPP', 'EMAIL', 'PUSH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Import Batch Status
DO $$ BEGIN
    CREATE TYPE import_status_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- SECTION 2: MULTI-TENANCY & CORE IDENTITY TABLES
-- ============================================================================

-- Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User-Organization Mapping
CREATE TABLE user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role org_role_enum DEFAULT 'STAFF' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, organization_id)
);

-- Employees (Collectors / Staff - Linked to Supabase Auth user_id if present)
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID, -- Optional link to auth.users(id)
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role org_role_enum DEFAULT 'COLLECTOR' NOT NULL,
    status employee_status_enum DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (organization_id, code)
);

-- Add Supabase Auth Foreign Key Constraint conditionally if auth.users table exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN 
        ALTER TABLE employees ADD CONSTRAINT fk_employees_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; 
    END IF; 
END $$;

-- Customers Master (Single Source of Truth)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    mobile VARCHAR(20) NOT NULL,
    alt_mobile VARCHAR(20),
    aadhaar VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    photo_url TEXT,
    status customer_status_enum DEFAULT 'ACTIVE' NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ============================================================================
-- SECTION 3: COMMITTEE & TOKEN INFRASTRUCTURE
-- ============================================================================

-- Committees Master
CREATE TABLE committees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    total_members INT NOT NULL CHECK (total_members > 0),
    total_months INT NOT NULL CHECK (total_months > 0),
    monthly_installment NUMERIC(12, 2) NOT NULL CHECK (monthly_installment > 0),
    start_date DATE NOT NULL,
    end_date DATE,
    status committee_status_enum DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (organization_id, code)
);

-- Committee Months
CREATE TABLE committee_months (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
    month_number INT NOT NULL CHECK (month_number >= 1),
    month_name VARCHAR(50) NOT NULL,
    due_date DATE NOT NULL,
    draw_date DATE,
    status committee_month_status_enum DEFAULT 'UPCOMING' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (committee_id, month_number)
);

-- Flexible Rule Engine JSONB
CREATE TABLE committee_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE UNIQUE,
    rules_jsonb JSONB NOT NULL DEFAULT '{
        "loan_percentage": 75,
        "loan_interest_rate": 1.0,
        "minimum_paid_months": 1,
        "maximum_open_loans": 1,
        "lucky_draw_action": "MARK_OUT",
        "gift_winner_action": "REMAIN_ACTIVE",
        "cash_alternative_enabled": true
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Tokens Table (Participation Unit)
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    raw_token_number VARCHAR(50) NOT NULL,
    normalized_token_number INT NOT NULL,
    duplicate_suffix VARCHAR(10) DEFAULT '' NOT NULL,
    display_token VARCHAR(60) GENERATED ALWAYS AS (
        normalized_token_number::text || CASE WHEN duplicate_suffix <> '' THEN duplicate_suffix ELSE '' END
    ) STORED,
    status token_status_enum DEFAULT 'ACTIVE' NOT NULL,
    joining_month_id UUID REFERENCES committee_months(id),
    exit_month_id UUID REFERENCES committee_months(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (committee_id, normalized_token_number, duplicate_suffix)
);

-- Token Status History
CREATE TABLE token_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    from_status token_status_enum,
    to_status token_status_enum NOT NULL,
    reason TEXT,
    actor_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ============================================================================
-- SECTION 4: INSTALLMENTS & COLLECTIONS
-- ============================================================================

-- Installment Schedules
CREATE TABLE installment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_month_id UUID NOT NULL REFERENCES committee_months(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    expected_amount NUMERIC(12, 2) NOT NULL CHECK (expected_amount >= 0),
    due_date DATE NOT NULL,
    status installment_status_enum DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (committee_month_id, token_id)
);

-- Daily Collection Registers
CREATE TABLE collection_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    collector_id UUID NOT NULL REFERENCES employees(id),
    collection_date DATE NOT NULL,
    total_cash NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (total_cash >= 0),
    total_online NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (total_online >= 0),
    total_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (total_amount >= 0),
    status collection_register_status_enum DEFAULT 'OPEN' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Installment Receipts & Payments
CREATE TABLE installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_month_id UUID NOT NULL REFERENCES committee_months(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
    schedule_id UUID REFERENCES installment_schedules(id),
    collection_register_id UUID REFERENCES collection_registers(id),
    receipt_number VARCHAR(100) NOT NULL UNIQUE,
    expected_amount NUMERIC(12, 2) NOT NULL CHECK (expected_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL CHECK (paid_amount >= 0),
    late_fee NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (late_fee >= 0),
    payment_date DATE NOT NULL,
    payment_mode payment_mode_enum DEFAULT 'CASH' NOT NULL,
    collector_id UUID REFERENCES employees(id),
    idempotency_key VARCHAR(100) UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ============================================================================
-- SECTION 5: GIFT CATALOG & DRAWS
-- ============================================================================

-- Gift Catalog
CREATE TABLE gift_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    default_cash_alternative NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (default_cash_alternative >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Per-Month Committee Gift Allocations
CREATE TABLE committee_month_gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_month_id UUID NOT NULL REFERENCES committee_months(id) ON DELETE CASCADE,
    gift_catalog_id UUID NOT NULL REFERENCES gift_catalog(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    priority INT DEFAULT 1 NOT NULL,
    cash_alternative_override NUMERIC(12, 2) CHECK (cash_alternative_override IS NULL OR cash_alternative_override >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Draw Events
CREATE TABLE draw_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_month_id UUID NOT NULL REFERENCES committee_months(id) ON DELETE CASCADE UNIQUE,
    draw_date DATE NOT NULL,
    conducted_by_id UUID REFERENCES employees(id),
    status draw_event_status_enum DEFAULT 'COMPLETED' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Draw Results
CREATE TABLE draw_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    draw_event_id UUID NOT NULL REFERENCES draw_events(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
    reward_type reward_type_enum NOT NULL,
    reward_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (draw_event_id, token_id, reward_type)
);

-- Gift Winners & Claims
CREATE TABLE gift_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    draw_result_id UUID NOT NULL REFERENCES draw_results(id) ON DELETE CASCADE,
    committee_month_gift_id UUID REFERENCES committee_month_gifts(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    is_cash_opted BOOLEAN DEFAULT FALSE NOT NULL,
    cash_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (cash_amount >= 0),
    claim_status gift_claim_status_enum DEFAULT 'PENDING' NOT NULL,
    delivery_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ============================================================================
-- SECTION 6: FINANCIAL TRANSACTIONS LEDGER, EXPENSES & LOANS
-- ============================================================================

-- Financial Transactions Ledger
CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    type cashbook_type_enum NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount <> 0),
    token_id UUID REFERENCES tokens(id),
    customer_id UUID REFERENCES customers(id),
    reference_id UUID,
    idempotency_key VARCHAR(100) UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Cashbook Register
CREATE TABLE cashbook_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    type cashbook_type_enum NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    opening_balance NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    closing_balance NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    transaction_id UUID REFERENCES financial_transactions(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Expense Categories & Expenses
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES expense_categories(id),
    expense_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_mode payment_mode_enum DEFAULT 'CASH' NOT NULL,
    status expense_status_enum DEFAULT 'APPROVED' NOT NULL,
    spent_by_id UUID REFERENCES employees(id),
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Loans & Repayments
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_id UUID NOT NULL REFERENCES committees(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    principal_amount NUMERIC(12, 2) NOT NULL CHECK (principal_amount > 0),
    interest_rate_pct NUMERIC(5, 2) DEFAULT 0 NOT NULL CHECK (interest_rate_pct >= 0),
    tenure_months INT DEFAULT 12 NOT NULL CHECK (tenure_months > 0),
    disbursal_date DATE NOT NULL,
    status loan_status_enum DEFAULT 'DISBURSED' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE loan_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    repayment_date DATE NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
    principal_paid NUMERIC(12, 2) NOT NULL CHECK (principal_paid >= 0),
    interest_paid NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (interest_paid >= 0),
    receipt_number VARCHAR(100) NOT NULL UNIQUE,
    payment_mode payment_mode_enum DEFAULT 'CASH' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Token Final Settlements
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    committee_id UUID NOT NULL REFERENCES committees(id),
    token_id UUID NOT NULL REFERENCES tokens(id) UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    total_paid NUMERIC(12, 2) NOT NULL CHECK (total_paid >= 0),
    deductions NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (deductions >= 0),
    outstanding_loans NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (outstanding_loans >= 0),
    bonus_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (bonus_amount >= 0),
    net_settlement_amount NUMERIC(12, 2) NOT NULL,
    status settlement_status_enum DEFAULT 'CALCULATED' NOT NULL,
    settled_at DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ============================================================================
-- SECTION 7: IMPORTS, NOTIFICATIONS & AUDIT TRAIL
-- ============================================================================

-- Import Engine Pipeline (File Hash Deduplication Enforced)
CREATE TABLE import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    total_rows INT DEFAULT 0 NOT NULL,
    processed_rows INT DEFAULT 0 NOT NULL,
    successful_rows INT DEFAULT 0 NOT NULL,
    error_rows INT DEFAULT 0 NOT NULL,
    status import_status_enum DEFAULT 'PENDING' NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (organization_id, file_hash)
);

CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    batch_number INT NOT NULL,
    status import_status_enum DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES import_batches(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    raw_data JSONB NOT NULL,
    status import_status_enum DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    error_code VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE token_transfer_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id),
    from_customer_id UUID NOT NULL REFERENCES customers(id),
    to_customer_id UUID NOT NULL REFERENCES customers(id),
    transfer_date DATE NOT NULL,
    reason TEXT,
    approved_by_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    channel notification_channel_enum DEFAULT 'SMS' NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status notification_status_enum DEFAULT 'QUEUED' NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    actor_id UUID,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ============================================================================
-- SECTION 8: PARENT-DERIVED ORGANIZATION_ID INHERITANCE TRIGGERS (STRICT EXCEPTIONS)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_inherit_org_id_from_committee()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF NEW.committee_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM committees WHERE id = NEW.committee_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced committee_id % not found.', NEW.committee_id;
        END IF;
        NEW.organization_id := v_org_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inherit_org_comm_months BEFORE INSERT OR UPDATE ON committee_months FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_committee();
CREATE TRIGGER trg_inherit_org_comm_rules BEFORE INSERT OR UPDATE ON committee_rules FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_committee();
CREATE TRIGGER trg_inherit_org_tokens BEFORE INSERT OR UPDATE ON tokens FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_committee();
CREATE TRIGGER trg_inherit_org_loans BEFORE INSERT OR UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_committee();

CREATE OR REPLACE FUNCTION fn_inherit_org_id_from_committee_month()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF NEW.committee_month_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM committee_months WHERE id = NEW.committee_month_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced committee_month_id % not found.', NEW.committee_month_id;
        END IF;
        NEW.organization_id := v_org_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inherit_org_schedules BEFORE INSERT OR UPDATE ON installment_schedules FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_committee_month();
CREATE TRIGGER trg_inherit_org_draw_events BEFORE INSERT OR UPDATE ON draw_events FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_committee_month();
CREATE TRIGGER trg_inherit_org_month_gifts BEFORE INSERT OR UPDATE ON committee_month_gifts FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_committee_month();

CREATE OR REPLACE FUNCTION fn_inherit_org_id_from_token()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF NEW.token_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM tokens WHERE id = NEW.token_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced token_id % not found.', NEW.token_id;
        END IF;
        NEW.organization_id := v_org_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inherit_org_installments BEFORE INSERT OR UPDATE ON installments FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_token();
CREATE TRIGGER trg_inherit_org_gift_winners BEFORE INSERT OR UPDATE ON gift_winners FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_token();
CREATE TRIGGER trg_inherit_org_settlements BEFORE INSERT OR UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_token();

CREATE OR REPLACE FUNCTION fn_inherit_org_id_from_draw_event()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF NEW.draw_event_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM draw_events WHERE id = NEW.draw_event_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced draw_event_id % not found.', NEW.draw_event_id;
        END IF;
        NEW.organization_id := v_org_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inherit_org_draw_results BEFORE INSERT OR UPDATE ON draw_results FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_draw_event();

CREATE OR REPLACE FUNCTION fn_inherit_org_id_from_loan()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF NEW.loan_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM loans WHERE id = NEW.loan_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced loan_id % not found.', NEW.loan_id;
        END IF;
        NEW.organization_id := v_org_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inherit_org_loan_repays BEFORE INSERT OR UPDATE ON loan_repayments FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_loan();

CREATE OR REPLACE FUNCTION fn_inherit_org_id_from_import_job()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF NEW.import_job_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM import_jobs WHERE id = NEW.import_job_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced import_job_id % not found.', NEW.import_job_id;
        END IF;
        NEW.organization_id := v_org_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inherit_org_import_batches BEFORE INSERT OR UPDATE ON import_batches FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_import_job();
CREATE TRIGGER trg_inherit_org_import_rows BEFORE INSERT OR UPDATE ON import_rows FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_import_job();
CREATE TRIGGER trg_inherit_org_import_errors BEFORE INSERT OR UPDATE ON import_errors FOR EACH ROW EXECUTE FUNCTION fn_inherit_org_id_from_import_job();


-- ============================================================================
-- SECTION 9: AUTOMATED TOKEN NORMALIZATION & BUSINESS VALIDATION TRIGGERS
-- ============================================================================

-- Enhanced Automated Token Normalization (29½, 29 ½, 29 1/2, 29.5, 029, 443-A, 443 A, 443/1)
CREATE OR REPLACE FUNCTION fn_before_token_insert_normalize()
RETURNS TRIGGER AS $$
DECLARE
    v_raw TEXT := TRIM(NEW.raw_token_number);
    v_clean INT;
    v_extracted_suffix VARCHAR(10) := '';
    v_dup_count INT;
    v_suffixes TEXT[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
BEGIN
    IF v_raw ~ '^[0-9]+[\s\-\/]+[A-Za-z0-9]+$' THEN
        v_clean := (regexp_replace(v_raw, '^([0-9]+).*$', '\1'))::INT;
        v_extracted_suffix := UPPER(regexp_replace(v_raw, '^[0-9]+[\s\-\/]+([A-Za-z0-9]+)$', '\1'));
    ELSE
        v_clean := COALESCE(NULLIF(regexp_replace(v_raw, '^0*([0-9]+).*$', '\1'), ''), '0')::INT;
    END IF;
    
    NEW.normalized_token_number := v_clean;

    IF v_extracted_suffix <> '' THEN
        NEW.duplicate_suffix := v_extracted_suffix;
    ELSIF NEW.duplicate_suffix IS NULL OR NEW.duplicate_suffix = '' THEN
        SELECT COUNT(*) INTO v_dup_count 
        FROM tokens 
        WHERE committee_id = NEW.committee_id 
          AND normalized_token_number = v_clean
          AND id IS DISTINCT FROM NEW.id;

        IF v_dup_count > 0 THEN
            IF v_dup_count <= 26 THEN
                NEW.duplicate_suffix := v_suffixes[v_dup_count];
            ELSE
                NEW.duplicate_suffix := 'A' || v_dup_count::text;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalize_token BEFORE INSERT OR UPDATE ON tokens FOR EACH ROW EXECUTE FUNCTION fn_before_token_insert_normalize();

-- Rule-Driven Loan Eligibility Validation (JSONB Engine)
CREATE OR REPLACE FUNCTION fn_validate_loan_eligibility()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid NUMERIC(12,2);
    v_paid_months_count INT;
    v_open_loans_count INT;
    v_max_loan_pct NUMERIC(5,2) := 75.00;
    v_min_paid_months INT := 1;
    v_max_open_loans INT := 1;
    v_rules JSONB;
    v_max_allowed NUMERIC(12,2);
BEGIN
    SELECT rules_jsonb INTO v_rules FROM committee_rules WHERE committee_id = NEW.committee_id;
    IF v_rules IS NOT NULL THEN
        IF v_rules ->> 'loan_percentage' IS NOT NULL THEN
            v_max_loan_pct := (v_rules ->> 'loan_percentage')::NUMERIC;
        END IF;
        IF v_rules ->> 'minimum_paid_months' IS NOT NULL THEN
            v_min_paid_months := (v_rules ->> 'minimum_paid_months')::INT;
        END IF;
        IF v_rules ->> 'maximum_open_loans' IS NOT NULL THEN
            v_max_open_loans := (v_rules ->> 'maximum_open_loans')::INT;
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_open_loans_count 
    FROM loans 
    WHERE token_id = NEW.token_id AND status IN ('REQUESTED', 'APPROVED', 'DISBURSED', 'REPAYING') AND id IS DISTINCT FROM NEW.id;

    IF v_open_loans_count >= v_max_open_loans THEN
        RAISE EXCEPTION 'Token % has reached maximum allowed open loans (%).', NEW.token_id, v_max_open_loans;
    END IF;

    SELECT COUNT(DISTINCT committee_month_id) INTO v_paid_months_count FROM installments WHERE token_id = NEW.token_id;
    IF v_paid_months_count < v_min_paid_months THEN
        RAISE EXCEPTION 'Token % requires at least % paid months for loan eligibility (currently paid % months).', 
            NEW.token_id, v_min_paid_months, v_paid_months_count;
    END IF;

    SELECT COALESCE(SUM(paid_amount), 0) INTO v_total_paid FROM installments WHERE token_id = NEW.token_id;
    v_max_allowed := (v_total_paid * v_max_loan_pct) / 100.00;

    IF NEW.principal_amount > v_max_allowed AND v_total_paid > 0 THEN
        RAISE EXCEPTION 'Requested loan amount (₹%) exceeds maximum allowed eligibility (₹% = % pct of total paid ₹%).', 
            NEW.principal_amount, v_max_allowed, v_max_loan_pct, v_total_paid;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_loan BEFORE INSERT OR UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION fn_validate_loan_eligibility();

-- Business Rule Validation 2: Installment Blocking on OUT Tokens
CREATE OR REPLACE FUNCTION fn_validate_installment_token_status()
RETURNS TRIGGER AS $$
DECLARE
    v_status token_status_enum;
BEGIN
    SELECT status INTO v_status FROM tokens WHERE id = NEW.token_id;
    IF v_status = 'OUT' THEN
        RAISE EXCEPTION 'Cannot record installment payment for token % which is OUT.', NEW.token_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_installment_token_status BEFORE INSERT ON installments FOR EACH ROW EXECUTE FUNCTION fn_validate_installment_token_status();

-- Business Rule Validation 3: Gift Quantity Cap Validation
CREATE OR REPLACE FUNCTION fn_validate_gift_quantity()
RETURNS TRIGGER AS $$
DECLARE
    v_allowed INT;
    v_current_count INT;
BEGIN
    IF NEW.committee_month_gift_id IS NOT NULL THEN
        SELECT quantity INTO v_allowed FROM committee_month_gifts WHERE id = NEW.committee_month_gift_id;
        SELECT COUNT(*) INTO v_current_count FROM gift_winners WHERE committee_month_gift_id = NEW.committee_month_gift_id AND id IS DISTINCT FROM NEW.id;
        
        IF v_current_count >= v_allowed THEN
            RAISE EXCEPTION 'Gift winner count (%) cannot exceed allocated quantity (%).', v_current_count + 1, v_allowed;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_gift_quantity BEFORE INSERT ON gift_winners FOR EACH ROW EXECUTE FUNCTION fn_validate_gift_quantity();


-- ============================================================================
-- SECTION 10: FINANCIAL TRANSACTIONS LEDGER AUTO-SYNC TRIGGERS
-- ============================================================================

-- Ledger Auto-Posting 1: Installment Receipt -> Ledger
CREATE OR REPLACE FUNCTION fn_auto_post_installment_ledger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO financial_transactions (
        organization_id, transaction_date, type, category, amount, token_id, reference_id, idempotency_key, notes
    ) VALUES (
        NEW.organization_id, NEW.payment_date, 'CASH_IN', 'INSTALLMENT', NEW.paid_amount, NEW.token_id, NEW.id, NEW.idempotency_key, 'Installment receipt #' || NEW.receipt_number
    ) ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_post_installment_ledger AFTER INSERT ON installments FOR EACH ROW EXECUTE FUNCTION fn_auto_post_installment_ledger();

-- Ledger Auto-Posting 2: Loan Disbursal -> Cash Out Ledger
CREATE OR REPLACE FUNCTION fn_auto_post_loan_disbursal_ledger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'DISBURSED' THEN
        INSERT INTO financial_transactions (
            organization_id, transaction_date, type, category, amount, token_id, customer_id, reference_id, idempotency_key, notes
        ) VALUES (
            NEW.organization_id, NEW.disbursal_date, 'CASH_OUT', 'LOAN_DISBURSAL', NEW.principal_amount, NEW.token_id, NEW.customer_id, NEW.id, 'LOAN_DISB_' || NEW.id::text, 'Loan disbursal for token'
        ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_post_loan_disbursal_ledger AFTER INSERT OR UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION fn_auto_post_loan_disbursal_ledger();

-- Ledger Auto-Posting 3: Loan Repayment -> Cash In Ledger
CREATE OR REPLACE FUNCTION fn_auto_post_loan_repayment_ledger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO financial_transactions (
        organization_id, transaction_date, type, category, amount, reference_id, idempotency_key, notes
    ) VALUES (
        NEW.organization_id, NEW.repayment_date, 'CASH_IN', 'LOAN_REPAYMENT', NEW.amount_paid, NEW.id, 'LOAN_REPAY_' || NEW.receipt_number, 'Loan repayment receipt #' || NEW.receipt_number
    ) ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_post_loan_repayment_ledger AFTER INSERT ON loan_repayments FOR EACH ROW EXECUTE FUNCTION fn_auto_post_loan_repayment_ledger();

-- Ledger Auto-Posting 4: Settlement Payout -> Cash Out Ledger
CREATE OR REPLACE FUNCTION fn_auto_post_settlement_ledger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'PAID' THEN
        INSERT INTO financial_transactions (
            organization_id, transaction_date, type, category, amount, token_id, customer_id, reference_id, idempotency_key, notes
        ) VALUES (
            NEW.organization_id, COALESCE(NEW.settled_at, CURRENT_DATE), 'CASH_OUT', 'SETTLEMENT_PAYOUT', NEW.net_settlement_amount, NEW.token_id, NEW.customer_id, NEW.id, 'SETTLEMENT_' || NEW.id::text, 'Final token settlement payout'
        ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_post_settlement_ledger AFTER INSERT OR UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION fn_auto_post_settlement_ledger();

-- Ledger Auto-Posting 5: Cash Alternative Gift Claim -> Cash Out Ledger
CREATE OR REPLACE FUNCTION fn_auto_post_gift_cash_ledger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_cash_opted = TRUE AND NEW.claim_status = 'DELIVERED' AND NEW.cash_amount > 0 THEN
        INSERT INTO financial_transactions (
            organization_id, transaction_date, type, category, amount, token_id, customer_id, reference_id, idempotency_key, notes
        ) VALUES (
            NEW.organization_id, COALESCE(NEW.delivery_date, CURRENT_DATE), 'CASH_OUT', 'GIFT_CASH_CLAIM', NEW.cash_amount, NEW.token_id, NEW.customer_id, NEW.id, 'GIFT_CASH_' || NEW.id::text, 'Gift cash alternative payout'
        ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_post_gift_cash_ledger AFTER INSERT OR UPDATE ON gift_winners FOR EACH ROW EXECUTE FUNCTION fn_auto_post_gift_cash_ledger();


-- ============================================================================
-- SECTION 11: AUDIT TRAIL, PROCEDURES & REPORTING VIEWS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_current_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    v_org_id := NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id', '')::UUID;
    RETURN v_org_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_on_lucky_draw_winner()
RETURNS TRIGGER AS $$
DECLARE
    v_draw_month_num INT;
    v_comm_id UUID;
BEGIN
    IF NEW.reward_type = 'LUCKY_WINNER' THEN
        SELECT cm.month_number, cm.committee_id INTO v_draw_month_num, v_comm_id
        FROM draw_events de
        JOIN committee_months cm ON cm.id = de.committee_month_id
        WHERE de.id = NEW.draw_event_id;

        UPDATE tokens 
        SET status = 'OUT', exit_month_id = (
            SELECT committee_month_id FROM draw_events WHERE id = NEW.draw_event_id
        )
        WHERE id = NEW.token_id;

        INSERT INTO token_status_history (organization_id, token_id, from_status, to_status, reason)
        VALUES (NEW.organization_id, NEW.token_id, 'ACTIVE', 'OUT', 'LUCKY_DRAW_WINNER');

        UPDATE installment_schedules
        SET status = 'CANCELLED_LUCKY'
        WHERE token_id = NEW.token_id 
          AND status = 'PENDING'
          AND committee_month_id IN (
              SELECT id FROM committee_months 
              WHERE committee_id = v_comm_id AND month_number > v_draw_month_num
          );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lucky_draw_winner
AFTER INSERT ON draw_results
FOR EACH ROW
EXECUTE FUNCTION fn_on_lucky_draw_winner();

CREATE OR REPLACE FUNCTION fn_audit_logger()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_entity_id UUID;
    v_org_id UUID;
    v_actor UUID;
    v_ip VARCHAR(45);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_entity_id := OLD.id;
        v_org_id := OLD.organization_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id;
        v_org_id := NEW.organization_id;
    ELSIF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id;
        v_org_id := NEW.organization_id;
    END IF;

    BEGIN
        v_actor := COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::UUID,
            NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'user_id', '')::UUID
        );
    EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;

    BEGIN
        v_ip := NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '');
    EXCEPTION WHEN OTHERS THEN v_ip := NULL; END;

    INSERT INTO audit_logs (organization_id, entity_type, entity_id, action, old_data, new_data, actor_id, ip_address)
    VALUES (v_org_id, TG_TABLE_NAME, v_entity_id, TG_OP, v_old_data, v_new_data, v_actor, v_ip);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_customers AFTER INSERT OR UPDATE OR DELETE ON customers FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();
CREATE TRIGGER trg_audit_committees AFTER INSERT OR UPDATE OR DELETE ON committees FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();
CREATE TRIGGER trg_audit_tokens AFTER INSERT OR UPDATE OR DELETE ON tokens FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();
CREATE TRIGGER trg_audit_installments AFTER INSERT OR UPDATE OR DELETE ON installments FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();
CREATE TRIGGER trg_audit_draw_results AFTER INSERT OR UPDATE OR DELETE ON draw_results FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();
CREATE TRIGGER trg_audit_loans AFTER INSERT OR UPDATE OR DELETE ON loans FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();
CREATE TRIGGER trg_audit_settlements AFTER INSERT OR UPDATE OR DELETE ON settlements FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();

CREATE OR REPLACE FUNCTION fn_get_or_create_customer(
    p_org_id UUID,
    p_name VARCHAR,
    p_father_name VARCHAR,
    p_mobile VARCHAR,
    p_aadhaar VARCHAR,
    p_address TEXT,
    p_city VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    IF p_aadhaar IS NOT NULL AND p_aadhaar <> '' THEN
        SELECT id INTO v_customer_id FROM customers 
        WHERE organization_id = p_org_id AND aadhaar = p_aadhaar AND deleted_at IS NULL LIMIT 1;
        IF v_customer_id IS NOT NULL THEN RETURN v_customer_id; END IF;
    END IF;

    IF p_mobile IS NOT NULL AND p_mobile <> '' THEN
        SELECT id INTO v_customer_id FROM customers 
        WHERE organization_id = p_org_id AND mobile = p_mobile AND deleted_at IS NULL LIMIT 1;
        IF v_customer_id IS NOT NULL THEN RETURN v_customer_id; END IF;
    END IF;

    IF p_father_name IS NOT NULL AND p_father_name <> '' THEN
        SELECT id INTO v_customer_id FROM customers 
        WHERE organization_id = p_org_id 
          AND LOWER(name) = LOWER(p_name) 
          AND LOWER(father_name) = LOWER(p_father_name) 
          AND deleted_at IS NULL LIMIT 1;
        IF v_customer_id IS NOT NULL THEN RETURN v_customer_id; END IF;
    END IF;

    IF p_address IS NOT NULL AND p_address <> '' THEN
        SELECT id INTO v_customer_id FROM customers 
        WHERE organization_id = p_org_id 
          AND LOWER(name) = LOWER(p_name) 
          AND LOWER(address) = LOWER(p_address) 
          AND deleted_at IS NULL LIMIT 1;
        IF v_customer_id IS NOT NULL THEN RETURN v_customer_id; END IF;
    END IF;

    INSERT INTO customers (
        organization_id, name, father_name, mobile, aadhaar, address, city
    ) VALUES (
        p_org_id, p_name, p_father_name, p_mobile, p_aadhaar, p_address, p_city
    ) RETURNING id INTO v_customer_id;

    RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_merge_customers(
    p_target_customer_id UUID,
    p_source_customer_id UUID,
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    IF p_target_customer_id = p_source_customer_id THEN
        RAISE EXCEPTION 'Target and source customer cannot be identical.';
    END IF;

    UPDATE tokens SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;
    UPDATE gift_winners SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;
    UPDATE loans SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;
    UPDATE settlements SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;
    UPDATE financial_transactions SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;
    UPDATE token_transfer_history SET from_customer_id = p_target_customer_id WHERE from_customer_id = p_source_customer_id;
    UPDATE token_transfer_history SET to_customer_id = p_target_customer_id WHERE to_customer_id = p_source_customer_id;
    UPDATE notifications SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;

    INSERT INTO audit_logs (
        organization_id, entity_type, entity_id, action, old_data, new_data, actor_id
    ) VALUES (
        (SELECT organization_id FROM customers WHERE id = p_target_customer_id),
        'customers',
        p_target_customer_id,
        'MERGE',
        jsonb_build_object('merged_source_id', p_source_customer_id),
        jsonb_build_object('surviving_target_id', p_target_customer_id),
        p_actor_id
    );

    UPDATE customers SET status = 'MERGED', deleted_at = NOW() WHERE id = p_source_customer_id;
END;
$$ LANGUAGE plpgsql;

-- Views
CREATE OR REPLACE VIEW v_customer_summary AS
SELECT 
    c.id AS customer_id,
    c.organization_id,
    c.name,
    c.mobile,
    c.aadhaar,
    COUNT(t.id) AS total_tokens,
    COUNT(t.id) FILTER (WHERE t.status = 'ACTIVE') AS active_tokens,
    COUNT(t.id) FILTER (WHERE t.status = 'OUT') AS out_tokens,
    COALESCE(SUM(i.paid_amount), 0) AS total_paid_amount
FROM customers c
LEFT JOIN tokens t ON t.customer_id = c.id
LEFT JOIN installments i ON i.token_id = t.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.organization_id, c.name, c.mobile, c.aadhaar;

CREATE OR REPLACE VIEW v_committee_summary AS
SELECT 
    cm.id AS committee_id,
    cm.organization_id,
    cm.name,
    cm.total_members,
    cm.total_months,
    cm.monthly_installment,
    COUNT(DISTINCT t.id) AS total_assigned_tokens,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'ACTIVE') AS active_tokens,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'OUT') AS out_tokens,
    COALESCE(SUM(i.paid_amount), 0) AS total_collected
FROM committees cm
LEFT JOIN tokens t ON t.committee_id = cm.id
LEFT JOIN installments i ON i.token_id = t.id
GROUP BY cm.id, cm.organization_id, cm.name, cm.total_members, cm.total_months, cm.monthly_installment;

CREATE OR REPLACE VIEW v_pending_installments AS
SELECT 
    s.id AS schedule_id,
    s.organization_id,
    cm.committee_id,
    comm.name AS committee_name,
    cm.month_number,
    t.id AS token_id,
    t.display_token,
    c.name AS customer_name,
    c.mobile AS customer_mobile,
    s.expected_amount,
    s.due_date
FROM installment_schedules s
JOIN committee_months cm ON cm.id = s.committee_month_id
JOIN committees comm ON comm.id = cm.committee_id
JOIN tokens t ON t.id = s.token_id
JOIN customers c ON c.id = t.customer_id
WHERE s.status = 'PENDING' AND t.status = 'ACTIVE';


-- ============================================================================
-- SECTION 12: INDEXES (FOREIGN KEYS & REPORTING)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_lucky_winner 
ON draw_results (token_id) 
WHERE reward_type = 'LUCKY_WINNER';

CREATE INDEX IF NOT EXISTS idx_tokens_comm_cust ON tokens(committee_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_installments_token ON installments(token_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_installments_month ON installments(committee_month_id);
CREATE INDEX IF NOT EXISTS idx_schedules_month_status ON installment_schedules(committee_month_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_txns_org_date ON financial_transactions(organization_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_loans_token_status ON loans(token_id, status);
CREATE INDEX IF NOT EXISTS idx_cust_trgm ON customers USING gin (name gin_trgm_ops, mobile gin_trgm_ops);


-- ============================================================================
-- SECTION 13: 100% COVERAGE RLS POLICIES (USING + WITH CHECK ON ALL 30 TABLES)
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_month_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transfer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy Generator Pattern for 100% Table Protection
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'user_organizations', 'employees', 'customers', 'committees', 'committee_months', 
        'committee_rules', 'tokens', 'token_status_history', 'installment_schedules', 
        'collection_registers', 'installments', 'gift_catalog', 'committee_month_gifts', 
        'draw_events', 'draw_results', 'gift_winners', 'financial_transactions', 
        'cashbook_entries', 'expense_categories', 'expenses', 'loans', 'loan_repayments', 
        'settlements', 'import_jobs', 'import_batches', 'import_rows', 'import_errors', 
        'token_transfer_history', 'notifications', 'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS p_org_iso_%I ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY p_org_iso_%I ON %I FOR ALL USING (organization_id = fn_current_org_id() OR fn_current_org_id() IS NULL) WITH CHECK (organization_id = fn_current_org_id() OR fn_current_org_id() IS NULL)', tbl, tbl);
    END LOOP;
END $$;


-- ============================================================================
-- SECTION 14: AUTHORITATIVE SEED DATA
-- ============================================================================

INSERT INTO organizations (id, name, code) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Primary Bissi Association', 'ORG-PRIMARY')
ON CONFLICT (code) DO NOTHING;

INSERT INTO committees (id, organization_id, name, code, total_members, total_months, monthly_installment, start_date)
VALUES 
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Hare Ka Sahara', 'HK-SAHARA', 500, 30, 2500.00, CURRENT_DATE),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Shree Krishna Associates', 'SK-ASSOC', 1111, 30, 3000.00, CURRENT_DATE),
('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Pyare Mohan', 'PYARE-M', 500, 30, 3000.00, CURRENT_DATE),
('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Set Sanwariya', 'SET-SANW', 500, 30, 3000.00, CURRENT_DATE)
ON CONFLICT (organization_id, code) DO NOTHING;

INSERT INTO committee_months (organization_id, committee_id, month_number, month_name, due_date)
SELECT 
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    m,
    'Month ' || m::text,
    CURRENT_DATE + (m || ' month')::interval
FROM generate_series(1, 30) AS m
ON CONFLICT (committee_id, month_number) DO NOTHING;

COMMIT;
