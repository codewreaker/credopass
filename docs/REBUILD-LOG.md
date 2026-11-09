# The rebuild log

> **What actually changed, in the order it changed.** The plan is
> [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) — what we *intend* to build. This is the record of what
> was built, what was decided differently along the way, and what broke.
>
> Read it top to bottom to understand the system as it stands.

**Status:** Phase 1 mostly complete · web app rewired onto `/api/v1/core` · attendee "My passes" surface landed · **Last updated:** 2026-11-08

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
| `db/scoped.ts` *(since deleted)* | Tenant-scoped repository accessor |
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

[`0001_rls.sql`](../services/core/drizzle/0001_rls.sql) *(written as `0004_rls_tenancy.sql`, renumbered before it landed)* — 12 policies, two
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

The plan for this is [`API-SECOND-REBUILD.md`](archive/API-SECOND-REBUILD.md); this is what actually
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

Plan: [`API-THIRD-REBUILD.md`](archive/API-THIRD-REBUILD.md), decisions D20–D26. This is what happened.

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

## A second identity for the same email 500'd every authenticated request (2026-11-06)

Reported as "the API is broken when I try to create events". It was not the events endpoint:
`POST /api/v1/core/events` answered **201** to curl every time, including the exact body the
composer sends. `/me/context` and `/organizations` were answering **500**, so the console never
had a tenant and nothing in it worked — event creation was just the first thing noticed.

### The bug: `accounts.email` was treated as a key by the database and as a mirror by the code

`resolveCaller` identifies a caller by `(issuer, subject)` and — correctly, and loudly
commented — refuses to look up an existing account by email, because any issuer that will mint
a token for an address could then take that account over.

But on first sight of a new `(issuer, subject)` it inserted an `accounts` row carrying the
asserted address, and `uq_accounts_email` is `UNIQUE (lower(email)) WHERE email IS NOT NULL`.
So the moment one human arrived with a *second* provider identity — a password sign-up and the
GitHub button, or (the case that found it) a Supabase user recreated under a new `sub` — the
insert raised, nothing caught it, and **every authenticated request that account made answered
500**. Not the first one: every one, forever, because the identity row was never created and
the next request took the same branch again.

```
identities                                  accounts
  sub a69c2b86…  →  account 9a3c6d9d…          9a3c6d9d…  israel…@gmail.com
  sub 3c245db0…  →  💥 insert accounts(email: 'israel…@gmail.com') → 23505
```

### The fix

The address is a **mirror** of what the provider asserted, not an identity. When it is already
claimed, the new account takes none and the address lives on the identity row, which has no
such index — so nothing asserted is lost, and `(issuer, subject)` remains the only key. The
two identities get two accounts, which is the honest answer: nothing has proved they are the
same person.

- Pre-flight `emailIsUnclaimed` decides whether to mirror.
- A unique-violation on `uq_accounts_email` is caught and retried once with no mirrored
  address, for the race between the check and the insert.
- `Caller.email` falls back to the asserted address when the account row holds none, so the
  greeting and `/me` still show something.

### Verification

Three tests in `src/test/integration/identity.test.ts`, red before the change and green after:
a second identity gets its own account rather than raising; the address and its verified flag
survive on the identity row; and six concurrent first-sightings of one address all answer, with
exactly one of them mirroring it. Full `lint` + `typecheck` + `test` + `test:integration` pass.

### Not fixed here

A driver error still escapes as a bare 500 rather than a `ProblemError`. That is the reason
this took a browser session to find instead of being legible from the response body.

---

## B1 — paste was broken in every input in the product (2026-11-06)

### What was wrong

`apps/web/src/hooks/index.tsx` bound a document-level `keydown` listener that, under
`metaKey || ctrlKey`, called `preventDefault()` and navigated for **e, n, m, v, a, t, p** — with no
check for where focus was. So in a form-heavy app:

| Pressed | Expected | Got |
|---|---|---|
| ⌘V | paste | navigate to `/events` |
| ⌘A | select all | navigate to `/analytics` |
| ⌘N / ⌘T / ⌘P | new window / new tab / print | navigate |

The symptom that got reported was the mild one — "an analytics shortcut triggered while I was
typing". The real defect was that **paste did not work anywhere in the product**.

There were also *two* shortcut systems: the listener above, and nine `useHotkey('Mod+…')`
registrations inside `containers/Command/index.tsx`. They disagreed (⌘P went to `/profile` in one
and `/account` in the other), and which one won depended on whether the palette was mounted.

### What was built

**`apps/web/src/hooks/shortcuts.ts` — one registry.** Eight bindings, each with its key, its
on-screen label and its route target. The palette renders its cheat sheet by mapping over this
array, so a binding and its documentation cannot drift.

**Navigation moved to `g` chords.** `g e` events · `g m` attendees · `g a` analytics · `g c` create
event · `g n` add attendee · `g p` profile · `g o` organizations · `g s` organization settings.
⌘K still opens the palette and is the only modifier binding left.

> **D39 · Navigation shortcuts never use a modifier.** ⌘V, ⌘A, ⌘T, ⌘N and ⌘P are native shortcuts
> people rely on; overriding them is wrong even outside a text field, so a focus guard alone would
> not have been enough. `g` chords are what Linear, GitHub and Gmail use, and they cannot collide
> with anything native. ⌘K is the exception because it shadows nothing anyone depends on and is the
> one shortcut every user of this kind of app already expects.

**A focus guard, which the old handler had none of** — `isTypingContext()` ignores keystrokes from
`input`, `textarea`, `select`, `[contenteditable]` and `role="textbox|searchbox|combobox"`, walking
up from the target so a contenteditable's descendants count too.

An **open dialog also counts as typing**, even when focus is not in a field. A modal is a committed
context, and pulling someone out of a half-filled form because they typed `g` would be the same bug
wearing a different coat. Base UI unmounts closed dialogs, so `[role="dialog"]` being present means
one is genuinely open.

The chord leader stays armed for **1500 ms** — long enough to type deliberately, short enough that a
stray `g` cannot swallow a keystroke a minute later. Any modifier, or any guard hit, disarms it.

**The duplicate system is gone.** All nine `useHotkey` calls were deleted from the palette; it binds
nothing now. `@tanstack/react-hotkeys` is left in `package.json` — nothing else imports it, so it is
a dependency to drop, not a behaviour to change.

### Two palette entries fixed while in there

- **"Check-In" navigated to `/events`.** The kiosk route is `/checkin/$eventId` and the palette has
  no event in hand, so the entry was a second, mislabelled route to the events list. Removed rather
  than relabelled.
- **"Settings" was a no-op** (`// Settings behavior not implemented yet`). It now opens
  `/account?tab=settings`, which exists. "Profile" and "Organizations" likewise carry their `tab`
  rather than dropping the user on whichever tab `/account` defaults to.

### Verified

`nx run web:build` and `nx run web:lint` both pass — the one remaining lint warning is a
pre-existing unused-disable in the generated `routeTree.gen.ts`.

**Not verified in a browser.** The chord behaviour, the typing guard and the dialog guard have not
been exercised against a running app; this was a static change confirmed by build and lint only.

---

## The Python learning project is deleted (2026-11-06)

`docs/PYTHON-LEARNING-PLAN.md`, `docs/LEARNING-WORKFLOW.md`, `docs/learning/` (nine week files),
`services/core-v2/` and `docker/initdb/` are gone.

> **D40 · The AI feature is a service, not a curriculum.** The eight-week plan existed to learn
> Python by porting `/api/v1/core` to `/api/v2/core`. The port is not happening, and the teaching
> frame was making the AI feature answer to a syllabus instead of to the product.
> **`services/ai-chat` replaces it** — a separate Python service for the AI feature, holding no
> database of its own: every read and write goes through the existing v1 TypeScript API carrying the
> caller's own token.

What went with it: the `credopass_v2_dev` database and the `initdb` mount in
`docker/docker-compose.dev.yml` that created it, and the `core-v2` row in `docs/README.md` §4.
`.vscode/settings.json` now points Pylance at `services/ai-chat/.venv` instead.
`NEXT-PHASE-PLAN.md` §5.7 (the chat panel) was rewritten to name `services/ai-chat` — its AG-UI
client, mock-stream fixture and approval UI are all still the plan; only the backend's name and
provenance changed.

`services/ai-chat` is early: `src/app/settings.py` and nothing else committed. It refers to an
`AI-SIDEBAR-PLAN.md` §1 that does not exist in `docs/` yet.

## Pass links pointed at the API, and 404'd (2026-11-06)

Found by walking the product on a phone viewport against the **deployed** API. Registering someone
printed a pass URL of `http://api.credopass.com/p/CP1.…`. That is a 404, and has been for as long as
the service has been deployed:

| URL | Result |
|---|---|
| as the app printed it | 302 → **404** |
| `https://api.credopass.com/p/…` | **404** |
| `https://app.credopass.com/p/…` | **200** |

`/p/:token` is a route in `apps/web`. The API has never served it.

Both call sites built the link from `new URL(c.req.url).origin` — the origin of the incoming *API*
request. Two faults fall out of that single expression, and neither shows up locally, where the API
is reached over plain http on a host the developer also runs the app on:

- the **host** is the API's, which is by definition not the app's;
- the **scheme** is whatever reached the Bun process, which behind Coolify's TLS terminator is
  `http`.

Because no email exists yet (D18), the printed URL is the only copy of a pass anyone ever gets. The
single artefact this product exists to hand an attendee was a dead link in production.

**D41 — a user-facing origin is deployment knowledge, not something to infer from a request.**
`services/core/src/config/public-url.ts` holds it; `attendance.ts` and `public.ts` call
`publicAppUrl()`. It is `https://app.credopass.com` under `NODE_ENV=production` and
`http://localhost:5000` otherwise, with `PUBLIC_APP_URL` as an override.

The first cut made the variable mandatory and refused to boot without it. That was wrong: there is
one production web app, its host is not a secret, and making the deployment restate a constant buys
nothing while guaranteeing a failed deploy the first time someone forgets. A known default with an
override is the same safety for none of the cost.

`X-Forwarded-Proto` was considered and rejected. It would fix the scheme and leave the host wrong,
and it is a header a client can set — trusting it to build a credential-bearing URL trades one bug
for a worse one.

Passes already issued cannot be repaired; their URL was never stored, only printed.

Found during the same walk and filed rather than fixed: `docs/UI-REDESIGN.md` R1–R5 (the app scrolls
an inner box rather than the document, loading states render as confident content), and U2 looking
less like a scanner bug than a kiosk that shows a QR its own scanner tab rejects.

---

## Screenshots for the how-to page are captured by a script (2026-11-06)

`apps/website/scripts/capture-screens.ts` walks `apps/website/src/pages/how-to/screens.ts` and
writes `public/how-to/<id>.<viewport>.png`. One list drives both the capture and the page, so a
screen cannot be documented without an image and an image cannot go stale unnoticed.

Google being the only sign-in means a headless run cannot log in, so the session is captured once by
hand (`nx run website:shots:login`) into a gitignored `.auth/state.json` and reused. Public screens
are deliberately captured in a **separate anonymous context** — a public page has to be proved to
work with no session, and shooting it signed in would hide exactly the bug worth catching.

18 of the 19 screens were captured on 2026-11-06. Only `/invitations/$token` is missing, because
U6 means no invitation link can be recovered to point it at — the bug is blocking its own
screenshot.

The fixtures were renamed out of `ZZ TEST` and into `Sunday Morning Service`, `Ama Mensah` and
`Kwame Boateng`, because the screenshots are published on the marketing site and a page of test
data reads as an unfinished product.

Renaming them appeared to turn up a bug — an attendee's email reporting `Attendee updated` and not
changing — which was filed as U7 and then **retracted**. The contact rows on that composer are
buttons that open a one-field sheet, so the test had typed into the sheet and then dismissed it.
The email saves correctly. Recorded here because the shape of the error is worth remembering: a
control that looks like a text field and is a button will fool a test harness the same way it
fools a person, and the only safe check is to read the accessibility tree rather than click where
the value appears to be.

---

## Re-inviting someone used to be a 500 (2026-11-06)

`/account?tab=members` says, correctly, *"CredoPass does not send email yet — copy each link and
pass it on yourself."* Every invitation already in the list then said **`link not shown`**. The
token is stored as a SHA-256 hash and returned once, so a link not copied in that moment was gone,
and with no email there was no second channel. Two invitations were sitting in production in that
state.

Underneath it was a worse bug nobody had hit yet. `inviteMember` checked whether the address was
already a **member**, and nothing else — but `uq_invitations_org_email_pending` makes
`(organization, lower(email))` unique while a row is neither accepted nor revoked. Inviting the
same person a second time therefore went straight into a constraint violation: a 500, where the
route's own contract promises a 409. The same applied to anyone whose invitation had merely
expired, because expiry does not clear that index.

**D42 — re-inviting rotates, it does not duplicate or fail.** `inviteMember` looks for a live
invitation for that address and, finding one, updates its token hash, role and expiry and returns
the new token. "Send it again" is now the same request as "send it".

The alternative was a `POST …/invitations/{id}/regenerate` endpoint. Rotation on re-invite is
better because it needs no new route, no new permission and no new UI concept, and it fixes the
500 as a side effect rather than leaving it for later. Storing the plaintext token so it could be
shown again was rejected outright: it is a bearer credential for organisation access, and the
hash-only rule is the reason a database dump does not hand out memberships.

The shown-once property survives. Rotating issues a new token and the previous one stops working
immediately — covered by a test that accepts with the stale token and expects a refusal.

In the web app, `link not shown` became a `New link` button on the row.

**Not verified against production:** the deployed API still has the old code, so the button 500s
there until the next deploy.

---

## The pass that stopped working, and two wrong fixes (2026-11-06)

Reported as "a link is no longer valid". Reproduced: register, keep the link, register the same
person for the same event again, open the first link → `410 Gone — That pass has been revoked.`

`Attendance.register` upserts the attendance row and says why — *"a double-tapped button is not an
error"* — then calls `Pass.issue` five lines later, which revokes every live pass for that
`(event, person)`. With no email (D18) the URL shown at registration is the only copy, so the worst
sequence is not a double-tap: it is **staff registering someone who had already self-registered**.
The attendee's pass dies remotely and silently, and the replacement appears on a screen they cannot
see.

**Two fixes were attempted and both were wrong. Recording them, because each was refuted by the
system rather than by argument.**

1. *Make `resend-pass` the single rotation point and have `register` stop minting.*
   `POST /public/events/{id}/resend-pass` does nothing — it calls `findRegistration` and returns
   `202 {accepted: true}` whatever it finds, deliberately, so that it cannot be used as an oracle
   for "is this person attending this event" (T39), and it has no email to send anyway. It is a
   placeholder.
2. *Let several live passes coexist, since a pass names `(event, person)` and `attendance` is
   unique on that pair, so they are duplicates of one fact.* The integration suite answered with
   `23505 uq_passes_event_person_live`: `passes` has a partial unique index on
   `(event_id, person_id) WHERE revoked_at IS NULL`. **One live pass per person per event is a
   schema invariant.** The service comment that stated it was not describing a preference.

**D43 — rotation on re-registration stays; the silence does not.** Given the invariant and a
hash-only token that cannot be re-shown, the pass must rotate. So all three places a pass is issued
now say so, unconditionally: the pass page, the public register sheet, and the staff
`Add an attendee` dialog — the last in `text-warning`, because that is the one where someone else's
link just died. Unconditional phrasing matters: a message that appeared only when a previous pass
existed would be the oracle `resend-pass` is built to avoid.

This is mitigation, not a cure. There is still no way to recover a pass without replacing it, and
no way to tell the attendee it happened. Both wait on `NotificationService` (D18).

---

---

## 2026-11-07 — Stage 1: who you are, the first screen, and a poster that sticks

The first slice of [`ROADMAP.md`](ROADMAP.md), from the testing feedback of the same day. Items are
**F**-numbered there.

### F1 · The greeting was your email address, and the cause was on the server

`identity.ts` set `displayName` from `claims.name` — a **top-level** `name` claim. Supabase does not
send one: Google's profile claims arrive inside `user_metadata`. So `accounts.display_name` was
`NULL` for every account ever created and the console fell back to the email local part.

`displayNameFromClaims` now reads `user_metadata.full_name` → `user_metadata.name` → top-level
`name` → `given_name + family_name`, and is covered by a ten-case table test.

Two things worth keeping in mind:

- **`user_metadata` is user-writable** (`auth.updateUser({ data })`). It is read for the display
  name and nothing else, for the same reason `identities.email_verified` is never trusted from it.
  A cosmetic name costs nothing if someone lies about it; an identity decision does.
- **The name is backfilled on sign-in, never overwritten.** Writing it only at account creation
  would have left every pre-existing account `NULL` forever. Following the provider on *every*
  sign-in would silently undo `PATCH /me` the next time someone signed in. So: `NULL` gets filled,
  anything else is left alone, and the user's own edit always wins.

### F2 + U4 · The pencil, and somewhere for it to go

A small pencil beside the greeting opens `/account?tab=profile`, which no longer says "editing your
profile isn't built yet". **`PATCH /me` exists** — `scope: 'account'`, no permission, display name
only. Email stays read-only deliberately: `accounts.email` is a mirror of a provider assertion
(D1), and an editable field would make the mirror lie and set `uq_accounts_email` fighting over
addresses.

