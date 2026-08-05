-- =============================================================================
-- SKA FINTECH — V2.0 CLEAN ARCHITECTURE MIGRATION
-- Preserves all existing production data.
-- Uses non-conflicting table names (byaj_* instead of interest_*).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------------

DO $$ BEGIN CREATE TYPE payment_module AS ENUM (
  'BISSI', 'MONTHLY_INSTALLMENT', 'BYAJ', 'LOAN', 'DAILY_DIARY', 'OTHER'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE account_status AS ENUM (
  'ACTIVE', 'COMPLETED', 'PAUSED', 'DEFAULTED', 'CANCELLED'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE pay_mode AS ENUM (
  'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE loan_stage AS ENUM (
  'APPLIED', 'APPROVED', 'DISBURSED', 'REPAYING', 'CLOSED', 'DEFAULTED'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. EXTEND CUSTOMER MASTER (non-destructive column additions)
-- ---------------------------------------------------------------------------

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS reference_mobile  VARCHAR(30),
  ADD COLUMN IF NOT EXISTS customer_type     VARCHAR(30) DEFAULT 'BISSI',
  ADD COLUMN IF NOT EXISTS display_id        VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_cust_mobile     ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_cust_alt_mobile ON customers(alt_mobile);
CREATE INDEX IF NOT EXISTS idx_cust_ref_mobile ON customers(reference_mobile);

-- ---------------------------------------------------------------------------
-- 3. MONTHLY INSTALLMENT MODULE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mi_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  excel_token_label  TEXT,
  token_serial       INTEGER,
  installment_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_day            SMALLINT,
  start_date         DATE,
  complete_date      DATE,
  address            TEXT,
  notes              TEXT,
  status             account_status NOT NULL DEFAULT 'ACTIVE',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mi_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES mi_accounts(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL REFERENCES customers(id)   ON DELETE RESTRICT,
  period_month    DATE NOT NULL,
  payment_date    DATE NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  payment_mode    pay_mode NOT NULL DEFAULT 'CASH',
  receipt_number  VARCHAR(100),
  collector       VARCHAR(100),
  notes           TEXT,
  raw_value       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_mi_acc_customer  ON mi_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_mi_acc_serial    ON mi_accounts(token_serial);
CREATE INDEX IF NOT EXISTS idx_mi_pay_customer  ON mi_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_mi_pay_period    ON mi_payments(period_month);

-- ---------------------------------------------------------------------------
-- 4. BYAJ (INTEREST) MODULE
--    Note: named byaj_* to avoid conflict with existing interest_accounts table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS byaj_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  byaj_serial      INTEGER,
  interest_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_day          SMALLINT,
  address          TEXT,
  reason1          TEXT,
  reason2          TEXT,
  reply            TEXT,
  notes            TEXT,
  status           account_status NOT NULL DEFAULT 'ACTIVE',
  next_due_date    DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS byaj_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES byaj_accounts(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL REFERENCES customers(id)     ON DELETE RESTRICT,
  period_month    DATE NOT NULL,
  payment_date    DATE NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  payment_mode    pay_mode NOT NULL DEFAULT 'CASH',
  receipt_number  VARCHAR(100),
  collector       VARCHAR(100),
  notes           TEXT,
  raw_value       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_byaj_acc_customer ON byaj_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_byaj_acc_serial   ON byaj_accounts(byaj_serial);
CREATE INDEX IF NOT EXISTS idx_byaj_pay_customer ON byaj_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_byaj_pay_period   ON byaj_payments(period_month);

-- ---------------------------------------------------------------------------
-- 5. LOAN MODULE (schema only — no data import)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loan_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  principal_amount    NUMERIC(14,2) NOT NULL,
  disbursed_amount    NUMERIC(14,2),
  interest_rate_pct   NUMERIC(6,3) NOT NULL DEFAULT 0,
  tenure_months       SMALLINT,
  disbursal_date      DATE,
  expected_close_date DATE,
  security            TEXT,
  guarantor_name      TEXT,
  guarantor_mobile    VARCHAR(20),
  stage               loan_stage NOT NULL DEFAULT 'APPLIED',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID NOT NULL REFERENCES loan_accounts(id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL REFERENCES customers(id)     ON DELETE RESTRICT,
  payment_date    DATE NOT NULL,
  total_paid      NUMERIC(12,2) NOT NULL,
  principal_paid  NUMERIC(12,2) NOT NULL DEFAULT 0,
  interest_paid   NUMERIC(12,2) NOT NULL DEFAULT 0,
  penalty_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode    pay_mode NOT NULL DEFAULT 'CASH',
  receipt_number  VARCHAR(100),
  collector       VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id     UUID NOT NULL REFERENCES loan_accounts(id) ON DELETE CASCADE,
  doc_type    VARCHAR(50),
  file_url    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_acc_customer ON loan_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_loan_pay_loan     ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_pay_customer ON loan_payments(customer_id);

-- ---------------------------------------------------------------------------
-- 6. DAILY DIARY — link to customer master
-- ---------------------------------------------------------------------------

ALTER TABLE daily_diary_loans
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_ddl_customer ON daily_diary_loans(customer_id);

-- ---------------------------------------------------------------------------
-- 7. UNIVERSAL PAYMENT LEDGER (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID REFERENCES customers(id),
  module         payment_module NOT NULL,
  source_id      UUID,
  source_table   VARCHAR(60),
  amount         NUMERIC(12,2) NOT NULL,
  payment_mode   pay_mode NOT NULL DEFAULT 'CASH',
  payment_date   DATE NOT NULL,
  period_month   DATE,
  collector      VARCHAR(100),
  office_name    VARCHAR(100),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_customer ON payment_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_module   ON payment_ledger(module);
CREATE INDEX IF NOT EXISTS idx_ledger_date     ON payment_ledger(payment_date);
CREATE INDEX IF NOT EXISTS idx_ledger_period   ON payment_ledger(period_month);

-- ---------------------------------------------------------------------------
-- 8. BACKFILL LEDGER FROM EXISTING BISSI COLLECTIONS
-- ---------------------------------------------------------------------------

INSERT INTO payment_ledger (
  customer_id, module, source_table,
  amount, payment_mode, payment_date, period_month, notes, created_at
)
SELECT
  col.customer_uuid,
  'BISSI'::payment_module,
  'collections',
  col.amount,
  CASE LOWER(COALESCE(col.payment_mode::text, 'cash'))
    WHEN 'cash'          THEN 'CASH'::pay_mode
    WHEN 'upi'           THEN 'UPI'::pay_mode
    WHEN 'bank_transfer' THEN 'BANK_TRANSFER'::pay_mode
    WHEN 'cheque'        THEN 'CHEQUE'::pay_mode
    ELSE 'CASH'::pay_mode
  END,
  COALESCE(col.collected_at::date, CURRENT_DATE),
  DATE_TRUNC('month', COALESCE(col.collected_at, NOW()))::date,
  col.notes,
  col.created_at
FROM collections col
WHERE col.customer_uuid IS NOT NULL
  AND col.amount > 0
  AND EXISTS (SELECT 1 FROM customers cu WHERE cu.id = col.customer_uuid)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. DASHBOARD VIEWS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v2_dashboard_today AS
SELECT
  module,
  COUNT(*)                                                       AS payment_count,
  SUM(amount)                                                    AS total_amount,
  SUM(CASE WHEN payment_mode = 'CASH' THEN amount ELSE 0 END)   AS cash_amount,
  SUM(CASE WHEN payment_mode != 'CASH' THEN amount ELSE 0 END)  AS online_amount
FROM payment_ledger
WHERE payment_date = CURRENT_DATE
GROUP BY module;

CREATE OR REPLACE VIEW v2_dashboard_month AS
SELECT
  module,
  DATE_TRUNC('month', payment_date)::date AS month,
  COUNT(*)                                AS payment_count,
  SUM(amount)                             AS total_amount
FROM payment_ledger
WHERE DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY module, DATE_TRUNC('month', payment_date);

-- ---------------------------------------------------------------------------
-- 10. PENDING VIEWS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v2_mi_pending AS
SELECT
  ma.id               AS account_id,
  ma.customer_id,
  c.name              AS customer_name,
  c.mobile,
  ma.installment_amount,
  ma.due_day,
  ma.excel_token_label,
  ma.token_serial,
  NOT EXISTS (
    SELECT 1 FROM mi_payments mp
    WHERE mp.account_id = ma.id
      AND mp.period_month = DATE_TRUNC('month', CURRENT_DATE)::date
  ) AS is_pending
FROM mi_accounts ma
JOIN customers c ON c.id = ma.customer_id
WHERE ma.status = 'ACTIVE';

CREATE OR REPLACE VIEW v2_byaj_pending AS
SELECT
  ba.id               AS account_id,
  ba.customer_id,
  c.name              AS customer_name,
  c.mobile,
  ba.interest_amount,
  ba.due_day,
  ba.byaj_serial,
  NOT EXISTS (
    SELECT 1 FROM byaj_payments bp
    WHERE bp.account_id = ba.id
      AND bp.period_month = DATE_TRUNC('month', CURRENT_DATE)::date
  ) AS is_pending
FROM byaj_accounts ba
JOIN customers c ON c.id = ba.customer_id
WHERE ba.status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- 11. CUSTOMER FULL VIEW (collector search)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v2_customer_full AS
SELECT
  c.id,
  c.name,
  c.mobile,
  c.alt_mobile,
  c.reference_mobile,
  c.address,
  c.customer_type,
  c.status,
  c.reference_number,
  (SELECT json_agg(json_build_object(
     'committee_id',  t.committee_id,
     'token_number',  t.normalized_token_number,
     'display_token', t.display_token,
     'status',        t.status
   )) FROM tokens t WHERE t.customer_id = c.id AND t.deleted_at IS NULL
  ) AS bissi_tokens,
  (SELECT json_agg(json_build_object(
     'account_id', ma.id, 'amount', ma.installment_amount,
     'due_day', ma.due_day, 'status', ma.status,
     'label', ma.excel_token_label
   )) FROM mi_accounts ma WHERE ma.customer_id = c.id
  ) AS mi_accounts,
  (SELECT json_agg(json_build_object(
     'account_id', ba.id, 'amount', ba.interest_amount,
     'due_day', ba.due_day, 'status', ba.status
   )) FROM byaj_accounts ba WHERE ba.customer_id = c.id
  ) AS byaj_accounts,
  (SELECT json_agg(json_build_object(
     'loan_id', la.id, 'principal', la.principal_amount, 'stage', la.stage
   )) FROM loan_accounts la WHERE la.customer_id = c.id
  ) AS loan_accounts
FROM customers c
WHERE c.deleted_at IS NULL;

COMMIT;
