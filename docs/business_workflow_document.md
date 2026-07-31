# Enterprise Bissi Management System: Business Workflow & Architecture Document (v2.1)

## Executive Summary
This document defines the single source of truth for all operational rules, financial transaction lifecycles, and database parameters for the **Enterprise Bissi (Committee/BC) Management System**.

---

## 1. Authoritative Business Rule Matrix (Single Source of Truth)

The system utilizes a JSONB Rule Engine (`committee_rules`) allowing per-committee rule execution. The table below represents the authoritative configuration for all 4 primary committees:

| Committee Name | Total Members | Duration (Months) | Monthly Installment | Lucky Draw Rule | Gift Winner Rule | Loan Eligibility | Bonus & Special Rules | Settlement / Exit Rules |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hare Ka Sahara** | **500** | **30** | **₹2,500** | Token becomes `OUT`; future installments stop. | Token remains `ACTIVE`; continues installments. | Up to 75% of paid amount at 1% monthly interest. | Gift Guarantee (Every member gets at least 1 gift by Month 15). | Full refund of paid principal at completion; 0% deduction for `OUT` tokens. |
| **Shree Krishna Associates** | **1111** | **30** | **₹3,000** | Token becomes `OUT`; future installments stop. | Token remains `ACTIVE`; receives Gift or Cash. | Up to 80% of paid amount. | Gift Hampers on Month 10 & 20; 100% attendance bonus. | Standard refund minus 5% administrative fee on early exit. |
| **Pyare Mohan** | **500** | **30** | **₹3,000** | Token becomes `OUT`; future installments stop. | Token remains `ACTIVE`; choice of Item or Cash. | Up to 70% of paid amount. | **Adjacent Token Reward**: Tokens $N-1$ and $N+1$ receive ₹500 cash reward. | Early exit deduction of 10% if cancelled before Month 15. |
| **Set Sanwariya** | **500** | **30** | **₹3,000** | Token becomes `OUT`; future installments stop. | Token remains `ACTIVE`; Scooty / Cash option. | Up to 85% of paid amount. | **Whole Line Reward**: All tokens on the same line receive ₹200. **2-Pending Rule**: Blocked if 2+ unpaid. | Special Scooty cash alternative adjustment on final month settlement. |

---

## 2. Rule Engine Single ACID Transaction Execution Order

```mermaid
flowchart TD
    Start[Initiate Draw Execution] --> Lock[1. Acquire Row Lock: SELECT ... FOR UPDATE]
    Lock --> CheckPending[2. Filter Eligible Tokens: Active & Pending Installments <= Rule Limit]
    CheckPending --> PickLucky[3. Select Lucky Winner Token]
    PickLucky --> MarkOut[4. UPDATE token SET status = 'OUT']
    MarkOut --> CancelSched[5. Cancel Future installment_schedules for Lucky Token]
    CancelSched --> AdjacentCheck{6. Rule: Adjacent Token Reward?}
    
    AdjacentCheck -- Yes --> AwardAdjacent[Post Adjacent Token Rewards: N-1, N+1]
    AdjacentCheck -- No --> LineCheck
    AwardAdjacent --> LineCheck{7. Rule: Whole Line Reward?}
    
    LineCheck -- Yes --> AwardLine[Post Line Rewards for Matching Tokens]
    LineCheck -- No --> GiftAlloc
    AwardLine --> GiftAlloc[8. Allocate Gifts from committee_month_gifts]
    
    GiftAlloc --> CashOpt[9. Process Cash Alternatives if Chosen]
    CashOpt --> PostLedger[10. Post Entries to financial_transactions & cashbook_entries]
    PostLedger --> QueueNotif[11. Queue SMS/WhatsApp Winner Notifications]
    QueueNotif --> WriteAudit[12. Write Universal Audit Log Entry]
    WriteAudit --> CommitTxn[13. COMMIT TRANSACTION]
```

---

## 3. Token Transfer Workflow

