# Part 0 — Discovery

Baseline facts about the Credopass repo, established from files opened during this session. Every claim below cites a real path. Later parts should reference this file rather than re-deriving stack facts.

## 1. Repo shape

- **Package manager:** Bun (`bun.lock` at root, `.npmrc`, CI installs via `bun install --frozen-lockfile` — [ci-web.yml](../.github/workflows/ci-web.yml), [ci-api.yml](../.github/workflows/ci-api.yml)).
- **Monorepo tool:** Nx 22.3.3 ([nx.json](../nx.json), `nx` in root [package.json](../package.json)). Plugins configured: `@nx/js/typescript` (typecheck/build), `@nx/expo/plugin` (mobile), `@nx/eslint/plugin`. Task caching (`cache: true`) is on for `build`, `lint`, `typecheck`, `test` in `nx.json` targetDefaults.
- **Workspaces:** root `package.json` declares `"workspaces": ["packages/*", "apps/*", "services/*"]` — a single Bun/npm workspace, not a Turborepo/pnpm-workspace setup (no `turbo.json`, no `pnpm-workspace.yaml`, no `bunfig.toml` workspaces block present).

## 2. Apps and packages

| Path | package.json name | What it is (from source, not just folder name) |
|---|---|---|
| `apps/web` | `@credopass/web` | The core product SPA — event check-in, members, organizations, analytics, upgrade/billing UI. TanStack Router (code-based routes, `routeTree.gen.ts` generated), TanStack Query/DB, deployed to Vercel. |
| `apps/website` | `@credopass/website` | Marketing site. Single page found so far (`src/pages/Home.tsx`), Vite + React, shadcn/ui-style deps (`cmdk`, `vaul`, `sonner`, `next-themes` despite no Next.js dependency — these are shadcn-generated component deps, not evidence of Next.js). |
| `apps/mobile` | `mobile` | Expo/React Native app (Expo SDK ~54, `react-native` 0.81.5). Uses a hand-rolled navigator (`src/navigation/RootNavigator.tsx`, `BottomTabNavigator.tsx`, per-domain stacks), **not** Expo Router file-based routing. |
| `packages/api-client` | `@credopass/api-client` | TanStack DB collection definitions (`src/collections/*.ts`) wrapping REST calls to the Hono API. Shared between web and (presumably) mobile. |
| `packages/lib` | `@credopass/lib` | Grab-bag shared package: Drizzle schema/table definitions (`src/schemas/tables/*`), Zod validation schemas, Supabase client + auth helpers (`src/supabase/*`), Zustand stores, theme provider, Mapbox search wrappers. |
| `packages/ui` | `@credopass/ui` | Shared web component library (Base UI, ag-grid, maplibre-gl, motion, shadcn-style primitives). |
| `packages/ui-mobile` | `@credopass/ui-mobile` | Declared in workspaces; `package.json` has **no dependencies listed** — needs inspection in Part 1 for whether it's a real shared component set or a near-empty stub. |
| `services/core` | `@credopass/services` | Custom backend: Hono HTTP API (`src/routes/*.ts` — organizations, events, event-members, attendance, users, loyalty, org-memberships), Drizzle ORM over `pg` (node-postgres), deployed as a Docker container. |

## 3. Frontend stack (confirmed from source, not just installed deps)

