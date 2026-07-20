# Part 1 — Application Structure & Architecture Audit

Per [`00-discovery.md`](00-discovery.md): Nx 22 + Bun workspace, 3 apps (`web`, `website`, `mobile`), 4 packages (`api-client`, `lib`, `ui`, `ui-mobile`), 1 service (`core`).

## 1. Workspace inventory & dependency graph

| Project | Type | Depends on (workspace packages) |
|---|---|---|
| `apps/web` | app | `@credopass/api-client`, `@credopass/lib`, `@credopass/ui` |
| `apps/website` | app | `@credopass/lib`, `@credopass/ui` |
| `apps/mobile` | app | `@credopass/api-client`, `@credopass/lib`, `@credopass/ui-mobile` |
| `packages/api-client` | lib | `@credopass/lib` (for Zod schemas/types) |
| `packages/lib` | shared lib | none (workspace-internal) — but see §5, it is doing too much |
| `packages/ui` | shared UI (web) | none (workspace-internal) |
| `packages/ui-mobile` | shared UI (mobile) | none (workspace-internal); has its own theme tokens independent of `packages/lib/src/theme` |
| `services/core` | backend | `@credopass/lib` (schema + validation) |

No circular dependencies found. No lib is consumed by only one app in a way that's a clean "inline candidate" — `api-client` and `ui`/`ui-mobile` are each used by exactly one app today (`api-client`↔`web`+`mobile` actually, `ui`↔`web`+`website`, `ui-mobile`↔`mobile` only). **`packages/ui-mobile` is the one package genuinely consumed by a single app** (`apps/mobile`) — not yet a strong inlining case since it's a real, non-trivial component set (12 components + a full token system, see §5), but worth watching if mobile stays the only consumer.

`services/core` does **not** depend on `packages/api-client` (expected — the API is the thing `api-client` calls) and does not depend on `packages/ui`/`ui-mobile` (expected, no UI in a backend service).

## 1.5. Critical: `services/core` has no authentication or tenant-scoping enforcement at all

This closes an open question `00-discovery.md` §4 flagged and deserves top billing rather than burial in the anti-pattern sweep, because it changes how every other finding in this audit should be weighed.

- **No auth middleware exists anywhere in the API.** [`services/core/src/index.ts`](../services/core/src/index.ts) mounts exactly two global middlewares — `logger()` and `cors()` (lines 24-51) — and nothing else. A repo-wide grep for `Authorization`, `authMiddleware`, `verifyToken`, `jwt`, `supabase.auth.getUser`, `bearer` inside `services/core/src` returns **zero matches**. Every route — `organizations`, `org-memberships`, `users`, `events`, `event-members`, `attendance`, `loyalty` — is reachable by an unauthenticated HTTP request; Supabase Auth (per `00-discovery.md` §4) is used entirely client-side and never checked by the API that actually reads/writes data.
- **No tenant scoping is enforced either, despite the capability existing.** [`services/core/src/util/crud-factory.ts:16,29,39-41`](../services/core/src/util/crud-factory.ts) defines a `requireOrganizationId` option specifically to force multi-tenant filtering on list endpoints — but a grep for `requireOrganizationId` across `services/core/src/routes/*.ts` returns **zero usages**. [`events.ts`](../services/core/src/routes/events.ts:12) only lists `organizationId` as an *optional* `allowedFilters` entry, and the client never sends it: `packages/api-client/src/collections/events.ts:27` fetches `GET /events` with no query params at all. Confirmed live in this session's local run: the dev server log showed the API executing `select ... from "organizations" order by "organizations"."createdAt" desc` and `select ... from "events" order by "events"."startTime" desc` — unconditional, no `WHERE`, no org filter — in response to an anonymous page load.
- **RLS (per `00-discovery.md` §4) does not compensate, because the API connects as a role that bypasses it.** So there are currently **zero enforcement layers** between "any HTTP client on the internet" and "read or write any row in any organization's data" — not the database (RLS on, no policies, and bypassed anyway), not the API (no auth, no scoping), leaving only the UI's own choices about what to render as the sole practical gate. `org_memberships.role` (`owner/admin/member/viewer`, `00-discovery.md` §5) exists purely as descriptive data today; nothing in the codebase reads it to make an authorization decision.
- **Why this matters more than a typical finding:** this isn't a missing edge case, it's the base case. Every screen captured in `02-ui-forensic.md`, every collection mapped in `03-tanstack-db-migration.md`, and every tier/entitlement model proposed in `05-user-management-upgrade.md` currently sits on top of an API that would serve the same unscoped data to a curious competitor's `curl` command as it does to a logged-in org owner. This should be treated as the top-priority fix in the executive summary, ahead of design or migration work — those are safe to sequence after this; this is not safe to leave unsequenced.

