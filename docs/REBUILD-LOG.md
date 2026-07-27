# The rebuild log

> **What actually changed, in the order it changed.** The plan is
> [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) — what we *intend* to build. This is the record of what
> was built, what was decided differently along the way, and what broke.
>
> Read it top to bottom to understand the system as it stands.

**Status:** Phase 1 mostly complete · web app rewired onto `/api/v1/core` · **Last updated:** 2026-07-27

---

## The shape of it, in one page

```
BEFORE                                    AFTER
──────                                    ─────
React app with a database attached        API with rendering clients

apps/web ──► TanStack DB collections      apps/web ──┐
             (full-table caches)          apps/mobile ├─► /api/v1/core ──► services
                    │                     curl ──────┘         │
                    ▼                                          ▼
             /api/core (thin CRUD)                        Postgres + RLS

Business rules in the browser             Business rules in services/
Tenant = whatever the client sent         Tenant = from the token, branded type
Errors = { error: "..." }                 Errors = RFC 9457 problem+json
OpenAPI hand-written, always stale        OpenAPI generated from the Zod schemas
```

**One API surface.** This section used to describe two running side by side. `/api/core/*` and its
CRUD factory are deleted; the service 404s that path and every client is on `/api/v1/core`.

---

## Phase −1 — The database was publicly writable

**The finding.** `services/core/drizzle/rls_dev_permissive.sql` had created
`FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)` on all seven tables. Combined with
`VITE_SUPABASE_ANON_KEY` shipping in the web bundle — which is what an anon key is *for* — anyone who
opened the site and read one JS bundle could read and write every row, bypassing the API entirely.

Confirmed live, not theoretically. Every table answered HTTP 200 with real data to the public key:
`users` 34 rows (with email addresses), `loyalty` 32, `org_memberships` 25, `organizations` 3,
`events` 2, `attendance` 2.

**One correction to the plan.** §9.5 prescribed revoking `anon` only. That was insufficient: the
policies also granted `authenticated`, and the app offers "Continue as guest" via
`signInAnonymously()` — so any visitor could mint an `authenticated` JWT with no credentials.
Revoking `anon` alone would have left identical access one anonymous sign-in away. Both roles revoked.

**Verified safe before applying.** The API connects as `postgres`, and the dev policies were scoped
`TO anon, authenticated` — so they never applied to it. The browser Supabase client is used only for
`auth.*`; there is not one `.from()` or `.rpc()` call in `apps/` or `packages/`.

| Landed | |
|---|---|
| `services/core/sql/001_revoke_public_data_access.sql` | Drops the policies, revokes both roles, revokes default privileges |
| `services/core/sql/verify-public-access.sh` | Probes every table; exits 1 if any answers with data |

**Applied 2026-07-26.** The verifier now reports `PASS: no table returns data to the public key.`

---

## Phase 0 — Foundations

No user-visible change. This phase exists to make later mistakes impossible rather than merely
discouraged.

### The two structural gates

**1. A route cannot exist without declaring its authorization.**
[`route-registry.ts`](../services/core/src/http/route-registry.ts) ·
[`define-route.ts`](../services/core/src/http/define-route.ts)

Registering with OpenAPI and declaring the authorization contract are the *same call*. The common
mistake is a **type** error: `scope: 'organization'` without a permission does not compile. A bad
declaration that reaches the registry another way crashes the service at boot, before it serves a
request.

**2. A handler cannot fabricate a tenant.**
[`tenancy/context.ts`](../services/core/src/tenancy/context.ts)

`TenantContext` carries a `unique symbol` brand. The test proves it with `@ts-expect-error` — if the
brand ever weakens, the build fails.

### Everything else

| Landed | What it does |
|---|---|
| [`http/problem.ts`](../services/core/src/http/problem.ts) | RFC 9457 envelope, 30 stable machine codes |
| [`authz/permissions.ts`](../services/core/src/authz/permissions.ts) | 26 permissions + the role matrix |
| [`db/scoped.ts`](../services/core/src/db/scoped.ts) | Tenant-scoped repository accessor |
| `/api/v1/core/docs` | Scalar — reference **and** a working API client |
| [`test/contract.ts`](../services/core/src/test/contract.ts) | Validates every response against the emitted spec |
| 47 adversarial tests | Written ahead of the code they guard |
| eslint rules | `services/**` can't import Hono; routes can't import `createTenantContext` |

### Decided differently

- **Contract harness uses ajv directly**, not `openapi-response-validator`. OAS 3.1 schemas *are* JSON
  Schema 2020-12, so there is nothing to translate. It has four self-tests, because a contract checker
  that cannot fail proves nothing.
- **Test targets split.** `test` is unit/structural (no DB, always green); `test:adversarial` is its
  own blocking CI job. One command cannot express "28 red tenancy tests and 0 others".

### Fixed beyond scope

- **CI was passing the production `DATABASE_URL` into the test job.** Tests could reach the live
  database. Removed.
- **CI only ran on push to main**, so a suite that "blocks merge unconditionally" could not. Added
  `pull_request`.