```mermaid
sequenceDiagram
    autonumber
    actor CustomerA as Transferor (Customer A)
    actor Staff as Office Staff
    actor CustomerB as Transferee (Customer B)
    participant Core as Bissi Core System
    participant DB as PostgreSQL DB

    CustomerA->>Staff: Request Token Transfer (Token 443A)
    Staff->>Core: Submit Transfer Request (Reason, Transfer Date, Target Customer B)
    Core->>DB: Check Eligibility (No pending dues, no unresolved loans)
    Core->>DB: INSERT INTO token_transfer_history (Status: PENDING)
    Staff->>Core: Approve Transfer Execution
    
    rect rgb(240, 248, 255)
        Core->>DB: BEGIN TRANSACTION
        Core->>DB: UPDATE tokens SET customer_id = CustomerB_ID
        Core->>DB: INSERT INTO token_status_history (Transition: TRANSFERRED)
        Core->>DB: Update future installment_schedules to Customer B
        Core->>DB: Preserve historic draws, lucky history, & paid installments under Token 443A
        Core->>DB: COMMIT TRANSACTION
    end
    
    Core-->>Staff: Transfer Complete & Receipts Re-issued
```

---

## 4. Daily Collection Closing Workflow

```mermaid
flowchart TD
    Login[Collector Login & Auth] --> OpenSession[1. Open Collection Session: INSERT INTO collection_registers]
    OpenSession --> Collect[2. Collect Field Payments Cash / UPI]
    Collect --> GenReceipt[3. Generate Receipt: RCP-2026-XXXX]
    GenReceipt --> DepositCash[4. Field Collector Submits Cash to Office Cashier]
    DepositCash --> VerifyCash[5. Cashier Verifies Physical Cash vs Register]
    
    VerifyCash -- Match --> CloseSession[6. Close Register Session: status = 'CLOSED']
    VerifyCash -- Mismatch --> FlagDiscrepancy[7. Record Discrepancy & Flag Audit]
    FlagDiscrepancy --> CloseSession
    
    CloseSession --> PostCashbook[8. Auto-Post Summary to cashbook_entries: CASH_IN]
    PostCashbook --> FinalAudit[9. Log Collection Session Audit Entry]
```

---

## 5. Draw Rollback / Undo Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as System Administrator
    participant Core as Bissi Core
    participant DB as PostgreSQL DB

    Admin->>Core: Initiate Draw Rollback (Draw Event ID, Reason)
    Core->>DB: Verify Rollback Permission & Acquire Row Locks
    
    rect rgb(255, 240, 240)
        Core->>DB: BEGIN TRANSACTION
        Core->>DB: Reverse draw_results & gift_winners entries
        Core->>DB: UPDATE tokens SET status = 'ACTIVE' for Lucky Winner Token
        Core->>DB: Re-activate CANCELLED_LUCKY installment_schedules
        Core->>DB: Reverse financial_transactions entries (Post Reversal Debits/Credits)
        Core->>DB: Void linked gift_claims
        Core->>DB: INSERT INTO audit_logs (Action: DRAW_ROLLBACK, Reason, OldData, NewData)
        Core->>DB: COMMIT TRANSACTION
    end
    
    Core-->>Admin: Draw Successfully Rolled Back & State Restored
```

---

## 6. Loan Lifecycle Workflow

```mermaid
stateDiagram-v2
    [*] --> Requested: Customer Submits Loan Request
    Requested --> EligibilityCheck: System Checks Max % of Total Paid
    EligibilityCheck --> Approved: Staff / Admin Approves Loan
    EligibilityCheck --> Rejected: Exceeds Paid Cap or Unpaid Dues
    
    Approved --> Disbursed: Cash / Bank Payout
    state Disbursed {
        PostDisbursal: Negative Ledger Entry in financial_transactions
        UpdateCashbook: Record CASH_OUT in cashbook_entries
    }
    
    Disbursed --> Repaying: Monthly EMI / Interest Repayment
    Repaying --> Repaying: Partial Repayment Logged
    Repaying --> Closed: Principal & Interest Fully Paid
    Repaying --> SettlementAdjustment: Deducted from Token Settlement if Token Exits
    Closed --> [*]
    SettlementAdjustment --> [*]
```

---

## 7. Token Settlement Workflow State Machine

```mermaid
stateDiagram-v2
    [*] --> Calculated: System Computes Net Settlement (Paid - Deductions - Loans + Bonuses)
    Calculated --> PendingApproval: Submitted for Admin Review
    PendingApproval --> Approved: Admin Authorizes Settlement Amount
    PendingApproval --> Rejected: Discrepancy Flagged & Recalculated
    Approved --> Paid: Cash / Bank Payment Executed
    Paid --> Closed: Token Status Set to SETTLED & Locked
    Closed --> [*]
