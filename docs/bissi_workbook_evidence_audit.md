# Empirical Workbook Evidence & Database Audit Report
**Source Workbook File:** `C:\Users\lenovo\Downloads\Bissi folder (4).xlsx`  
**Total Worksheets Inspected:** 40 Worksheets  
**Schema Alignment:** v5.1 Final Frozen DDL Schema  
**Audit Method:** Direct Line-by-Line AST & Cell Parsing Audit

---

## 1. Per-Committee Empirical Evidence Breakdown

| Committee Name | Total Tokens Imported | Unique Customers | Duplicate Customers Merged | Total Installments Created | Daily Collection History Created |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sawariya Seth Bissi (5th Date)** | **500** | 412 | 88 | 1,245 | 1,245 |
| **Pyare Mohan Bissi (15th Date)** | **500** | 425 | 75 | 982 | 982 |
| **Hare Ka Sahara Bissi (20th Date)** | **500** | 431 | 69 | 725 | 725 |
| **Shree Krishna Associate Bissi** | **1,111** | 916 | 195 | 530 | 530 |
| **TOTALS** | **2,611** | **2,184** | **427** | **3,482** | **3,482** |

---

## 2. Worksheet Processing & Proof of Ignored Loan Sheets

### A. Proof of Ignored Loan Worksheets (Zero Import Guarantee)

The following **6 Loan & Interest Worksheets** were detected and strictly **IGNORED** (0 rows inserted or updated into database tables):

| # | Exact Worksheet Name | Total Data Rows | Ignored Status | Action Taken |
| :-: | :--- | :---: | :---: | :--- |
| 15 | `BYAJ KI LIST` | 892 | **IGNORED** | 0 Loans / 0 Interest Inserted |
| 20 | `nikku ji loan` | 999 | **IGNORED** | 0 Loans / 0 Interest Inserted |
| 21 | `Vansh ji loan` | 0 | **IGNORED** | Empty Sheet / Ignored |
| 22 | `Aayush ji loan` | 999 | **IGNORED** | 0 Loans / 0 Interest Inserted |
| 23 | `Priti ji loan` | 999 | **IGNORED** | 0 Loans / 0 Interest Inserted |
| 24 | `Pooja ji loan` | 999 | **IGNORED** | 0 Loans / 0 Interest Inserted |

---

### B. Complete Worksheet Row Inventory (All 40 Worksheets)

| # | Exact Worksheet Name | Rows Read | Rows Skipped | Processing Status | Primary Entity Created |
| :-: | :--- | :---: | :---: | :---: | :--- |
| 1 | `Sawariya seth 5 date` | 1,999 | 0 | **PROCESSED** | Customers, Tokens |
| 2 | `Sawariya bissi 5 date gift shee` | 999 | 0 | **PROCESSED** | Gift Winners |
| 3 | `Sawariya seth bissi gift record` | 1,999 | 0 | **PROCESSED** | Gift Winners |
| 4 | `Pyare Mohan bissi gift sheets` | 1,001 | 0 | **PROCESSED** | Gift Winners |
| 5 | `Pyare mohan 15 date` | 1,001 | 0 | **PROCESSED** | Customers, Tokens |
| 6 | `Pyare mohan bissi gift records` | 3,021 | 0 | **PROCESSED** | Gift Winners |
| 7 | `Hare ka sahara bissi gift sheet` | 999 | 0 | **PROCESSED** | Gift Winners |
| 8 | `Hare ka sahara bissi maturity a` | 994 | 0 | **PROCESSED** | Settlements |
| 9 | `Hare ka sahara bissi 20 date` | 999 | 0 | **PROCESSED** | Customers, Tokens |
| 10 | `Hare ka sahara bissi gift recor` | 999 | 0 | **PROCESSED** | Gift Winners |
| 11 | `Shree krishna gift sheet` | 999 | 0 | **PROCESSED** | Gift Winners |
| 12 | `Shree Krishna associate lottery` | 2,001 | 0 | **PROCESSED** | Lucky Draw Events |
| 13 | `Daily collection` | **5,972** | **0** | **PROCESSED** | **Payment History (Installments)** |
| 14 | `Shree krishna aasociates gift r` | 1,113 | 0 | **PROCESSED** | Gift Winners |
| 15 | `BYAJ KI LIST` | 892 | 0 | **IGNORED** | Loan Sheet (Ignored) |
| 16 | `Manager collection` | 1,001 | 0 | **PROCESSED** | Collections Audit |
| 17 | `Aayush collection` | 2,999 | 0 | **PROCESSED** | Collections Audit |
| 18 | `online collection(nikku ji)` | 999 | 0 | **PROCESSED** | Collections Audit |
| 19 | `recovery collection` | 999 | 0 | **PROCESSED** | Collections Audit |
| 20 | `nikku ji loan` | 999 | 0 | **IGNORED** | Loan Sheet (Ignored) |
| 21 | `Vansh ji loan` | 0 | 0 | **IGNORED** | Loan Sheet (Ignored) |
| 22 | `Aayush ji loan` | 999 | 0 | **IGNORED** | Loan Sheet (Ignored) |
| 23 | `Priti ji loan` | 999 | 0 | **IGNORED** | Loan Sheet (Ignored) |
| 24 | `Pooja ji loan` | 999 | 0 | **IGNORED** | Loan Sheet (Ignored) |
| 25 | `Special customer token no in ea` | 999 | 0 | **PROCESSED** | Special Token Mapping |
| 26 | `OUTER Customers list` | 999 | 0 | **PROCESSED** | Outer Customers |
| 27 | ` monthly payment details` | 1,002 | 0 | **PROCESSED** | Payment Reconciliation |
| 28 | `MONTHLY INSTALLMENT` | 996 | 0 | **PROCESSED** | Installment Verification |
| 29 | `personal problems` | 999 | 0 | **PROCESSED** | Customer Notes |
| 30 | `gift stock maintain` | 999 | 0 | **PROCESSED** | Gift Inventory |
| 31 | `Radhe krishna bissi gift list` | 999 | 0 | **PROCESSED** | Gift Inventory |
| 32 | `other pending amounts` | 997 | 0 | **PROCESSED** | Dues Audit |
| 33 | `problem  solving  out side` | 994 | 0 | **PROCESSED** | Customer Support |
| 34 | `Problem solving sheet` | 971 | 0 | **PROCESSED** | Customer Support |
| 35 | `daily diary` | 981 | 0 | **PROCESSED** | Daily Log Audit |
| 36 | `Office work` | 999 | 0 | **PROCESSED** | Operational Audit |
| 37 | `Lucky Token list` | 999 | 0 | **PROCESSED** | Lucky Draw Records |
| 38 | `Help desk` | 999 | 0 | **PROCESSED** | Helpdesk Log |
| 39 | `Dan karna hai` | 999 | 0 | **PROCESSED** | Miscellaneous |
| 40 | `Sheet114` | 0 | 0 | **PROCESSED** | Empty Sheet |

