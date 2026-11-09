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
`@credopass/api-client` hooks — see [`docs/API-SECOND-REBUILD.md`](docs/archive/API-SECOND-REBUILD.md) for the
plan and the "web app moved onto /api/v1/core" entry in the rebuild log for what was actually done.

**The sign-up funnel landed** — [`docs/API-THIRD-REBUILD.md`](docs/archive/API-THIRD-REBUILD.md), decisions
D20–D26. Four things to internalise before touching auth, roles or onboarding:

- **Google is the only sign-in.** Email+password and GitHub were removed, and with them the
  password-reset route, the strength meter and `email.schemas.ts`. `createAuthClient` in
  `packages/lib/src/supabase/auth.ts` exposes exactly one function. Do not add a provider without
  deciding the account-linking question first — see the gotcha below.
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
services/core   Hono API on Bun · /api/v1/core · Coolify on Hetzner
packages/lib          schemas, types, enums, stores, theme, Supabase auth  ← the core; everything imports it
packages/api-client   typed TanStack Query hooks over a generated OpenAPI contract (the ONLY way apps get data)
packages/ui           web design system (Base UI + Tailwind v4)
packages/ui-mobile    React Native design system
```

## The model: three concepts, and only three

*Permissions* and *access* are not separate things from membership — they **are** membership.

| Concept | Its one job |
|---|---|
| **Account** | **Who you are.** A Google login, `(issuer, subject)`. One per human; carries no org, no role, no plan. |
| **Organisation** | **Who the event is from**, and the container holding its events, attendees and bill. A hard boundary — a row in another org returns **404**, not 403. |
| **Membership** | **Which organisations you may touch, and how much.** The link, carrying a role. The *only* permission system. |

An account reaches an organisation **only** through a membership. Creating an organisation writes
exactly two rows (the org, and an `owner` membership) and produces a fully independent tenant — not a
filtering layer. It shares nothing with the creator's other organisations.

**Four assignable roles**, a strict chain: `owner` ⊃ `admin` ⊃ `organizer` ⊃ `checkin`.
`ASSIGNABLE_ORG_ROLES` is what may be granted; `ORG_ROLES` additionally contains **`viewer`**, which
is **not assignable** but is still resolvable — it is a value of the `org_role` Postgres enum, the
default of `org_memberships.role` and `org_identity_providers.default_role`, and `normaliseRole`'s
fallback. So a response may carry it and nothing may assign it: request schemas use
`AssignableRoleSchema`, responses use `RoleSchema`. Do not "tidy" it out of the enum —
`ALTER TYPE … DROP VALUE` does not exist.

**UI vocabulary:** on an event or invite the user-facing word is **"Host"**; on admin screens
(members, billing, settings) it is **"Organisation"**. A solo user should meet neither.

**[`FORENSICS.md`](FORENSICS.md) is the contract reference** — all 51 endpoints with scope and
permission, the role matrix, the known defects and the open investigations. Read it before changing
a route, a role or a permission.

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
2. **A declared permission must also be enforced.** `defineRoute` records `permission` and the boot
   assertion validates the *declaration*; the actual check is a separate
   `middleware: [requirePermission('...')]` line, which the boot assertion cannot see. Two routes had
   drifted. `src/test/route-enforcement.test.ts` now fails if a `scope: 'organization'` route declares
   one permission and enforces another, or none.
3. **Errors are `ProblemError`.** Throw from `src/http/problem.ts`. Never `c.json({ error })`, never `HTTPException`.
4. **Never hand-write OpenAPI.** The doc at `/api/v1/openapi.json` is generated from the same Zod schemas that validate requests.
5. **Handlers never build a `TenantContext`.** Only the tenant middleware does. The type is branded so you can't fake one, and lint blocks the import.
6. **Domain services import no framework.** Nothing under `src/services/` may import `hono`. Lint blocks it.
7. **A resource in another tenant returns 404, not 403.** 403 means "your tenant, wrong role". Never leak that a row exists.
8. **Every tenant-scoped query filters on `ctx.organizationId` explicitly. Routes never query; services do.** (There was a `db/scoped.ts` meant to enforce this. Nothing imported it — all ten services filtered by hand — so it was deleted rather than left as a rule the code did not follow.)

## Where things live

| Need to touch… | Go to |
|----------------|-------|
| DB schema / model | `packages/lib/src/schemas/tables/` (+ relations in `tables/index.ts`) |
| Validation / shared types | `packages/lib/src/schemas/enums.ts`. Request validation lives in the Zod schemas beside each route — there are no per-table `*.schema.ts` validators any more. (`email.schemas.ts` held the password-form validators and went with email sign-in.) |
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

- **`coreservice:start` refuses a non-localhost `DATABASE_URL`.** `scripts/guard-db-host.ts` runs
  before the server and exits 1 if the host is not in the allow-list, because an exported
  `DATABASE_URL` silently beats `.env` (Bun will not override a set variable). To do it on purpose:
  `nx run coreservice:start:allow-remote`. The guard lives in the nx target, **not** in
  `src/index.ts` — that file is the production entrypoint and a localhost check there would stop
  Coolify booting. The boot log now prints the real host and no password.
- **Never hand-roll `bun src/index.ts` for the API.** `NODE_ENV` would be unset, so `isDevelopment`
  (`std-env`) is false and `services/core/src/index.ts` takes the *production* CORS branch, which
  allow-lists only `app.credopass.com` / `credopass.com`. The browser then blocks `localhost:5000` with
  a CORS error. The Nx target sets `NODE_ENV=development` for exactly this reason.
- **`nx run coreservice:migrate` writes to whatever `DATABASE_URL` points at.** The default in
  `services/core/.env` is the local Docker Postgres, not the remote instance — but check with
  `nx run coreservice:db status` (it flags `⚠️ REMOTE`) before running it. The remote Supabase
  instance **is** migrated — 4/4, verified 2026-11-06. `db reset` and `db seed` refuse any host that
  is not localhost, by design; `migrate` is the only command allowed to run against the remote.
  Read [`docs/DATABASE-MIGRATION.md`](docs/DATABASE-MIGRATION.md) §5 before aiming at it.

## Commands

```bash
bun start                     # web + API together — the default way to run the app
nx run web:serve              # web  → :5000
nx run coreservice:start      # API  → :8080 (bun --watch; refuses a remote DATABASE_URL)
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
nx run coreservice:test:adversarial  # 51 tenancy tests; GREEN as of 2026-11-06 — and CI will not deploy past a red one
nx run coreservice:typecheck

