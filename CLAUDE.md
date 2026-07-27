# CLAUDE.md

Context for AI agents working in this repo. Read this first; it's the fastest path to being useful here. Human-facing docs: [`README.md`](README.md) + a `README.md` in every package/app/service.

## How to talk to the maintainer

- **Keep answers short and plain.** Say what changed and what to do next. Skip the reasoning unless asked.
- **End every task with a numbered "What you need to do next" list.** Exact commands, in order. If there's nothing to do, say so in one line.

## Right now: mid-rebuild

The repo is being rebuilt API-first.

- **[`docs/API-FIRST-REBUILD.md`](docs/API-FIRST-REBUILD.md)** — the plan. What we intend to build.
- **[`docs/REBUILD-LOG.md`](docs/REBUILD-LOG.md)** — the log. What was actually built, what was decided differently, what broke. **Update it at the end of every phase.**

Read both before changing the API, the schema, or anything tenancy-related.

**Two API surfaces exist at once. This is deliberate.**

| Surface | Status | Use for |
|---|---|---|
| `/api/core/*` | **Gone.** `src/routes/` and `crud-factory.ts` were deleted; the service 404s this path. | Nothing. If you see it in a config, that config is a bug. |
| `/api/v1/core/*` | The only one. | Everything. |

The `/core` suffix is there because more services will sit beside it later (`/api/v1/billing`, …). Code lives in `services/core/src/api/v1/core/`.

Phase 0 is done. **Phase 1 is mostly done**: `accounts` / `identities` / `people` / `invitations` / SSO tables, RLS policies, issuer registry, auth + tenant middleware, `/me`, `/me/context`, organizations, members, invitations.

**Still open in Phase 1:**
- The API connects as `postgres`, which bypasses RLS — so the policies in `services/core/drizzle/0001_rls.sql` are currently inert on the API path. Switching `DATABASE_URL` to `credopass_api` requires wiring `SET LOCAL app.account_id` per transaction first, or every query returns nothing.
- No data migration from `users` → `accounts` + `people` yet.

**The web app now talks to `/api/v1/core`.** Every screen reads the new API through
`@credopass/api-client` hooks — see [`docs/API-SECOND-REBUILD.md`](docs/API-SECOND-REBUILD.md) for the
plan and the "web app moved onto /api/v1/core" entry in the rebuild log for what was actually done.

**The sign-up funnel landed** — [`docs/API-THIRD-REBUILD.md`](docs/API-THIRD-REBUILD.md), decisions
D20–D26. Three things to internalise before touching auth, roles or onboarding:

- **There is no guest tier and no onboarding screen.** Signing in commissions an organisation
  (`ensureDefaultOrganization` in `requireCaller`). That *is* onboarding.
- **There are no device tokens.** A door tablet is a person signed in with the `checkin` role.
  Do not reintroduce a second authentication system for it.
- **`/events/new` renders without a session**, with sign-in overlaid. That overlay is
  presentation. `POST /events` is org-scoped and 401s — that is the control.

## What this is

**CredoPass** — an attendance platform. It records who *actually attends* events (durable `attendance` rows), not just who signed up. Nx monorepo, Bun workspaces: 3 frontends + 1 backend, all sharing one schema/type/data core.

```
apps/web        the product (dashboard, kiosk, public event page) · React 19 + TanStack Router · Vercel
apps/mobile     Expo / React Native companion
apps/website    marketing site + /how-it-works · Vite
services/core   Hono API on Bun · /api/core · Cloud Run
packages/lib          schemas, types, enums, stores, theme, Supabase auth  ← the core; everything imports it
packages/api-client   typed TanStack Query hooks over a generated OpenAPI contract (the ONLY way apps get data)
packages/ui           web design system (Base UI + Tailwind v4)
packages/ui-mobile    React Native design system
```

## Golden rules (violating these breaks conventions)

