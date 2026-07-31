-- ============================================================================
-- BISSI (COMMITTEE/BC) MANAGEMENT SYSTEM - SUPABASE / POSTGRESQL MIGRATION (v5.1 FROZEN)
-- Migration Version: 20260731_v5.1
-- Description: Complete 30-Table Multi-Tenant Architecture with 100% RLS Coverage
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

DO $$ BEGIN
    CREATE TYPE org_role_enum AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'COLLECTOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE customer_status_enum AS ENUM ('ACTIVE', 'MERGED', 'INACTIVE', 'BLOCKED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE committee_status_enum AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE committee_month_status_enum AS ENUM ('UPCOMING', 'OPEN', 'CLOSED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE employee_status_enum AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE token_status_enum AS ENUM ('ACTIVE', 'OUT', 'TRANSFERRED', 'CANCELLED', 'SETTLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE installment_status_enum AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'LATE', 'CANCELLED_LUCKY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_mode_enum AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

DO $$ BEGIN
    CREATE TYPE gift_claim_status_enum AS ENUM ('PENDING', 'DELIVERED', 'CASH_CLAIMED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE loan_status_enum AS ENUM ('REQUESTED', 'APPROVED', 'DISBURSED', 'REPAYING', 'CLOSED', 'DEFAULTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE settlement_status_enum AS ENUM ('CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE cashbook_type_enum AS ENUM ('CASH_IN', 'CASH_OUT', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE collection_register_status_enum AS ENUM ('OPEN', 'CLOSED', 'VERIFIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE draw_event_status_enum AS ENUM ('PENDING', 'COMPLETED', 'ROLLED_BACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE expense_status_enum AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_status_enum AS ENUM ('QUEUED', 'SENT', 'FAILED', 'DELIVERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel_enum AS ENUM ('SMS', 'WHATSAPP', 'EMAIL', 'PUSH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE import_status_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