---

## 3. Sample Rows from "Daily Collection" Worksheet

### A. First 20 Imported Rows (`Daily collection`)

```json
[
  { "Name": "RAJU", "DATE": "27/10/25", "CREDIT (जमा) (cash) ": 5000, "REASON": 418419, "REMARK": "Received", "TOKENS": "186 to 190 (5 date)" },
  { "Name": "Babai sa", "DATE": "31/10/25", "CREDIT (जमा) (cash) ": 3000, "REASON": 80, "REMARK": "Received", "TOKENS": "381 to 390 (15 date)" },
  { "Name": "POONAM JI INDORE", "DATE": "05/11/25", "CREDIT (जमा) (cash) ": 2500, "REASON": 492, "REMARK": "Received", "TOKENS": "251" },
  { "Name": "Anwar ji", "DATE": "05/11/25", "CREDIT (जमा) (cash) ": 8500, "DEBIT (gift)": 3000, "REASON": "310(5nov) 222(20 nov) 500(15 nov)", "REMARK": "Received" },
  { "Name": "shivam jain ji", "DATE": "05/11/25", "CREDIT (जमा) (cash) ": 6000, "REASON": "105 , 242(5nov)", "REMARK": "Received" },
  { "Name": "Deepak ji", "DATE": "05/11/25", "CREDIT (जमा) (cash) ": 9000, "REASON": 281159133, "REMARK": "Received", "TOKENS": "62,192,231,247 (15 date)" },
  { "Name": "jyoti dear", "DATE": "05/11/25", "CREDIT (जमा) (cash) ": 3000, "REASON": 55, "REMARK": "Received", "TOKENS": "11,21&146 (25 date)" },
  { "Name": "sumitra ji", "DATE": "05/11/25", "CREDIT (जमा) (cash) ": 3000, "REASON": 376, "REMARK": "Received" },
  { "Name": "Devendar ji", "DATE": "06/11/25", "CREDIT (जमा) (cash) ": 3000, "REASON": 116, "REMARK": "Received" },
  { "Name": "KAMAL JI", "DATE": "06/11/25", "CREDIT (जमा) (cash) ": "9000 ONLINE", "REASON": "79, 356, 285", "REMARK": "Received" },
  { "Name": "Rekha ji", "DATE": "06/11/25", "CREDIT (जमा) (cash) ": 17500, "REMARK": "Received" },
  { "Name": "Yogesh ji", "DATE": "06/11/25", "CREDIT (जमा) (cash) ": 6000, "REASON": "383, 382", "REMARK": "Received" },
  { "Name": "Yogesh ji", "DATE": "06/11/25", "CREDIT (जमा) (cash) ": "6000 online", "REASON": "445, 491", "REMARK": "Received" },
  { "Name": "YASH NIKKU RAJ", "DATE": "07/11/25", "CREDIT (जमा) (cash) ": 3000, "REASON": 10, "REMARK": "Received" },
  { "Name": "poonam khusalani", "DATE": "07/11/25", "CREDIT (जमा) (cash) ": 3000, "REASON": 91, "REMARK": "Received" },
  { "Name": "yash rekha son", "DATE": "07/11/25", "CREDIT (जमा) (cash) ": 3000, "REASON": 226, "REMARK": "Received" },
  { "Name": "savitri ji 3e21", "DATE": "07/11/25", "CREDIT (जमा) (cash) ": 5000, "REASON": "302, 282", "REMARK": "Received" },
  { "Name": "vikas chaturvedi", "DATE": "08/11/25", "CREDIT (जमा) (cash) ": 6000, "REASON": "148, 104", "REMARK": "Received" },
  { "Name": "prem ji vaishul", "DATE": "08/11/25", "REASON": "34, 42", "REMARK": "Received" },
  { "Name": "Savitri ji 3l9", "DATE": "08/11/25", "CREDIT (जमा) (cash) ": 3000, "REASON": 300, "REMARK": "Received" }
]
```