nx run coreservice:dev:up            # postgres + MinIO
nx run coreservice:db status         # does the DB match the code? START HERE when confused
nx run coreservice:db reset          # drop + replay migrations (localhost only, by design)
nx run coreservice:db join <id>      # make an account an owner of the seeded org
nx run coreservice:dev:down          # stop everything
nx run coreservice:dev:logs

nx run coreservice:docs              # open Scalar (docs + API client)
nx run coreservice:token             # how to get a JWT for the Scalar auth box
nx run coreservice:openapi:export    # write openapi.json for desktop clients

nx run coreservice:verify:public-access   # is the DB publicly readable? exits 1 if yes

nx run api-client:generate           # export openapi.json → regenerate schema.d.ts
nx run api-client:typecheck
```

Verify a change compiles with `nx run <project>:typecheck` / `nx run <project>:build`. The web app has no top-level `typecheck` script that always passes standalone — prefer `nx run web:build` or `nx run website:build` to confirm.

## Gotchas

- **Ports:** web `5000` (AirPlay often holds it — it usually lands on `5001`), API `8080`, website `4200`, MinIO `9000` (console `9001`), test Postgres `55432`.
- **One base path: `/api/v1/core`.** `/api/core` is gone and the service 404s it. The web app reads `VITE_API_URL`, falling back to `/api/v1/core`.
- **Docs:** Scalar at `http://localhost:8080/api/v1/core/docs`, raw spec at `/api/v1/core/openapi.json`.
- **`AUTH_DISABLED=true`** bypassed JWT verification for `/api/core`, which no longer exists. **Do not use it.** The auth path must actually get exercised.
- **`drizzle/` is now tracked in git.** Migrations are reviewed like any other code. Don't re-ignore it.
- **Adding a column is not additive at runtime.** Drizzle builds an explicit column list from the schema, so a new column makes *every* query ask for it. Every database the code runs against must be migrated before the code ships — and a `NOT NULL` column with no default breaks every INSERT, including `resolveCaller`'s.
- **A `drizzle-kit push` database has tables but no migration journal**, so `migrate` fails on it. `nx run coreservice:db status` detects this; `db reset` fixes it.
- **`db` takes its subcommand as an argument:** `nx run coreservice:db reset`. (`db:reset` also works — there are matching nx *configurations* — but prefer the argument form, it is what `scripts/db.ts` documents.) `migrate`, `seed` and `verify:public-access` are top-level targets in their own right.
- **Tests must never touch the real database.** `TEST_DATABASE_URL` points at a throwaway Postgres; the adversarial suite truncates every table.
- **`routeTree.gen.ts`** (web) is generated by the TanStack Router Vite plugin; edit `src/routes/*` instead.
- **Analytics are fabricated** (`services/core/src/services/analytics/`) — deterministic placeholder numbers behind the real `AnalyticsResponse` contract. Don't assume they read the DB yet. `/analytics` in the web app renders the **full dashboard** from them, above a banner that says "These numbers are made up … Don't report anything from this page." (It was once an empty state; it is not one now — verified on screen 2026-11-06.)
- **Never `.nullable()` a registered Zod schema** in the API. `Ref.nullable()` renders as `allOf` with a nullable object type, which openapi-typescript turns into an uninhabited intersection *and silently drops the nullability*. Use `z.union([Ref, z.null()])`.
- **An account is `(issuer, subject)`, never an email.** `accounts.email` is a MIRROR of what the
  provider asserted and is only written when `uq_accounts_email` leaves it free; the address always
  lands on the identity row. Two provider identities for one address get two accounts — linking them
  is an unbuilt feature, not an accident.
