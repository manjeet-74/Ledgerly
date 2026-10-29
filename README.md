# Ledgerly

The decision trust layer for marketing spend — an independent concept project. Ledgerly watches
marketing performance data, recommends budget reallocations and anomaly responses, routes them
through a role-gated, multi-step approval flow, executes them, and measures whether they actually
delivered — with every single step written to a tamper-evident, hash-chained audit log.

This is a personal project, not a production compliance product. See [Known limits](#known-limits)
below and the "Illustrative" banner on the in-app Trust Center.

## Features

| | |
|---|---|
| **Decision engine** | Deterministic rules (ROAS gap, z-score anomaly detection) generate budget-shift and anomaly-alert recommendations, each with a full "show the math" evidence trail. |
| **Approval workflow** | Spend-tier-based, multi-role approval (Marketing → Finance → Executive), with a spend cap and a rollback rule required before anything executes. |
| **Audit trail** | Every state change is an append-only, SHA-256 hash-chained event. A Postgres trigger blocks direct mutation of LIVE audit rows; `/audit/verify` proves the chain is unbroken. |
| **Trust Center** | Seven controls, each a live query against the running system (not a static page) — tamper the chain and watch a control fail in real time. |
| **ROI Calculator** | Imports the exact same formula the backend uses, so the number on screen can never drift from what the engine would compute. |
| **DEMO vs. LIVE** | DEMO is a deterministic, pre-seeded sandbox with a fake 90-day story (no login needed — switch roles from a dropdown). LIVE requires a real login and works on data you upload yourself. |

## Tech stack

- **`packages/shared`** — pure TypeScript: stats, the decision engine's rules, the hash-chain
  primitives, the ROI formula, shared types. Zero Node- or browser-only dependencies, so it runs
  identically on the server and in the browser bundle.
- **`apps/api`** — NestJS, Prisma/PostgreSQL, BullMQ/Redis, JWT auth, Jest.
- **`apps/web`** — Next.js 14 (App Router), React Query, Tailwind, Framer Motion, Recharts,
  Playwright.

## Prerequisites

- Node.js ≥ 20 (developed against 23; nothing here uses Node-20-only APIs)
- pnpm (`corepack enable` or `npm i -g pnpm`)
- Docker Desktop (for Postgres + Redis)

## Quickstart

```bash
git clone <this-repo-url> ledgerly
cd ledgerly
pnpm install

cp .env.example apps/api/.env
# Edit apps/api/.env if you need different ports -- see note below.

docker compose up -d        # Postgres + Redis
pnpm --filter @ledgerly/api prisma:generate
pnpm --filter @ledgerly/api prisma:migrate
pnpm --filter @ledgerly/api seed    # 6 users + DEMO workspace data

pnpm --filter @ledgerly/api dev     # http://localhost:4000
pnpm --filter @ledgerly/web dev     # http://localhost:3000, in a second terminal
```

Open **http://localhost:3000** and click **Open Demo** — no login needed. To try the LIVE flow,
sign in with any of the seeded accounts (password `ledgerly123` for all of them):

| Email | Role |
|---|---|
| `admin@ledgerly.dev` | Admin |
| `director@ledgerly.dev` | Marketing Director |
| `finance@ledgerly.dev` | Finance |
| `executor@ledgerly.dev` | Executor |
| `auditor@ledgerly.dev` | Auditor |
| `viewer@ledgerly.dev` | Viewer |

> **Port note**: `docker-compose.yml` maps Postgres to host port **5433** and Redis to **6380**
> (not the defaults 5432/6379), to avoid colliding with other projects that might already be
> running on this machine. If that's not a concern for you, feel free to change both the compose
> file and `apps/api/.env`'s `DATABASE_URL`/`REDIS_URL` back to the standard ports.

## Running tests

```bash
pnpm --filter @ledgerly/shared test    # Vitest: stats, confidence, hash chain, ROI, engine rules
pnpm --filter @ledgerly/api test:e2e   # Jest+supertest: upload, engine dedupe, approvals, audit chain, RBAC
pnpm --filter @ledgerly/web build      # production build + type-check
cd apps/web && npx playwright test     # end-to-end smoke + mobile/QA suite (needs the dev server running)
```

`test:e2e` runs against a dedicated `ledgerly_test` Postgres database (create it once with
`docker compose exec postgres psql -U ledgerly -d ledgerly -c "CREATE DATABASE ledgerly_test;"`,
then copy `apps/api/.env` to `apps/api/.env.test` and point its `DATABASE_URL` at `ledgerly_test`)
so the suite's uploads/tampering/resets never touch your dev DEMO/LIVE data. See
`apps/api/test/app.e2e-spec.ts` for the full set of scenarios it covers.

The Playwright suite needs `apps/web`'s dev server already running on `localhost:3000` against a
DEMO-seeded API on `localhost:4000` (run `pnpm --filter @ledgerly/api seed` first if you haven't).

## Project structure

```
packages/shared/   pure TS: stats, decision engine, hash chain, ROI formula, shared types
apps/api/          NestJS backend — Prisma schema, all REST modules, BullMQ outcome processor
apps/web/          Next.js frontend — dashboard, decisions, audit, trust, ROI, and data pages
```

## Known limits

- LIVE analyzes CSV/webhook data only — there are no direct Google Ads / Meta / Shopify
  connectors in this version.
- The decision engine is deliberately simple and fully explainable (a ROAS gap rule and a
  z-score anomaly check), not a forecasting model.
- The Trust Center's controls are real, live checks against this running system — but they are
  illustrative of the *pattern*, not a real third-party compliance attestation.
- Outcome measurement compares total net contribution before vs. after a decision; it does not
  attempt to isolate causality from other changes happening at the same time.

## Troubleshooting

**The site loads completely unstyled (plain blue links, no layout), or pages render blank.**
This is almost always a stale Next.js dev cache — most often right after upgrading `next` or
another build dependency. The symptom in the terminal is `GET /_next/static/css/app/layout.css
404` and/or webpack `Can't resolve './vendor-chunks/...'` warnings: the compiled CSS and JS
chunks are being requested at paths the stale cache no longer has, so the browser gets an
unstyled shell. Fix it by clearing the cache and restarting the dev server:

```bash
# stop the web dev server, then:
rm -rf apps/web/.next
pnpm --filter @ledgerly/web dev
```

`.next` is a regenerable build artifact (and gitignored), so deleting it is always safe. If the
site still looks unstyled after a clean restart, hard-refresh the browser to drop the old
stylesheet URL.

## Deployment

Not yet deployed publicly. The intended target is the web app on Vercel, the
API + a managed Redis on Railway or Render, and Postgres on Supabase — this needs real accounts
and environment secrets that aren't part of this repo, so it's a manual step for whoever runs
this next.