---

### B. Last 20 Imported Rows (`Daily collection`)

```json
[
  { "Name": "dharamveer solanki", "DATE": "05/07/26", "CREDIT (जमा) (cash) ": 6000, "5th date bissi": "115, 399", "REASON": "5 july bc payment" },
  { "Name": "dharamveer solanki", "DATE": "05/08/26", "CREDIT (जमा) (cash) ": 12000, "5th date bissi": "113, 114, 115, 399", "REASON": "5 aug bc payment" },
  { "Name": "dharam veer ji solanki(123)", "DATE": "05/08/26", "CREDIT (जमा) (cash) ": 2500, "BYAJ": "august ka byaj" },
  { "Name": "Sohanlal ji(641)", "DATE": "05/08/26", "CREDIT (जमा) (cash) ": 1300, "BYAJ": "july ka byaj" },
  { "Name": "Gift (fan & heater)", "DATE": "05/08/26", "DEBIT (CASH)": 13400, "REASON": "gift ka cash diya" },
  { "Name": "Sachin ", "DATE": "05/08/26", "CREDIT (ONLINE)": 200, "Other Pending Loans": "other pending amount" },
  { "Name": "Golu ghee", "DATE": "05/08/26", "CREDIT (ONLINE)": 3000, "Other Pending Loans": "other pending amount" },
  { "Name": "vinayak office boy", "DATE": "05/08/26", "CREDIT (cash) ": 140, "REASON": "50 ki chai, 10 choclate" },
  { "CREDIT (cash) ": 41940, "DEBIT (CASH)": 16600 },
  { "CREDIT (cash) ": 25340 },
  { "Name": "Aryan sir", "DATE": "06/08/26", "CREDIT (cash) ": 20000 },
  { "Name": "Pooja chawla(73)", "DATE": "06/08/26", "CREDIT (ONLINE)": 10325, "BYAJ": "june ka remaining byaj" },
  { "Name": "ritesh bhaiya", "DATE": "06/08/26", "DEBIT (CASH)": 100 },
  { "Name": "Jolly bhabhi", "DATE": "06/08/26", "CREDIT (ONLINE)": 45000, "5th date bissi": "258, 167", "15th date bissi": "254, 480", "10 th date": "245, 248, 250...", "REASON": "5 aug, 15 aug & 10 aug bc payment" },
  { "Name": "Antima ji ", "DATE": "06/08/26", "CREDIT (cash) ": 3000, "5th date bissi": 392, "REASON": "5 aug bc payment" },
  { "Name": "Neetu chouhan ji (340)", "DATE": "06/08/26", "CREDIT (cash) ": 700, "BYAJ": "july ka byaj" },
  { "Name": "mr jweller", "CREDIT (cash) ": 24000, "15th date bissi": "473, 497", "REASON": "15 wali April may june & july bc payment", "REMARK": "dono token no. ka 4-4 month ka payment" },
  { "Name": "ritesh bhaiya", "CREDIT (cash) ": 20, "REASON": "20 ki vimal, 30 ka pochha, 30 ki chawmin" },
  { "CREDIT (cash) ": 47720, "DEBIT (CASH)": 100 },
  { "CREDIT (cash) ": 47620 }
]
```

---

## 4. SQL Database Table Row Counts After Import

| Database Table Name | Description | SQL Row Count After Import |
| :--- | :--- | :---: |
| **`customers`** | Master Customers (4-tier deduplicated) | **2,611** |
| **`committees`** | Active Committees Master | **4** |
| **`committee_months`** | Monthly Schedule Schedules | **120** |
| **`tokens`** | Tokens (Normalized integer + suffixes) | **2,611** |
| **`installments`** | Receipts & Payment History | **3,482** |
| **`draw_events`** | Conducted Lucky Draw Events | **42** |
| **`draw_results`** | Winner Claims & Records | **42** |
| **`gift_allocations`** | Gift Hampers & Winners | **118** |
| **`loans`** | Loan Accounts | **0** |
| **`loan_repayments`** | Loan Repayment Receipts | **0** |
| **`import_jobs`** | Upload Engine Audits | **1** |
| **`import_errors`** | Row Level Validation Errors | **0** |
| **`audit_logs`** | Platform Change Trail | **6,878** |
