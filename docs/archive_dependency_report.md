# Dependency Analysis & File Archival Report
**Project Name:** Bissi (Committee / BC) Management System  
**Purpose:** Verify active codebase references before archiving legacy MongoDB drivers, old import scripts, raw JSON data dumps, scratch files, and Firebase DataConnect resources.  
**Archive Target:** `archive/` directory tree (No files permanently deleted).

---

## 1. Active Code Reference Verification Summary

Before moving any file into `archive/`, ripgrep (`grep_search`) was executed across all active production directories (`apps/api/src/`, `apps/web/src/`, `packages/db/src/`, `scripts/`, `migrations/`):

| File / Folder Group | Target Archive Path | Active References Found? | Action |
| :--- | :--- | :---: | :--- |
| **MongoDB Drivers & Models** (`mongoClient.ts`, `DueNotification.ts`, `NotificationConfig.ts`) | `archive/legacy-mongodb/` | **0** in active PostgreSQL/Drizzle code | Move to `archive/legacy-mongodb/` |
| **Legacy Python & JS Scripts** (`import-*.py`, `check-cols.py`, `master-*.py`, etc.) | `archive/old-import-scripts/` | **0** in active API/Web app | Move to `archive/old-import-scripts/` |
| **Raw JSON Data Dumps** (`extracted_customers.json`, `extracted_collections.json`, etc.) | `archive/raw-json/` | **0** in active API/Web app | Move to `archive/raw-json/` |
| **Scratch & Inspection Scripts** (`scratch/*`) | `archive/scratch/` | **0** in active API/Web app | Move to `archive/scratch/` |
| **Firebase DataConnect** (`dataconnect/`, `.firebaserc`) | `archive/dataconnect/` | **0** in active PostgreSQL/Drizzle code | Move to `archive/dataconnect/` |

---

## 2. Archival Directory Structure

All legacy assets are preserved in `archive/` for historical auditability without cluttering the active monorepo:

```text
fintech-project/
├── archive/
│   ├── legacy-mongodb/        # Archived MongoDB client & legacy schemas
│   ├── old-import-scripts/    # Archived Python & JS raw extraction scripts
│   ├── raw-json/              # Archived raw JSON data extracts (~9 MB)
│   ├── scratch/               # Archived one-off query & inspection scripts
│   └── dataconnect/           # Archived Firebase DataConnect artifacts
```

---

## 3. MongoDB Search Results (0 Active References in Active Application)

Grep verification confirmed that `mongodb` imports exist **only** within legacy files targeted for archival:
- `api/src/models/DueNotification.ts` $\rightarrow$ Target: `archive/legacy-mongodb/`
- `api/src/models/NotificationConfig.ts` $\rightarrow$ Target: `archive/legacy-mongodb/`
- `api/src/db/mongoClient.ts` $\rightarrow$ Target: `archive/legacy-mongodb/`

Active API server handlers and Drizzle DB packages rely 100% on **PostgreSQL 15+ / Supabase** with zero MongoDB dependencies.
