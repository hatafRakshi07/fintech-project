# Comprehensive Repository Implementation Audit & Refactoring Report
**Project Name:** Bissi (Committee / BC) Management System  
**Audit Purpose:** Full codebase review to identify dead code, legacy MongoDB files, scratch scripts, data dumps, and propose a clean production monorepo architecture.  
**Action Status:** **AWAITING USER APPROVAL** (No files deleted yet).

---

## 1. Executive Summary & Audit Findings

During this comprehensive codebase audit, the repository was scanned for dead code, duplicate utilities, experimental files, legacy database references (MongoDB, Firebase DataConnect, PGlite), obsolete root scripts, and un-structured routing.

### Key Audit Findings
1. **Legacy MongoDB Code**:
   - Files containing `mongodb` and `ObjectId` imports exist inside `api/src/models/` and `api/src/db/mongoClient.ts`. PostgreSQL v5.1 is now the sole source of truth; all MongoDB code is dead legacy artifact.
2. **Root Script Clutter (25+ Files)**:
   - The root workspace contains 25+ ad-hoc Python (`.py`), Node (`.mjs`), and Shell (`.js`) scripts used during initial raw data extraction and migration experiments.
3. **Raw JSON Data Dumps (11 Files / ~9 MB)**:
   - 11 raw JSON files containing historical customer, collection, and lottery extracts (`extracted_collections.json`, `extracted_customers.json`, etc.) sit in the workspace root.
4. **Scratch Directory (`scratch/` - 58 Files)**:
   - A dedicated `scratch/` folder contains 58 temporary one-off query scripts, schema checks, and date update scripts.
5. **Firebase & DataConnect Leftovers**:
   - `dataconnect/`, `src/dataconnect-generated/`, `.firebaserc`, `pglite-data/`, and log files from earlier offline trials remain in the root directory.
6. **Database Schema Monolith**:
   - `lib/db/src/schema/` contains ad-hoc table groupings (`crm.ts`, `exits.ts`, `memberships.ts`, `operations.ts`, `schemes.ts`, `system.ts`) which do not reflect the v5.1 Frozen DDL.
7. **Ad-Hoc API Routing**:
   - `artifacts/api-server/src/routes/index.ts` contains a 69,770-byte monolith router with mixed business logic and inline queries instead of a clean Repository-Service-Controller hierarchy.

---

## 2. Exhaustive File Deletion Manifest (Pending User Approval)

Below is the complete list of **85+ files and directories** flagged for deletion upon user approval:

### Category A: MongoDB & Obsolete Database Drivers (3 Files)
- `api/src/models/DueNotification.ts` (Contains `import { ObjectId } from 'mongodb'`)
- `api/src/models/NotificationConfig.ts` (Contains `import { ObjectId } from 'mongodb'`)
- `api/src/db/mongoClient.ts` (Legacy MongoDB client setup)

### Category B: Obsolete Root Scripts (25 Files)
- `check-cols.py`
- `check-supabase-tables.py`
- `check-tables.py`
- `clear-data.mjs`
- `dump-customers.js`
- `extract-all-data.py`
- `extract-interests.py`
- `fix-unknown-tokens-500.py`
- `import-all-4-bissi-schemes-complete.py`
- `import-all-remaining.py`
- `import-bissi-data.py`
- `import-bissi-fast.py`
- `import-final.py`
- `import-interests-pglite.js`
- `import-interests.py`
- `import-real-data.mjs`
- `import-sawariya-seth-5.py`
- `import-sawariya-seth-500.py`
- `master-bissi-excel-erp-import.py`
- `master-sawariya-import.py`
- `pg-local.mjs`
- `populate-drizzle-erp-schema.py`
- `push-schema-to-neon.mjs`
- `run-full-sawariya-normalized-import.py`
- `setup-supabase-tables-and-import.py`
- `update-lucky-status.py`

### Category C: Root Raw JSON Data Dumps (11 Files)
- `customers_dump.json` (1.3 KB)
- `extracted_collections.json` (3.7 MB)
- `extracted_committees.json` (0.5 KB)
- `extracted_customers.json` (1.6 MB)
- `extracted_daily_collections.json` (3.0 MB)
- `extracted_gifts.json` (590 KB)
- `extracted_interests.json` (66 KB)
- `extracted_loans.json` (11 KB)
- `extracted_lotteries.json` (489 KB)
- `extracted_tokens.json` (292 KB)
- `interests_dump.json` (91 KB)

### Category D: Scratch Scripts (`scratch/` - 58 Files)
- All 58 temporary query scripts in `scratch/` (e.g. `add_performance_indexes.mjs`, `apply_user_token_fixes.mjs`, `check_cm_cols.py`, `clean_all_duplicates.mjs`, `fix-all-lotteries-real.mjs`, `test_lottery_query.mjs`, etc.)

### Category E: Legacy Firebase, DataConnect & Log Files (5 Directories / Files)
- `dataconnect/` (Firebase DataConnect folder)
- `src/dataconnect-generated/` (Firebase generated SDKs)
- `.firebaserc` (Firebase project config)
- `dataconnect-debug.log`
- `pglite-data/` & `pglite-debug.log`
- `attached_assets/` (Temporary pasted prompt text file)

---

## 3. Clean Monorepo Workspace Target Structure

The refactored repository will strictly enforce the 5 top-level directories:

```text
fintech-project/
├── apps/
│   ├── api/                   # Production Clean Architecture REST & WS Server
│   │   └── src/
│   │       ├── controllers/   # Thin HTTP Controllers (0 business logic)
│   │       ├── services/      # Business Service Layer & Rule Engine
│   │       ├── repositories/  # Drizzle Data Access Repositories
│   │       ├── middleware/    # Auth, Tenant & Validation Middlewares
│   │       └── app.ts         # Fastify / Express Server Application
│   └── web/                   # Next.js 14 / React Dashboard App
├── packages/
│   └── db/                    # Drizzle ORM Package
│       └── src/
│           └── schema/        # 16 Modular Database Schema Files
├── scripts/                   # Production DDL & Maintenance Scripts
│   ├── bissi_enterprise_schema.sql
│   └── test_production_suite.sql
├── migrations/                # Supabase SQL Migration Files
└── docs/                      # Business & Architecture Specifications
```

---

## 4. 16-File Database Schema Split (`packages/db/src/schema/`)

The database package `packages/db` will split into 16 modular schema files reflecting the 30 tables and 19 ENUMs of v5.1 Frozen DDL:

| # | Schema File | Target Table & ENUM Definitions |
| :-: | :--- | :--- |
| 1 | `customers.ts` | `customers` table, `customer_status_enum` |
| 2 | `committees.ts` | `committees` table, `committee_rules` table, `committee_status_enum` |
| 3 | `committee_months.ts` | `committee_months` table, `committee_month_status_enum` |
| 4 | `tokens.ts` | `tokens` table, `token_status_history` table, `token_status_enum` |
| 5 | `installments.ts` | `installment_schedules`, `installments`, `collection_registers` tables, `installment_status_enum`, `payment_mode_enum`, `collection_register_status_enum` |
| 6 | `draws.ts` | `draw_events`, `draw_results` tables, `reward_type_enum`, `draw_event_status_enum` |
| 7 | `gifts.ts` | `gift_catalog`, `committee_month_gifts`, `gift_winners` tables, `gift_claim_status_enum` |
| 8 | `loans.ts` | `loans`, `loan_repayments` tables, `loan_status_enum` |
| 9 | `settlements.ts` | `settlements` table, `settlement_status_enum` |
| 10 | `finance.ts` | `financial_transactions`, `cashbook_entries`, `expense_categories`, `expenses` tables, `cashbook_type_enum`, `expense_status_enum` |
| 11 | `employees.ts` | `employees`, `user_organizations` tables, `employee_status_enum`, `org_role_enum` |
| 12 | `notifications.ts` | `notifications` table, `notification_status_enum`, `notification_channel_enum` |
| 13 | `audit.ts` | `audit_logs`, `import_jobs`, `import_batches`, `import_rows`, `import_errors` tables, `import_status_enum` |
| 14 | `organizations.ts` | `organizations` table |
| 15 | `relations.ts` | Drizzle relational definitions across all 30 entities |
| 16 | `index.ts` | Barrel export re-exporting all schema tables, ENUMs, and relations |

---

## 5. Clean Architecture Layer Specifications

### 5.1 Repository Layer (`apps/api/src/repositories/`)
Pure data access wrappers using Drizzle ORM instance:
- `CustomerRepository`: CRUD operations, 4-tier lookup query, customer merge execution.
- `CommitteeRepository`: Committee creation, rule lookup, committee month schedule generation.
- `TokenRepository`: Token creation, raw token lookup, normalized token search.
- `InstallmentRepository`: Schedule queries, payment receipt creation, collection register aggregation.
- `DrawRepository`: Draw event logs, draw result insertion, winner lookup.
- `LoanRepository`: Loan application queries, disbursal status updates, repayment records.
- `SettlementRepository`: Final settlement calculation queries.
- `FinanceRepository`: Financial transactions ledger inserts, cashbook summary queries.

### 5.2 Service Layer (`apps/api/src/services/`)
Core business logic & Rule Engine execution (0 HTTP dependencies):
- `CustomerService`: Idempotent customer resolution and merge validation.
- `TokenService`: Fraction parsing (`29½` $\rightarrow$ `29`) and duplicate suffix assignment (`443A`).
- `InstallmentService`: Payment validation, blocking receipts on `OUT` tokens.
- `DrawService`: Lucky winner state transitions (token `OUT` and future schedule cancellation) and gift winner quantity cap enforcement.
- `LoanService`: Rule-driven loan eligibility calculation via `committee_rules.rules_jsonb`.
- `SettlementService`: Net settlement calculation (Total Paid - Outstanding Loans - Deductions + Bonus).

### 5.3 Controller Layer (`apps/api/src/controllers/`)
Thin HTTP controllers:
- Input validation (Zod schemas).
- Delegation to Service Layer methods.
- Standardized HTTP status codes (200, 201, 400, 404, 422, 500) and response payloads.
- **ZERO business logic or direct raw SQL queries inside controllers**.

---

## 6. Next Steps & Action Request

> [!NOTE]
> Please review this audit report and the accompanying [implementation_plan.md](file:///C:/Users/lenovo/.gemini/antigravity-ide/brain/00b7d96d-85e5-411e-a73e-872c585be616/implementation_plan.md). Once approved, the cleanup of obsolete files and the Monorepo / Clean Architecture refactoring will begin immediately.