---

## Phase 1 — Identity and tenancy

The keystone: `users` splits into **`accounts`** (who signs in) and **`people`** (tenant-scoped
attendee records), joined to any identity provider through **`identities`**.

### Why that split is the whole game

Today `users.email` is **globally** unique. Two churches cannot both have `john@gmail.com` on their
rolls — the first to check him in owns the row, and the second's check-in silently attaches to a
person the first org can read. Tenant-scoping that uniqueness is the difference between a
multi-tenant product and a shared spreadsheet.

It also creates the two-scope model that makes the attendee product possible:

```
account ──org_memberships──► organisation scope   (the console; one org at a time)
   └─────people.account_id──► personal scope      (my tickets; across ALL orgs)
```

`people.account_id` is the hinge. Org-scoped reads never look at it. Personal reads look at *only*
it. Neither can reach the other's rows — which is how **attending an event never grants access to the
organisation running it** becomes structural rather than a rule someone remembers.

### Tables

| New | Purpose |
|---|---|
| `accounts` | A human who signs in. No org, no role, no plan. |
| `identities` | `(issuer, subject)` → account. The only join to any IdP. |
| `people` | Tenant-scoped attendee record. Email unique **per org**. |
| `invitations` | Addressed to an email, not an account — which is why it can't be columns on a membership. |
| `org_identity_providers` · `org_domains` | Enterprise SSO. Schema now, flows in Phase 7. |

`org_memberships` gained `account_id`, `status`, `provisioned_by`, `external_id`; `userId` became
nullable.

### Identity

**The trust anchor is the issuer, not a vendor.** A token is trusted because its `iss` is registered
and its signature verifies against that issuer's JWKS — never because it came from a particular SDK.
Adding a tenant's Okta becomes a config row rather than a deploy.

**A caller is identified by `(issuer, subject)`. Never by email.** Email is user-editable at many
providers and absent for anonymous sessions. T47 enforces this by grep, so it holds for code no test
happens to exercise.

### Membership invariants

Enforced in [`membership.ts`](../services/core/src/services/membership.ts), not by convention:

- Creating an org writes the owner membership in the **same transaction** — no orphan orgs
- The last owner cannot be demoted or removed
- Nobody can grant a role above their own
- An admin cannot act on an owner
- Invitation tokens: 32 bytes CSPRNG, returned once, stored only as SHA-256, and acceptance requires
  a **verified** email match

### RLS

[`0004_rls_tenancy.sql`](../services/core/drizzle/0004_rls_tenancy.sql) — 12 policies, two
`SECURITY DEFINER` helpers, and a `credopass_api` role with `rolbypassrls = false`.

The subtlety worth remembering: **`USING` carries the self-branch, `WITH CHECK` does not.** An
attendee may *read* their own record in an org they have nothing to do with, but can never *write*
one. `org_memberships` and `passes` get no self-branch at all.

### Decided differently

1. **`GET`/`POST /organizations` are `scope: 'account'`, not `org:read`.** §5.2 lists them as
   org-scoped, which is circular — you cannot require an active organisation in order to create your
   first one.
2. **`requireTenant({ fromPathParam })`** for `/organizations/{id}/*`. Still validated against
   memberships, so rule 1 holds. A *path* naming another tenant's org returns 404; a *header* returns
   403 — matching §5.0's not-found-vs-forbidden rule.
3. **`/api/v1` → `/api/v1/core`**, leaving room for `/api/v1/billing` later.

### Bugs found and fixed

| Bug | Why it mattered |
|---|---|
| Auth sub-app mounted at `/` with `use('*')` | Put auth on `/health`, `/docs`, `/openapi.json`. A 401 from `/health` pulls the service out of the load balancer. |
| `defineRoute` returned a widened `RouteConfig` | Collapsed every `c.req.valid()` to `never`. The wrapper was costing the type safety it exists to provide. |
| Opaque `500 internal_error` | Hid the real cause — `DATABASE_URL` pointing at a database the migrations had never been applied to. Now: dev-mode `detail`, a boot warning naming the missing tables, and `/health/ready` returning 503. |
| Problem `type` URIs pointed at `credopass.com` | That is the marketing site. Now `app.credopass.com`. (These are RFC 9457 *identifiers*; nothing needs to be published there.) |

### Still open

- **The RLS cutover.** The API connects as `postgres`, which bypasses RLS — so those 12 policies are
  currently inert on the API path. Needs `SET LOCAL app.account_id` wired per transaction *before*
  switching the role, or every query returns zero rows.
- **No data migration** from `users` → `accounts` + `people`.
- **The web app still calls `/api/core`.** Client rewiring is deliberately last.

---

## Phase 2 — Events and people reads (started)

### `deriveStatus` — the one implementation

[`event-status.ts`](../services/core/src/services/event-status.ts) · 21 boundary tests

Status stops being a stored column and becomes a pure function of recorded facts plus the clock.
`events` gained `opened_at`, `closed_at`, `cancelled_at`, `cancellation_reason`, `enforce_capacity`.
The old `status` column stays until Phase 3 so `/api/core` keeps working; nothing in `/api/v1/core`
reads it.