## 2. Boundary and layering check

- **No Nx module-boundary lint rule is configured.** [`eslint.config.js`](../eslint.config.js) has no `@nx/enforce-module-boundaries` rule, no `tags` in any `project.json` referenced by such a rule. Any app can import any package's internals directly; there is nothing in tooling stopping `apps/website` from reaching into `apps/web/src/*` or vice versa. This is a real gap, not just an unused feature — Nx ships this specifically for monorepos this shape.
- **`@typescript-eslint/no-explicit-any` is explicitly disabled** (`eslint.config.js` rules block: `"@typescript-eslint/no-explicit-any": "off"`). This is a deliberate, repo-wide choice to allow `any`, not an oversight — but it removes the main automated guardrail against the escape hatches found in §7.
- **UI-to-backend boundary violation, concretely:** [`apps/web/src/Pages/Login/index.tsx:4,12`](../apps/web/src/Pages/Login/index.tsx) constructs its own Supabase client instance directly in a page component — `const supabaseInstance = createClient(SUPASE_CRED.URL, SUPASE_CRED.ANON_KEY)` — instead of using a single shared client instance. The env-var wrapper it pulls credentials from, [`apps/web/src/config.ts:25-27`](../apps/web/src/config.ts), contains its own comment admitting this: *"If you already have a shared Supabase client elsewhere in the monorepo... delete this file and import that one instead."* A shared client already exists (`@credopass/lib/supabase` re-exports `createClient` — [`packages/lib/src/supabase/index.ts`](../packages/lib/src/supabase/index.ts)), so this isn't a missing-capability problem, it's an un-followed-through refactor. Every other screen that needs Supabase (per a repo grep) goes through hooks/props rather than instantiating a client inline — Login is the one exception found.
- Beyond Login, no other component-level direct `fetch()`/`supabase.*` calls were found in `apps/web/src/Pages`, `containers`, or `routes` — data access elsewhere goes through `@credopass/api-client`'s TanStack DB collections, which is the intended pattern.
- **Business logic duplication across apps:** not established either way yet — `apps/mobile` and `apps/web` both consume `@credopass/api-client`'s collections, which is the right shape to avoid duplication, but mobile's own screens (`apps/mobile/src/screens/**`) weren't diffed line-by-line against web's `Pages/**` in this pass; flag as a follow-up if a future part needs it.

## 3. Routing architecture

| App | Style | Evidence |
|---|---|---|
| `apps/web` | Code-based TanStack Router, one file per route under `src/routes/**`, generated `routeTree.gen.ts` | `checkin/$eventId.tsx`, `checkin/index.tsx`, `events/$eventId.tsx`, `events/index.tsx`, `index.tsx`, `login.tsx`, `members.tsx`, `organizations.tsx`, `upgrade.tsx`, `analytics.tsx`, plus `__root.tsx` layout — [`apps/web/src/routes/`](../apps/web/src/routes/) |
| `apps/website` | **No router at all.** `App.tsx` renders `<Home />` unconditionally — a single static page, despite living in a dedicated `apps/website/src/pages/` directory that implies more pages are planned. | [`apps/website/src/App.tsx`](../apps/website/src/App.tsx) |
| `apps/mobile` | Hand-rolled stack/tab navigators (not Expo Router) — `RootNavigator.tsx` → `BottomTabNavigator.tsx` → per-domain stacks (`CheckInStack`, `EventsStack`, `MembersStack`) | [`apps/mobile/src/navigation/`](../apps/mobile/src/navigation/) |