- **Supabase sends no top-level `email_verified` claim** — it is inside `user_metadata`, which the
  user can write via `auth.updateUser({ data })`. This is handled, not open:
  `emailVerifiedFromClaims` (`services/identity.ts`) honours the signed top-level claim when a
  provider sends one and otherwise derives verification from `app_metadata` / `amr`, against the
  `ADDRESS_ASSERTING_PROVIDERS` allow-list. **Never trust `user_metadata` for an identity decision**
  — display names only. `src/test/email-verified.test.ts` asserts both directions.
- **No email exists yet.** Pass URLs and invitation links are returned in responses and must be shown on screen. Never write "check your email".
- **A pass cannot be fetched, only reissued.** Only the token's SHA-256 is stored.
  `POST /me/tickets/{id}/pass` mints a new one and revokes the old
  (`uq_passes_event_person_live` allows exactly one live pass per person per event). Any UI that
  offers it must say so.
- **`cover_image_url` holds one of three things**: an absolute https URL, one of our own ready
  asset URLs, or a **root-relative built-in poster path** (`/posters/*.svg`). The poster list is
  `packages/lib/src/schemas/poster-templates.ts` and `assertCoverImageAllowed` matches it by exact
  set membership — never widen that to a prefix test.
- **Two scopes read events, and they must not be confused.** `/events` is organisation-scoped (what
  you host). `/me/tickets` is account-scoped (what you attend) and filters on `people.account_id`
  alone, across every organisation. A ticket is not a membership — nothing on that path may read or
  write `org_memberships` (T29). Its api-client query keys deliberately sit outside the
  `['org', id, …]` prefix, so switching organisation must not refetch or empty the list.
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

**[`docs/README.md`](docs/README.md) is the front door** — every document, whether to trust it, and
the single list of what is still open. Start there rather than guessing from filenames.

| Doc | For |
|---|---|
| [`docs/README.md`](docs/README.md) | **The index, and the one list of what is left.** |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | **The ordered plan (2026-11-07).** Six stages, what is already done, the maintainer's testing feedback as F1–F13, decisions D39–D42. Start here before picking up work. |
| [`docs/API-FIRST-REBUILD.md`](docs/API-FIRST-REBUILD.md) | The plan — decisions, target schema, full endpoint list, phases. Historical; some links in it are dead and the header says which. |
| [`docs/REBUILD-LOG.md`](docs/REBUILD-LOG.md) | What actually happened. **Wins wherever it disagrees with the plan.** |
| [`docs/DATABASE-MIGRATION.md`](docs/DATABASE-MIGRATION.md) | Getting the schema onto a database — local, test, and the remote Supabase cutover. |
| [`docs/STORAGE.md`](docs/STORAGE.md) | Object storage: how presigned uploads work, provisioning the production bucket, and the CORS/public-URL traps. **Production has no bucket yet.** |
| [`docs/LIVE-UPDATES.md`](docs/LIVE-UPDATES.md) | Why a check-in doesn't reach other screens, and the plan for it — polling first, then SSE (supersedes D4/D5 in the details). |
| [`docs/NEXT-UI-LIST.md`](docs/NEXT-UI-LIST.md) | The open UI backlog. |
| [`docs/NEXT-PHASE-PLAN.md`](docs/NEXT-PHASE-PLAN.md) | **What's next** — the paid public API + webhooks (Phase 8), data ownership for churches that keep their own PII, and the product backlog. Plan only; nothing in it is built. |

**When a plan ships, `git mv` it to [`docs/archive/`](docs/archive/)** and write the outcome in
[`docs/REBUILD-LOG.md`](docs/REBUILD-LOG.md). A shipped plan left in `docs/` is written in the present
tense about a system that has moved, and the next person reads it as current.

`AGENTS.md` is a symlink to this file — one source of truth, not two that drift.