Precedence is asserted on its own, because it is the thing a reimplementation gets wrong:
**cancelled > completed > ongoing > scheduled**. Both boundaries are inclusive — at exactly `end_at`
an event is still `ongoing`. Off-by-one there is a door refusing check-ins a second early.

### ⚠️ A schema change broke `/api/core` against un-migrated databases

**Found by the legacy test suite, and worth understanding as a general rule.**

Drizzle builds an explicit column list from the schema definition. The moment `events` gained
`cancelled_at` in code, every legacy query became:

```sql
select "id", …, "opened_at", "closed_at", "cancelled_at", … from "events"
```

Against a database without those columns that is a hard error — so `/api/core` returns 500 for
events on the remote instance, even though nothing about `/api/core` changed.

**The general rule this establishes:** in a shared-schema monorepo, adding a column is not additive
at runtime. Every database the code runs against must be migrated *before* the code ships, including
the ones only the old API talks to. "The old surface is untouched" is true of the code and false of
the schema.

Migrations `0003`–`0006` are themselves additive and safe (new tables, nullable columns, one NOT NULL
with a default) — but they must be applied.

---

### The local database was never set up properly

Two separate faults, found while trying to run Phase 2 against it.

**1. `nx run coreservice:dev:up` always failed.** `docker compose up --wait` treats *any* named
container that exits as a failure — and `credopass-minio-init` is a one-shot job that creates the
bucket and exits 0 by design. The containers came up fine; the command reported failure. Fixed by
waiting only on the long-running services and starting the init job separately.

**2. The database had tables but an empty migration journal.** It had been created with
`drizzle-kit push`, so `drizzle-kit migrate` tried to `CREATE TABLE` over the top and failed. The
database looked healthy and was unusable — and nothing said so.

That second one is worth internalising: **"tables exist" and "migrations applied" are different
facts.** A `push` database drifts from the committed migrations silently, and you only find out when
CI or a fresh clone builds something different from what you have been developing against.

| Landed | |
|---|---|
| `db:status` | Host, tables, policies, journal-vs-disk. Read-only, safe anywhere. **Start here when confused.** |
| `db:reset` | Drops `public`/`app`/`drizzle`, replays every migration. **Refuses any non-localhost host** — a destructive command must not be one typo from a live instance. |
| `setup` fixed | Now migrates rather than resetting. A setup command people re-run must never silently wipe their data. |

Local now: **13 tables, 12 RLS policies, 7 migrations recorded**, `credopass_api` with
`bypassrls: false`.

---

### Read paths

`EventService` and `PeopleService` now decide everything the screens used to compute in the browser:
the status badge, the upcoming/past split, the hero spotlight, the calendar rail, `standing`,
`eventsAttended`, per-event counts.

`GET /events` · `/events/summary` · `/events/calendar` · `/events/{id}` ·
`/people` · `/people/summary` · `/people/{id}` — **23 operations** in the spec.

The rule worth keeping: **`group=past` is applied after status derivation, not as
`WHERE startTime < now()`.** A cancelled *future* event belongs in "past" — it is not going to
happen. A naive timestamp filter gets that wrong, and it is the kind of wrong nobody notices until an
organiser asks why a cancelled event is still in their upcoming list.

### `users` → `accounts` + `people`, imported

`scripts/migrate-users-to-people.ts` (D10 — a scripted import, not a dual-write apparatus).

The interesting part is that it is **not one-to-one**. `users` is global with a globally unique
email; `people` is tenant-scoped. So one user becomes one person **per organisation they have a
footprint in**, worked out from memberships *and* attendance — not guessed. A user who attends events
at two churches becomes two people, and neither church can see the other's row. That is the split
doing its job (T20).

Accounts are created only for users with a membership: an account is someone who signs *in*, and
minting one for every attendee would fill the identity table with rows no token will ever resolve to.

Idempotent — re-running creates nothing. Ran against local: **25 accounts, 25 people, 150 attendance
rows linked**.

### Two bugs worth remembering

**1. `= ANY(${array})` does not bind an array.** Drizzle's `sql` template binds a JS array as a
single scalar, producing `ANY(($1))`, which fails at runtime. Use `inArray`.

**2. A correlated subquery silently matched the wrong column.** `${people.id}` renders as a bare
`"id"` — and inside `FROM attendance a` that resolves to `attendance.id`. A valid column, so Postgres
accepted it happily and every lifetime count came back 0. Fixed by writing the outer reference out in
full as `"people"."id"`.

The second is the more dangerous shape: no error, no warning, just quietly wrong numbers. Worth a
look wherever a correlated subquery references an outer table.

### One adversarial test flipped — and that is an improvement

T18 (`/events/{id}/stream` → 404) went from pass to fail. It was passing because the route did not
exist, so *everything* 404'd. Now `/events/*` requires auth and correctly answers 401. The test wants
"404 for another tenant's event", which needs a real token the fixtures cannot mint yet.