- `apps/web` route files under `src/routes/` are thin — they wire up to full page implementations under `src/Pages/<Domain>/index.tsx` (e.g. `routes/members.tsx` → `Pages/Members/index.tsx`, 578 lines). TanStack Router supports loaders for route-level data fetching, but the actual data fetching in `Pages/*` happens via TanStack DB collection hooks called inside the page components, **not** via router `loader` functions — meaning route transitions don't get the router's built-in pending/error boundary integration for data, and there's no route-level prefetch-on-hover benefit being used. This is a consistent pattern across all of `apps/web`'s routes (not an isolated inconsistency), so it reads as an intentional simplification rather than an oversight — but it does forfeit a capability TanStack Router is specifically good at.
- `apps/website` having zero routing despite a `pages/` directory structure suggests either very early-stage development or an abandoned multi-page plan — can't distinguish from static analysis alone; flagged as an open question rather than a defect.

## 4. Build & tooling health

- **Caching is configured and real:** `nx.json` targetDefaults set `"cache": true` for `build`, `lint`, `typecheck`, `test`, and `build` declares `dependsOn: ["^build"]` (dependency-graph-aware). CI (`ci-web.yml`, `ci-api.yml`) additionally uses `nrwl/nx-set-shas` + `nx show project <p> --affected` to skip whole-pipeline runs when a project isn't affected — this is real, working affected-based CI, not just capability left unused.
- **Path aliases are centralized and consistent:** all cross-package imports resolve through `tsconfig.base.json`'s single `paths` map (`@credopass/lib/*`, `@credopass/api-client`, `@credopass/api-client/*`, `@credopass/ui/*`, `@credopass/ui-mobile/*`). No per-package alias drift found.
- **`services/core`'s test script depends on a schema that no longer exists.** `services/core/src/test/routes.test.ts:41-49` builds a test event payload with a `hostId` field, but the live schema (`packages/lib/src/schemas/tables/events.ts` via the relations file) replaced `hostId` with the `event_members` join table — the relations comment in [`packages/lib/src/schemas/tables/index.ts:75`](../packages/lib/src/schemas/tables/index.ts) literally says *"replaces hostId."* This test is written against the stale, dead-code schema documented in `00-discovery.md` §5 (`services/core/src/db/schema/`) and would fail against the live schema. It's very likely never run — see §6.
- **CI/CD friction:** `ci-web.yml`'s path filters reference `packages/validation/**`, a package that does not exist (`00-discovery.md` §6) — meaning a push touching only `packages/lib` or `packages/api-client` won't auto-trigger a web deploy on `git push`, only `workflow_dispatch` will catch it.
- **`.env` sprawl without a single validated config module.** Each app hand-rolls its own env access: `apps/web/src/config.ts` reads `import.meta.env.VITE_*` directly with ad hoc `throw`/`console.warn` guards; `services/core` reads `process.env.DATABASE_URL` inline in `db/client.ts` with its own separate error-message construction. There's no shared `zod`-validated env schema despite `zod` being a dependency everywhere (`packages/lib`, `apps/web`, `services/core` all depend on it) — the pieces to build one config module exist but aren't assembled into one.

## 5. Shared package design

- **`packages/ui` is not purely presentational.** [`packages/ui/src/components/map.tsx`](../packages/ui/src/components/map.tsx) is 1,482 lines — for a single component, this strongly suggests embedded state/data logic, not just markup (Part 2 should visually confirm, but a component this size in a "shared, presentational" package is itself a finding). [`packages/ui/src/components/sidebar.tsx`](../packages/ui/src/components/sidebar.tsx) at 748 lines is the second largest.
- **Two independent design-token systems exist with no shared source:**
  - Web/website: `packages/lib/src/theme/index.tsx` (a single `ThemeProvider`, consumed by both `apps/web/src/main.tsx` and `apps/website/src/App.tsx` — genuinely shared between those two apps).
  - Mobile: `packages/ui-mobile/src/theme/{colors,spacing,typography}.ts` — hand-authored hex values (e.g. `primary.500: '#0ea5e9'`, `packages/ui-mobile/src/theme/colors.ts`) with no import from, or cross-reference to, `packages/lib/src/theme`.
  - This means a brand color change today requires manually updating two unrelated token sources, and nothing enforces they stay in sync. Given RN can't consume Tailwind/CSS-variable tokens directly, some divergence is structurally necessary — but the *values* themselves (hex codes) could still be generated from one source of truth and aren't. Part 2's token-drift audit should check whether the two systems currently agree in practice.
