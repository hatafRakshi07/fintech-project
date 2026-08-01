# Frontend Architecture Guide (`bissi-app/src`)

This folder contains the React 19 source code for the FinTech web application.

## 📂 Directory Breakdown

- **`components/`** — Modular, reusable React UI components.
  - `common/` — General UI elements (buttons, inputs, cards, status badges).
  - `kyc/` — KYC document upload forms & verification status badges.
  - `layout/` — Main `Shell.tsx`, Sidebar navigation, Header bar.
  - `ui/` — Base Radix / Shadcn components (Dialog, Toaster, Tooltip).

- **`pages/`** — Route page components rendered by Wouter router.
  - `dashboard.tsx` — Main executive overview with financial charts & KPIs.
  - `agent-portal.tsx` — Agent dashboard for customer onboarding & broadcasts.
  - `customer-portal.tsx` — Customer self-service financial view.
  - `admin-kyc.tsx` — Admin KYC review & document approval.
  - `accounting/` — Accounting ledgers, cashbook & voucher entries.
  - `customers/`, `loans/`, `collectors/` — Domain entity management.

- **`hooks/`** — Custom React state & API hooks (`use-role.ts`, `use-toast.ts`).

- **`main.tsx`** — Application entry point. Loads global CSS, sets up error boundary, and mounts root React node.

- **`index.css`** — Global SKA Brand design system with Tailwind CSS tokens.

## 💡 Key Concepts for Developers

1. **Routing**: Managed by `wouter` in `src/App.tsx`.
2. **State & Fetching**: Managed by `@tanstack/react-query` and `@workspace/api-client-react`.
3. **Role Security**: Routes are protected using `<RoleGate roles={[...]} />`.