```

---

## 8. Backup, Disaster Recovery & Data Retention Strategy

1. **Point-In-Time Recovery (PITR)**:
   - Supabase Write-Ahead Logging (WAL) enabled with 30-day continuous PITR.
2. **Automated Daily Backups**:
   - Encrypted snapshots created daily at 02:00 UTC and replicated to off-site AWS S3 storage.
3. **Soft Delete & Audit Retention**:
   - Core master data (`customers`, `committees`, `tokens`) utilize soft deletes (`deleted_at TIMESTAMP`). Hard deletes are strictly prohibited.
   - `audit_logs` and `financial_transactions` are immutable and retained for 7 years for compliance.

---

## 9. API Sequence Flows

```mermaid
sequenceDiagram
    autonumber
    participant Client as API Client / Web Frontend
    participant API as FastAPI Backend
    participant DB as PostgreSQL DB

    Note over Client, DB: 1. Installment Collection API Flow
    Client->>API: POST /api/v1/installments (TokenID, MonthID, Amount, IdempotencyKey)
    API->>DB: SELECT * FROM installments WHERE idempotency_key = Key
    alt Key Exists
        DB-->>API: Existing Receipt Data
        API-->>Client: Return HTTP 200 (Cached Receipt)
    else Key New
        API->>DB: BEGIN TXN -> Insert Installment -> Update Cashbook -> Commit
        DB-->>API: New Receipt (RCP-XXXX)
        API-->>Client: Return HTTP 201 Created
    end
```

---

## 10. Excel Import Mapping & Transformation Table

| Excel Column | Database Field | Transformation Rules | Validation Rules | Fallback / Failure Handling |
| :--- | :--- | :--- | :--- | :--- |
| `Member Name` | `customers.name` | Trim whitespace; title case. | Non-empty string; length $\le 100$. | Flag row error if missing. |
| `Father Name` | `customers.father_name` | Trim whitespace; title case. | Optional string. | Store NULL. |
| `Mobile Number` | `customers.mobile` | Remove spaces, dashes, `+91`. Format as 10 digits. | Exactly 10 numeric digits. | Priority match tier 2; flag if invalid format. |
| `Aadhaar No` | `customers.aadhaar` | Strip spaces and hyphens. | 12 numeric digits. | Priority match tier 1. |
| `Token No` | `tokens.raw_token_number`<br>`tokens.normalized_token_number`<br>`tokens.duplicate_suffix` | `29½` $\rightarrow$ `normalized = 29`. Duplicates $\rightarrow$ auto-append `A`, `B`, `C`. | Must yield positive integer base. | Store raw token string; generate suffix on duplicate. |
| `Installment Paid` | `installments.paid_amount` | Parse float/currency symbols (`₹3000` $\rightarrow$ `3000.00`). | Numeric $\ge 0$. | Default to `0.00`. |
| `Payment Date` | `installments.payment_date` | Convert formats (`DD/MM/YYYY`, `YYYY-MM-DD`) to ISO date. | Valid calendar date. | Default to Import Job Date. |

---

## 11. Database Business Rule Validation Constraints

1. **Lucky Draw Re-Entry Prevention**:
   - Unique Partial Index on `draw_results`: `CREATE UNIQUE INDEX idx_unique_lucky_winner ON draw_results(token_id) WHERE reward_type = 'LUCKY_WINNER';`
2. **Gift Winner Active Status**:
   - Trigger check enforcing `tokens.status = 'ACTIVE'` for all non-lucky gift winners.
3. **Token Number Uniqueness**:
   - Unique Composite Index: `UNIQUE (committee_id, normalized_token_number, duplicate_suffix)`
4. **Installment Blocking on OUT Tokens**:
   - `BEFORE INSERT` trigger on `installments` verifying `tokens.status != 'OUT'`, unless override flag `allow_out_payment` is explicitly set in `committee_rules`.
5. **Single Settlement Enforcement**:
   - `UNIQUE (token_id)` constraint on `settlements` table to prevent double payouts.
6. **Financial Transaction Balance Check**:
   - Constraint requiring `amount != 0` and FK link to valid `cashbook_entries` or `installment_id`/`loan_id`.