- **`packages/ui-mobile` is a real, populated package**, not a stub: 12 components (`Avatar`, `Badge`, `Button`, `Card`, `DataTable`, `EmptyState`, `EventCalendar`, `EventRow`, `Input`, `Loader`, `QRDisplay`, `Select`) plus its own theme system — despite its `package.json` listing zero `dependencies` (it presumably relies on `react-native` core primitives via the app's own peer install, not unusual for a pure-RN component package).

## 6. Testing posture

**There is effectively no test coverage in this codebase.**

| Project | Test files found |
|---|---|
| `apps/web` | 0 |
| `apps/website` | 0 |
| `apps/mobile` | 0 |
| `packages/api-client` | 0 |
| `packages/lib` | 0 |
| `packages/ui` | 0 |
| `packages/ui-mobile` | 0 |
| `services/core` | 1 (`src/test/routes.test.ts`) — and per §4, it's written against a stale schema |

- `vitest.workspace.ts` exists and is correctly wired to discover `vite.config.*`/`vitest.config.*` across the monorepo, and `@testing-library/react`/`@vitest/coverage-v8`/`jest-expo` are all installed as devDependencies — **the tooling to test is fully present and configured; it's simply not used.** This is a tooling-is-ready-but-unused situation, not a missing-capability one.
- `ci-api.yml`'s quality-checks job (lint/typecheck/**test**) is entirely commented out (lines 10-38), and `ci-web.yml`'s test step is `bun nx test web || echo "No tests configured"` — a step that always exits 0 whether or not tests exist or pass, i.e. **not actually a CI gate**.
- **Highest-risk untested paths, by product surface (per `00-discovery.md`):**
  1. **Auth / guest conversion** (`apps/web/src/hooks/index.tsx` `useGuestAutoLogin`, `packages/lib/src/supabase/auth.ts`) — zero tests on the flow that silently signs every unauthenticated visitor in anonymously and redirects them; a regression here changes who gets into the product at all.
  2. **Upgrade/billing route** (`apps/web/src/routes/upgrade.tsx`, `Pages/Upgrade/`) — zero tests on the one revenue-adjacent flow in the app (see `05-user-management-upgrade.md` for how far this goes today).
  3. **Check-in/attendance** (`apps/web/src/routes/checkin/**`, `services/core/src/routes/attendance.ts`) — this is the core transactional flow specific to this product (event check-in), and it's untested on both client and server.
  4. **`services/core` CRUD routes generally** — the one existing test only covers user+event creation and, per §4, tests against a schema shape the app no longer uses.

## 7. Anti-pattern sweep

- **God components:** `packages/ui/src/components/map.tsx` (1,482 lines), `apps/website/src/pages/Home.tsx` (745 lines — the entire marketing site in one file, no decomposition into Hero/Features/Footer sections), `apps/mobile/src/app/App.tsx` (700 lines), `apps/web/src/Pages/Members/index.tsx` (578 lines), `apps/web/src/Pages/Analytics/index.tsx` (572 lines).
- **`any`/unchecked-cast usage**, concentrated in two places: `apps/web/src` (28 occurrences) and `packages/ui/src` (22 occurrences) — both plausible given map/chart/grid third-party integrations (maplibre-gl, recharts, ag-grid commonly need escape hatches), but with `no-explicit-any` off repo-wide (§2) nothing currently distinguishes a justified third-party-boundary `any` from a lazy one. `apps/website`, `apps/mobile`, and `packages/ui-mobile` have zero `any` usage, for contrast.
- **Duplicated/dead schema:** covered in `00-discovery.md` §5 — `services/core/src/db/schema/*` is unused, inconsistent-with-live-schema, and should be deleted rather than left as an apparent second source of truth.
- **Env-variable sprawl:** covered in §4 — no single validated config module despite `zod` being available everywhere.
- **Error handling is inconsistent between the two data-mutation paths in `packages/api-client`:** `handleAPIErrors` (`packages/api-client/src/client.ts:24-32`) parses a structured `{ error: { cause } }` shape and throws a formatted `Error`, but it's only called from `onInsert` in `events.ts`; `onUpdate`/`onDelete` in the same file throw generic `new Error('Failed to update event')`/`'Failed to delete event'` without inspecting the response body at all (`packages/api-client/src/collections/events.ts:71,82`) — a real inconsistency within one file, not just across the codebase, meaning update/delete failures lose whatever detail the API actually returned.

## Scored table: subsystem health

| Subsystem | Status | Basis |
|---|---|---|
| Nx build/lint/typecheck/test caching | **Works well** | Real `cache: true` + affected-based CI, §4 |
| Web routing (TanStack Router) | **Works well, one gap** | Consistent code-based routes; data fetching in components not loaders is a deliberate-looking but capability-forfeiting pattern, §3 |
| Website routing | **Broken/absent** | No router; single hardcoded page despite `pages/` scaffolding, §3 |
| Module boundaries | **Needs work** | No Nx boundary lint configured at all, §2 |
| Shared UI (`packages/ui`) | **Needs work** | 1,482-line "component" suggests logic leakage into a presentational package, §5 |
| Cross-platform design tokens | **Needs work** | Two unsynced token sources (web vs mobile), §5 |
| Data access boundary | **Mostly works, one violation** | api-client used consistently except Login's inline Supabase client, §2 |
| Config/env handling | **Needs work** | No validated single config module despite `zod` being available, §4 |
| Testing | **Broken** | 0 tests across 7 of 8 projects; the 1 existing test targets a dead schema; CI test steps are non-blocking, §6 |
| CI/CD pipeline health | **Needs work** | Stale path filters, commented-out API quality gate, Cloud-Run-vs-Coolify comment drift (`00-discovery.md` §6) |

## Prioritized structural fixes (impact × ease)

0. **Add authentication + organization-scoping enforcement to `services/core`** (§1.5) — this supersedes every other item on this list in priority. Concretely: verify the Supabase-issued JWT on every request (Supabase exposes a JWKS endpoint for exactly this), and set `requireOrganizationId: true` (already built into `crud-factory.ts`, just unused) on every multi-tenant route, deriving the allowed `organizationId` set from the verified user's `org_memberships` rather than trusting a client-supplied filter. Medium effort (the scaffolding already exists), maximum impact (this is a live data-exposure gap, not a theoretical one).
1. **Wire the API's quality-checks job back in and fix the stale test** (`ci-api.yml` lines 10-38, `routes.test.ts` `hostId`→`eventMembers`) — high impact (this is the only backend test gate at all), low effort (uncomment + one-file fix).
2. **Delete `services/core/src/db/schema/`** — removes a confusing, unused duplicate source of truth; zero risk (confirmed unimported), trivial effort.
3. **Add `@nx/enforce-module-boundaries`** with basic app/lib tags — prevents the boundary drift already seen once (Login's inline Supabase client) from recurring elsewhere; medium effort (needs tagging every project), high long-term impact given 3 apps + 4 libs will only grow.
4. **Fix `ci-web.yml`'s path filters** (drop `packages/validation`, add `packages/lib`, `packages/api-client`) — low effort, prevents silent deploy misses on shared-package changes.
5. **Consolidate env config into one validated module per app** (using the `zod` already installed everywhere) — medium effort, removes a recurring source of the kind of drift seen in `apps/web/src/config.ts`.
6. **Decompose the largest god components** (`map.tsx`, `Home.tsx`) before Part 2's redesign work touches them — doing this first will make the UI forensic pass and any follow-up redesign meaningfully cheaper.
7. **Add tests for the three highest-risk flows** (guest auth, upgrade, check-in) — the tooling is already installed and configured; this is pure authoring effort, not a tooling gap.

---
*Next: `02-ui-forensic.md` (screenshot capture + per-screen critique, mobile + tablet viewports).*