It was a false positive. It has stopped lying.

---

## Where things stand

| | |
|---|---|
| Unit + structural tests | **68 passing** |
| Integration tests (real Postgres) | **37 passing** |
| Adversarial tenancy tests | **10 / 50** — the rest need Phase 2+ endpoints |
| Migrations | 8, replayed from empty and verified |
| API operations | 23 |

**Reading the adversarial number correctly:** those 39 failures are the plan working. The tests were
written before the code they guard, so they go green as phases land. A green adversarial suite today
would mean the tests were too weak.

---

## The web app moved onto `/api/v1/core` (2026-07-27)

The plan for this is [`API-SECOND-REBUILD.md`](API-SECOND-REBUILD.md); this is what actually
happened. `apps/web` did not compile before this — 18 files imported
`@credopass/api-client/collections`, which had been deleted. It builds now, and every screen reads
the new API.

### The client

`packages/api-client` kept its name and its position — apps still never `fetch` — but its insides
are three layers:

```
generated/schema.d.ts   openapi-typescript, checked in, regenerated by `nx run api-client:generate`
client.ts               openapi-fetch + auth header + org header + problem→ApiError
types.ts                contract types DERIVED from the generated paths, never restated
query-keys.ts           every org-scoped key starts ['org', organizationId, …]
hooks/                  TanStack Query hooks, one file per endpoint group
active-organization.ts  the active org, outside React
```

Two decisions worth keeping:

**The active organization is part of every org-scoped query key.** Switching organizations re-keys
the cache rather than mutating it, so the previous tenant's rows cannot survive the switch. That is
what replaced `window.location.reload()` in `OrgSelector` — and it is a stronger guarantee than the
reload was, because it does not depend on the reload finishing.

**Contract types are extracted from `paths`, not rewritten.** `ApiResponse<'/events', 'get'>` reads
the real 200 body. A server-side shape change becomes a type error at the call site, which is the
only reason to generate a client at all.

### Two API changes came out of the rewiring

Both were found by the UI needing something the API could not answer.

**1. `.nullable()` on a `$ref`'d Zod schema produces uninhabited TypeScript.** `MeContext.activeOrganization`
and `EventsSummary.next` were declared `Schema.nullable()`, which zod-openapi renders as
`allOf: [{$ref}, {type: ["object","null"]}]`. openapi-typescript cannot express that, so it emitted
`OrgSummary & Record<string, never>` — a type nothing can satisfy, and one that had *lost the
nullability entirely*. Changed both to `z.union([Schema, z.null()])`, which renders as `anyOf` and
generates `OrgSummary | null`.

Worth knowing generally: **never `.nullable()` a registered schema** in this codebase. The document
compiles either way; only the generated client tells you it is wrong.

**2. `EventSummary` now carries `allowSelfCheckIn` and `requireCheckOut`.** Two screens needed door
configuration and only ever hold a summary: the kiosk deciding whether to offer check-out at all, and
the composer round-tripping the self-check-in toggle. Without them the kiosk could not honour
`requireCheckOut` and the composer silently reset the toggle on every edit.

### What the UI stopped doing

Deleted, not commented out:

| Gone | Because |
|---|---|
| `getStatus` + event grouping in `packages/lib/src/utils/events.ts` | `deriveStatus` runs server-side. Two implementations would disagree the first time an event was cancelled. |
| ~150 lines of `standing` / `eventsAttended` derivation in `Attendees` | Both arrive on `PersonRow`, pre-computed. |
| `OrgSelector`'s `organizations[0]` auto-select | The list was every organization in the database. It is the caller's memberships now, remembered per account. |
| `useEventSessionStore`, `useOrganizationStore` | A per-tab check-in counter and a reload-on-switch, both superseded. The first had a hardcoded name compiled into it. |
| `contexts/premium.tsx` | `localStorage` entitlements. The organization's `plan` is the answer. |
| `use-attendee-checkin.ts`, `use-public-event.ts`, `useGeocodedLocation` | Hand-rolled fetches; and geocoding moved to the write path. |
| The whole of `/analytics` (~750 lines of charts) | It rendered fabricated numbers. See below. |
| All loyalty copy on `/login` and `/upgrade` | The table is deleted. |

### Two places the honest answer is "not yet"

**`/analytics` renders an empty state.** There is no analytics endpoint. The page it replaced drew
charts from `services/core/src/analytics/`, which returns deterministic placeholder numbers — a
"Sample data" badge does not fix that, because people screenshot dashboards. The route survives and
says plainly that there is nothing to show.

**Every pass URL is displayed, never emailed.** `NotificationService` does not exist, so registering
someone shows the link on screen and says to send it. No copy anywhere claims an email was sent.

### Still open

- **`PATCH /me`** — the Account page shows the profile and cannot edit it.
- **`/me/tickets`, `/me/claim`** — the personal scope has no screens, as planned.
- **ICS, media, SSE** — "Add to calendar", cover photos and a pushed kiosk counter are all absent
  rather than faked. The kiosk polls `/checkin-state` every 5s.
