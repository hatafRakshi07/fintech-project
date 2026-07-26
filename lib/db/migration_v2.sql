-- ==========================================
-- PHASE 7: ENUMS
-- ==========================================
CREATE TYPE role_enum AS ENUM ('ADMIN', 'MANAGER', 'CLERK', 'COLLECTOR');
CREATE TYPE customer_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');
CREATE TYPE membership_status_enum AS ENUM ('ACTIVE', 'LUCKY', 'SETTLED', 'MATURED', 'CANCELLED');
CREATE TYPE loan_type_enum AS ENUM ('SECURED', 'UNSECURED');
CREATE TYPE loan_status_enum AS ENUM ('ACTIVE', 'CLOSED', 'DEFAULTED');
CREATE TYPE payment_method_enum AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE');
CREATE TYPE payment_item_type_enum AS ENUM (
  'INSTALLMENT', 'LOAN_EMI', 'INTEREST', 'PENALTY', 
  'SECURITY_DEPOSIT', 'REGISTRATION_FEE', 'GIFT_PAYMENT', 'REFUND', 'SETTLEMENT'
);
CREATE TYPE gift_selection_enum AS ENUM ('GIFT_TAKEN', 'CASH_TAKEN');
CREATE TYPE visit_status_enum AS ENUM ('COLLECTED', 'NOT_AVAILABLE', 'PROMISE_TO_PAY', 'REFUSED');

-- ==========================================
-- PHASE 8: FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- PHASE 3, 4, 6: TABLES & CONSTRAINTS
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    role role_enum DEFAULT 'CLERK' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    salary DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE collectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    max_cash_limit DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    dob TIMESTAMPTZ,
    avatar_url TEXT,
    status customer_status_enum DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE scheme_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
    duration_months INT NOT NULL,
    installment_amount DECIMAL(12,2) NOT NULL,
    security_deposit_amount DECIMAL(12,2) NOT NULL,
    draw_day_of_month INT NOT NULL,
    settlement_percentage DECIMAL(5,2) NOT NULL CHECK (settlement_percentage BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    joining_date TIMESTAMPTZ NOT NULL,
    status membership_status_enum DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    collector_id UUID REFERENCES collectors(id) ON DELETE RESTRICT,
    payment_method payment_method_enum NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- ==========================================
-- PHASE 5: INDEXES
-- ==========================================
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_memberships_customer ON memberships(customer_id);
CREATE INDEX idx_memberships_scheme ON memberships(scheme_id);
CREATE INDEX idx_active_memberships ON memberships(scheme_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_payment_receipts_customer ON payment_receipts(customer_id);

-- ==========================================
-- PHASE 9: TRIGGERS
-- ==========================================
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_memberships_modtime BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
-- (repeat for all tables)

-- ==========================================
-- PHASE 10: VIEWS
-- ==========================================
CREATE OR REPLACE VIEW v_customer_outstanding AS
SELECT 
    c.id as customer_id,
    c.name,
    COUNT(i.id) as pending_installments,
    COALESCE(SUM(i.amount_due), 0) as total_outstanding
FROM customers c
JOIN memberships m ON c.id = m.customer_id
LEFT JOIN installments i ON m.id = i.membership_id AND i.is_paid = false
GROUP BY c.id, c.name;
