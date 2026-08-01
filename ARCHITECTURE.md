# FinTech Platform — Developer & Architecture Guide

Welcome to the FinTech Platform repository! This document provides a high-level overview of the systematic architecture, folder layout, tech stack, and conventions used across this monorepo so any developer can get up to speed in minutes.

---

## 🚀 Quick Start for Developers

### Prerequisites
- Node.js (v18+ or v20+)
- `pnpm` package manager (v9+)

### Running the App
To start all services in parallel (Frontend App + API Server):
```bash
# Windows Command Prompt / PowerShell
cmd /c START.bat
```
Or run the workspace dev script:
```bash
pnpm dev
```

---

## 🏗️ Architecture Overview

The repository is structured as a **Type-Safe Monorepo** managed via `pnpm` workspaces.

```
fintech-project/
├── artifacts/              # Monorepo Applications & Services
│   ├── bissi-app/          # Primary React + Vite Frontend Web App
│   ├── collector-app/      # Collector Field Agent Mobile/Web App
│   └── api-server/         # Express + TypeScript Backend API Server
├── lib/                    # Shared Workspace Libraries & Packages
│   ├── api-client-react/   # React Query API hooks & fetch wrappers
│   ├── api-spec/           # OpenAPI / Swagger specification
│   ├── api-zod/            # Zod validation schemas
│   └── db/                 # Drizzle ORM Database Schemas & Migrations
├── scripts/                # Database seeding & utility scripts
├── START.bat               # One-click launch script for local development
├── PRODUCTION.md           # Production deployment & Docker guidelines
└── ARCHITECTURE.md         # Developer Architecture Guide (This File)
```

---

## 🎨 Frontend Architecture (`artifacts/bissi-app/src`)

The frontend is built with **React 19**, **Vite**, **TypeScript**, and **Tailwind CSS v4**.

```
src/
├── components/             # Reusable UI Components
│   ├── common/             # Atomic components (Buttons, Inputs, Badges, Modals)
│   ├── kyc/                # KYC Status badges & document verification forms
│   ├── layout/             # Shell, Sidebar navigation, Header, Role switcher
│   └── ui/                 # Base Shadcn/Radix components (Dialog, Toaster, Tooltip)
├── hooks/                  # Custom React Hooks
│   ├── use-role.ts         # User role management (Admin, Manager, Collector, Customer)
│   ├── use-toast.ts        # Global toast notifications
│   └── use-kyc.ts          # KYC verification state hooks
├── pages/                  # Page Routes (Wouter Router)
│   ├── dashboard.tsx       # Main Admin / Financial Overview Dashboard
│   ├── customers/          # Customer Directory & Profile details
│   ├── agent-portal.tsx    # Agent Onboarding, Commission & Message Broadcast
│   ├── customer-portal.tsx # Read-only Customer Financial View
│   ├── accounting/         # Accounting, Ledgers (Sales, Purchase, Cashbook)
│   ├── loans/              # Loan Applications & Recovery tracking
│   ├── admin-kyc.tsx       # Admin KYC Review & Verification Management
│   └── not-found.tsx       # 404 Fallback page
├── main.tsx                # Single Unified React TypeScript Entry Point
└── index.css               # Global SKA Brand Design Tokens (Gold + Ink Palette)
```

---

## 🔐 Role-Based Security & Access Control

Access to pages and routes is enforced using `RoleGate` components in `App.tsx`:

| Role Name | Access Level | Description |
| :--- | :--- | :--- |
| `super_admin` / `owner` | Full Access | Complete system access including branches, settings & KYC management |
| `branch_manager` | Manager | Customer onboarding, collector assignment, loans, lotteries |
| `accountant` / `finance` | Accounting | Access to sales/purchase ledgers, cashbook, invoices & accounting |
| `collector` / `agent` | Field Agent | Onboarding customers, tracking due collections, agent portal |
| `customer` | Customer | Read-only access to personal loans, chit funds, and tokens |

---

## 📡 API & Backend Architecture (`artifacts/api-server`)

The backend is an **Express + TypeScript** server using **Drizzle ORM** for PostgreSQL database operations.

Key Endpoints:
- `/api/agents/me` & `/api/agents/onboard-customer` — Agent operations & onboarding
- `/api/broadcast` — Customer broadcast notifications
- `/api/kyc/` — KYC document uploads and admin verification
- `/api/customers/` — Customer profile management
- `/api/accounting/` — Financial ledgers & voucher entry

---

## 🛠️ Code Conventions & Best Practices

1. **Type Safety**: All frontend and backend code is written in **TypeScript**. Always define type definitions in `src/types` or shared Zod schemas in `lib/api-zod`.
2. **Styling**: Use Tailwind CSS utility classes. Avoid hardcoded inline styles.
3. **API Calls**: Wrap API requests in `@tanstack/react-query` hooks for automatic caching, refetching, and loading states.
4. **Icons**: Use icons from `lucide-react`.

---

## 📖 Developer Summary

Any developer working on this project can:
1. Open `artifacts/bissi-app/src/pages/` to modify page UI or add new routes.
2. Open `artifacts/bissi-app/src/components/` to edit reusable UI components.
3. Open `artifacts/api-server/src/routes/` to add or modify API endpoints.
4. Run `cmd /c pnpm run typecheck` to verify code correctness.