- **`GET /me`** has no dedicated caller: `/me/context` returns the same account object, and a second
  round-trip for it would be waste. The hook exists in the client.

### Where things stand

| | |
|---|---|
| Unit + structural tests | **61 passing** |
| API operations | **45** |
| `apps/web` build | ✅ (was failing to compile) |
| `apps/web` typecheck | ✅ 0 errors (was 151) |
| `nx run coreservice:verify` | ✅ |

`packages/ui` and `packages/lib` lint failures (`bottom-nav.tsx`, `map.tsx`,
`date-time-range-picker.tsx`, `use-toolbar-context.ts`) pre-date this work and are untouched by it.

---

## Anonymous sign-in removed; the first organisation is now automatic (2026-07-27)

### Why the guest flow went

`/login` silently signed every first-time visitor in anonymously. Measured, not assumed:

- Growth was **one account per browser profile**, not per visit — Supabase persists the session in
  `localStorage`, so returning visitors reuse it. (4 loads across 2 profiles produced 2 accounts.)
- It bought nothing. The visitor was signed in, then shown **"Create your organization"** — a bigger
  commitment than the sign-in screen it replaced.
- `/` → `/login` → `/events` → `/onboarding` was **three redirects**, and `/events` was a *push*, so
  Back bounced between `/login` and `/onboarding` forever. Verified: three Back presses, no escape.
- There was **no upgrade path** — no `linkIdentity`, no `updateUser`. The Account page offered
  "create a real account to keep your organizations" for an action that did not exist. A guest who
  built something and cleared storage lost it permanently, sole owner and all.

`signInAnonymously` is gone from `createAuthClient`. Do not reintroduce it without account linking.

### What replaced it

| Was | Now |
|---|---|
| Silent guest sign-in, then an onboarding wall | Sign-in screen with a rotating showcase of real app screenshots |
| 3 redirects from `/` | 1 — `/` reads the session in `beforeLoad` and picks `/events` or `/login` |
| New account belongs to nothing | First sign-in auto-provisions **"<Name>'s organization"**, owner role |
| — | Per-plan cap on organisations an account may **own** (`authz/plans.ts`; free = 2) |

**This reverses the earlier "drop auto-org" decision, and D16 is why it is now safe.** D16 forbids
provisioning for someone who merely *visited*. With anonymous sign-in gone, every account is a real
authenticated person, so that objection no longer applies. Guests are still excluded from
auto-provisioning — the API accepts anonymous tokens even though nothing issues them.

Auto-provisioning runs in `requireCaller`, gated on `memberships.length === 0 && !isGuest`, so it is
true once per account and free on every request after. It takes `pg_advisory_xact_lock(hashtext(id))`
and re-checks inside the lock, because a first page load fires several requests at once and all of
them see "no memberships". Slugs get a random suffix on collision — two people called Israel must not
make the second one's sign-in fail on a globally-unique column.

### Bugs found on the way

- **Device pairing was impossible.** `use('/devices/:deviceId', requireCaller)` matches on path only,
  so it also caught `POST /devices/pair` with `deviceId = "pair"`. The route declares
  `scope: 'public'` — a tablet has no token yet — but the mount answered 401. Now bound to `DELETE`.
- **`claimByVerifiedEmail` would 500 on every call.** `= ANY(${addresses})` bound a JS array as one
  parameter, so Postgres raised `malformed array literal`. Now `inArray`. Latent only because
  `/me/claim` is unbuilt.
- **Sign-up gave no feedback.** With email confirmation on, Supabase returns a user and *no session*;
  the form only checked `error`, so success re-rendered silently. Now shows "Confirm your email".

### Adversarial suite: fixtures are real now

Was **11 pass / 39 fail**. The failures were not schema drift — a wiped test container reproduced
them exactly. They were placeholder `token: ''` actors, and most "endpoint not in openapi.json"
errors were malformed URLs (`/events//check-in`) from empty ids, not missing routes.

`test/support/issuer.ts` signs ES256 tokens in-process behind a real `IssuerRegistry` subclass, so
signature and issuer checks still run. `test/support/fixtures.ts` builds two tenants **through the
API**. Now **38 pass / 12 todo / 1 fail**.

The 12 `todo` name the endpoint each needs (`/uploads`, `/me/tickets`, `/me/claim`, `/analytics`,
`/attendance/{id}`, `/people/{id}/merge`, `/events/{id}/stream`, domains, `/auth/realm`) — so a red
run means a regression, not a backlog item.

**The 1 remaining failure is a decision, not a defect.** T7: §7.3 says an account with no
organisation gets `200 []`; `requireTenant` answers `403 not_a_member`. Not a leak either way. Left
red rather than softened.

T6, T29b and T34 were rewritten: they asserted "zero organisations", which auto-provisioning makes
false. They now assert the claim that actually matters — *none of B's* — which is stricter about the
leak and no longer coupled to onboarding behaviour.

### Verification

