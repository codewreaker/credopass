# The rebuild log

> **What actually changed, in the order it changed.** The plan is
> [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) — what we *intend* to build. This is the record of what
> was built, what was decided differently along the way, and what broke.
>
> Read it top to bottom to understand the system as it stands.

**Status:** Phase 1 mostly complete · **Last updated:** 2026-07-26

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

**Two API surfaces run side by side, on purpose:**

| Surface | State | For |
|---|---|---|
| `/api/core/*` | Untouched. Still serves the live web app. | Nothing new. Deleted in Phase 3. |
| `/api/v1/core/*` | The rebuild. | All new work. |

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

## Where things stand

| | |
|---|---|
| Unit + structural tests | **68 passing** |
| Integration tests (real Postgres) | **16 passing** |
| Adversarial tenancy tests | **11 / 50** — the rest need Phase 2+ endpoints |
| Migrations | 7, replayed from empty and verified |
| API operations | 16 |

**Reading the adversarial number correctly:** those 39 failures are the plan working. The tests were
written before the code they guard, so they go green as phases land. A green adversarial suite today
would mean the tests were too weak.

---

## Conventions worth knowing

1. Every route is created with `defineRoute` and declares `scope` (+ `permission` if org-scoped).
2. Errors are `ProblemError`. Never `c.json({ error })`.
3. Never hand-write OpenAPI — it is generated from the Zod schemas that validate.
4. Handlers never build a `TenantContext`. Only the tenant middleware does.
5. `services/**` imports no framework.
6. A resource in another tenant returns **404**, not 403.
7. Tables are reached through `scoped(db, ctx)`.

---

## Phase map

| Phase | State |
|---|---|
| −1 · Revoke public DB access | ✅ Done, verified |
| 0 · Foundations | ✅ Done |
| 1 · Identity + tenancy | 🟡 Endpoints done; RLS cutover, data migration, client rewiring open |
| 2 · Events + people reads | 🟡 deriveStatus done; EventService/PeopleService and endpoints next |
| 3 · Writes, passes, email, delete local-first | ⬜ |
| 4 · Domain events + live kiosk | ⬜ |
| 5 · Recurrence | ⬜ |
| 6 · Media, entitlements, real analytics | ⬜ |
| 7 · Enterprise SSO | ⬜ |