1. **Schema is the single source of truth.** Drizzle tables in `packages/lib/src/schemas/tables/` drive the migrations, the API's request validation, the OpenAPI document and every client type. To change the model: edit the table → `cd services/core && bunx drizzle-kit generate` → read the SQL → `nx run coreservice:migrate` → `nx run api-client:generate`. Full procedure, including the remote cutover: [`docs/DATABASE-MIGRATION.md`](docs/DATABASE-MIGRATION.md). **Never** hand-write a type or validator that duplicates a table.
2. **Apps never call `fetch` for app data.** Read/write through a `@credopass/api-client` hook — `useEvents`, `useCheckIn`, `usePass`, … Regenerate the client with `nx run api-client:generate` after any API change. TanStack **DB** collections are gone and are not coming back.
3. **Forms are pages, not dialogs.** Anything with a keyboard → a page or `SheetDialog`. `Dialog` is only for granular single-value edits.
4. **Base UI uses render props, not `asChild`.** Spread: `render={(props) => <a {...props} />}`.
5. **Two design systems, on purpose.** `@credopass/ui` (web, DOM+Tailwind) and `@credopass/ui-mobile` (React Native) share visual intent, not code. Don't import one into the other.
6. **Attendance ≠ a UI flag.** `events.checkInMethods` is config for *which* check-in UI a door shows. The `attendance` row (unique on `eventId,patronId`) is the real record.

## Golden rules for `/api/v1` (the rebuild)

These are enforced by code, not by convention. Breaking one fails the build, the lint, or the boot.

1. **Every route is created with `defineRoute`.** It declares `scope` and — for `scope: 'organization'` — a `permission`. Getting this wrong is a TypeScript error, and a bad declaration that slips through crashes the service on startup.
2. **Errors are `ProblemError`.** Throw from `src/http/problem.ts`. Never `c.json({ error })`, never `HTTPException`.
3. **Never hand-write OpenAPI.** The doc at `/api/v1/openapi.json` is generated from the same Zod schemas that validate requests.
4. **Handlers never build a `TenantContext`.** Only the tenant middleware does. The type is branded so you can't fake one, and lint blocks the import.
5. **Domain services import no framework.** Nothing under `src/services/` may import `hono`. Lint blocks it.
6. **A resource in another tenant returns 404, not 403.** 403 means "your tenant, wrong role". Never leak that a row exists.
7. **Every tenant-scoped query filters on `ctx.organizationId` explicitly. Routes never query; services do.** (There was a `db/scoped.ts` meant to enforce this. Nothing imported it — all ten services filtered by hand — so it was deleted rather than left as a rule the code did not follow.)

## Where things live