| Check | Result |
|---|---|
| `nx run coreservice:verify` | ✅ 72 unit/structural passing |
| `nx run coreservice:test:integration` | ✅ 136 passing |
| `nx run coreservice:test:adversarial` | 38 pass / 12 todo / 1 known-decision fail |
| `nx run web:build` · `web:lint` | ✅ |

Still open: `packages/ui` / `packages/lib` lint failures listed above (pre-existing). Anonymous
sign-in should also be disabled in the Supabase dashboard — removing the client call stops the app
from using it, but the endpoint stays open until the project setting is turned off.

---

## The sign-up funnel; guests and device tokens deleted (2026-07-27)

Plan: [`API-THIRD-REBUILD.md`](API-THIRD-REBUILD.md), decisions D20–D26. This is what happened.

**26 files deleted, ~2,900 lines removed, 3 added.** Almost all of it was subtraction, because
three systems had stopped meaning anything and were holding the funnel up.

### Three things that could not be entered

| Deleted | Why it was already dead |
|---|---|
| The guest tier | `accounts.is_guest` could only be set from an `is_anonymous` claim, and nothing had issued one since anonymous sign-in was removed. `Account.isGuest` was a contract field that was a compile-time constant `false`. |
| The onboarding wizard (548 lines) | `ensureDefaultOrganization` made `needsOnboarding` permanently false, so `OnboardingGate` never blocked and the wizard was reachable only by typing the URL. Its third step was "create your first event" — the reason making an organisation required making an event. |
| Device tokens (table, 4 endpoints, pairing screen, 32 tests, a 210-line explainer) | The `checkin` role already carried exactly the permissions a door needs, the device branch already borrowed it (`role: 'checkin'`), and the kiosk screen already worked for a signed-in user. |

### The one change that had to go first

`packages/api-client/types.ts` derived its `Permission` union from
`ApiBody<'/events/{id}/devices','post'>['scopes']` — the device-pairing request body was the only
place in the whole document where a permission was named in a *request*, so that is where the
literal union was read back from. **Deleting the device routes would have deleted the type** and
left `useCan` taking a bare `string`.

`/me/context` now declares `z.enum(PERMISSIONS)` on the field that actually carries them, and the
client anchors there. Stabler, and more honest — the field ships a closed set, so the contract
says so.

### `event_grants`: an authorization surface that silently did nothing

Found in the sweep, not in the brief. It backed a per-event role system (`organizer` / `co_host`
/ `staff`) consulted by `canOnEvent`, which read `ctx.eventGrants` — **a map `requireCaller`
never populated.** Always empty, so every grant meant to widen access evaluated to `false`, and
the only code exercising it was unit tests fabricating a context by hand.

Deleted rather than wired up. A permanently-empty authorization surface is worse than none,
because it reads as working: `permissions.ts` documented organizer's row-scoped rights as
"enforced in EventService" against a table nothing ever wrote to.

`org_identity_providers` and `org_domains` look equally unused and were **kept** — they are
deliberate Phase 7 SSO scaffolding (D-M), and `identities.orgIdentityProviderId` references them.

### Bugs found on the way

- **`apps/web/.env.production` pointed at `/api/core`**, a base path the service 404s. Production
  was aimed at a dead URL. `apps/mobile` had the same problem against `localhost:3000/api/core`.
- **`/upgrade` told signed-in users they were guests.** Two live callers navigate to it and both
  mean *upgrade your plan*; what rendered was "You're in guest mode… Continue as guest instead",
  over a sign-up form whose submit was a one-second `setTimeout` standing in for an API call that
  was never wired. Replaced with the plan screen, which says plainly that billing is not wired up
  rather than offering a button that does nothing.
- **T6 only passed against a pristine database.** The adversarial `beforeAll` never calls
  `harness.reset()`, and T6 used a hardcoded `fresh@example.test`; a second run hit
  `uq_accounts_email` and failed with a 500 from `GET /me` that had nothing to do with tenancy.
  Uniquified. The suite is now idempotent — verified across three consecutive runs.
- **`joinAs`'s `label` parameter inferred the role union** from `label = role`, so a test naming
  an actor after what it proves failed to compile.

### The tests that replaced the deleted ones

Deleting 31 device tests without replacing their claims would be real lost coverage. Three took
their place: a `checkin`-role block in `tenant-context.test.ts` asserting the door is **strictly
narrower than organizer** (that is what replaced device-scope intersection — the cap is the role
now, so it must be at least as tight); T13, that A's door staff cannot check anyone into B's
event; and T14, that removing a door member ends their access on the next request.

**T7 was rewritten and is no longer red.** It asserted §7.3's `200 []` against `requireTenant`'s
`403 not_a_member` for "a guest with no active org" — a conflict now unreachable from both ends.
T6 already covers what a fresh account sees, so T7 guards the *ambiguous* case instead: a caller
in several organisations must name one. The dangerous failure there is silence — picking one on
their behalf would put another tenant's rows on screen under a heading naming neither.

### The funnel itself

One route guard removed, one overlay, one dialog, one link.

