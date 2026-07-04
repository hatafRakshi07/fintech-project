# Bissi — Chit Fund / Committee Management System

A full-stack management platform for Indian-style rotating savings groups (Bissi/Committee/Chit Funds).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — build + run API server (reads `.env`)
- `pnpm --filter @workspace/bissi-app run dev` — start Vite frontend dev server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — create/reset the default admin user

## First-time setup

1. Copy `.env.example` → `artifacts/api-server/.env` and fill in `DATABASE_URL` and `PORT`
2. Run `pnpm --filter @workspace/db run push` to create all tables
3. Run `pnpm --filter @workspace/scripts run seed` (set `ADMIN_PASSWORD` env var first!)
4. Start the API server: `pnpm --filter @workspace/api-server run dev`
5. Start the frontend: `pnpm --filter @workspace/bissi-app run dev`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, helmet, express-rate-limit, bcryptjs
- DB: PostgreSQL + Drizzle ORM; sessions stored in `sessions` table (8h TTL)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — source of truth for all DB tables
- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/` — auto-generated; do not edit manually
- `artifacts/api-server/src/routes/` — route handlers (one file per domain)
- `artifacts/bissi-app/src/pages/` — frontend pages

## Security

- Passwords hashed with bcrypt (cost 12)
- Sessions stored in `sessions` DB table, 8h TTL, purged on login
- Rate limiting on `/api/auth/login`: 10 requests / 15 min / IP
- Set `CORS_ORIGINS=https://yourdomain.com` in production to restrict CORS
- HTTP security headers via `helmet`

## Architecture decisions

- API-first: OpenAPI spec drives both backend route types and frontend client via Orval codegen
- Drizzle for type-safe SQL; no raw queries except dashboard trend (uses `db.execute`)
- Auth uses DB-backed sessions (no Redis needed); refresh/extend sessions not implemented yet
- Frontend auth: token in `localStorage`, injected via `setAuthTokenGetter()` in `api-client-react`

## Gotchas

- Run `pnpm run typecheck:libs` (or `tsc --build`) before typechecking artifacts — lib `.d.ts` must be built first
- After adding a new DB table, re-export it from `lib/db/src/schema/index.ts`
- Windows: use `node --env-file=.env` in `artifacts/api-server/.env` to load env vars for dev