| Need to touch… | Go to |
|----------------|-------|
| DB schema / model | `packages/lib/src/schemas/tables/` (+ relations in `tables/index.ts`) |
| Validation / shared types | `packages/lib/src/schemas/enums.ts`, `email.schemas.ts`. Request validation lives in the Zod schemas beside each route — there are no per-table `*.schema.ts` validators any more. |
| **Database: migrating, resetting, the remote cutover** | [`docs/DATABASE-MIGRATION.md`](docs/DATABASE-MIGRATION.md) |
| Data fetching / mutations | `packages/api-client/src/hooks/` (TanStack Query, one file per endpoint group) |
| Contract types for the client | `packages/api-client/src/types.ts` — **derived** from `generated/schema.d.ts`, never restated |
| Active organization (client) | `packages/api-client/src/active-organization.ts` |
| App bootstrap / permission gates | `apps/web/src/contexts/session.tsx` (`useSession`, `useCan`) |
| **API endpoints (new, `/api/v1`)** | `services/core/src/api/v1/` |
| **Route + permission declaration** | `services/core/src/http/define-route.ts`, `http/route-registry.ts` |
| **Error format** | `services/core/src/http/problem.ts` |
| **Permissions & role matrix** | `services/core/src/authz/permissions.ts` |
| **Tenant scoping types** | `services/core/src/tenancy/context.ts` |
| **Domain services** (Phase 1+) | `services/core/src/services/` |
| **Tests: unit / structural** | `services/core/src/test/*.test.ts` |
| **Tests: adversarial tenancy** | `services/core/src/test/adversarial/` |
| Auth (server) | `services/core/src/middleware/caller.ts` (`requireCaller` / `requireTenant`) + `identity/issuer-registry.ts` |
| Auth (client) | `apps/web/src/supabase.ts`, `packages/lib/src/supabase/` |
| Web routes | `apps/web/src/routes/` (file-based; `routeTree.gen.ts` is generated — don't edit) |
| Web screens | `apps/web/src/Pages/` |
| Web shell/cross-page | `apps/web/src/containers/` |
| Web components / design | `packages/ui/src/components/` |
| Marketing pages | `apps/website/src/pages/` (router in `apps/website/src/App.tsx`) |
| Mobile screens/nav | `apps/mobile/src/screens/`, `apps/mobile/src/navigation/` |

## Running the app (agents: read this)

**Anytime you run `bun start` give me a command to kill so there are not multiple lingering ones**

Two corollaries worth knowing:

- **Never hand-roll `bun src/index.ts` for the API.** `NODE_ENV` would be unset, so `isDevelopment`
  (`std-env`) is false and `services/core/src/index.ts` takes the *production* CORS branch, which
  allow-lists only `app.credopass.com` / `credopass.com`. The browser then blocks `localhost:5000` with
  a CORS error. The Nx target sets `NODE_ENV=development` for exactly this reason.
- **`nx run coreservice:migrate` writes to whatever `DATABASE_URL` points at.** The default in
  `services/core/.env` is the local Docker Postgres, not the remote instance — but check with
  `nx run coreservice:db status` (it flags `⚠️ REMOTE`) before running it. The remote Supabase
  instance has never been migrated for the rewrite; read [`docs/DATABASE-MIGRATION.md`](docs/DATABASE-MIGRATION.md) §5 before aiming at it.

## Commands

```bash
bun start                     # web + API together — the default way to run the app
nx run web:serve              # web  → :5000
nx run coreservice:start      # API  → :8080 (bun --watch)
nx run website:serve          # site → :4200
nx run coreservice:migrate    # apply pending migrations to whatever DATABASE_URL points at
nx run coreservice:seed
nx run coreservice:studio     # browse the DB
nx run web:typecheck
nx affected -t lint test      # only what changed
```

Rebuild-specific — everything is an nx target, don't hand-roll shell commands:

```bash
nx run coreservice:setup             # one-command fresh-clone setup
nx run coreservice:verify            # lint + typecheck + test (run before saying "done")
nx run coreservice:test              # unit + structural — no DB, must always pass
nx run coreservice:test:integration  # services against real Postgres; starts its own DB
nx run coreservice:test:adversarial  # 47 tenancy tests; red until the endpoints they guard exist
nx run coreservice:typecheck

nx run coreservice:dev:up            # postgres + MinIO
nx run coreservice:db status         # does the DB match the code? START HERE when confused
nx run coreservice:db reset          # drop + replay migrations (localhost only, by design)
nx run coreservice:db join <id>      # make an account an owner of the seeded org
nx run coreservice:dev:down          # stop everything
nx run coreservice:dev:logs

nx run coreservice:docs              # open Scalar (docs + API client)
nx run coreservice:token             # mint a JWT for the Scalar auth box
nx run coreservice:openapi:export    # write openapi.json for desktop clients

nx run coreservice:verify:public-access   # is the DB publicly readable? exits 1 if yes

nx run api-client:generate           # export openapi.json → regenerate schema.d.ts
nx run api-client:typecheck
```

Verify a change compiles with `nx run <project>:typecheck` / `nx run <project>:build`. The web app has no top-level `typecheck` script that always passes standalone — prefer `nx run web:build` or `nx run website:build` to confirm.

## Gotchas

- **Ports:** web `5000` (AirPlay often holds it — it usually lands on `5001`), API `8080`, website `4200`, MinIO `9000` (console `9001`), test Postgres `55432`.
- **Two base paths.** Old: `/api/core`. New: `/api/v1`. Web still reads `VITE_API_URL` (fallback `/api/core`).
- **Docs:** Scalar at `http://localhost:8080/api/v1/core/docs`, raw spec at `/api/v1/core/openapi.json`.
- **`AUTH_DISABLED=true`** bypassed JWT verification for `/api/core`, which no longer exists. **Do not use it.** Run local Supabase so the auth path actually gets exercised.
- **`drizzle/` is now tracked in git.** Migrations are reviewed like any other code. Don't re-ignore it.
- **Adding a column is not additive at runtime.** Drizzle builds an explicit column list from the schema, so a new column makes *every* query — including `/api/core`'s — ask for it. Every database the code runs against must be migrated before the code ships. The remote instance is currently un-migrated, so `/api/core` events queries 500 there.
- **A `drizzle-kit push` database has tables but no migration journal**, so `migrate` fails on it. `nx run coreservice:db status` detects this; `db reset` fixes it.
- **`db` takes its subcommand as an argument:** `nx run coreservice:db reset`. (`db:reset` also works — there are matching nx *configurations* — but prefer the argument form, it is what `scripts/db.ts` documents.) `migrate`, `seed` and `verify:public-access` are top-level targets in their own right.
- **Tests must never touch the real database.** `TEST_DATABASE_URL` points at a throwaway Postgres; the adversarial suite truncates every table.
- **`routeTree.gen.ts`** (web) is generated by the TanStack Router Vite plugin; edit `src/routes/*` instead.
- **Analytics are fabricated** (`services/core/src/services/analytics/`) — deterministic placeholder numbers behind the real `AnalyticsResponse` contract. Don't assume they read the DB yet. `/analytics` in the web app deliberately renders an empty state rather than drawing charts from them.
- **Never `.nullable()` a registered Zod schema** in the API. `Ref.nullable()` renders as `allOf` with a nullable object type, which openapi-typescript turns into an uninhabited intersection *and silently drops the nullability*. Use `z.union([Ref, z.null()])`.
- **No email exists yet.** Pass URLs and invitation links are returned in responses and must be shown on screen. Never write "check your email".
- **Tailwind v4**: prefer canonical class names (`bg-linear-to-t`, not `bg-gradient-to-t`) to avoid lint warnings.

## Before saying a change is done

Run these. All must pass:

```bash
nx run coreservice:lint
nx run coreservice:typecheck
nx run coreservice:test
```

Say plainly what you could not verify and why.

## Deep dives

Each package README goes further: [lib](packages/lib/README.md) · [api-client](packages/api-client/README.md) · [ui](packages/ui/README.md) · [ui-mobile](packages/ui-mobile/README.md) · [web](apps/web/README.md) · [mobile](apps/mobile/README.md) · [website](apps/website/README.md) · [core](services/core/README.md).

| Doc | For |
|---|---|
| [`docs/API-FIRST-REBUILD.md`](docs/API-FIRST-REBUILD.md) | The plan — decisions, target schema, full endpoint list, phases. Historical; some links in it are dead and the header says which. |
| [`docs/REBUILD-LOG.md`](docs/REBUILD-LOG.md) | What actually happened. **Wins wherever it disagrees with the plan.** |
| [`docs/DATABASE-MIGRATION.md`](docs/DATABASE-MIGRATION.md) | Getting the schema onto a database — local, test, and the remote Supabase cutover. |
| [`docs/LIVE-UPDATES.md`](docs/LIVE-UPDATES.md) | Why a check-in doesn't reach other screens, and the plan for it — polling first, then SSE (supersedes D4/D5 in the details). |
| [`docs/NEXT-UI-LIST.md`](docs/NEXT-UI-LIST.md) | The open UI backlog. |

`AGENTS.md` is a symlink to this file — one source of truth, not two that drift.