- **`apps/web`:** TanStack Router — `createRouter({ routeTree })` in [apps/web/src/main.tsx](../apps/web/src/main.tsx), routes under `apps/web/src/routes/**` (e.g. `checkin/$eventId.tsx`, `events/index.tsx`, `login.tsx`, `upgrade.tsx`, `organizations.tsx`, `members.tsx`, `analytics.tsx`). Data layer: TanStack DB (`@tanstack/react-db`) collections from `@credopass/api-client`, backed by TanStack Query (`@tanstack/query-db-collection`'s `queryCollectionOptions`) — see `packages/api-client/src/collections/events.ts`. State: Zustand (`@credopass/lib/stores`, e.g. `useLauncher`). UI: `@credopass/ui` (Base UI primitives) + Tailwind v4.
- **`apps/website`:** Plain Vite + React, no router library found yet in package.json deps (needs confirmation in Part 1 whether it's single-page or uses `react-router`/TanStack Router too — only `Home.tsx` located so far).
- **`apps/mobile`:** Expo + React Native, custom navigation stacks (not file-based).
- No Redux, no Apollo/GraphQL client anywhere in dependency lists.

## 4. Backend / data layer

- **Single Postgres database, hosted by Supabase.** `services/core/.env`: `DATABASE_URL=postgresql://postgres:***@db.zzymqzurubgparvpgfvy.supabase.co:5432/postgres`. This is the **same Supabase project ref** (`zzymqzurubgparvpgfvy`) referenced in `.replit`'s `VITE_SUPABASE_URL=https://zzymqzurubgparvpgfvy.supabase.co`. So there is one Supabase project serving two distinct roles:
  1. **Auth provider** — client apps talk to Supabase Auth directly via `@supabase/supabase-js` (`packages/lib/src/supabase/auth.ts`): email/password sign-in, sign-up, GitHub OAuth, and `supabase.auth.signInAnonymously()` for guest sessions.
  2. **Raw Postgres** — the Hono API (`services/core`) connects directly to Supabase's underlying Postgres via `drizzle-orm/node-postgres`, **not** through Supabase's PostgREST layer or the Supabase JS client (`services/core/src/db/client.ts`). This is almost certainly using the Postgres superuser/service-role connection string, which bypasses Row-Level Security.
- **RLS is enabled but has no policies.** Every table definition calls `.enableRLS()` (e.g. [users.ts:19](../packages/lib/src/schemas/tables/users.ts), [organizations.ts:42](../packages/lib/src/schemas/tables/organizations.ts), [org-memberships.ts:46](../packages/lib/src/schemas/tables/org-memberships.ts)), but a repo-wide search for `pgPolicy`, `createPolicy`, or `CREATE POLICY` in both the Drizzle schema and the raw SQL migrations (`services/core/drizzle/*.sql`) returns nothing. With RLS on and zero policies, Postgres denies all access to any role subject to RLS — meaning RLS as configured today provides no protection *and* would break any client that queries Postgres directly with the Supabase anon/authenticated key rather than through the Hono API. **Open question, flagged for Part 5:** permission enforcement (the owner/admin/member/viewer roles in `org_memberships`) is not verified at the database level anywhere found; it must be enforced entirely in `services/core` route handlers — confirm in Part 1/5.
- **No caching/session layer found.** No Redis, no server-side session store in dependencies or code searched so far.
- **Scheduled job:** [.github/workflows/supabase-cron.yml](../.github/workflows/supabase-cron.yml) hits Supabase's PostgREST endpoint (`GET /rest/v1/organizations`) every 6 hours — a keep-alive to prevent the free/low-tier Supabase project from pausing due to inactivity, not an application feature.

## 5. Schema (from `packages/lib/src/schemas/tables/`, confirmed as the live schema — see discrepancy note below)

Tables: `users`, `organizations`, `org_memberships`, `events`, `event_members`, `attendance`, `loyalty`. Relations defined in [packages/lib/src/schemas/tables/index.ts](../packages/lib/src/schemas/tables/index.ts).

- **`organizations`** ([organizations.ts](../packages/lib/src/schemas/tables/organizations.ts)) is the tenant boundary. Already has billing fields: `plan` enum (`free | starter | pro | enterprise`), `stripeCustomerId`, `stripeSubscriptionId`, plus `externalAuthEndpoint`/`externalAuthApiKey` for pulling member rosters from an external institution system. Soft-delete via `deletedAt`.
- **`org_memberships`** ([org-memberships.ts](../packages/lib/src/schemas/tables/org-memberships.ts)) links `users` ↔ `organizations` with a `role` enum (`owner | admin | member | viewer`, documented in a comment at lines 14-19) and invitation tracking (`invitedBy`, `invitedAt`, `acceptedAt`). Unique constraint one-membership-per-user-per-org.
- **`users`** ([users.ts](../packages/lib/src/schemas/tables/users.ts)) is minimal: email, first/last name, phone. No `plan`/`tier`/`isAnonymous` column — anonymous/guest identity is tracked entirely on the Supabase Auth side, not mirrored into this table (needs confirmation in Part 5 of what happens to a guest's `users` row, if any, on conversion).
- **`events`, `event_members`, `attendance`, `loyalty`** exist per `drizzle/0000_bent_excalibur.sql` and `0001_fixed_bedlam.sql` migrations but weren't opened individually yet — Part 1/5 should read them for full column detail.
- **Schema location discrepancy (dead code):** `services/core/src/db/schema/index.ts` is a **stale, unused duplicate** schema — its own header comment says `FILE: packages/database/src/schema/index.ts`, a path that doesn't exist in this repo. It defines a smaller, inconsistent model (e.g. `events.hostId` instead of the current `event_members` join table). A repo-wide grep confirms nothing imports from `services/core/src/db/schema/*` — the actual client (`services/core/src/db/client.ts:4`) and Drizzle Kit config (`services/core/drizzle.config.ts:11`) both point at `@credopass/lib/schemas/tables` / `../../packages/lib/src/schemas/tables/index.ts`. This dead directory should be deleted, not treated as a second source of truth.

## 6. CI/CD and deployment

- **`apps/web`** ([ci-web.yml](../.github/workflows/ci-web.yml)): lint → typecheck → test → `vercel build`/`vercel deploy` to Vercel, gated by `nx show project web --affected`. Triggers only on changes to `apps/web/**`, `packages/ui/**`, `packages/validation/**` — **`packages/validation` does not exist in this repo** (only `api-client`, `lib`, `ui`, `ui-mobile`); this path filter is stale and silently means changes to `packages/lib` or `packages/api-client` alone won't trigger a web deploy via path-filter-triggered pushes (workflow_dispatch still works).
- **`apps/website`** has **no CI/CD workflow at all** — no `.github/workflows/*website*`, and it isn't referenced in `ci-web.yml`'s path filters. It has its own `vercel.json` ([apps/website/vercel.json](../apps/website/vercel.json)) implying manual/dashboard-driven Vercel deploys.
- **`services/core`** ([ci-api.yml](../.github/workflows/ci-api.yml)): builds with `nx build coreservice`, builds a Docker image from [services/core/Dockerfile](../services/core/Dockerfile), pushes to `ghcr.io/codewreaker/credopass-core`, then deploys via a Coolify webhook (`curl` to `secrets.COOLIFY_WEBHOOK`) — i.e., **self-hosted on Hetzner via Coolify**, not Cloud Run. Note: the workflow still defines unused `PROJECT_ID`/`GAR_LOCATION`/`REPOSITORY` env vars for Google Artifact Registry/Cloud Run, and the Dockerfile's own header comments and `HEALTHCHECK` narrate a Cloud Run deployment story — this is leftover from a prior GCP Cloud Run target that was swapped for Coolify/Hetzner without cleaning up the surrounding comments/env vars. The quality-checks job (lint/typecheck/test) for the API is entirely commented out (lines 10-38 of ci-api.yml) — **the API ships to production with no automated lint/typecheck/test gate.**
- **Local dev:** [docker/docker-compose.dev.yml](../docker/docker-compose.dev.yml) runs a local Postgres 16 container (`credopass-postgres`) plus an optional `credopass-service-core` container behind the `services` profile — but per §4, the actual `services/core/.env` `DATABASE_URL` in this checkout points at the hosted Supabase Postgres, not the local Docker Postgres. The local Postgres path appears to be present but not the one currently wired up.
- **Replit:** [.replit](../.replit) configures a Replit-hosted dev preview (`cd apps/web && bun vite --mode development`), and hardcodes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` directly in `[userenv.shared]`. This is the Supabase *publishable* anon key, which is designed to be public/client-exposed by Supabase's own security model (protection comes from RLS, not key secrecy) — not a leaked secret in the traditional sense, but worth noting as the RLS gap in §4 means this key currently can't be used to read/write Postgres directly anyway (no policies grant it access).

## 7. Open architectural questions / in-progress work found in the code

- **A UI redesign was attempted and mostly reverted.** Git history: `2fd3f54` "Redesign CredoPass UI to Linear/Vercel/Stripe quality — Luma competitor upgrade" was followed by `9a7213e` "Revert redesign except login, auth, upgrade, organizations, and check-in selector; restore login illustration." **This means the current UI is a mix of redesigned screens (login, auth, upgrade, organizations, check-in selector) and pre-redesign screens (everything else)** — a near-certain source of visual/design-token inconsistency that Part 2 must specifically account for rather than treating as uniform drift.
- **A hook file admits its own placement is provisional:** `apps/web/src/hooks/index.tsx:1` — *"this hook is temporarily in the ui package, but it should be moved to lib once I figure out the best way to handle cross-package dependencies for hooks that are used in both packages."*
- **Guest-first auth flow is a deliberate, documented product decision, not an oversight** — the comment block at `apps/web/src/hooks/index.tsx:82-90` explicitly states that landing on `/login` without `?manual=true` triggers silent anonymous Supabase sign-in and redirect to `/events`. This is central to Part 5's user-lifecycle analysis.
- **76 `TODO`/`FIXME`/`@TODO`/`HACK` comments** across `apps/`, `packages/`, `services/` (grep count, not yet individually triaged — Part 1 should pull the highest-signal ones, e.g. `services/core/src/db/client.ts:41` `//@TODO: connect to external postgres and verify connection`).
- **No end-to-end/browser-automation tooling is installed anywhere in the repo** — no Playwright, Cypress, or Puppeteer in any `package.json`, no `e2e` directory. This directly affects Part 2: screenshot capture will require installing a browser automation tool from scratch (flagged here per the ground rule to check Part 0 findings before assuming Playwright exists).
- **TanStack DB is already partially adopted**, but via the generic TanStack Query-backed adapter (`@tanstack/query-db-collection`'s `queryCollectionOptions`, wrapping hand-written `fetch()` calls to the Hono REST API — see `packages/api-client/src/collections/events.ts`), **not** the TanStack DB Supabase collection adapter. No Supabase-specific TanStack DB adapter package exists anywhere in `bun.lock`. This means Part 3 of this audit is not "should we adopt TanStack DB" (already done) but "should the existing REST-backed collections be re-pointed at Supabase directly, and is that even a good idea given the RLS gap in §4" — a materially different, narrower question than the prompt assumed. Flagged explicitly per the ground rules for re-scoping Part 3.
- **`docs/` contains long-form architecture/database/API/deployment docs** (`ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DEPLOYMENT.md`, 600-1050 lines each) that have **not been verified against code in this session** — per the ground rules, later parts should not cite these as fact without cross-checking, since e.g. the Coolify-vs-Cloud-Run and `packages/validation` discrepancies above show CI/deploy config already drifts from its own comments.

## Stack summary table (for quick reference by later parts)

| Layer | Technology | Evidence |
|---|---|---|
| Monorepo tool | Nx 22.3.3 | `nx.json`, root `package.json` |
| Package manager | Bun | `bun.lock`, `.npmrc` |
| Web app framework | React 19 + Vite + TanStack Router | `apps/web/src/main.tsx`, `apps/web/vite.config.ts` |
| Web data layer | TanStack DB + TanStack Query (REST-backed) | `packages/api-client/src/collections/*.ts` |
| Mobile framework | Expo / React Native 0.81 | `apps/mobile/app.json`, `apps/mobile/package.json` |
| Marketing site | React 19 + Vite | `apps/website/vite.config.mts` |
| Backend API | Hono on Bun | `services/core/src/index.ts`, `services/core/package.json` |
| ORM | Drizzle ORM (`drizzle-orm/node-postgres`) | `services/core/src/db/client.ts` |
| Database | Postgres, hosted by Supabase | `services/core/.env` `DATABASE_URL` |
| Auth | Supabase Auth (email/password, GitHub OAuth, anonymous) | `packages/lib/src/supabase/auth.ts` |
| Row-level security | Enabled on tables, **no policies defined** | grep for `pgPolicy`/`CREATE POLICY`: zero hits |
| Web/website hosting | Vercel | `apps/web/vercel.json`, `apps/website/vercel.json`, `ci-web.yml` |
| API hosting | Self-hosted Docker on Hetzner via Coolify | `ci-api.yml` (Coolify webhook step) |
| Container registry | GHCR (`ghcr.io/codewreaker/credopass-core`) | `ci-api.yml` |

---
*Next: `01-architecture.md` (workspace/dependency graph, boundaries, routing, build tooling, testing posture).*