### F3 + F4 · One control row instead of three

- The `"2 events · 1 upcoming · 0 live now"` line is **gone**. Its numbers moved onto the
  Upcoming ⇄ Past switch, which is what they were labelling. `GET /events/summary` gained
  `groups: {upcoming, past}` — **not** derivable from the three counts it already had, because the
  switch splits on *finished or not*, so the upcoming side includes ongoing and draft events too.
  The rule now lives in one `isFinished` helper that `list()` and `summary()` share; a count that
  disagrees with the list it labels is worse than no count.
- **The timezone toggle is gone (D42).** It defaulted to OFF, so most people never saw a timezone
  at all. It is information, not a filter.
- **Calendar View / View Organisations** moved into the space it freed, as pills, always visible.
  They used to be cards below the header behind a toolbar toggle most people never found.
- The header is a **column** now. It was `justify-content: space-between` with `flex-wrap`, so the
  layout the feedback asked for only happened by accident, at phone width.

### B2 · "No organization" was a loading state

Not fixed before today, despite looking fixed — the race usually resolves fast. `/me/context` now
ships `organizations[].name`, so the composer's org pill needs no second request and cannot race.
`null` renders as a skeleton. This is the R2 pattern (*the app renders the zero value instead of "I
do not know yet"*) closed in two of its three places; the greeting is the third.

### F14 · The poster slot finally persists something

The composer has had a cover-image well since it was written and it **threw the pick away on
submit** — a blob URL in `useState` that `onSubmit` never read. No event in the product has ever
had an image.

`events.cover_image_url` (migration `0004`) holds an absolute URL. Pasting a link works end to end
and renders on the event billboard, the list, the public page and the pass. Uploading a file is
still a preview, and the picker now *says so* rather than discarding it silently.

**`https:` only, and that is a boundary, not a style rule.** The URL becomes an `<img src>` on pages
served to people who are not signed in. `http:` is mixed content, `data:` is unbounded bytes in a
text column, and `z.string().url()` on its own happily accepts `javascript:alert(1)` — so the
protocol is checked explicitly. Verified: both are refused with a 400.

**Why a URL column and not the `assets` FK.** `cover_asset_id` has existed, unused and pointing at
no table, since the first schema. Giving it one means object storage, presigned uploads,
derivatives and compression — ROADMAP stage 4. Stage 4 replaces what *writes* this column, not the
column, so nothing that reads an event changes twice.

**On the billboard the poster is a backdrop, not a banner.** The title is near-black on lime at
`text-3xl`; an arbitrary photograph behind it at full strength makes contrast a function of
whatever the organiser pasted. The lime stays the base layer, the image sits at 30% under a
gradient that is opaque where the text is, and a broken link renders nothing.

### Verified

`coreservice:verify` (78 unit + structural), 114 integration, 51 adversarial, `web:lint`,
`web:build` — all green. Walked on screen at 375×812 against the local API: signed in by real
Google name, created an event with a pasted poster, saw it on the detail screen and the public
page, renamed the account and watched the greeting follow.

**Not verified:** the remote database has not had `0004` applied, so this must not be deployed
before `nx run coreservice:migrate` runs against it. The web app's standalone `tsc` still reports
three pre-existing errors in `Command/index.tsx`, `QRScanner.tsx` and `Upgrade/index.tsx` — none in
files touched here.

---

## 2026-11-07 — Stage 2: a pass and an invitation stop looking alike

### F6/F8/F9 · One component, two meanings

CredoPass draws two completely different things as a QR square and drew them
identically: a **pass** (`/p/$token`, one person's ticket, scanned at the door) and an
**invitation** (`/e/{id}`, the share link, one code on a poster for everybody).

They cannot be merged — a code everyone shares cannot identify one person — so the fix is visual.
`GlowingQRCode` takes a `kind`: `invitation` wraps the code in a **dashed** ring with a caption,
`pass` is unchanged. Dashed rather than solid on purpose: a solid ring reads as decoration, a
dashed one reads as a cut line, which is the poster/flyer mental model we want. The ring wraps the
code rather than restyling it, so what a camera reads is byte-for-byte what it was.

**The treatment is the maximised door screen's, not a new one.** The first version used a dashed
ring; the glow the maximised view already had was better, so it moved out of
`apps/web/src/Pages/CheckIn/style.css` into the shared component and that screen now uses
`kind="invitation"` like everywhere else. One ring, one definition. The note explaining why the
component's built-in `.glowing-qr-border` could not be used went with it: that ring is drawn
*inside* the code's own footprint, where the QR's white quiet zone covers it at display size.

**The ring is `--info` (blue), not lime.** Lime on a lime-branded product reads as "ours", not as
"different", and telling the two codes apart is the entire job. Blue sits at hue 240 against
lime's 121 — about as far apart as this palette goes — and holds up photographed and on the lime
billboard alike. The component's own `.glowing-qr-border` is suppressed for an invitation: leaving
it on gave two arcs spinning at once, and its 20px of breathing room became dead padding.

The caption inherits `currentColor` rather than taking `--muted-foreground`, because it appears
both on a dark card and on the full-bleed lime billboard — a fixed muted grey is legible on the
first and nearly invisible on the second.

**`InviteBillboard` — one component, two variants.** The kiosk's inline invite panel and the
maximised door screen were separate blocks of JSX showing the same code: one on a dark card, one
on lime, each with its own framing and copy. They drifted and they looked like two different
things because they were. `variant="panel" | "fullscreen"` is now the only difference —
fullscreen adds the brand lockup, Minimise, a second decorative ring and the footer, because
there it is the whole screen. The panel took the lime treatment: an invite is not a component of
the console, it is a thing you point a stranger's phone at, and **Maximise is now a change of
scale rather than a change of design.** The event detail card keeps the dark treatment, which is
what distinguishes a glance at your own event from a sign on a wall.

Applied to the event detail card, the kiosk's invite tab and the maximised screen. The pass page
passes no `kind` and renders exactly as before.

### U2 · The kiosk opened on a code its own scanner refuses

This is almost certainly the never-reproduced "QR scan check-in is broken" report.
`/checkin/$eventId` opened on `display` — the event's share QR — and the natural thing to do with
a code on a door screen is scan it. The scanner tab then rejects that exact string ("that's the
event link"), correctly, and the whole screen reads as a broken scanner.

The kiosk now opens on **Scan passes**. The invite code is still one tap away, relabelled
**Invite QR** (not "Event QR"), and now says what it is *not*: "It is not a pass itself — don't
scan it with the scanner." **Still wants confirming with a real camera** before U2 is closed.

### F10 · The counter is a way in

`checkInCount` was a `<div>` — the one piece of live information on the screen, and nothing to
tap. It is a button now, and it opens a sheet rather than navigating: leaving the route unmounts
the scanner, and coming back re-requests the camera and re-initialises `html5-qrcode`, which is
seconds of black rectangle with a queue at the door. A sheet leaves the kiosk mounted, so "Back to
scanning" is a dismiss, not a cold start. "Full list" still goes to `/attendees?eventId=`.

**No new endpoint.** `GET /people?eventId=&standing=attended` already answers exactly this —
scoping to an event changes `standing` from lifetime to that event.

### F7 · An auto-generated name was publishing a personal one

`defaultOrganizationName` built `"Israel's organization"` from the account's first name. That name
is **published**: it is on `PublicEvent.organizationName`, so it appears on the public event page
and on every attendee's pass. A default nobody chose put the organiser's personal name in front of
strangers.

It returns `'My organization'` and **takes no arguments at all** — the strongest form of the
guarantee, since nothing about the account *can* reach a published field. Only affects
organisations created from now on; existing rows keep their name, and renaming is the owner's call
(Settings tab), not a migration's.

### F15 · The upload warning was a footnote

Reported from the field the same day stage 1b shipped: picked a file, saved, image gone. It *was*
disclosed — in muted 11px text under the image — and read straight past. The warning now sits on
the image, in warning colour, the moment the preview appears. The real answer is stage 4.1, which
F15 has moved up the queue.

### F16 · Blank address is refused — filed, not fixed

Confirmed: `events.location_text` is `NOT NULL` and the API enforces `min(1)`, while the
composer's own copy offers "Offline location or virtual link". Already on the list as **B3** and
scheduled at **stage 5b** — it needs a migration (drop the NOT NULL, add `format` + `meeting_url`,
CHECK the combinations), so it is not a one-line fix and was not smuggled into this stage.

### Verified

78 unit, 114 integration, 51 adversarial, `coreservice:lint`, `web:lint`, `web:build`. Walked at
375×812 against the **deployed** API: the kiosk opens on the scanner, the counter opens the sheet
with real check-in times, the invite code carries its ring and caption, no console errors.

**Not verified:** the scanner with a real camera (blocked in the automation pane), which is what
U2 still needs.

---

## 2026-11-07 — Stage 3: recurring events

**F5, D40.** `event_series` + `events.series_id` / `series_index`, migration `0005`.

### The decision the feature turns on: materialise, don't compute

The tempting design stores an RRULE and expands it on read — one row, no horizon. It does not
work here, because everything this product does hangs off `events.id`: `attendance` is unique on
`(event_id, person_id)`, `passes` on `(event_id, person_id) WHERE revoked_at IS NULL`, plus
capacity, the short code and check-in state. A computed occurrence has no id, so the first time
anyone checks in to "the third Sunday" there is nothing to write the row against — and an id
invented at check-in time would differ between two doors. Luma, Eventbrite and Google Calendar all
materialise for the same reason.

So creating a recurring event writes the series **and** every occurrence in one transaction. The
stored RRULE is the record of what was asked for, never read back to decide what exists.

### DST is why `recurrence.ts` exists

"Every Sunday at 10am" means 10am **local**. Across a DST boundary that is a different UTC
instant — 10:00 Europe/London is 10:00Z in January and 09:00Z in July — so expansion cannot be
`startAt + n * 7 * 86400000`. Fixed-millisecond arithmetic moves a service by an hour twice a
year, in opposite directions, and nobody notices until a congregation turns up at the wrong time.

The expander breaks the start into local wall-clock parts, advances the **calendar**, and converts
each occurrence back to UTC at its own offset — two passes, because the offset you need is the one
in force at the result. 97 unit tests, and the DST cases are the point of the file.

Monthly is by **weekday**, not day-of-month: "the second Sunday", not "the 9th". A month with no
5th Sunday is **skipped, not nudged** — rolling onto the 4th would invent an event nobody asked
for in a month they expected free.

### The UI is Apple Calendar's, after a false start

The first version was a pill grid with a count (4 / 8 / 12 / 26 / 52). It was rejected on sight,
rightly: it made the organiser do arithmetic. The second is Apple's — a plain checkmark list
(Never · Every Day · Every Week · Every 2 Weeks · Every Month · Every Year) and an **End repeat**
date.

**An end date, not a count.** "Until the end of term" is a question an organiser can answer; "how
many Sundays is that" is not. The backend took `until` with it, and the RRULE stores `UNTIL=`
rather than `COUNT=` so the rule records their intent rather than our arithmetic.

Still capped at **104 occurrences** — each one is a real row with its own short code, so "every
day until 2099" has to stop somewhere. The sheet says so when the cap bites rather than silently
generating fewer events than asked for.

### Smaller things that mattered

- **Short codes are reserved across the batch.** `allocateShortCode` only checked the table, so
  two of 104 could match each other and fail the whole insert on `uq_events_short_code`.
- **`ON DELETE SET NULL`, never CASCADE.** Deleting a programme must not take the occurrences —
  they carry the attendance, which is the one thing this product exists to keep. An orphaned
  occurrence is a one-off event again. There is an integration test for exactly this.
- **RLS on the new table, hand-written.** drizzle-kit does not emit it. The policies look inert
  today (the API connects as `postgres`, which is BYPASSRLS) but a tenant table added without one
  is how the eventual cutover acquires a hole.
- **A crash found by running it.** `RepeatField` called `until.getTime()` on a value that had been
  through the form's zod validator and come back not-a-Date, which took the composer down via the
  error boundary. Normalised on read.

### Verified

97 unit, 124 integration (11 new, against real Postgres), 51 adversarial, lint, build. Created a
14-week programme through the UI and confirmed in the database: 14 rows, contiguous indices,
distinct short codes, `FREQ=WEEKLY;BYDAY=SA;UNTIL=…`.

### An edge-case audit, because the failure mode here is somebody missing an event

Probed rather than assumed, and the probe found two real defects — both now fixed:

- **The count shown before committing was wrong by 3x.** The composer approximated it as
  `span / averageMonthLength`; a monthly series on a fifth weekday skips most months, so the
  sheet promised ~22 events and the server wrote 8. `recurrence.ts` moved to `packages/lib` and
  both sides now run the same expander, so the number is exact.
- **A long sparse monthly series truncated silently.** The step loop stopped at
  `MAX_OCCURRENCES + 24`, which is not enough for a fifth-weekday pattern (about five a year), so
  a long programme simply ended early with nothing saying it had. Now `MAX_OCCURRENCES * 12`.

Confirmed-correct behaviours, each now locked by a test: a wall time that does not exist rolls
forward (01:30 → 02:30 on a spring-forward night) rather than the occurrence being dropped; an
ambiguous wall time yields exactly one occurrence; an event spanning a boundary keeps its
wall-clock length; short codes cannot collide within a batch; deleting a series leaves the
attendance standing.

**R-1 is now visible in the product**, not only in a doc: choosing an end date beyond the cap says
"this programme will **stop after 28 October 2028** — it does not continue on its own".

**Still open, and recurrence should not be promoted beyond the maintainer until they are done —
see the risk register in [`ROADMAP.md`](ROADMAP.md):**

- **R-1** a capped series stops dead and there is no top-up job. Warned at creation; nothing
  mentions it afterwards.
- **R-2** no way to change or cancel a whole programme. One tap creates 104 rows; undoing it is
  104 actions, and delete 409s once anyone has registered.
- **R-3** the series is reckoned in the *browser's* timezone, not the organisation's — which
  exists (`organizations.timezone`, "Recurrence needs it (D3)") and is simply not read.
- **R-4** "Every Month" on a 29th–31st is a fifth-weekday pattern and produces a sparse series.
  Correct, now stated exactly, still surprising — and "last Sunday of the month" is not offered.

**Not deployable until `nx run coreservice:migrate` has run against the remote.**

## 2026-11-07 — the poster becomes the poster, and a location becomes optional

**Posters are shown, not hinted at.** `event-poster-backdrop.tsx` is now
`event-poster.tsx`: the image is its own card above the lime billboard instead of
a texture behind it. The old treatment — `opacity-30` + `mix-blend-luminosity`
under a gradient that was fully opaque where the title sat — was the right call
while the bytes were arbitrary pasted URLs, because an organiser's dark
photograph behind near-black `text-primary-foreground` makes the title vanish.
Two things changed: we host the bytes now, and no text sits on the image any
more, so nothing has to stay legible over it. The component's own comment had
said this was "stage 4's job, once we host the bytes".

It is `object-contain`, never cropped. Event posters are usually portrait and
usually carry type at the very top, which is the first thing a `cover` crop
eats — the Luma reference the design came from crops its own poster's first word
off. The card carries a lit edge at the top-left and bottom-right, painted as
**two** masked-gradient borders: a dark one that defines the card against pale
artwork and a white one that reads as shine against dark artwork. A poster can
be either, so a single layer would be invisible half the time.

**Rows show the poster where the date was.** `DateIcon` already took a `url` and
nobody ever passed one. `EventRowModel` gained `coverImageUrl`, and a broken
image falls back to the date block rather than leaving a hole. The date is not
lost — it is in the row's meta line either way.

**The api-client contract was stale.** `coverImageUrl` had been on
`EventSummary` since F14 but was missing from `generated/schema.d.ts`, so the
field arrived at runtime with no type to describe it. `api-client:generate` was
not run when F14 shipped. It has been now.

### B3 + F16 — optional location and online events

Migration `0007_white_retro_girl.sql`, two statements: `location_text` drops
`NOT NULL`, and `meeting_url` is added. The composer has advertised "Offline
location or virtual link" for weeks while the schema refused both halves of
that promise.

**D44 — `format` is derived, not stored.** The roadmap sketch called for a
`format` column plus a CHECK keeping it coherent with the other two. There is
no such column. A stored copy of something derivable must be rewritten on every
write that touches its inputs, and the first write that forgets leaves a row
claiming to be online with no link on it — which is precisely the argument D2
makes for deriving event *status* from the timestamps. `deriveEventFormat` in
`services/event-format.ts` maps the two columns onto
`in_person | online | hybrid | unspecified`. `unspecified` is a real answer: an
event may be created before anyone has decided where it happens, which is the
whole of F16.

**Blank is NULL, decided at the boundary.** `blankToNull` runs on the write
path, so `''` never reaches the column and every reader has exactly one thing
to check. A form that posts an untouched input is the common case, not an edge
one.

**Deploying this needs the remote migrated FIRST.** Drizzle builds an explicit
column list from the schema, so every query now asks for `meeting_url`. Code
shipped ahead of migration `0007` makes every event query fail on production.

---

## 2026-11-07 — the production bucket is live, on R2

**Stage 4.1/4.2 is no longer theoretical.** Bucket `credopass-media` on Cloudflare R2,
served from the public development URL `https://pub-d8a53bb93c1a4b08a30d0d4f28cbea29.r2.dev`.
`S3_REGION=auto`. The CORS policy is committed at `services/core/r2-cors.json` rather than
retyped into a dashboard, and covers `localhost:5000–5003` because AirPlay pushes the web dev
server around.

Verified end to end against the real API: presign → PUT straight to R2 → `done` (which HEADs
the object) → anonymous GET of the poster → `POST /events` with that cover URL passing
`assertCoverImageAllowed` → the public event page serving it with no auth. All green.

**D43 — the `r2.dev` URL, not a custom domain.** `media.credopass.com` needs the zone inside
the Cloudflare account; `credopass.com` is on Namecheap nameservers and the partial/CNAME setup
that avoids moving them is Business-plan only. The r2.dev limit is hundreds of requests per
second, which one church on a Sunday is three orders of magnitude below. The nameserver move is
parked as a Stage 6 prerequisite, where it is justified by shielding `api.credopass.com` behind
Cloudflare rather than by posters.

**A correction worth keeping.** `STORAGE.md` §6.6 first claimed that changing `S3_PUBLIC_URL`
would orphan existing poster URLs. It does not: `assertCoverImageAllowed` sends a URL on an
unrecognised host to its plain-https branch, where it passes. The host check exists so local
MinIO can serve over `http`, not to pin a hostname. A switch leaves objects on the old
hostname — one UPDATE, not a migration.

### Two footguns found the hard way

**An exported `DATABASE_URL` silently beats `.env`.** Bun will not override a variable already
in the environment, so `export DATABASE_URL=<remote>` left over from a remote migration makes
every `bun start` from that tab talk to production. `coreservice:start` compounds it by printing
`✓ PostgreSQL connected (local)` from the string it was handed without ever checking the host —
`db status` is the only command that flags `⚠️ REMOTE`. The above verification ran against
production because of this; the test rows were removed. **`EADDRINUSE` on :8080 is not noise** —
it means a stale process is still serving and the new config never took effect. A guard making
`start` refuse a non-localhost `DATABASE_URL` was built on 2026-11-07 — see the entry below.

**`coreservice:token` registers real users in production.** `SUPABASE_URL` is the live project
and there is no local Supabase, so `signInAnonymously()` in `scripts/dev-token.ts` creates an
anonymous auth user there on every call — nine on this day alone. Do not fix this by disabling
anonymous sign-ins on prod: that breaks the only way to mint a JWT for Scalar or curl, and
`AUTH_DISABLED` is gone by design. The fix is `supabase init` + `supabase start` with
`SUPABASE_URL=http://localhost:54321` locally.

**Still open:** server-side derivatives (`sharp`), `assets.width`/`height` always null, no poster
delete path, no abandoned-upload sweep, and the Coolify variables are not set — production still
has no bucket configured.

---

---

## 2026-11-08 — "My passes": the attendee finally has a screen of their own

**The finding (maintainer testing).** *"You can see all the events you host, but no way to see the
events you went to. Luma makes it very clear."* The product had exactly one list of events and it
was the hosting list. Someone who attends events and hosts none opened CredoPass to an empty state
offering to create their first event — while the database held every registration they had ever
made.

The surface was designed for and then deferred (D26). `people.account_id` has existed since Phase 1
precisely for this, `claimByVerifiedEmail` was written and left unrouted, and T33/T34 were marked
"needs `POST /me/claim`". This lands all of it.

**What was built.**

| | |
|---|---|
| `GET /me/tickets?group=upcoming\|past` | Every event this account is attending, across every organisation. Returns both counts with either group so the switch never renders a `0` it has not fetched. |
| `POST /me/tickets/{eventId}/pass` | Reissues the caller's own pass. |
| `POST /me/claim` | Links guest registrations made before the account existed. |
| `services/core/src/services/tickets.ts` | The personal scope. |
| `apps/web` `/tickets` → `Pages/Tickets` | **Superseded the same day** — see the next entry. It is one merged list on `/events` now, and `/tickets` redirects. |
| `NAV_ITEMS` | A second entry, "Passes". **Also superseded** — there is no Passes tab. |

**Three things about the scoping, since this is the first non-org read in the service.**

1. These are `scope: 'account'`. They take no `X-Organization-Id` and the active-organisation
   switcher must not filter them — the query keys deliberately sit outside the `['org', id, …]`
   prefix for that reason.
2. The whole of the authorization check is `people.account_id = caller`. No organisation is named
   and none can be passed in, so the org-scoped path and this one cannot be made to produce each
   other's rows by changing a parameter.
3. **Attending is not belonging** (T29). Nothing here reads or writes `org_memberships`, and
   `/me/claim` creates no membership.

**A pass is reissued, never fetched.** Only the SHA-256 of a token is stored, so the link handed
over at registration genuinely is the only copy. "Show my pass" mints a new one and revokes the old
— `uq_passes_event_person_live` allows exactly one — which the pass screen has always said in as
many words.

---

## 2026-11-08 — `email_verified` was false for every account in the product

**The bug this blocks.** `resolveCaller` read `input.claims.email_verified === true`. Supabase sends
no such top-level claim — it is inside `user_metadata` — so `identities.email_verified` was `false`
for every row ever written, `claimByVerifiedEmail` could never match, and "My passes" would have
shipped permanently empty for anyone who registered as a guest before signing in. CLAUDE.md
documented the trap; nothing had yet acted on it.

**The fix.** `emailVerifiedFromClaims` in `services/identity.ts`, in this order and nothing else:

1. A top-level `email_verified: true` — the standard OIDC claim, signed by the issuer.
2. Otherwise: an address is present AND the session came through a federated provider that owns the
   address it asserted, read from `app_metadata` (which GoTrue writes and the user cannot) and
   failing that from `amr`.

`user_metadata` is never consulted, which is the whole point — a value the account holder can set
with one `auth.updateUser({ data })` call is not evidence about the account, and admitting it here
is account takeover one API call away. `ADDRESS_ASSERTING_PROVIDERS` is an allow-list: a provider
whose sign-up accepts an unconfirmed address (plain email+password) is deliberately absent, and
`src/test/email-verified.test.ts` asserts both directions.

---

## 2026-11-08 — Built-in event posters, and three defects found shipping them

**The finding.** *"Have some pre-designed cached posters that are auto-selected when you create an
event."* The poster slot offered two things a person making an event on their phone does not have:
a file to upload, or an https URL to paste. So almost no event had one.

**What was built.** Eight SVG posters in `apps/web/public/posters/`, listed in
`packages/lib/src/schemas/poster-templates.ts` — the shared contract the composer renders the picker
from and `services/core` validates against. A new event starts with one already applied (rotated per
composer mount, so a host's events do not all look identical); "Add photo" opens a tray that leads
with the artwork and keeps upload and paste at the end.

**They are stored as root-relative paths**, not URLs, so one row renders on `localhost:5000` and
`app.credopass.com` alike. `assertCoverImageAllowed` exempts them **by exact set membership, never by
a `/posters/` prefix** — the value of an allow-list is that it enumerates — and the integration suite
asserts that `/posters/../../etc/passwd` and a trailing space are both refused.

**Four defects surfaced on the way, all pre-existing and all now fixed:**

- **The storage integration suite was testing against the real R2 bucket.** It set its fixture with
  `process.env.S3_* ??= …` — "unless the environment already said otherwise" — and
  `services/core/.env` says otherwise since local dev was pointed at R2 (D43). So the suite silently
  stopped exercising the MinIO fixture it describes, read the production bucket's configuration
  instead, and "accepts our own ready asset, over plain http" failed because `publicUrlFor` was
  returning the r2.dev https URL. Pinned with `=`, `S3_PUBLIC_URL` included. Same class of footgun as
  the exported `DATABASE_URL` that beats `.env`: an ambient value quietly winning over the one named
  in the code in front of you.

- **The poster frame painted a white veil over every dark image.** `event-poster.tsx` used
  `[mask-composite:exclude] [mask:…]`, and `mask` is a shorthand: whichever order Tailwind emitted
  the two arbitrary properties in, it reset `mask-composite` back to `add`. Computed style confirmed
  `mask-composite: add, add`, so the "lit edge" gradient covered the whole card instead of a 1px
  frame. Replaced with the `mask-image` / `mask-clip` longhands, which reset nothing. This affected
  uploaded photos too; the posters only made it impossible to miss.
- **`EmptyState` rendered a dead "Create Event" button** whenever a caller passed no action — it was
  the prop default, wired to `() => {}`. Two screens were hitting it: an attendee search with no
  matches, and now "no passes yet", where creating an event is the opposite of the point. The
  default is gone; no action means no button.
- **The light-mode tab bar had no visible edge.** See the next entry.

---

## 2026-11-08 — The floating tab bar was invisible in light mode

**The finding.** *"A drop shadow or blur on the bottom nav-bar — it wasn't obvious to first-time
users."*

**The cause, which was not the blur.** The shadow was a literal at the call site:
`shadow-[0_8px_32px_-8px_oklch(0_0_0/35%)]`. A single shadow that diffuse, cast by 60%-opaque white
glass onto a white page, behind an 8% hairline, draws no edge at all. It worked in dark mode and had
only ever been judged there.

**The fix is a token, `--glass-shadow`,** because the two themes need genuinely different shadows and
a Tailwind arbitrary value cannot vary by theme. Light mode gets a tight contact shadow ("this sits
on top of the page") plus a soft ambient one; dark mode keeps a soft shadow, since a light fill on a
dark page separates itself. Light `--glass-bg` 60% → 78% and `--glass-border` 8% → 14%; dark
`--glass-bg` is unchanged and its border goes 8% → 12%.

**No palette token was touched** — no hue, no brand colour, no `--primary` / `--background` /
`--card` / sidebar value — and `defaultTheme` is still `dark`. Only the four `--glass-*` tokens the
tab bar is built from changed.

---

## 2026-11-08 — The pass screen invited signed-in people to create an account

**The finding.** *"The autofill works if I'm already a member, but it was still suggesting I create
an account, even though I had one."*

Two halves, and the register form was only ever the visible half:

- **`SignUpNudge` on `/p/{token}` was unconditional.** It now branches on the viewer's **local
  session** and offers "See all my passes" instead. The original note here warned against branching
  on whether *this address* has an account, because that would make the page an oracle for "does
  this person use CredoPass" and, through the event link, "is this person attending this event".
  That reasoning is untouched: no lookup happens, no request pairs a credential with the pass token,
  the same page is served to everyone, and the branch is decided entirely in the viewer's own
  browser.
- **The register form prefilled silently.** It now says *"Signed in as …— we filled this in for
  you"*, which is the only thing that distinguishes CredoPass recognising you from the browser's own
  autofill. Still editable: registering a partner from your own phone is ordinary.

**And the registration now actually attaches.** `POST /public/events/{id}/register` is
`scope: 'public'` and takes no credential — deliberately, so registering works with no account at
all — so the `people` row it writes has no `account_id`. The page calls `/me/claim` straight after
when there is a session, and `SessionProvider` calls it once per account on bootstrap. Without that,
an event you registered for while signed in would never appear under "My passes".

---

## 2026-11-08 — The sign-in screen, for the device people arrive on

**The finding.** *"CredoPass Welcome screen needs better design work — professional, like LinkedIn
or Luma."*

The billboard was always the strong half. The phone layout was the weak one: a detached lime banner
carrying a one-line tagline, then roughly a third of the viewport of nothing, then the heading and
button sitting low — so the first screenful of CredoPass was a logo and a gap.

- **One column, no banner.** Lockup, pitch, heading, button in a single run. The tagline is a kicker
  rather than a second `h1`, because two competing headlines on a 390pt screen is what pushed the
  button down in the first place.
- **A reassurance row** — Free to start · No card · One tap — directly under the button. A screen
  whose entire content is one OAuth button reads as a wall without it. Three items, each short
  enough to stay on one line at 375pt; a fourth word wraps the last chip onto a row of its own and
  looks like a mistake.
- **Small print.** "We only read your name and email address from Google." A sign-in with no terms
  line looks unfinished to the person evaluating this for an organisation, which is who signs up.
- **A card on desktop,** `md` and up. The controls used to float in 800px of empty panel with
  nothing holding them.
- **The question-mark illustration is gone** from the form column. `/empty-state-one.svg` is a
  figure under a large question mark, which on a sign-in page reads as "something has gone wrong".

---

## 2026-11-08 (later) — one list, and the tab lasted a day

**The finding, same afternoon the tab shipped.** *"Instead of a separate tab for passes, it should
all be on the event page. The main event page should tell me all the events I am registered to
attend as well as the ones I am hosting."*

Right, and the previous entry was wrong about it. Someone opening CredoPass is asking "what have I
got on?", and splitting that answer across two tabs made it depend on remembering which tab you were
in — an event you are speaking at and an event you are attending are the same kind of thing on the
same evening.

**`/events` is now one list.** `use-merged-events.ts` joins the two queries in the client. They are
NOT merged server-side and must not be: `/events` is organisation-scoped and `/me/tickets` is
account-scoped, the tenancy model rests on those being separate queries with separate
authorization, and one endpoint returning both would have to be neither. Joining them is a
presentation question, so it happens where presentation happens.

| | |
|---|---|
| The difference | A pill on the poster, Luma-style: `Host`, `Going`, `Registered`, `Went`, `Missed`. |
| Collisions | Hosting wins. Registering for your own event is ordinary and must not produce two rows. |
| Guest rows | No edit, delete or attendee list — those are 403s (§2.9) — and they open `/e/{id}`, not `/events/{id}`, which is org-scoped and would 404 across tenants. |
| Counts | `null` until BOTH halves land, so the switch shows a dash rather than a number about to change. |
| Search | Narrows to events you host. `/me/tickets` takes no `q`, and silently returning unfiltered tickets would be worse than not returning them. |
| `/tickets` | Redirects to `/events`. Pass screens in the wild link to it. |

**`Registered` is the label worth defending.** It is a past event whose attendance row still says
`registered` — nobody recorded the person arriving. Not `Went`, which would invent a fact; not
`Missed`, which would accuse them of one, since the job that writes `no_show` on close may simply
not have run. For a product whose whole claim is that attendance is a recorded fact rather than a
sign-up, the label has to be the thing that is actually known.

The pill is the translucent treatment the status badges already use — tinted text in a tinted
hairline — over `bg-card/85` with a blur. The backing is not decoration: these sit ON artwork, and a
10%-alpha fill is invisible against an arbitrary poster.

**Also in this pass:**

- **The poster picker stopped closing on every pick.** Choosing artwork is a browsing act; you want
  to see all eight against the real preview. Selection applies live, a `Done` button dismisses the
  tray. Upload still closes on its own — there is one file and nothing to compare it against.
- **`sunrise.svg` was redrawn.** The list crops posters to a 64px centre square, and its centre was
  all pale sun, so the thumbnail read as a blank white tile. Smaller sun, raised foreground.
- **A poster row showed no date.** The leading square is either the poster or the Luma-style date
  block, never both, and the meta line carried only the time — so a row with a poster said
  "1:18 PM" and never which day. Harmless while almost no event had a poster; every new event
  starts with one now, so it was about to be every row. The meta line prints the date when, and
  only when, the poster took the date block's place, and the "did it load" state moved up to the
  row so a broken poster flips both halves back together.
- **Blank squares in the list.** Reported as "why do some of the event list show blank?", and it
  was two things wearing one symptom. The DATA: two rows pointed at uploads that do not resolve —
  one R2 object that 404s, one MinIO object that answers 200 with a 22-byte body — both left over
  from storage testing, neither a template. The BUG: the leading square was either the poster or
  the date block, decided up front, so a poster that is slow or dead left a bordered empty box for
  the length of the request and the fallback only fired on `onError`. The date block is now always
  rendered and the poster is layered over it, transparent until the bytes arrive — so the square
  can never be empty, and a dead poster degrades to the date without ever having shown a hole.
  (First attempt at this made it worse: the overlay reused `.event-date-icon`, which carries an
  opaque `var(--card)` fill, and hid the date block permanently.)
- **"Why did my registration not appear?"** It had not shipped yet. Confirmed by planting an
  unclaimed `people` row in another organisation the way a pre-launch registration exists: the
  bootstrap `/me/claim` adopted it on the next page load and it appeared under Past. Nothing to fix —
  existing registrations backfill themselves once this is deployed.

---

## 2026-11-08 (later still) — `Organization.plan` was a `string` and `Plan.id` was an enum

Clearing the web app's three long-standing typecheck errors turned up a real contract bug rather
than three sloppy annotations.

Two of them were simply widened parameters — the command palette typed an account tab as `string`
when the route validates a closed set, and the QR scanner's cleanup had a branch that fell through
without returning. The third did not go away when narrowed, because the contract itself disagreed
with itself: `Plan.id` shipped `"free" | "starter" | "pro" | "enterprise"` while
`Organization.plan` shipped `string`, for the same value. So the upgrade screen could not look an
organisation's own plan up in the plan catalogue without a cast — which is exactly the kind of cast
that hides a real mismatch later.

The column has been `text({ enum: [...] })` in Drizzle all along, and `PATCH /organizations/{id}/plan`
already declared the enum. Only `OrganizationSchema` said `z.string()`. Fixed there — one line —
plus `OrganizationSummary.plan` in the service, then regenerated the client. **Narrowing a response
field is not a breaking change for a client that already handled the wider type**, and nothing was
casting around it.

`apps/web` typechecks clean for the first time in a while: 3 errors → 0.

---

## 2026-11-08 (afternoon) — a published personal name, reusable posters, and a sweeper

### The organisation name was publishing the host's own name

Reported as *"the shared QR code has the person who created it's organisation — an invited person
doesn't need that information. Seems like a backend security issue."*

**The QR is clean** — it encodes the `/e/{id}` URL and nothing else. The exposure is
`organizationName` in the public payload, and the cause is older than the QR: the default used to
be `` `${who}'s organization` ``, built from the account's first name or email local part. That
generator was fixed to `My organization` (F7) and the rows it had already written were left alone
on purpose, because renaming somebody's organisation is their decision. Which left every
pre-existing account — including the maintainer's, still `Israel's organization` — publishing a
personal name on every event page and every pass.

Closed from the publishing end instead: `isGeneratedOrganizationName` withholds a name nobody
chose, in `loadPublicEvent` (which the pass embeds) and in `/me/tickets`. The row is untouched and
the console still shows it. Verified against the running API — an event in `Israel's organization`
now returns `null`, one in `Kharis Church` still returns `Kharis Church`.

**It fails safe, and that direction is deliberate.** A real `Dave's Organization` is suppressed
too and loses its label until renamed. Publishing a name nobody chose is the worse error, so the
ambiguous case loses. Seven unit tests pin both directions.

> **Still open, and it is the maintainer's call:** whether the host should appear on the public
> page at all. The argument for keeping it is that an attendee wants to know who is running the
> event, which is why Luma shows it. Nothing is leaked either way now.

### Posters can be reused instead of re-uploaded

`GET /media/recent` (`media:read`, org-scoped) plus a **Recent** row above the built-in posters.
Selecting one points the new event at the **same stored object** — it does not copy it — so a
church running the same service weekly stops re-uploading the same artwork and the bucket stops
growing a duplicate. Fetched only once the tray is open, and invalidated after an upload so the
image just added is at the top.

### The sweeper, and why it is not the job that was asked for

The ask was "delete the R2 objects behind soft-deleted events, weekly". The query is deliberately
not that, because **an object is not owned by an event** — and the Recents row above makes one
object backing several events the ordinary case. Deleting on event-deletion would blank the poster
on every other event still using it.

So `sweepOrphanedMedia` asks *"does any live event still reference this object"*, per object. Two
classes: `pending` past its TTL, and `ready` that nothing references and is older than
`ORPHAN_GRACE_MS` (7 days). The row is soft-deleted, never dropped, and a storage delete that
fails leaves the row alone so the next run retries — never soft-delete a row whose bytes survive.

**The grace period is what makes the schedule unimportant.** An image sitting in an unsubmitted
composer is referenced by nothing for those minutes; a week of grace means a sweep that runs
daily, weekly, or twice because the service restarted can never take it.

It runs **in the service**, daily, armed two minutes after boot — not in CI, because the sweep
needs the production `DATABASE_URL` and the bucket credentials and CI is deliberately given
neither. Daily rather than weekly because a timer inside a process is reset by every deploy, so a
weekly one in a service that ships more often than weekly would mostly never fire.

Six integration tests, written as the failure modes: an asset two events share survives one of them
being deleted; a recent unattached upload is spared; one organisation's asset is not reclaimed
because another deleted an event.

### Recurring events — unchanged, and already documented

No code written. [`RECURRING-EVENTS.md`](RECURRING-EVENTS.md) is the brief — the implementation was
built and removed the same day, and §6 is the bar for un-pausing. The composer's Repeat control
already says so on screen. The blocker is R-1: a series stops dead at the horizon and nothing says
so.

### The AI sidebar plan was restored

`docs/ai-sidebar/AI-SIDEBAR-PLAN.md` had been deleted in a tree-wide refactor (`f4907dd`) while
`services/ai-chat/src/app/settings.py` still cited it by name — the only tracked Python file in
the repo pointed at a document that was not there. Restored, with a new §10 answering "free models
that work in-browser".

**§10's finding is a tension, not a shopping list.** The plan puts inference server-side because
the tools forward *the caller's own token*, which is the security property the whole design rests
on. A model in the tab cannot hold that agent loop without making every guard-rail advisory, and
it skips AG-UI — the thing being learned — entirely. In-browser is worth having for jobs with no
data access (summarising text the user just typed, embeddings over what is already on the page),
and the ~700MB download means organiser-side only, never on `/e/{id}` or `/p/{token}`.

---

## 2026-11-08 (evening) — the host is back, and the name gets fixed instead

**The correction.** Withholding the organisation name from the public page was
the wrong fix. Maintainer: *"I agree attendees should know who is organising the
event. I think we need it back — the 'organisation' name is what was confusing
it."*

Right. The objection was never that invitees see a host — every events product
shows one, because somebody deciding whether to turn up wants to know who is
running it. The objection was that `Israel's organization` **is not a host**. It
is a person with a noun stapled on, and it reads as a placeholder somebody
forgot to fill in. Hiding it solved that twice over in the wrong direction: the
invitee lost information they wanted, and the bad name stayed exactly where it
was.

So `organizationName` is published again, unconditionally, and
`isGeneratedOrganizationName` moved to `packages/lib/src/schemas/organization-name.ts`
where it now does a different job: it decides whether the **console nags the
owner to choose a name**.

`HostNamePrompt` sits above the greeting on `/events` — the screen a host opens
every time, rather than Settings, where the people who need it have already
demonstrated they do not go. It names the consequence rather than the setting
("Your events are going out as 'Israel's organization'. That name is on every
event page and every pass you send") because the setting is a chore and the
consequence is a reason. Dismissible, and renaming removes it on its own since
the predicate stops matching.

The predicate now over-matches deliberately and the test says so: a real
"Dave's Organization" gets one dismissible prompt, which is a far smaller harm
than never prompting the accounts whose name really is a leftover. When it
gated a published field that trade was the other way round.

### The agentic copilot is specified, not built

[`docs/ai-sidebar/AGENTIC-CHAT.md`](ai-sidebar/AGENTIC-CHAT.md) — design only, at
the maintainer's request, modelled on Cloudflare's **Agent Lee** (approval-gated
actions, undo, diagnostics, generative UI).

Three things in it are worth knowing without reading it:

- **The agent gets no permissions of its own.** Every tool forwards the caller's
  real token to v1, so the role matrix that already exists is the only
  authorization, and there is no new surface to audit.
- **The tool catalogue is short on purpose.** Reads are generous; writes are
  five; and there is an explicit never-list — deletes, members, invitations,
  billing, and anything touching a pass, because a pass is a bearer credential
  and reissuing one revokes a link held by somebody who is not in the
  conversation.
- **CredoPass has a prompt-injection vector Cloudflare's analogy does not.**
  `POST /public/events/{id}/register` takes a first and last name from anyone
  with the link, no credential. Those strings land in the attendee list, which
  is what a `list_people` tool would feed into the model's context — so the
  entire internet can write into the agent's prompt. Approval on every write is
  the control that makes this survivable, which is the strongest argument for
  keeping the write list tiny. §6 of that document is a gate: if the injection
  story is not agreed, read-only ships and write tools do not.

---

## 2026-11-08 (night) — the organisation model named, the roles cut, two defects found

Triggered by feedback, not a bug: *"when an event is created and shared, users see 'My
Organisation'."* The name had already been fixed once, withheld once (`cd05245`) and republished
once (`b86ba60`) the same day. Three passes at a naming problem meant it was not a naming problem.

**The diagnosis.** One `organizations` row does two incompatible jobs: it is the **tenant boundary**
(billing, staff, people, RLS) and the **public host identity** on an invite. No single name satisfies
both — "Kharis Church" is right for billing and wrong on an Accra-branch event page.

### Decisions

| | |
|---|---|
| **D45** | **The three concepts are account / organisation / membership, and permissions are not a fourth.** *Permissions* and *access* are not separate from membership — they **are** membership. You do not have permissions; you have a membership, and it carries a role. Written into `CLAUDE.md` and `FORENSICS.md`. |
| **D46** | **Every public identity is its own tenant, as a peer — not a child.** "Blazers" sits beside "Israel", not under him. A sub-org hierarchy was considered and rejected: the need it answers (branches of one institution) is a *different* need from a second unrelated identity, and the hierarchy serves the first while being actively wrong for the second. Confirmed by Luma, whose Personal→Team calendar conversion happens **in place, keeping billing** — so a tenant from day one is what makes growth free. |
| **D47** | **A group layer goes ABOVE organisations, never a scoping dimension inside them.** This is why it does not contradict **D7**. D7 forbade "a second scoping dimension to every query and every RLS policy"; grouping above adds none — `ctx.organizationId` stays singular everywhere it is today, and `app.current_org_ids()` (`drizzle/0001_rls.sql:65-72`) already returns a **set** that all policies compare with `= ANY (…)`, so a group membership widens **one function**, not sixteen policies. You can always group; you cannot easily split. Not built. |
| **D48** | **A branch never gets its own login.** A branch is an `organizations` row; a branch head is an `account` with a membership. Shared branch logins would destroy `attendance.checked_in_by_account_id` — "who checked this guest in?" would collapse from one answer per person to one per branch. |
| **D49** | **`viewer` becomes non-assignable rather than deleted.** It and `checkin` were near-duplicates differing on one axis each (viewer held `member:read` + `analytics:read`; checkin holds `attendance:record`), so neither contained the other — that was the cross-over, and it was the *sole* reason `ROLE_PERMISSIONS` was hand-written rather than derived. **Deviation from the plan, deliberately:** the plan said remove it outright with a migration. On implementation that is the wrong trade. `viewer` is a value of the `org_role` Postgres enum (and `ALTER TYPE … DROP VALUE` does not exist), the default of two columns, and `normaliseRole`'s fallback — a read-only default is the correct least-privilege answer. So `ASSIGNABLE_ORG_ROLES` is the four that may be granted and `ORG_ROLES` still resolves five. Request schemas use `AssignableRoleSchema`, responses use `RoleSchema`. Same UI simplification, no risky enum or default migration, and a future group-level viewer keeps its target. |
| **D50** | **A declared permission must also be enforced, and a test says so.** See the defect below. |

### Two defects found while auditing the contract

**Declared ≠ enforced.** `GET /organizations/{id}` and `GET /media/recent` declared a permission and
carried **no `requirePermission` middleware**. Every other org-scoped route does. The boot assertion
validates the *declaration*; it cannot see whether the middleware is wired. Impact was nil — both
permissions are held by every role, so any member could call them anyway — which is precisely why
nobody noticed, and precisely why it would have bitten the first time either permission was
tightened. Both fixed, and `src/test/route-enforcement.test.ts` now fails if a declaration and its
enforcement disagree.

**A client-supplied primary key.** `POST /organizations` accepted `id: z.string().uuid().optional()`
and passed it to the insert. It could not take over an existing organisation (the PK conflict throws)
but a client must not choose server-side identifiers, and the collision surfaced as a 500 rather than
a declared response. Removed from the schema and from `createOrganization`'s input type. **`POST
/events` still honours a client UUID** through a different shape — recorded, not changed.

### Also

- Three of 25 permissions have **no route behind them**: `series:manage`, `attendance:amend`,
  `analytics:export`. They are granted to organizer-and-above and shipped to clients in
  `/me/context` against no endpoint. Recorded, not removed; no test asserts the inverse direction.
- Six permissions are held by *every* role, so they distinguish nothing and effectively mean "any
  active member". Recorded.
- `OrgSummary.role` is an open `z.string()` while `Member.role` is the closed enum, so
  `/me/context` publishes the role as a free string. Recorded.
- **`FORENSICS.md` added at the repo root** — the three concepts, all 51 endpoints with scope and
  permission, the role matrix with the cross-over analysis, the defects, and the open investigation.
  The API is the contract, so the contract now has one place to be read.
- Documentation corrected: `README.md` had two dead links (`docs/API-FIRST-REBUILD.md`, archived;
  `docs/NEXT-UI-LIST.md`, deleted) and one flatly wrong claim — that the remote Supabase instance was
  **not** migrated, when it has been at 8/8 since 2026-11-07. Counts were stale throughout (11 tables
  → 13, 47 adversarial tests → 52, T48 added here, 4 migrations → 8). `docs/README.md` was stamped 2026-11-06 while
  this log carried eight entries from 2026-11-08, listed `docs/ai-sidebar/` nowhere despite its own
  rule that everything in `docs/` must be listed, and still called B2 an open bug. `ROADMAP.md`
  contradicted itself on B2 — the code wins; corrected.

### ⚠️ Open, and deliberately not closed

**Cross-account event visibility, reported 2026-11-08.** Events created on a second person's account
became visible on the maintainer's after he created a new organisation. `membership.ts`, `tickets.ts`,
`me.ts` and `requireTenant` were audited and are correctly scoped — **no org-scoped read path was
found that returns another account's organisation.** Three hypotheses remain undiscriminated (the same
Google account on both phones; claim-by-verified-email working as designed; a genuine leak), and the
discriminator is one observation: whether the pill on those rows read "Host" or
"Going/Registered/Went". Parked at the maintainer's instruction, with the question recorded in
`FORENSICS.md` §8. **Not reproduced, not explained, not dismissed.**

## 2026-11-09 — the host is the person, and the composer says so

**D51 — a solo organisation is named after the person, with no suffix.**
`defaultOrganizationName` takes the account again and returns `account.displayName`
verbatim. This reverses the rule written one day earlier, which took no arguments so that
"nothing about the account CAN reach a published field" — the right fix for the wrong
diagnosis.

The reasoning went round three times before settling, which is why it is worth writing down:

1. The default was `` `${who}'s organization` ``, which is published. Replaced with the
   literal `My organization` (F7).
2. The name was then withheld from the public page entirely (`cd05245`).
3. Then published again (`b86ba60`), because an invitee deciding whether to turn up wants to
   know who is running the event.

With the name published **by design**, the objection collapses. It was never that a personal
name is published — a solo host *is* a person, and "Israel Agyeman-Prempeh" is the accurate
host for a weekly singalong. The objection was the `'s organization` suffix, which turns a
name into something that is not an organisation and reads as a placeholder nobody filled in.

**Deviation from the plan, deliberately.** The plan said to delete `host-name-prompt.tsx` and
retire `isGeneratedOrganizationName` on the grounds that a correct name needs no nag. Both
are kept. `defaultOrganizationName` falls back to `My organization` when no display name was
asserted, and legacy rows still carry `Israel's organization` — so the predicate and the
prompt still have real work. Deleting them would have meant the rare nameless account
publishes a placeholder with nothing to flag it. The prompt will now almost never fire, which
is the point.

Also: the composer's pill is labelled **"Hosted by"** rather than showing the name bare.
*Organisation* is an admin word — it belongs on members, billing and settings. What matters at
the moment of creation is the published consequence, in the words the invitee will read. This
is the UI half of the vocabulary split recorded in `CLAUDE.md`.

**Not verified.** `integration/default-organization.test.ts` was rewritten to assert the new
behaviour (including that the fallback still trips the rename predicate) but has not run —
Docker is not up on this machine, so the integration and adversarial suites remain unexecuted
across both this change and the previous commit. Lint, typecheck, the 97 unit/structural tests
and the web build all pass.

## 2026-11-09 (later) — the suites run, and two stale stubs get written

Docker was down for the previous two commits, so the integration and adversarial suites had
not executed. They have now. **All green: 97 unit/structural, 136 integration, and the
adversarial suite at 0 fail.** Nothing in the role reduction, the enforcement fix or the
Stage 0 rename regressed, and `integration/default-organization.test.ts` — rewritten blind —
passes.

**The adversarial suite is smaller than its headline number.** 52 tests are declared; **42
execute and 10 are `it.todo` stubs**. The file headers justify stubs as naming routes that
"do not exist yet", and that has gone stale — T15 (analytics scoping), T16 (presigned upload
key prefix) and T26 (cross-tenant media asset) all name routes that have since shipped.
"the 52-test adversarial suite" overstated the cover, so README and FORENSICS now say what
actually runs.

**T31 and T33 written, and they matter.** Both were stubs despite `/me/tickets` and
`/me/claim` having long shipped — which meant the two assertions bearing directly on the open
cross-account report were not being made at all:

- **T33** — an account holding an **unverified** address matching a `people` row claims
  nothing and its ticket list stays empty. Claiming cannot harvest another person's tickets
  by registering under their address.
- **T31** — `/me/tickets` returns the caller's rows across every organisation and nobody
  else's, including a second person registered in an organisation the caller also appears in.

This narrows the open investigation without closing it. It rules out the unverified-email
variant and a broad `/me/tickets` leak. It does **not** rule out the main hypothesis: the
maintainer's Google address is verified, so if his wife entered it on an attendee row the
claim is legitimate and the ticket genuinely his. Still waiting on the one observation that
decides it — whether the pill on those rows read "Host" or "Going/Registered/Went".

Eight stubs remain. Several are now implementable and are worth a pass of their own.

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
