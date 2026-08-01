# 🏦 Shree Krishna Association — FinTech Enterprise Monorepo

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-cyan.svg)](https://react.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-15.1-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-v9-orange.svg)](https://pnpm.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.1-38bdf8.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> An enterprise-grade, type-safe monorepo for financial management, chit-fund (Bissi) tracking, field collections, customer portals, and double-entry accounting. Built with **React 19**, **Next.js 15 (App Router)**, **TypeScript**, **Express**, and **PostgreSQL / Drizzle ORM**.

---

## 📋 Navigation & Documentation Index

Any developer working on this codebase should review the core architecture and deployment guides:

| Guide | Description |
| :--- | :--- |
| 🏗️ **[ARCHITECTURE.md](file:///c:/Users/lenovo/Desktop/fintech-project/ARCHITECTURE.md)** | Technical Architecture, Component Layout, Frontend/Backend Specs & RBAC System |
| 🚀 **[PRODUCTION.md](file:///c:/Users/lenovo/Desktop/fintech-project/PRODUCTION.md)** | Docker Deployment, Vercel/Cloud Hosting, SSL, Backups & Environment Config |
| 🔐 **[SECURITY.md](file:///c:/Users/lenovo/Desktop/fintech-project/SECURITY.md)** | Security Policies, RBAC Rules, Rate Limiting, Token Management & Supply-Chain Rules |
| 📚 **[docs/ Index](file:///c:/Users/lenovo/Desktop/fintech-project/docs/README.md)** | Index of 12+ Comprehensive Audits, Reports, Data Migration Summaries & Workflows |

---

## 🏛️ Systematic Monorepo Directory Architecture

The repository is structured as a **PNPM Workspace Monorepo** separating core applications, shared libraries, data scripts, and deployment configurations.

```
fintech-project/
├── 📱 artifacts/                    # Monorepo Applications & Services
│   ├── bissi-app/                  # Primary React 19 + Vite Frontend (Admin & Customer Portal)
│   ├── collector-app/              # Field Agent / Collector Mobile Web PWA
│   ├── api-server/                 # Express + TypeScript REST API Server
│   └── mockup-sandbox/             # Design Sandbox & UI Component Prototypes
│
├── 📦 lib/                          # Shared Workspace Libraries & Packages
│   ├── api-client-react/           # TanStack React Query custom hooks & fetch wrappers
│   ├── api-spec/                   # OpenAPI / Swagger specification schemas
│   ├── api-zod/                    # Shared Zod validation schemas across FE & BE
│   └── db/                         # Drizzle ORM Schemas, Migrations & Database Types
│
├── 📜 scripts/                      # Database Seeding, Excel Importers & Utility Scripts
│   ├── seed-complete-db.mjs        # Database Seeding Script for local development
│   ├── import_excel_bissi_v4.mjs   # Data ingestion & Excel conversion script
│   └── smoke-test-api.mjs          # Automated API validation runner
│
├── 🚀 deployment/                   # Infrastructure & Production Manifests
│   ├── docker-compose.yml          # Containerized local production environment
│   └── nginx.conf                  # Production Reverse Proxy Configuration
│
├── 📑 docs/                         # Repository Audit & Master Project Documentation
├── ⚙️ .agents/                      # Custom Agent Skills & Workspace Configurations
└── 🔑 .env.example                  # Environment Variables Template
```

---

## ⚡ Quick Start for Developers

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **pnpm**: `npm install -g pnpm` (v9+)
- **PostgreSQL** (Optional if using Docker or Cloud Database)

### 2. Environment Setup
Copy the environment variables template:
```bash
cp .env.example .env.local
```

### 3. One-Click Launch (Windows)
To start all services in parallel (PostgreSQL container check + API Server + Admin App + Collector App):
```cmd
START.bat
```
*(This automatically opens the browser at `http://localhost:5000` for Admin/Customer Portal and `http://localhost:5002/collector/` for Field Agent App)*.

### 4. Cross-Platform Manual Startup
```bash
# 1. Install dependencies
pnpm install

# 2. Run TypeScript check across all packages
pnpm run typecheck

# 3. Start all services in parallel
pnpm dev
```

---

## 🛠️ Tech Stack & Technology Matrix

| Layer | Technologies & Frameworks Used |
| :--- | :--- |
| **Frontend Applications** | React 19, Vite 7, Wouter (Routing), Lucide React (Icons), Framer Motion |
| **Styling & Design System** | Tailwind CSS v4, Radix UI Primitives, SKA Custom Gold & Ink Design Tokens |
| **State & API Data Fetching**| TanStack React Query v5, Custom Hooks (`use-role`, `use-kyc`, `use-toast`) |
| **Backend API Server** | Express 4, TypeScript 5.9, Node.js 20+, Pino Logger |
| **Database & ORM** | PostgreSQL 16, Drizzle ORM, PGLite (Local embedded DB support) |
| **Data Validation** | Zod (End-to-End type safety between Frontend and Backend) |
| **Monorepo Package Manager** | PNPM Workspaces (`pnpm-workspace.yaml`), Supply-Chain Security Filters |

---

## 🔐 Role-Based Access Control (RBAC) System

The application enforces strict multi-role permission boundaries managed via `RoleGate` components in frontend routes and middleware on the backend API:

| Role Code | User Persona | Access Scope |
| :--- | :--- | :--- |
| `super_admin` / `owner` | System Owner | Full access to financial ledgers, system settings, branch management & KYC reviews |
| `branch_manager` | Branch Manager | Customer onboarding, collector assignments, chit fund lots & loan approvals |
| `accountant` / `finance` | Accountant | Access to Sales/Purchase ledgers, Cashbook, Invoices & financial reporting |
| `collector` / `agent` | Field Collector | Field collection tracking, receipt generation & customer onboarding |
| `customer` | Customer | Read-only view of personal chit groups, loan statuses, payment receipts & tokens |

---

## 💻 Developer Command Matrix

Run these scripts from the repository root:

```bash
# 🚀 Start all application dev servers
pnpm dev

# 🔍 Run TypeScript type checking across all monorepo packages
pnpm run typecheck

# 🏗️ Build production bundles for all applications
pnpm run build

# 🗄️ Run complete database seed script
pnpm run seed

# 🧪 Run backend API smoke tests
pnpm run test:api
```

---

## 📐 Code Standards & Contribution Guidelines

1. **Strict Type Safety**: All TypeScript code must pass `pnpm run typecheck` without errors before committing.
2. **Component Conventions**: Reusable UI components belong in `artifacts/bissi-app/src/components/common` or `artifacts/bissi-app/src/components/ui`.
3. **API Hook Standardization**: Define all server interactions in `@workspace/api-client-react` using React Query.
4. **Environment Variables**: Never commit credentials or secrets. Always update `.env.example` when adding new configurable parameters.

---

## 🤝 Project Maintainers & Support

For architecture questions, deployment troubleshooting, or data schema migrations, refer to the detailed documentation in [ARCHITECTURE.md](file:///c:/Users/lenovo/Desktop/fintech-project/ARCHITECTURE.md) or [PRODUCTION.md](file:///c:/Users/lenovo/Desktop/fintech-project/PRODUCTION.md).