`/events/new` renders for a signed-out visitor with sign-in laid over it (glassmorphism, per the
Luma reference). The fields are inert via `<fieldset disabled>`, so **there is no draft to
save** — which is why this is simpler than the sessionStorage design first sketched. The overlay
is presentation; `POST /events` is org-scoped and 401s, and that is the control.

### Verification

| Check | Result |
|---|---|
| `nx run coreservice:verify` | ✅ 68 unit/structural |
| `nx run coreservice:test:integration` | ✅ 105 passing (was 136; 31 device tests deleted) |
| `nx run coreservice:test:adversarial` | ✅ **39 pass / 12 todo / 0 fail** (was 38 / 12 / 1) |
| `nx run web:build` · `web:lint` · `website:build` | ✅ |
| API operations | 41 (was 45) · permissions 25 (was 26) · tables 11 (was 13) |

Two pre-existing typecheck errors remain in `Pages/ResetPassword/index.tsx` and
`packages/ui/src/components/login/email-password-form.tsx` (Zod/TanStack Form `StandardSchemaV1`
mismatches) — confirmed identical on the untouched tree.

**Migration `0003_drop_device_tokens_and_guest_tier.sql` is applied locally, not remotely.**
`nx run coreservice:migrate` writes to whatever `DATABASE_URL` points at — locally that is the
Docker Postgres. The remote Supabase instance has never been migrated for the rewrite; see
[`DATABASE-MIGRATION.md`](DATABASE-MIGRATION.md) §5. The local test databases replay it from empty on every run, which is where the 105 + 39
above come from.


---

## Account shortcut, and the documentation/dead-code sweep (2026-07-27)

Not a phase. A cleanup pass with one UI change in it.

### The avatar menu — `apps/web/src/containers/UserMenu/`

There was no route to your own profile from the chrome. Account, Billing and Sign out lived inside
`OrgSelector` — the control in the sidebar header branded with the *organisation's* logo — so "where
is my profile?" was answered by a menu about something else.

Split by subject: `OrgSelector` is now organisations only; a new avatar in the top bar owns the
account. It carries profile, plan (with the active org's tier as a badge, read from
`GET /organizations`), members (gated on `member:read`), settings, a theme toggle, and sign out.

The theme toggle is worth a note. `ThemeProvider` has always exposed `toggleTheme`, and nothing in
the console called it — the app could read the theme but not set it. It is a
`closeOnClick={false}` item, because a menu that closes when you change the theme makes comparing
the two modes tedious.

`/account?tab=profile` gained a **Plan** section: the current tier, and a link to `/upgrade`. Gated
on `useCan('org:billing')` so a non-owner is told who can change it rather than handed a 403.

### Deleted

| What | Why |
|---|---|
| `packages/ui/src/components/user/` (376 lines) | A config-driven user menu with zero importers. Its one real idea — the theme switcher — moved into `UserMenu`. |
| `@tanstack/react-db`, `query-db-collection`, `query-core`, `react-devtools`, `router-devtools`, `lodash`, `@types/lodash` | Declared, never imported. TanStack DB has been gone since the second rebuild. |
| `audit/*.md`, `docs/MULTI-TENANCY.md`, `docs/GUEST-ONBOARDING.md` | Plans for a system that no longer exists. Every phase in `MULTI-TENANCY.md` is done; it described `crud-factory.ts`, `routes/events.ts` and the `users` table, all deleted. `GUEST-ONBOARDING.md` was self-marked historical. |
| `AGENTS.md` (as a file) | Was a stale copy of `CLAUDE.md` still claiming `/api/core` "still serves the live web app". Now a symlink — one source of truth, not two that drift. |

### Corrected claims

The marketing site was selling three things that do not exist: a loyalty programme (deleted in the
first rebuild), an offline-first kiosk (deleted with TanStack DB), and SOC 2 compliance (never
true). Its pricing block had three tiers where `authz/plans.ts` has four, priced Starter at $5
against a real £19, and sold "up to 100 members" limits the plan model has never had — the real
limit is organisations owned. All now mirror the catalogue, with a comment saying to change pricing
there first.

`db/client.ts` passed `logger: true` to Drizzle unconditionally, which prints every statement *with
its bound parameters*. In production that is emails and ids in the Cloud Run log stream. Now
`logger: isDevelopment`.

### Targets that were documented but did not exist

`CLAUDE.md` listed `coreservice:migrate` and `coreservice:verify:public-access`. Neither was a
target — `migrate` only existed as an nx *configuration* of `db`, and the public-access probe was a
shell script nothing pointed at. Both are real targets now. The probe was also still testing
`users`, `event_members` and `loyalty`; it tests the eleven tables that exist.

### New: `docs/DATABASE-MIGRATION.md`

The step-by-step for getting the schema onto a database — fresh local, the throwaway test one, and
the remote Supabase cutover. §5 is the cutover, including the shape the `users` →
`accounts` + `people` backfill has to have (still unwritten). §6 states plainly that **RLS is inert
on the API path** and gives the ordered fix, because the policies exist and look like they are
protecting you.

`docs/API-FIRST-REBUILD.md` now carries a header saying which of its links are dead and why, rather
than being rewritten — it is the record of what was decided, and reality lives here.


