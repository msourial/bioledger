# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4
- **Identity**: @worldcoin/idkit (World ID login gate)
- **PWA**: vite-plugin-pwa (installable app)

## Bio-Ledger Application

The primary app is **Bio-Ledger** — a Verifiable Life-Graph PWA for the PL Genesis Hackathon targeting:

1. **Protocol Labs bounty**: Filecoin warm storage via Synapse SDK (stub/mock in dev)
2. **ERC-8004 bounty**: AI Companion Agent signs Work Receipts (HMAC-SHA256) after each 25m focus session
3. **World ID bounty**: Identity gate unlocking the "Sovereign Vault" using real IDKit v4 (`IDKitRequestWidget` + server-side proof verification). Falls back to simulation when env vars are absent.

### Key Files
- `artifacts/bio-ledger/src/pages/LockScreen.tsx` — World ID gate (IDKitRequestWidget v4, falls back to simulation)
- `artifacts/bio-ledger/src/pages/Dashboard.tsx` — Split-pane main app (Living Room + Ledger)
- `artifacts/bio-ledger/src/lib/whoop-mock.ts` — Mocked Whoop HRV/Strain bio-data (useMockBioData hook)
- `artifacts/bio-ledger/src/lib/companion-agent.ts` — Work Receipt HMAC signing + Filecoin stub
- `artifacts/bio-ledger/src/hooks/use-apm.ts` — Mouse/keyboard APM tracker
- `artifacts/bio-ledger/src/components/PixelUI.tsx` — Pixel-art UI components
- `artifacts/api-server/src/routes/receipts.ts` — REST API for Work Receipts
- `artifacts/api-server/src/routes/world-id.ts` — World ID config/RP-context/verify endpoints
- `lib/db/src/schema/work-receipts.ts` — work_receipts table (Drizzle ORM)

### World ID Environment Variables
Set these to enable the real on-chain ZK proof flow:
- `WORLD_ID_APP_ID` — App ID from developer.worldcoin.org (format: `app_xxxxx`)
- `WORLD_ID_ACTION` — Action string (default: `bio-ledger-verify`)
- `WORLD_ID_RP_ID` — Relying Party ID from developer.worldcoin.org (format: `rp_xxxxx`)
- `WORLD_ID_SIGNING_KEY` — ECDSA private key hex (from RP keypair in Developer Portal)
When absent, the lock screen runs a cosmetic ZK simulation ("DEMO MODE").

### Design Palette
- Background: #2D1B4E (Deep Purple)
- Accent: #702963 (Magenta)
- Primary/Neon: #00F5FF (Neon Teal)
- Font: Press Start 2P (pixel) + VT323 (terminal)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── bio-ledger/         # Bio-Ledger React PWA (previewPath: /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