---

## A soft-deleted organisation was still a tenant (2026-07-27)

Three findings from a QA pass. Two were the same bug wearing different clothes; the third is a
missing feature, now planned.

### The bug: `loadMemberships` did not look at `organizations.deleted_at`

Deleting an organisation is a **soft** delete — `organizations.deleted_at` is set and the
`org_memberships` rows survive it, deliberately, so the delete is reversible. But
[`loadMemberships`](../services/core/src/services/identity.ts) selected memberships without joining
`organizations`, so a deleted organisation stayed a perfectly valid tenant on the API path:

- `requireTenant` still resolved it. With the deleted org as the caller's *sole* membership, no
  `X-Organization-Id` header was even needed — the "exactly one membership" branch picked it.
- `POST /events` therefore wrote events into an organisation the owner had deleted and could no
  longer see, because `GET /organizations` and `/me/context` *do* filter `deleted_at`.

That is QA finding 2 — *"I created an event without an organisation and it worked"* — and it was
caused by QA finding 1. The join is now on `loadMemberships`, so a soft-deleted organisation stops
being a tenant everywhere at once: tenant resolution, `/me/context`, permissions, every org-scoped
route.

`ensureDefaultOrganization` needed the same join for the opposite reason. Its "does this account
already have an organisation?" check counted the surviving membership row, so an account whose only
organisation had been deleted was told it had one and then 403'd on every org-scoped route — stuck,
with no screen offering a way out. It now looks through the membership at `deleted_at` and
re-provisions, which is also the recovery path for anyone already stranded by the old behaviour.

### The rule: you cannot delete your last organisation

`deleteOrganization` takes the caller's account id and refuses with 409 `last_organization` when the
target is the only organisation they still belong to. This is the counterpart of
`ensureDefaultOrganization`: onboarding is signing in (D22), so there is no orgless console to land
in and no screen that offers a way out of one — deleting your last organisation either strands you or
silently hands you a fresh auto-provisioned one on the next request. Both are worse than saying no.

Order of the two refusals is deliberate: `has_events` is checked first, because "delete the events
first" is the more specific instruction.

**Web:** the Account → Settings delete button is disabled with an explanatory description when it is
the caller's only organisation, and the `last_organization` code has its own toast. The event
composer disables submit and says why when a signed-in caller has no active organisation — it used
to post regardless, which is how a deleted org absorbed an event.

**Tests:** four new integration tests (last-org refusal, delete-once-a-second-exists, a soft-deleted
org disappearing from `loadMemberships`, re-provisioning after every org was deleted). Full suite:
68 unit + 109 integration + 39 adversarial, all green.

### New: `docs/LIVE-UPDATES.md`

QA finding 3 — *"I checked in from a separate window and the number didn't move"* — is a real gap,
and only partly the missing SSE work. The kiosk counter **is** shared and correct (it polls
`/events/{id}/checkin-state` every 5 s); every *other* surface has no freshness policy at all,
because `apps/web/src/lib/query-client.ts` sets `refetchOnWindowFocus: false` and nothing polls.

The document diagnoses each surface, sets a latency budget per surface, and splits the work: a
half-day polling fix that closes the report everywhere except the sub-second door case, then D4/D5's
SSE design rewritten for the system as it exists — no device tokens (so `EventSource` can't carry
the bearer token and the client reads the stream with `fetch`), `/api/v1/core` paths, a dedicated
`LISTEN` connection outside the pool, and `bigserial` gaps in replay. Decisions D27–D30.

---

## Conventions worth knowing

1. Every route is created with `defineRoute` and declares `scope` (+ `permission` if org-scoped).
2. Errors are `ProblemError`. Never `c.json({ error })`.
3. Never hand-write OpenAPI — it is generated from the Zod schemas that validate.
4. Handlers never build a `TenantContext`. Only the tenant middleware does.
5. `services/**` imports no framework.
6. A resource in another tenant returns **404**, not 403.
7. Every tenant-scoped query filters on `ctx.organizationId` explicitly. (There was a
   `db/scoped.ts` meant to enforce this. Nothing imported it, so it was deleted rather than
   left as a rule the code did not follow.)

---

## Phase map

| Phase | State |
|---|---|
| −1 · Revoke public DB access | ✅ Done, verified |
| 0 · Foundations | ✅ Done |
| 1 · Identity + tenancy | 🟡 Endpoints done; RLS cutover, data migration, client rewiring open |
| 2 · Events + people reads | ✅ Done (client rewiring deferred to Phase 3) |
| 3 · Writes, passes, email, delete local-first | 🟡 Writes + passes done and wired into the web app; email (`NotificationService`) still open |
| 3.5 · Sign-up funnel; guest + device tiers deleted | ✅ Done — see the 2026-07-27 entry above |
| 4 · Domain events + live kiosk | ⬜ |
| 5 · Recurrence | ⬜ |
| 6 · Media, entitlements, real analytics | ⬜ |
| 7 · Enterprise SSO | ⬜ |
