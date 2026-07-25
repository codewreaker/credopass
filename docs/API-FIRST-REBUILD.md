# CredoPass: the API-first rebuild

> **The plan to make the API the product.** Today CredoPass is a React app with a database attached.
> After this work, every capability is reachable with `curl`, the UI is a rendering client, and the
> OpenAPI document is the contract. This supersedes [MULTI-TENANCY.md](MULTI-TENANCY.md) (a patch plan
> for a system we are now replacing) and closes out the P0 in [MVP-READINESS.md](MVP-READINESS.md).

**Status:** proposed · **Author:** rebuild planning pass · **Date:** 2026-07-26 (rev 2)
**Verified against:** `epic/credopass-api-rewrite` @ `9eed1c6`, plus a live walk of the running stack
(web `:5001`, API `:8080`). Landscape screenshots captured to [`audit/shots/`](../audit/shots/) as
`tablet-landscape-*.png` (14 files).

> **Rev 2 changes.** Four maintainer directions folded in: the attendee surface is modelled properly on
> the Eventbrite pattern ([D17](#d17-new--the-attendee-surface-the-eventbrite-pattern)); identity is
> re-answered as an enterprise design with per-tenant IdPs ([D1](#d1--identity-is-ours-idps-are-pluggable-the-answer-to-52));
> the event `lifecycle` enum is **deleted** — `draft` goes, `cancelled` stays as a timestamp
> ([D2](#d2--no-lifecycle-enum-status-is-derived-from-timestamps)); and transactional email becomes real
> infrastructure ([D18](#d18-new--transactional-email-is-infrastructure-not-a-feature)).

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Decisions register](#2-decisions-register)
3. [Target data model](#3-target-data-model)
4. [Domain services catalogue](#4-domain-services-catalogue)
5. [Complete API surface](#5-complete-api-surface)
6. [Authorization model](#6-authorization-model)
7. [Tenancy design](#7-tenancy-design)
8. [Event lifecycle and recurrence](#8-event-lifecycle-and-recurrence)
9. [Infrastructure](#9-infrastructure)
10. [Client rewiring plan](#10-client-rewiring-plan)
11. [Phased execution plan](#11-phased-execution-plan)
12. [Testing strategy](#12-testing-strategy)
13. [Disagreements, corrections and responses](#13-disagreements-corrections-and-responses)

---

## 1. Executive summary

### 1.1 The target architecture in one page

```mermaid
flowchart TB
    subgraph clients["Clients (rendering only)"]
      W["apps/web — console<br/>organiser, tenant-scoped"]
      P["apps/web — attendee<br/>/e/{id}, /p/{pass}, /me/tickets<br/>no app, no account required"]
      M["apps/mobile<br/>Expo (stubs today)"]
      C["curl · scripts · integrations"]
    end

    subgraph contract["The contract"]
      OAS["openapi.json<br/>generated from Zod"]
      GEN["@credopass/api-client<br/>openapi-typescript + openapi-fetch<br/>+ TanStack Query hooks"]
    end

    subgraph api["services/core — HTTP adapters"]
      RT["routes/*<br/>parse → authorize → call service → serialize"]
      MW["middleware<br/>auth · caller resolution · tenant · idempotency · rate limit"]
    end

    subgraph domain["services/core/src/services — pure domain"]
      SV["EventService · AttendanceService · PeopleService<br/>MembershipService · IdentityService · TicketService<br/>AnalyticsService · MediaService · NotificationService<br/>EntitlementService · SeriesService · PassService"]
      PORTS["ports: Db · Clock · Storage · EventBus<br/>Geocoder · Mailer · TokenVerifierRegistry"]
    end

    subgraph data["Postgres (Supabase)"]
      TBL["tenant-scoped tables + RLS"]
      DE["domain_events (append-only)"]
      NOT["LISTEN/NOTIFY"]
    end

    W & P & M --> GEN --> RT
    C --> RT
    OAS -.generates.-> GEN
    RT -.registers.-> OAS
    RT --> MW --> SV --> PORTS --> TBL
    SV --> DE --> NOT --> SSE["GET /events/{id}/stream (SSE)"] --> W

    style domain fill:#efe,stroke:#0a0
    style contract fill:#eef,stroke:#00a
```

**Five rules the codebase will enforce structurally, not by convention:**

| # | Rule | Enforced by |
|---|---|---|
| 1 | The tenant comes from the token, never the payload | Repository layer takes a `TenantContext` it cannot fabricate; RLS as a second, independent layer |
| 2 | Every route declares a scope and a permission | Startup assertion walks the OpenAPI registry; an undeclared route is a **boot failure** |
| 3 | Domain logic has no framework imports | `services/` has a lint rule banning `hono`, `Context`, `Request` |
| 4 | No hand-written OpenAPI, ever | `@hono/zod-openapi`; the doc is emitted from the same Zod schemas that validate |
| 5 | No business rule in `apps/` | The generated client exposes only decided fields; there is nothing left to derive |
| 6 | **Attending an event never grants access to the organisation that runs it** | Registration writes a `people` + `attendance` row and *cannot* write `org_memberships`; enforced by service invariant and by an adversarial test (T29) |

**Two audiences, two scopes.** The product has always had them; only one was ever modelled.

| | Organiser | Attendee |
|---|---|---|
| Signs in to | the console | nothing, usually |
| Scope of their data | **one organisation at a time** | **their own record, across every organisation** |
| Route scope | `scope: 'organization'` | `scope: 'account'` or `scope: 'public'` |
| Identity | `accounts` + `org_memberships` | `people` rows, optionally linked to an `account` |
| Reaches the product via | `/events`, `/attendees`, `/checkin` | a shared link → `/e/{id}` → `/p/{pass}` |

### 1.2 What changes, for whom

| Audience | Before | After |
|---|---|---|
| **A new visitor** | Lands in "Kharis Church", sees 34 strangers and every event | Lands on "Create your organisation"; sees nothing until they own something |
| **An organiser** | Same screens, computed in their browser from full-table caches | Same screens, values decided server-side; page loads stop scaling with total row count |
| **A door tablet** | Holds a full org session; counter is `useState`, resets on reload, two doors disagree | Holds a scoped device token good for one event; counter is live and shared over SSE |
| **An attendee with no account** | `/e/$id` register → pass held only in that browser tab; close it and it is gone | Register → pass **emailed as a durable URL** (`/p/{token}`); reopen it anywhere, forever |
| **An attendee with an account** | No such concept — signing in puts you in someone's console | `GET /me/tickets`: every event you've registered for, **across organisations**, and never a membership in any of them |
| **An enterprise tenant** | One shared Supabase project; no SSO | Their own OIDC/SAML IdP, per-organisation, with verified email domains and JIT provisioning |
| **Anyone integrating** | Would have to reverse-engineer the React app | Reads `openapi.json`; the TS client is generated from it, and so is anyone else's |
| **The maintainer** | Migrations untracked, tested against production | Local Supabase stack, committed migrations, adversarial tenancy suite in CI |

### 1.3 The four things this fixes that nothing else can

1. **`users` conflates two different nouns.** An operator who signs in and an attendee whose
   attendance is recorded are the same table, globally unique on email
   ([`tables/users.ts:10`](../packages/lib/src/schemas/tables/users.ts)). That is *why* tenancy cannot
   be expressed: a person has no tenant. Splitting `accounts` (identity) from `people` (tenant-scoped
   attendee records) is the keystone — bigger than the missing `authId` column that
   [MULTI-TENANCY.md §2](MULTI-TENANCY.md) identifies as C1.
2. **The attendee pass QR is forgeable.** `ticketValue = ${event.id}:${ticketId}`
   ([`EventView/index.tsx:521`](../apps/web/src/Pages/Events/EventView/index.tsx#L521)) is a raw event
   id and a raw user id, both of which appear in URLs and API responses. Anyone can mint someone
   else's pass. It becomes a signed token.
3. **The database may be directly writable by the public.**
   [`rls_dev_permissive.sql`](../services/core/drizzle/rls_dev_permissive.sql) grants
   `anon, authenticated` `USING (true) WITH CHECK (true)` on all seven tables, and
   `VITE_SUPABASE_ANON_KEY` ships in the web bundle. See [§9.5](#95-secrets--what-is-actually-at-risk)
   — this is the single most urgent item in this document and it is independent of the rebuild.
4. **An attendee's pass survives only as long as their browser tab.** The public flow registers you,
   renders a QR from `{eventId}:{userId}` in memory, and that is the whole of it — no email, no
   durable URL, nothing to reopen. Close the tab on the bus and you arrive at the door with nothing.
   Eventbrite's answer, and now ours, is that **the pass is a URL that gets emailed**
   ([D17](#d17-new--the-attendee-surface-the-eventbrite-pattern)). There is no mail infrastructure in
   the repo at all today — `grep -rl "resend\|postmark\|sendgrid\|nodemailer\|client-ses"` across every
   `package.json` returns nothing.

---

## 2. Decisions register

Every §8 question from the brief, plus six I surfaced. One choice each, with the trade-off accepted.

### D1 — Identity is ours; IdPs are pluggable (the answer to §5.2)

You asked whether "don't tie auth to a vendor" is the right instinct, and for the best enterprise
design rather than a literal reading of it. **The instinct is right, but one level off.** The thing
you must not outsource is not *authentication* — outsourcing that is correct and everyone does it.
It is **authorization**. The rule that matters:

> **The IdP answers "who is this human?". CredoPass answers "what may they do?" — always, for every
> provider, with no exceptions.** An IdP may never be the source of truth for organisations,
> memberships, roles or permissions.

Supabase Auth is a fine answer to the first question and must never be asked the second. Concretely:

**1. Four tables own identity, and none of them are Supabase's.**

```
accounts                  — a human. Ours. Stable id. Never deleted by a provider.
identities                — (issuer, subject) → account_id.  The only join to any IdP.
org_identity_providers    — per-organisation IdP config (OIDC/SAML). Enterprise SSO.
org_domains               — verified email domains → home-realm discovery.
```

`org_memberships` and `event_grants` — the authorization model — reference `accounts` only. No
provider can reach them.

**2. Verification is a registry keyed on `iss`, not a hardcoded Supabase call.**

```ts
// The trust anchor is the issuer. Adding a tenant's Okta is a config row, not a deploy.
interface TrustedIssuer {
  issuer: string;                    // the `iss` claim, exact match
  jwksUri: string;
  algorithms: ('RS256' | 'ES256')[];
  audience: string;
  organizationId: string | null;     // null = platform-wide (Supabase self-serve)
  subjectClaim: string;              // 'sub' by default
}
```

Resolution is always: verify signature against the issuer's JWKS → read `(iss, sub)` → look up
`identities` → get `account_id`. **`email` is never used to identify a caller** — it is user-editable
at many providers, absent for anonymous sessions, and is exactly the stopgap that
[`org-memberships.ts:97`](../services/core/src/routes/org-memberships.ts#L97) uses today.

**3. Enterprise SSO is per-organisation, with verified domains.**

An org configures OIDC or SAML; users at `@acme.com` are routed to Acme's IdP by home-realm discovery.
Domain ownership requires a **DNS TXT verification** before it can be claimed — otherwise anyone
registers an org, claims `@gmail.com`, and captures every Gmail user's sign-in. JIT provisioning
creates the account and a membership at the org's configured `default_role` on first successful
assertion. `enforce_sso` on the org then refuses password/social sign-in for its verified domains.

**4. SCIM is deferred but not precluded.** `org_memberships.external_id` and `provisioned_by`
(`manual | jit | scim`) exist from day one, so adding SCIM later is an endpoint, not a migration.

**Why this shape.** It gives you three things a "just use Supabase" design cannot: an enterprise tenant
can bring their own IdP without a code change; losing or replacing Supabase costs one row in an issuer
table and a backfill of `identities`, not a rewrite; and no provider outage or misconfiguration can
ever alter who is an admin of what.

**Trade-off.** More moving parts than calling `supabase.auth.getUser()`. The SAML path in particular is
genuinely fiddly, so it is **Phase 7, not MVP** — but the schema and the registry land in Phase 1, so
adding it never requires re-modelling. Supabase remains the *only* configured issuer until a customer
asks, and self-serve sign-up never touches any of it.

**Sub-decision (load-bearing):** the API connects as a dedicated `credopass_api` Postgres role that is
**not** `BYPASSRLS`, and sets `SET LOCAL app.account_id` per transaction. Without this, RLS protects
only direct PostgREST access and is *not* a second layer for the API path. See [§7.2](#72-layer-2--rls).

---

### D2 — No lifecycle enum: status is derived from timestamps

**You asked to drop `draft` and `cancelled` for simplicity. I'm taking the first, keeping the second,
and using the request to delete something bigger than either: the enum itself.**

**Drop `draft` — it is already dead code.** The composer hardcodes `'scheduled'` on create
([`use-event-form.ts:130`](../apps/web/src/Pages/Events/EventComposer/use-event-form.ts#L130)) and
defaults the field to `'scheduled'` ([`:102`](../apps/web/src/Pages/Events/EventComposer/use-event-form.ts#L102)).
**No path in the product has ever produced a draft event.** Removing it costs nothing and takes with it
the `publish` endpoint, the `event:publish` permission, and a state transition.

**Keep `cancelled` — it is load-bearing, and deleting is not a substitute.** It appears in the "past"
filter group ([`hooks/index.tsx`](../packages/lib/src/hooks/index.tsx)), and both the kiosk
([`CheckIn/index.tsx:211`](../apps/web/src/Pages/CheckIn/index.tsx#L211)) and the event view branch on
it explicitly. A cancelled event must keep its attendance rows (you have to tell those people), keep
its URL resolving so a printed poster says "cancelled" rather than 404, refuse new check-ins, and stay
in the organiser's history. Deleting instead loses the roll and breaks every link already in the world.

**So: delete the enum, not the state.** Store two nullable timestamps and derive everything:

```ts
// The whole of event status. No enum, no state machine, no transitions to guard.
type EventStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

const deriveStatus = (e: EventRow, now: Date): EventStatus =>
  e.cancelled_at ? 'cancelled'
  : e.closed_at || now > e.end_at ? 'completed'
  : now >= e.start_at ? 'ongoing'
  : 'scheduled';
```

**What this removes**, versus both today's schema and rev 1 of this plan: the `status` column and its
5-value enum · the `lifecycle` column and its 3-value enum · `POST /events/{id}/publish` ·
the `event:publish` permission · the draft→published transition and its guard · every "is this
transition legal?" check. `cancelled_at` doubles as the audit fact ("when, and therefore who").

A scheduler (every 5 min) still runs, but only for the one transition with *side effects*: closing an
event past its window — set `closed_at`, emit `event.closed`, finalise no-shows. That is a recorded
fact, not a render-time inference (brief §7), so something must write it.

**Trade-off accepted.** Without `draft`, an event is reachable at `/e/{id}` the moment it is created.
Its id is an unguessable UUID and it appears in no index, so this is unlisted-by-obscurity — which is
how a private Eventbrite event works too. If real drafts are ever wanted, they come back as a nullable
`published_at` timestamp, which is one column and no state machine.

This also kills the triple duplication of the rule:
[`collections/events.ts:24`](../packages/api-client/src/collections/events.ts#L24),
[`routes/public.ts:31`](../services/core/src/routes/public.ts#L31), and a DB column that never ages.

---

### D3 — Recurrence: materialised occurrences on a rolling horizon

**Choice.** `event_series` parent carrying an RFC 5545 `RRULE` + IANA timezone; concrete `events` rows
generated for a rolling **26-week / max 60 occurrences** horizon by a daily job, each carrying
`series_id` + `occurrence_start` (the un-shifted anchor) + `is_exception`.

**Why.** Every other object in the product needs a *stable event id*: an attendance row's FK, a QR
share URL, a kiosk session, an SSE channel, a poster someone printed last month. A virtual occurrence
has no id to hang those on, and inventing a composite id (`seriesId@2026-08-18T10:00Z`) reintroduces
the same problem the moment a single week moves. Materialising is the only option that doesn't leak
into every other subsystem.

**Trade-off.** Storage grows (~60 rows per series — irrelevant), and edits need explicit
"this / this-and-following / all" semantics with row surgery. Covered in [§8.3](#83-recurrence-model).

---

### D4 — Domain events: Postgres table only. No Redis.

**Choice.** One append-only `domain_events` table. Written in the *same transaction* as the state
change it describes. Fan-out via Postgres `LISTEN/NOTIFY` into an in-process SSE hub.

**Why.** Durability, ordering and transactional consistency come free; a Redis stream would need its
own outbox to get the same guarantee, which is strictly more machinery. `NOTIFY` fan-out works across
Cloud Run instances because every instance `LISTEN`s on the same channel.

**Trade-off.** `NOTIFY` payloads are capped at 8000 bytes (we send `{eventId, seq}` and clients re-read,
so this never binds) and are *not* durable across a dropped connection — so an SSE client reconnects
with `Last-Event-ID` and we replay from `domain_events` by sequence. That replay path is what makes it
correct; it must be built, not assumed.

---

### D5 — Live kiosk updates: SSE

**Choice.** `GET /api/v1/events/{id}/stream` (`text/event-stream`), with `Last-Event-ID` replay.
Check-ins still go out as ordinary `POST`s.

**Why.** The traffic is strictly server→client. `EventSource` reconnects automatically, which is
exactly what a door tablet on venue wifi needs. It survives every proxy, needs no upgrade handshake,
and Cloud Run supports it. WebSocket buys bidirectionality we do not need; polling cannot deliver the
"someone just walked in" latency a door display wants.

**Trade-off.** Cloud Run caps a request at 60 minutes, so a long-running kiosk reconnects at least
hourly — handled by the replay path above. One held connection per door; at this scale, nothing.

---

### D6 — Redis: not in the MVP

**Choice.** Do not provision Redis.

**Why.** The two jobs it would do are covered: pub/sub by `LISTEN/NOTIFY` (D4), and rate-limit counters
by a Postgres token bucket (`rate_limit_buckets`, one upsert per request on the public surface only).
The current system serves one org, 34 people and two events.

**Revisit when** any of: sustained >5 rps on `/public/*`, >20 concurrent kiosk streams, or the
idempotency table's write rate becomes a measurable share of DB load. Adding Redis later is a
localised change behind the `EventBus` and `RateLimiter` ports.

---

### D7 — `organizations` stays the tenant boundary. "Groups" become series + tags.

**Choice.** No rename, no nested group entity. `organizations` is the one tenant boundary, full stop.
What organisations were being abused for splits cleanly in two:

- **Recurring programmes** ("Sunday Service", "Youth Night") → `event_series` (D3), which we are
  building anyway.
- **Segments of people** ("choir", "volunteers", "small group A") → `person_tags`, a tenant-scoped
  label on a person. One table, no hierarchy.

**Why.** Every alternative (rename to `workspace`, nest `groups` under `organizations`) is either pure
churn or adds a second scoping dimension to every query and every RLS policy — the exact complexity
that produced the current mess. The org-switcher screen keeps working unchanged because organisations
keep meaning what the screen says they mean.

**Trade-off.** An org that genuinely needs sub-tenancy (a diocese with parishes) has to model it as
separate orgs with a shared owner. Acceptable; nobody has asked.

**Scope note.** `person_tags` is a §7-style *delta* — flagged in [§10.9](#109-proposed-workflow-deltas-acceptreject-individually), not assumed.

---

### D8 — Attendance: mutable row, with an append-only event log beside it

**Choice.** Keep `attendance` as a mutable projection, unique on `(event_id, person_id)`. Every
mutation also appends to `domain_events` in the same transaction.

**Why.** Full event sourcing means every read of "who is here" replays a log or maintains a projection
anyway — we would build the projection regardless, and then own two systems. The audit trail the brief
asks for ("who checked this person in, when, from which device") is satisfied entirely by the log.

**Trade-off.** Row and log can theoretically drift. Mitigated by the shared transaction plus a nightly
reconciliation job that replays the log for a sample of events and alerts on mismatch.

---

### D9 — Public and kiosk split: one stays anonymous, one gets a scoped device token

**Choice.** They are two different problems and get two different answers.

| Surface | Today | Target |
|---|---|---|
| **Public attendee page** `/e/$id` | Unauthenticated router mounted before auth ([`index.ts:127`](../services/core/src/index.ts#L127)) — correct shape | Stays a separate unauthenticated router, now rate-limited and capacity-aware |
| **Kiosk** `/checkin/$id` | Runs inside the authenticated console — the door tablet holds a **full org session** | A scoped **device token**: `checkin:record` on exactly one event, revocable, expiring, issued by an org admin |

**Why.** A tablet propped by a door is the least physically secure thing in the system, and today it
carries the same credential as the owner's laptop. Scoping it is the single highest-value security
change after tenancy itself.

**Trade-off.** New pairing flow (an org admin generates a code on `/events/$id`, the tablet enters it).
This is a **workflow delta** — see [§10.9](#109-proposed-workflow-deltas-acceptreject-individually). Reject it and the kiosk keeps a
full session; everything else in this plan still stands.

---

### D10 — Existing data: fresh database, one-shot scripted import, no dual-write

**Choice.** Provision the new Postgres. Write a single import script that carries over
`organizations`, real `users` → `accounts` + `people`, `events`, and `attendance`. Drop `loyalty`
entirely. Drop the seeded `*@example.com` fixtures ([`db/seed.ts`](../services/core/src/db/seed.ts) —
visible as 30-odd "Member" rows in [`tablet-attendees.png`](../audit/shots/tablet-attendees.png)).
Re-seed a realistic dev dataset instead.

**Why.** The live corpus is one real organisation, ~34 person rows of which most are seed fixtures, two
events, and a single-digit number of real attendance rows. Building a dual-write/backfill apparatus
for that is many times more work than the data is worth, and it would drag the old schema's defects
into the new one.

**Trade-off.** A cutover window (minutes) during which writes are refused. Acceptable — there is one
tenant. Rollback is "point DNS/env back at the old instance", which stays untouched and read-only.

---

### D11 (new) — Client-supplied ids + mandatory idempotency keys

**Choice.** `POST` bodies **may** carry an `id` (UUIDv7, client-generated). The server honours it.
All state-changing `POST`s **must** carry an `Idempotency-Key` header; replays return the original
response.

**Why.** This is the structural fix the brief asks for in §3.2. `persisted-ids.ts` exists purely
because the client's id is discarded and a different one minted
([`crud-factory.ts:148`](../services/core/src/util/crud-factory.ts#L148)). Honour the client's id and
the entire class of bug — the optimistic row, the dangling FK, the redirect to a row that will never
exist — cannot occur. Idempotency keys separately fix the "double-tap check-in on a flaky tablet"
case, which the current code cannot handle at all.

**Trade-off.** A malicious client can choose ids. Harmless: ids are not capabilities (authorization is
independent of id knowledge), and a collision is a `409`.

---

### D12 (new) — The attendee pass becomes a signed token

**Choice.** Pass payload goes from `{eventId}:{userId}` to `CP1.{base64url(payload)}.{sig}` — an HMAC
over `{eventId, personId, exp}`, keyed per organisation, issued by `GET /events/{id}/passes/{personId}`.
The kiosk `POST`s the whole string; the server verifies and resolves.

**Why.** The current format is forgeable by anyone who knows two ids, and the kiosk "validates" it by
scanning a full client-side user cache
([`CheckIn/index.tsx:161`](../apps/web/src/Pages/CheckIn/index.tsx#L161)) — so validity depends on what
happens to be in a browser's memory. Also: passes should expire.

**Trade-off.** Printed/screenshotted passes expire (set `exp` = event end + 24h, so this never bites in
practice). The **event share URL** `{origin}/e/{eventId}` is *unchanged* — it is a URL, it is meant to
be public, and posters in the wild keep working.

---

### D13 (new) — ICS is served by the API

**Choice.** `GET /api/v1/events/{id}/calendar.ics`, unauthenticated (the event is already public via
`/e/{id}`). The client's "Add to calendar" becomes a link to it.

**Why.** Three reasons the client cannot satisfy: a *series* needs a real recurring `VEVENT` with an
`RRULE` and `EXDATE`s; calendar apps subscribe to a URL and expect updates; and the current
implementation ([`EventView/index.tsx:146`](../apps/web/src/Pages/Events/EventView/index.tsx#L146))
emits `\n` line endings and no `UID`/`DTSTAMP`, which is invalid ICS that some clients reject.

**Trade-off.** One more public endpoint to rate-limit. Trivial.

---

### D14 (new) — Scalar for docs, `openapi-fetch` for the client

**Choice.** Serve Scalar (`@scalar/hono-api-reference`) at `/api/v1/docs`, keep raw `/api/v1/openapi.json`.
Generate types with `openapi-typescript`, call with `openapi-fetch`.

**Why.** Scalar renders large specs far better than Swagger UI and has a first-class Hono integration
and a built-in request runner. `openapi-fetch` is ~6 kB, fully typed from the generated `paths` type,
and generates *no* client code to review — so the generated artifact is one `.d.ts`, not a directory of
classes.

**Trade-off.** Swagger UI is more familiar. The raw JSON is still served, so anyone can point their own
tool at it.

---

### D15 (new) — Entitlements now, Stripe deferred

**Choice.** Build `EntitlementService` and serve entitlements from `GET /me/context`. Plan changes go
through an admin-only endpoint plus a Stripe **webhook handler stub** that verifies signatures and
updates `organizations.plan`. Defer: checkout sessions, the customer portal, proration, dunning.

**Why.** The analytics page must gate on something real *today* — it currently gates on a `localStorage`
boolean ([`contexts/premium.tsx:16`](../apps/web/src/contexts/premium.tsx#L16)). Nothing else about the
product is blocked on taking money.

**Trade-off.** Upgrading a customer is a manual DB/admin action until checkout lands. With one tenant,
correct.

---

### D16 (new) — Anonymous guests get a lazy account; they do not get someone else's org

**Choice.** Differ from [MULTI-TENANCY.md §Phase 0](MULTI-TENANCY.md), which recommends guests get no
user row at all.

- An anonymous **session on the public page** (`/e/$id`) creates **no** account. Registering creates a
  `person` row in the *event's* org. Correct today, unchanged.
- An anonymous **guest sign-in from `/login`** creates an `account` with `is_guest = true` **lazily, on
  first write** (i.e. when they create an organisation). Until then they have zero memberships and land
  on onboarding.
- `/upgrade` converts the guest account into a permanent one by attaching a real `identity` — which is
  exactly what that screen already claims to do.

**Why.** The brief's §2 says screens and workflows must not change. "Continue as guest" on `/login`
([`tablet-landscape-login.png`](../audit/shots/tablet-landscape-login.png)) currently lands you in the
console; blocking guests from the console entirely *changes that workflow*. Letting a guest reach the
console with **zero memberships** preserves the flow and removes the leak — the guest sees onboarding,
not Kharis Church. It also gives `/upgrade` a real job.

**Trade-off.** Guest accounts accumulate. Mitigated by a cleanup job deleting guest accounts with no
memberships and no activity after 30 days.

> This decision is about **console** guests. The attendee surface is a different problem with a
> different answer — see [D17](#d17-new--the-attendee-surface-the-eventbrite-pattern).

---

### D17 (new) — The attendee surface: the Eventbrite pattern

**The scenario, stated exactly.** Someone sends you a link to their event. You have no app, no account,
and no relationship with the organisation running it. You must be able to register, get something you
can show at the door, and still have it tomorrow. And doing all that must **not** make you a member of
their organisation.

**How Eventbrite actually does it**, and what each part is really solving:

| Step | Eventbrite | The problem it solves |
|---|---|---|
| Open link | Full public event page, no auth, works in any browser | Zero-friction reach — the link is the product's distribution |
| Register | Name + email, no password | An account requirement here loses most of the funnel |
| Get ticket | **Emailed**, as a durable URL with a QR | The browser tab is not storage. Email is the one address everyone already has |
| Come back later | Reopen the emailed link — no sign-in | The ticket is a **bearer capability**, not a session |
| Optionally sign in | "My Tickets" spans **every** organiser you've ever registered with | An attendee's identity is personal, not tenant-scoped |
| Never | Registering makes you staff at the organiser's account | Attending ≠ belonging |

**The architectural consequence — and the thing the current model gets wrong.** There are **two account
contexts**, and CredoPass models only the first:

```mermaid
flowchart LR
    A["account<br/>(a human)"] -->|org_memberships| ORG["organisation scope<br/>console · tenant-scoped<br/>scope: 'organization'"]
    A -->|"people.account_id<br/>(0..n, across many orgs)"| ME["personal scope<br/>my tickets · my history<br/>scope: 'account'"]
    ANON["no account at all"] -->|"pass token in a URL"| PASS["bearer scope<br/>/p/{token} — one pass<br/>scope: 'public'"]
    style ORG fill:#efe,stroke:#0a0
    style ME fill:#eef,stroke:#00a
    style PASS fill:#ffe,stroke:#a80
```

**Choice — three access modes, deliberately distinct:**

1. **Bearer pass (no account).** Registering returns and emails `/p/{passToken}` — a durable URL
   carrying a signed, event-scoped, long-lived token ([D12](#d12-new--the-attendee-pass-becomes-a-signed-token)).
   Opening it shows the pass, the QR, the event details, "add to calendar", and a check-in button if
   `allow_self_check_in`. **This is the whole answer to "I don't have the app".** It needs no session,
   no cookie, and no account — the URL *is* the credential, which is the same trust model as every
   ticket, boarding pass and password-reset link in existence.
2. **Personal scope (has an account).** `GET /me/tickets` returns every registration across **every**
   organisation, plus `GET /me/attendance-history`. These are `scope: 'account'` routes: self-scoped,
   never org-scoped, and they read *only* rows where `people.account_id = me`.
3. **Organisation scope.** Unchanged — `org_memberships` and nothing else grants it.

**Registration never grants membership.** `AttendanceService.register()` and every public endpoint are
structurally incapable of writing `org_memberships` — they receive a `TenantContext` whose permission
set does not contain `member:invite`, and the repository layer for `org_memberships` is not reachable
from those services. Backed by adversarial test **T29**.

**Claiming.** When someone with a verified email signs in, `POST /me/claim` links every `people` row
whose email matches their **verified** address (`identities` → provider-asserted `email_verified`),
across all orgs, setting `people.account_id`. Prior anonymous registrations appear in "My tickets"
retroactively. Unverified email never claims anything — that would be account takeover by typo.

**Why not just require an account to register?** It is the single biggest drop-off point in event
registration, and for CredoPass's actual users — a church door, a society meetup — demanding account
creation from a walk-in defeats the product's premise. It also does not make the security model
simpler: the door still needs a bearer credential, so you build `/p/{token}` either way.

**Trade-off.** A pass URL is a bearer capability: anyone it is forwarded to can view the pass and, if
self check-in is on, use it. Mitigations: the token is scoped to one event and one person, expires at
`end_at + 24h`, is revocable, is rate-limited, and a check-in is idempotent — so a forwarded pass can
check that *one* person in *once*, which is precisely the risk a paper ticket already carries.
Passes are never listed or enumerable; the only way to hold one is to have been sent it.

---

### D18 (new) — Transactional email is infrastructure, not a feature

**Choice.** Add a `Mailer` port with a **Resend** adapter, plus an `email_deliveries` table for
idempotency, auditing and retries. Templates rendered server-side with React Email.

**Why.** [D17](#d17-new--the-attendee-surface-the-eventbrite-pattern) is not implementable without it —
"the pass is emailed" is the whole mechanism. It is also the prerequisite for invitations (D-B), which
the brief already lists as a gap. There is currently **no** mail capability anywhere in the repo.

Six messages, all of them load-bearing, none of them marketing:

| Message | Trigger |
|---|---|
| Your pass for *{event}* | registration (public or staff-side) |
| Your pass (resent) | `POST /public/events/{id}/resend-pass` |
| *{event}* has been cancelled | `event.cancelled`, to everyone registered |
| *{event}* details changed | `event.updated` where time or location moved |
| You've been invited to *{org}* | invitation created (D-B) |
| Sign-in link | passwordless attendee sign-in |

**Why Resend.** Good DX, React Email is first-party, generous free tier, simple webhook for
bounce/complaint handling. The adapter is ~80 lines behind a port, so switching to Postmark or SES is a
file.

**Trade-off.** A new external dependency on the critical registration path. Mitigated by making the
send **asynchronous and non-blocking**: registration returns the pass URL in the response body
immediately and always, and enqueues the email. A mail outage degrades to "you saw your pass but
didn't get the email" — never to a failed registration. `POST /events/{id}/resend-pass` is the manual
recovery.

**Deliverability is not optional:** SPF, DKIM and DMARC on the sending domain, before the first send.

---

### D19 (new) — The pass URL is the canonical attendee artefact

**Choice.** `/p/{passToken}` is a first-class route in `apps/web`, rendered standalone (no app shell,
no auth). The QR encodes `CP1.{payload}.{sig}` — the same token that is in the URL.

**Why.** One artefact serves every case: the email links to it, the door scans the QR on it, the
attendee bookmarks it, and "add to calendar" hangs off it. The alternative — a QR that exists only
inside one React state — is what the product has today, and it is why a closed tab loses your pass.

**Trade-off.** A new public route to design and rate-limit. It reuses `EventView`'s public variant
almost entirely, so the design cost is small.

---

## 3. Target data model

### 3.1 ER diagram

```mermaid
erDiagram
    ACCOUNTS ||--o{ IDENTITIES : "authenticates via"
    ACCOUNTS ||--o{ ORG_MEMBERSHIPS : has
    ACCOUNTS ||--o{ DEVICE_TOKENS : issued
    ORGANIZATIONS ||--o{ ORG_IDENTITY_PROVIDERS : "SSO config"
    ORGANIZATIONS ||--o{ ORG_DOMAINS : "verified domains"
    ORG_IDENTITY_PROVIDERS ||--o{ IDENTITIES : issues
    ATTENDANCE ||--o{ PASSES : "bearer credential"
    PASSES ||--o{ EMAIL_DELIVERIES : "delivered by"
    ORGANIZATIONS ||--o{ ORG_MEMBERSHIPS : has
    ORGANIZATIONS ||--o{ PEOPLE : owns
    ORGANIZATIONS ||--o{ EVENTS : owns
    ORGANIZATIONS ||--o{ EVENT_SERIES : owns
    ORGANIZATIONS ||--o{ INVITATIONS : issues
    ORGANIZATIONS ||--o{ MEDIA_ASSETS : owns
    ORGANIZATIONS ||--o{ DOMAIN_EVENTS : scopes
    ORGANIZATIONS ||--o{ PERSON_TAGS : defines
    PEOPLE ||--o{ ATTENDANCE : "recorded in"
    PEOPLE ||--o| ACCOUNTS : "may be linked to"
    PEOPLE ||--o{ PERSON_TAG_LINKS : tagged
    PERSON_TAGS ||--o{ PERSON_TAG_LINKS : applies
    EVENT_SERIES ||--o{ EVENTS : "materialises to"
    EVENTS ||--o{ ATTENDANCE : records
    EVENTS ||--o{ EVENT_GRANTS : "delegates access"
    EVENTS ||--o{ DEVICE_TOKENS : "scoped to"
    EVENTS ||--o| MEDIA_ASSETS : "cover"
    ACCOUNTS ||--o{ EVENT_GRANTS : receives
```

### 3.2 Table-by-table

Conventions: all ids are `uuid` (v7, time-ordered, client-suppliable per D11). All timestamps are
`timestamptz`. `snake_case` column names — a deliberate break from the current `"camelCase"` quoted
identifiers, which make every hand-written SQL statement and every RLS policy require quoting.

---

#### `accounts` — someone who can sign in

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `citext` UNIQUE NULL | nullable: anonymous guests have none |
| `display_name` | `text` NULL | |
| `avatar_asset_id` | `uuid` FK → `media_assets` NULL | |
| `is_guest` | `boolean` NOT NULL DEFAULT false | |
| `locale` / `timezone` | `text` NULL | `timezone` is IANA; drives ICS + display |
| `last_seen_at` | `timestamptz` NULL | |
| `created_at` / `updated_at` | `timestamptz` NOT NULL | |

Indexes: `UNIQUE(email) WHERE email IS NOT NULL`, `(last_seen_at)`.

---

#### `identities` — issuer ↔ account (D1)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_id` | `uuid` FK → `accounts` ON DELETE CASCADE | |
| `issuer` | `text` NOT NULL | the `iss` claim, verbatim. **The trust anchor** |
| `subject` | `text` NOT NULL | `sub` — Supabase `auth.uid()`, Okta `sub`, … |
| `provider_kind` | `text` NOT NULL | `supabase` · `oidc` · `saml` — selects the verifier |
| `org_identity_provider_id` | `uuid` FK NULL | set when this identity came from a tenant's own IdP |
| `email` | `citext` NULL | as asserted by the issuer |
| `email_verified` | `boolean` NOT NULL DEFAULT false | **gates claiming** (D17) — never trust an unverified address |
| `last_login_at` | `timestamptz` NULL | |
| `created_at` | `timestamptz` NOT NULL | |

Constraints: `UNIQUE(issuer, subject)`. Indexes `(account_id)`,
`(lower(email)) WHERE email_verified` ← the claim path.

> This is the fix for [MULTI-TENANCY.md C1](MULTI-TENANCY.md#2-root-causes), two levels better than the
> `authId` column that document proposes: it supports multiple providers *and* multiple identities per
> account without a schema change, and keying on `issuer` (not a provider *name*) means two tenants can
> both run Okta without colliding.

---

#### `org_identity_providers` — **new**, per-tenant SSO (D1)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK ON DELETE CASCADE | |
| `kind` | `text` NOT NULL | `oidc` · `saml` |
| `display_name` | `text` NOT NULL | "Sign in with Acme SSO" |
| `issuer` | `text` NOT NULL UNIQUE | must match the token's `iss` exactly |
| `jwks_uri` / `metadata_url` | `text` | OIDC / SAML respectively |
| `audience` | `text` NOT NULL | rejected if the token's `aud` differs |
| `default_role` | `org_role` NOT NULL DEFAULT `'viewer'` | JIT provisioning lands here — **deliberately the least privilege** |
| `jit_provisioning` | `boolean` NOT NULL DEFAULT true | |
| `enforce_sso` | `boolean` NOT NULL DEFAULT false | refuse password/social for this org's verified domains |
| `enabled` | `boolean` NOT NULL DEFAULT false | |
| `created_at` / `updated_at` | | |

---

#### `org_domains` — **new**, verified home-realm discovery (D1)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK ON DELETE CASCADE | |
| `domain` | `citext` NOT NULL | `acme.com` |
| `verification_token` | `text` NOT NULL | the DNS TXT value to publish |
| `verified_at` | `timestamptz` NULL | **null ⇒ the domain does nothing at all** |
| `created_at` | | |

Constraints: `UNIQUE(domain) WHERE verified_at IS NOT NULL` — a verified domain belongs to exactly
one org.

> **Why verification is mandatory, not a nicety.** Without it, anyone signs up, claims `gmail.com`,
> enables `enforce_sso`, and now controls the sign-in path for every Gmail address. Public-suffix
> domains (`gmail.com`, `outlook.com`, …) are additionally blocklisted regardless of DNS proof.

---

#### `organizations` — **the** tenant boundary (D7)

Carried over from [`tables/organizations.ts`](../packages/lib/src/schemas/tables/organizations.ts) with
changes:

| Column | Type | Change |
|---|---|---|
| `id`, `name`, `slug`, `plan`, `stripe_customer_id`, `stripe_subscription_id`, `deleted_at`, timestamps | — | **kept** |
| `external_auth_endpoint`, `external_auth_api_key` | — | **dropped** — nothing implements them (brief §7); re-add with an encrypted-secret store when `external_auth` is actually built |
| `timezone` | `text` NOT NULL DEFAULT `'UTC'` | **added** — the org's default event timezone (D3 needs it) |
| `settings` | `jsonb` NOT NULL DEFAULT `'{}'` | **added** — non-relational preferences; never queried on |

Indexes: `UNIQUE(slug)`, `(plan)`, `(stripe_customer_id)`.

---

#### `org_memberships` — an account's role in an org

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK → `organizations` ON DELETE CASCADE | |
| `account_id` | `uuid` FK → `accounts` ON DELETE CASCADE | |
| `role` | `org_role` enum | `owner` · `admin` · `organizer` · `checkin` · `viewer` (§6) |
| `status` | `text` NOT NULL DEFAULT `'active'` | `active` · `suspended` |
| `provisioned_by` | `text` NOT NULL DEFAULT `'manual'` | `manual` · `jit` · `scim` — SCIM-ready without a later migration (D1) |
| `external_id` | `text` NULL | the IdP's own id for this membership; SCIM's join key |
| `created_at` / `updated_at` | | |

Constraints: `UNIQUE(organization_id, account_id)`. Indexes `(account_id)` ← **hot: every request**,
`(organization_id, role)`.

**Changed:** `invited_by`/`invited_at`/`accepted_at` move out to a real `invitations` table — an
invitation to someone who does not yet have an account cannot be a membership row, which is precisely
why the current columns are unwired.

---

#### `invitations` — **new** (unblocks brief §7)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK ON DELETE CASCADE | |
| `email` | `citext` NOT NULL | |
| `role` | `org_role` NOT NULL | |
| `token_hash` | `text` NOT NULL | SHA-256 of the emailed token; the token itself is never stored |
| `invited_by_account_id` | `uuid` FK → `accounts` ON DELETE SET NULL | |
| `expires_at` | `timestamptz` NOT NULL | default +14 days |
| `accepted_at`, `revoked_at` | `timestamptz` NULL | |
| `created_at` | | |

Constraints: `UNIQUE(organization_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL`.

---

#### `people` — a tenant-scoped attendee record (**the keystone change**)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK ON DELETE CASCADE | **the tenant column** |
| `account_id` | `uuid` FK → `accounts` ON DELETE SET NULL | set when this person also signs in. **Set by claiming** (D17), never by registering |
| `first_name`, `last_name` | `text` NOT NULL | |
| `email` | `citext` NULL | |
| `phone` | `text` NULL | |
| `avatar_asset_id` | `uuid` FK NULL | |
| `notes` | `text` NULL | |
| `deleted_at` | `timestamptz` NULL | soft delete — attendance history must survive |
| `created_at` / `updated_at` | | |

Constraints: `UNIQUE(organization_id, lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL`.
Indexes: `(organization_id, last_name, first_name)`, `(account_id)`,
and a trigram index on `(organization_id, first_name || ' ' || last_name || ' ' || email)` for server-side search.

> **`account_id` is the hinge of the two-scope model** (D17). Org-scoped reads never look at it —
> they filter on `organization_id`. Personal-scoped reads (`GET /me/tickets`) look at *only* it, across
> every org. One column, two entirely separate access paths, neither able to reach the other's rows.

> **Why this is the keystone.** Today `users.email` is *globally* unique
> ([`tables/users.ts:10`](../packages/lib/src/schemas/tables/users.ts#L10)). Two churches cannot both have
> `john@gmail.com` on their rolls; the first one to check him in owns the row, and the second one's
> check-in silently attaches to a person the first org can read. Tenant-scoping the uniqueness is not
> an optimisation — it is the difference between a multi-tenant product and a shared spreadsheet.

---

#### `event_series` — **new** (D3)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK ON DELETE CASCADE | |
| `name`, `description` | `text` | |
| `rrule` | `text` NOT NULL | RFC 5545, e.g. `FREQ=WEEKLY;BYDAY=SU` |
| `timezone` | `text` NOT NULL | IANA; the DST authority |
| `anchor_start_local` | `time` NOT NULL | wall-clock start, e.g. `10:00` |
| `duration_minutes` | `integer` NOT NULL | |
| `template` | `jsonb` NOT NULL | location, capacity, check-in config for new occurrences |
| `materialised_through` | `timestamptz` NOT NULL | horizon watermark |
| `ends_at` | `timestamptz` NULL | series end, if any |
| `deleted_at`, timestamps | | |

---

#### `events`

| Column | Type | Change |
|---|---|---|
| `id`, `organization_id`, `name`, `description`, `capacity`, `deleted_at`, timestamps | — | **kept** |
| `status` | — | **dropped.** No enum replaces it — status is derived from timestamps (D2) |
| `start_at`, `end_at` | `timestamptz` NOT NULL | **changed**: `end_at` becomes genuinely NOT NULL. The "no end time ⇒ assume 1 hour" rule ([`collections/events.ts:36`](../packages/api-client/src/collections/events.ts#L36)) becomes a *write-time default*, so no reader ever has to guess |
| `timezone` | `text` NOT NULL | **new** — needed for correct display + ICS + DST |
| `location_text` | `text` NOT NULL | renamed from `location` |
| `location_lat`, `location_lng` | `double precision` NULL | **new** — server-side geocode on write (see [§10.3](#103-eventsid--event-detail)) |
| `location_resolved_at` | `timestamptz` NULL | **new** |
| `short_code` | `text` NOT NULL | **new** — the door code the UI already shows as `#F6F82EC3–09D`; now a real collision-checked 8-char code |
| `check_in_methods` | `text[]` NOT NULL DEFAULT `'{qr}'` | **kept** |
| `require_check_out` | `boolean` NOT NULL DEFAULT false | **kept** (now actually reachable — §7 delta) |
| `allow_self_check_in` | `boolean` NOT NULL DEFAULT true | **kept** |
| `enforce_capacity` | `boolean` NOT NULL DEFAULT false | **new** — capacity is stored and displayed but never enforced (brief §7) |
| `cover_asset_id` | `uuid` FK → `media_assets` NULL | **new** — the `imageUrl` seam already cast in place at [`CheckIn/index.tsx:207`](../apps/web/src/Pages/CheckIn/index.tsx#L207) |
| `series_id` | `uuid` FK → `event_series` ON DELETE SET NULL | **new** |
| `occurrence_start` | `timestamptz` NULL | **new** — the un-shifted anchor; identity of an occurrence across moves |
| `is_exception` | `boolean` NOT NULL DEFAULT false | **new** — this occurrence diverges from the series |
| `opened_at`, `closed_at`, `cancelled_at` | `timestamptz` NULL | **new** — the recorded facts that *are* the status (D2). `cancelled_at` also answers "when was it cancelled" for free |
| `cancellation_reason` | `text` NULL | **new** — shown on the public page and in the cancellation email (D18) |

Indexes: `(organization_id, start_at DESC)` ← the list query,
`(series_id, occurrence_start)`, `UNIQUE(short_code)`, `(start_at) WHERE closed_at IS NULL AND cancelled_at IS NULL`
← the scheduler's sweep, `(organization_id) WHERE deleted_at IS NULL`.

> **Note what is absent.** There is no `status` column, no `lifecycle` column, and no enum for either.
> The four statuses the UI renders are a pure function of `(cancelled_at, closed_at, start_at, end_at,
> now)` — see [D2](#d2--no-lifecycle-enum-status-is-derived-from-timestamps). A status that cannot be
> stored cannot go stale, which is the bug the current `status` column has today.

---

#### `event_grants` — replaces `event_members`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK | denormalised for RLS (see [§7.2](#72-layer-2--rls)) |
| `event_id` | `uuid` FK ON DELETE CASCADE | |
| `account_id` | `uuid` FK ON DELETE CASCADE | |
| `role` | `event_role` enum | `organizer` · `co_host` · `staff` |
| `created_at` / `updated_at` | | |

Constraints: `UNIQUE(event_id, account_id)`.

> **Semantic change, and it matters.** `event_members` today is doing two unrelated jobs: delegating
> *management* of an event, and recording that a *person signed up*. The attendees page reads it as
> sign-ups ([`Attendees/index.tsx:390`](../apps/web/src/Pages/Attendees/index.tsx#L390)) while the API
> and table comments describe it as roles. `event_grants` keeps only the delegation job; **sign-ups are
> an `attendance` row with `state = 'registered'`**, which is what the public flow already writes.

---

#### `attendance`

| Column | Type | Change |
|---|---|---|
| `id`, `organization_id`, `event_id` | — | **kept** (org stays denormalised — correct, and now load-bearing for RLS) |
| `patron_id` → `person_id` | `uuid` FK → `people` | **renamed + retargeted** |
| `attended` | — | **dropped**, replaced by `state` |
| `state` | `attendance_state` enum NOT NULL | **new** — `registered` · `attended` · `no_show` · `cancelled`. Replaces the `attended` boolean *and* the render-time no-show inference ([`Attendees/index.tsx:404`](../apps/web/src/Pages/Attendees/index.tsx#L404)) |
| `registered_at` | `timestamptz` NULL | **new** |
| `check_in_time`, `check_out_time` | | **kept** |
| `check_in_method` | enum | **kept** |
| `checked_in_by_account_id` | `uuid` FK NULL | **new** — audit ("who checked this person in") |
| `checked_in_by_device_id` | `uuid` FK NULL | **new** — audit ("from which device") |
| `notes` | | **kept** |
| `created_at` / `updated_at` | | **added** — the current table has neither |

Constraints: `UNIQUE(event_id, person_id)`. Indexes: `(event_id, state)` ← the attendee list,
`(person_id, state)` ← lifetime counts, `(organization_id, check_in_time DESC)`,
partial `(event_id) WHERE state = 'attended'` ← the live counter.

---

#### `passes` — **new**, the attendee's bearer credential (D17, D19)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK ON DELETE CASCADE | |
| `event_id` | `uuid` FK ON DELETE CASCADE | |
| `person_id` | `uuid` FK → `people` ON DELETE CASCADE | |
| `token_hash` | `text` NOT NULL UNIQUE | SHA-256. **The token itself is never stored** — it exists only in the URL we emailed |
| `issued_at` | `timestamptz` NOT NULL | |
| `expires_at` | `timestamptz` NOT NULL | default `event.end_at + 24h` |
| `revoked_at` | `timestamptz` NULL | |
| `last_viewed_at`, `view_count` | | abuse signal: a pass viewed from 40 IPs has been forwarded around |
| `created_at` | | |

Constraints: `UNIQUE(event_id, person_id) WHERE revoked_at IS NULL`. Index `(token_hash)`.

> A row per pass — rather than a purely stateless signed token — is what makes revocation, expiry
> extension, and "this pass has been viewed 40 times" possible. Verification is still one indexed
> lookup on a hash, and the signature is checked *before* the lookup so an unsigned guess never
> reaches the database.

---

#### `email_deliveries` — **new** (D18)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK NULL | null for platform mail (sign-in links) |
| `to_email` | `citext` NOT NULL | |
| `template` | `text` NOT NULL | `pass_issued` · `event_cancelled` · `invitation` · … |
| `context_type` / `context_id` | `text` / `uuid` | e.g. `pass` / the pass id |
| `idempotency_key` | `text` NOT NULL UNIQUE | stops a retry storm double-mailing an attendee |
| `state` | `text` NOT NULL | `queued` · `sent` · `delivered` · `bounced` · `complained` · `failed` |
| `provider_message_id` | `text` NULL | |
| `attempts` | `integer` NOT NULL DEFAULT 0 | |
| `last_error` | `text` NULL | |
| `sent_at`, `created_at` | | |

Indexes: `(state, created_at)` ← the retry sweep, `(to_email, created_at DESC)`,
`(context_type, context_id)`.

A hard bounce or complaint marks the address suppressed; the UI surfaces "we couldn't reach this
address" on the attendee row rather than silently failing forever.

---

#### `domain_events` — **new** (D4, D8)

| Column | Type | Notes |
|---|---|---|
| `seq` | `bigserial` PK | global monotonic ordering; the SSE cursor |
| `id` | `uuid` UNIQUE NOT NULL | stable public id |
| `organization_id` | `uuid` FK ON DELETE CASCADE | tenant scope |
| `aggregate_type` | `text` NOT NULL | `event` · `attendance` · `organization` · `membership` |
| `aggregate_id` | `uuid` NOT NULL | |
| `type` | `text` NOT NULL | `event.cancelled`, `attendance.recorded`, `pass.issued`, … ([§8.1](#81-lifecycle-events)) |
| `version` | `integer` NOT NULL DEFAULT 1 | payload schema version |
| `payload` | `jsonb` NOT NULL | |
| `actor_account_id` | `uuid` NULL | |
| `actor_device_id` | `uuid` NULL | |
| `actor_kind` | `text` NOT NULL | `account` · `device` · `public` · `system` |
| `occurred_at` | `timestamptz` NOT NULL DEFAULT now() | |

Indexes: `(organization_id, seq)`, `(aggregate_type, aggregate_id, seq)`,
`(organization_id, type, occurred_at)` ← the analytics substrate.
Partitioned by month once it exceeds ~10M rows; not at MVP.

---

#### `device_tokens` — **new** (D9)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK ON DELETE CASCADE | |
| `event_id` | `uuid` FK ON DELETE CASCADE NULL | null = org-wide kiosk |
| `label` | `text` NOT NULL | "Main door", "Side entrance" |
| `token_hash` | `text` NOT NULL | |
| `scopes` | `text[]` NOT NULL | e.g. `{checkin:record, event:read}` |
| `issued_by_account_id` | `uuid` FK NULL | |
| `expires_at` | `timestamptz` NOT NULL | |
| `revoked_at`, `last_used_at` | `timestamptz` NULL | |
| `created_at` | | |

---

#### `media_assets` — **new** (§5.5)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK ON DELETE CASCADE | |
| `kind` | `text` NOT NULL | `event_cover` · `avatar` |
| `storage_key` | `text` NOT NULL UNIQUE | the S3 key ([§9.1](#91-s3-layout-and-upload-flow)) |
| `content_type`, `byte_size`, `width`, `height` | | populated on attach after a HEAD |
| `checksum` | `text` NULL | |
| `state` | `text` NOT NULL DEFAULT `'pending'` | `pending` · `attached` · `orphaned` |
| `derivatives` | `jsonb` NOT NULL DEFAULT `'{}'` | `{ "800": key, "400": key, "thumb": key }` |
| `uploaded_by_account_id` | `uuid` FK NULL | |
| `created_at` / `updated_at` | | |

---

#### `idempotency_keys` — **new** (D11)

`(key, account_or_device_id)` PK · `request_fingerprint` · `response_status` · `response_body jsonb` ·
`created_at`. Rows older than 24 h are swept nightly.

---

#### `rate_limit_buckets` — **new** (D6)

`(bucket_key)` PK · `tokens double precision` · `refilled_at timestamptz`. One upsert per request on
`/public/*` only.

---

#### `person_tags` / `person_tag_links` — **new**, and a *proposed delta* (D7)

`person_tags`: `id` · `organization_id` · `name` · `color` · `UNIQUE(organization_id, lower(name))`.
`person_tag_links`: `person_id` · `tag_id`, PK on both.

---

### 3.3 Explicit diff against the current 7 tables

| Current table | Fate |
|---|---|
| `organizations` | **kept**, +`timezone` +`settings`, −`externalAuthEndpoint` −`externalAuthApiKey` |
| `org_memberships` | **kept**, role enum changed, +`provisioned_by` +`external_id`, invitation columns extracted to `invitations` |
| `users` | **split** → `accounts` (identity) + `people` (tenant-scoped attendee) + `identities` |
| `events` | **kept**, heavily extended; **`status` dropped with no enum replacing it** (D2); series columns; geo; media |
| `event_members` | **renamed + narrowed** → `event_grants` (delegation only; sign-ups move to `attendance`) |
| `attendance` | **kept**, `attended` boolean → `state` enum; `patronId` → `person_id`; audit columns |
| `loyalty` | **dropped** (brief §4.1) |

**Added (15):** `accounts` · `identities` · `org_identity_providers` · `org_domains` · `people` ·
`invitations` · `event_series` · `passes` · `email_deliveries` · `domain_events` · `device_tokens` ·
`media_assets` · `idempotency_keys` · `rate_limit_buckets` · `person_tags` + `person_tag_links`.

**Enums removed:** `events.status` (5 values) and rev 1's proposed `events.lifecycle` (3 values) —
both gone, replaced by two nullable timestamps (D2).

**Net:** 7 tables → 21 (22 counting the tag link table). Read the growth honestly: it is almost
entirely *capabilities that did not exist* — enterprise SSO (2), attendee passes and email (2), audit
(1), media (1), series (1), invitations (1), idempotency and rate limiting (2). Only **one** table is
decomposition of something that already existed (`users` → `accounts` + `people` + `identities`), and
that one is the fix for the tenancy leak.

---

## 4. Domain services catalogue

Every module lives in `services/core/src/services/`, imports **no** framework, and receives its
dependencies through a single `Deps` object:

```ts
// services/core/src/services/deps.ts — shape only, not an implementation
export interface Deps {
  db: Db;                    // Drizzle instance, already tenant-bound (see §7.1)
  clock: Clock;              // { now(): Date } — injectable so tests control time
  bus: EventBus;             // { emit(e: DomainEventInput): Promise<void> }
  storage: Storage;          // presign / head / delete
  geocoder: Geocoder;        // forward-geocode a location string
  ids: IdGenerator;          // uuidv7()
  logger: Logger;
}
```

Every public function takes `(deps: Deps, ctx: TenantContext, input: T)`. `TenantContext` is
non-forgeable ([§7.1](#71-layer-1--application-scoping)).

---

### 4.1 `IdentityService`

| | |
|---|---|
| **Responsibility** | Resolve a verified token into a caller. Own accounts, identities, per-tenant IdPs and domain verification (D1). |
| **Public functions** | `resolveCaller(deps, { issuer, subject, claims }): Caller` · `linkIdentity` · `upgradeGuest` · `ensureAccountForGuest` · `discoverRealm(email)` → which IdP · `configureIdP(ctx, config)` · `verifyDomain(ctx, domainId)` · `jitProvision(idp, claims)` |
| **Invariants** | An `(issuer, subject)` pair maps to exactly one account. **`email` never identifies a caller** — only `(issuer, subject)` does. A guest account is created **lazily**, never on token verification alone (D16). An unverified `org_domain` has no effect on sign-in. JIT provisioning grants `default_role` and never more. Public-suffix domains can never be claimed. |
| **Backs** | `/login`, `/upgrade`, enterprise SSO, every authenticated request |

### 4.1a `TicketService` — the attendee's own view (D17)

| | |
|---|---|
| **Responsibility** | Everything an attendee sees about themselves, **across organisations**. The only `scope: 'account'` service. |
| **Public functions** | `myTickets(accountId, { upcoming \| past, cursor })` · `myAttendanceHistory(accountId)` · `claimByVerifiedEmail(accountId)` → `{ claimed: n }` · `passPage(token)` → the public pass projection |
| **Invariants** | Reads **only** rows where `people.account_id = accountId`; it has no `TenantContext` and cannot obtain one. `claimByVerifiedEmail` matches solely on an identity whose `email_verified` is true — an unverified address claims nothing. **It cannot write `org_memberships`**; the repository for that table is not in its dependency graph (T29). |
| **Backs** | `/me/tickets`, `/p/{token}`, the "keep your tickets" path from `/upgrade` |

### 4.1b `NotificationService` (D18)

| | |
|---|---|
| **Responsibility** | Render and enqueue every transactional email; own delivery state. |
| **Public functions** | `sendPass(passId)` · `resendPass(eventId, email)` · `notifyCancelled(eventId)` · `notifyChanged(eventId, diff)` · `sendInvitation(invitationId)` · `sendSignInLink(email)` · `handleProviderWebhook(payload)` |
| **Invariants** | Every send is keyed by `idempotency_key`, so a retry never double-mails. Sending is **asynchronous and never blocks the request** — registration returns the pass URL whether or not mail succeeds. A suppressed (hard-bounced/complained) address is never retried. No email contains a raw pass token in its body text — only the `/p/{token}` link. |
| **Backs** | The whole of D17; invitations (D-B); cancellation notices |

### 4.2 `MembershipService`

| | |
|---|---|
| **Responsibility** | Org creation, memberships, roles, invitations. |
| **Public functions** | `createOrganization` · `listMyOrganizations` · `listMembers` · `inviteMember` · `acceptInvitation` · `revokeInvitation` · `changeRole` · `removeMember` |
| **Invariants** | Creating an org creates the caller's `owner` membership **in the same transaction**. An org always has ≥1 `owner` — the last owner cannot be demoted or removed. A caller can never grant a role above their own. |
| **Backs** | `/profile` (org list + members), `OrgSelector`, onboarding, `/organizations` |

### 4.3 `PeopleService`

| | |
|---|---|
| **Responsibility** | The tenant's roll of attendees. Owns find-or-create by email, and **standing**. |
| **Public functions** | `listPeople(ctx, { q, eventId, standing, cursor, limit })` → rows already carrying `standing` + `eventsAttended` · `getPerson` · `createPerson` · `updatePerson` · `deletePerson` (soft) · `findOrCreateByEmail` · `mergePeople` |
| **Invariants** | Email uniqueness is per-org, case-insensitive, ignoring soft-deleted rows. `findOrCreateByEmail` is atomic (`INSERT … ON CONFLICT DO UPDATE … RETURNING`) — no read-then-write race. Soft delete never removes attendance history. |
| **Backs** | `/attendees`, `/attendees/new`, `/attendees/$id/edit`, the right-sidebar profile view |

> This replaces the ~150-line `useMemo` at
> [`Attendees/index.tsx:342-435`](../apps/web/src/Pages/Attendees/index.tsx#L342-L435) and the full-table
> scan at [`:295`](../apps/web/src/Pages/Attendees/index.tsx#L295).

### 4.4 `EventService`

| | |
|---|---|
| **Responsibility** | The **single authority** on event status. Listing, search, spotlight, summary counts. |
| **Public functions** | `deriveStatus(event, now)` ← *the one implementation, a pure function of timestamps* (D2) · `listEvents(ctx, { group, status[], from, to, q, cursor })` · `getEvent` · `createEvent` · `updateEvent` · `cancel` · `close` · `summary(ctx)` → `{ total, upcoming, ongoing, next }` · `calendarMonth(ctx, month)` |
| **Invariants** | `end_at > start_at`, always (write-time default `start + 1h`, so no reader ever guesses). `deriveStatus` **reads no column that could be stale** — only `cancelled_at`, `closed_at`, `start_at`, `end_at` and the injected clock. `cancel()` sets `cancelled_at` once and is idempotent; it never deletes rows, so passes and the share URL keep resolving. `close()` is idempotent and emits `event.closed` + finalises no-shows exactly once. Geocoding happens on write, never on read. |
| **Backs** | `/events`, `/events/new`, `/events/$id`, `/events/$id/edit`, the calendar rail, the hero spotlight |

### 4.5 `SeriesService`

| | |
|---|---|
| **Responsibility** | Recurrence: expansion, horizon maintenance, exception handling. |
| **Public functions** | `createSeries` · `materialise(seriesId, through)` · `updateOccurrence(eventId, scope: 'this' \| 'this_and_following' \| 'all')` · `cancelOccurrence` · `moveOccurrence` · `deleteSeries(scope)` |
| **Invariants** | Materialisation is idempotent — keyed on `(series_id, occurrence_start)`. An occurrence with `is_exception = true` is **never** overwritten by a series edit. Times are computed in the series' IANA timezone, so a 10:00 service stays 10:00 across a DST boundary. |
| **Backs** | *New capability.* Nothing in the current UI. See [§8.3](#83-recurrence-model). |

### 4.6 `AttendanceService`

| | |
|---|---|
| **Responsibility** | The one place a check-in happens. Registration, check-in, check-out, no-show finalisation, capacity. |
| **Public functions** | `register(ctx, eventId, personInput)` → `{ attendance, person, pass }` · `checkIn(ctx, eventId, { personId \| pass \| personInput }, method, actor)` · `checkOut` · `amend(attendanceId, patch)` · `finaliseNoShows(eventId)` · `liveState(eventId)` → `{ checkedIn, registered, capacity, remaining }` · `listForEvent(eventId, { state, cursor })` |
| **Invariants** | **One row per `(event_id, person_id)`, enforced by the DB, not by a cache read.** `checkIn` is a single transaction: find-or-create person → upsert attendance → append `domain_events` → notify. Idempotent: a second check-in returns `200` with `alreadyRecorded: true` and does **not** move `check_in_time`. Refused when the derived status is `completed`/`cancelled`, or when `enforce_capacity` and the event is full. **`register` issues a pass and enqueues its email in the same transaction, and returns the pass URL in the response regardless of mail outcome** (D17/D18). **Neither function can write `org_memberships`** — registering for an event never grants access to the organisation (T29). |
| **Backs** | `/checkin/$eventId` (all three paths: scan, manual, event-QR), `/e/$eventId`, `/attendees` |

> This replaces [`use-attendee-checkin.ts`](../apps/web/src/Pages/Events/use-attendee-checkin.ts) in its
> entirety — including the line that decides whether a person exists by scanning
> `userCollection.toArray` ([`:42`](../apps/web/src/Pages/Events/use-attendee-checkin.ts#L42)), i.e. by
> asking a browser cache.

### 4.7 `PassService`

| | |
|---|---|
| **Responsibility** | Issue, verify and revoke attendee passes (D12, D19). |
| **Public functions** | `issue(ctx, eventId, personId)` → `{ token, url, expiresAt }` · `verify(token)` → `{ eventId, personId, passId }` · `revoke(passId)` · `rotateOrgKey(orgId)` |
| **Invariants** | HMAC-SHA256 with a per-org key from the secret store. **Signature is checked before any DB lookup**, so an unsigned guess never touches Postgres. Constant-time comparison. Expired, revoked or wrong-event tokens are rejected. The raw token is never persisted — only its SHA-256. Accepts the legacy `{eventId}:{personId}` format only while `PASS_LEGACY_ACCEPT=true` (removed at the end of Phase 3). |
| **Backs** | `/p/{token}`, the pass QR on `/events/$id` and `/e/$id`, the kiosk scanner, the pass email |

### 4.8 `AnalyticsService`

| | |
|---|---|
| **Responsibility** | Real aggregates over `attendance` + `domain_events`, behind the evolved `AnalyticsResponse` contract. |
| **Public functions** | `overview(ctx, { scope, range })` · `export(ctx, { scope, range, format })` |
| **Invariants** | Every number is org-scoped. Reads `domain_events` for time-bucketed series (arrivals-by-hour, check-in methods) and `attendance` for point-in-time counts. Results are cached 60 s per `(org, scope, range)`. Never returns fabricated data — an empty org returns zeroes, not plausible noise. |
| **Backs** | `/analytics` |

### 4.9 `EntitlementService`

| | |
|---|---|
| **Responsibility** | Turn `organizations.plan` into a capability set (D15). |
| **Public functions** | `forOrganization(ctx)` → `Entitlements` · `assert(ctx, capability)` · `applyPlanChange(orgId, plan, source)` |
| **Invariants** | Entitlements are **only** derived server-side. A missing/unknown plan resolves to `free`. Every gated endpoint calls `assert`, so gating is not a UI concern. |
| **Backs** | `/analytics` Pro overlay, `/upgrade`, the `/events` upsell card |

### 4.10 `MediaService`

| | |
|---|---|
| **Responsibility** | Presigned uploads, attachment, derivatives, cleanup (§5.5). |
| **Public functions** | `createUpload(ctx, { kind, contentType, byteSize })` · `attach(ctx, assetId, target)` · `detach` · `sweepOrphans()` |
| **Invariants** | The server **HEADs the object** before attaching — a client cannot claim a size or type. Max 8 MB; `image/jpeg\|png\|webp\|avif` only. Keys are org-prefixed so a presigned URL cannot be aimed at another tenant's prefix. |
| **Backs** | `EventComposer`'s "Add photo" (preview-only today), the kiosk billboard cover, avatars |

### 4.11 `CalendarService`

| | |
|---|---|
| **Responsibility** | Valid ICS for an event or a series (D13). |
| **Public functions** | `eventIcs(eventId)` · `seriesIcs(seriesId)` |
| **Invariants** | CRLF line endings, `UID`, `DTSTAMP`, `SEQUENCE`; series emit `RRULE` + `EXDATE`; folded at 75 octets. |
| **Backs** | "Add to calendar" on `/events/$id` and `/e/$id` |

### 4.12 `EventStreamService`

| | |
|---|---|
| **Responsibility** | Bridge `domain_events` → SSE subscribers (D4/D5). |
| **Public functions** | `subscribe(ctx, eventId, sinceSeq)` → `AsyncIterable<ServerSentEvent>` · `replay(eventId, sinceSeq)` |
| **Invariants** | A subscriber only receives events for orgs it may read. Reconnection with `Last-Event-ID` replays from `domain_events` — no gap, no duplicate delivery below the cursor. Heartbeat comment every 20 s so proxies do not idle out. |
| **Backs** | The kiosk's live "N checked in" counter across multiple doors |

---

## 5. Complete API surface

**Base path:** `/api/v1`. The old `/api/core/*` paths answer `308` for one release so a deployed web
build does not break mid-rollout.

### 5.0 Cross-cutting rules (stated once; every endpoint obeys them)

| Concern | Rule |
|---|---|
| **Auth** | `Authorization: Bearer <jwt>` (Supabase) or `<device-token>`. Resolved once, per request, into a `Caller`. |
| **Tenancy** | Active org from the `X-Organization-Id` header, **validated against the caller's memberships**. Never from a body or query param. Absent + exactly one membership ⇒ that one. Absent + several ⇒ `400 organization_required`. |
| **Pagination** | Cursor only. `?limit=` (default 50, max 200) `&cursor=`. Response: `{ data: [...], page: { nextCursor: string \| null, hasMore: boolean } }`. No offsets, no total counts on list endpoints (counts come from dedicated `/summary` endpoints). |
| **Filtering / sorting** | Explicitly enumerated per endpoint in the Zod query schema. An unknown query param is a `400`, not silently ignored — the opposite of today's `allowedFilters` ([`crud-factory.ts:65`](../services/core/src/util/crud-factory.ts#L65)). |
| **Errors** | RFC 9457 `application/problem+json`: `{ type, title, status, detail, instance, code, errors?: [{path, message}] }`. `code` is a stable machine string (`event_not_found`, `capacity_reached`, `insufficient_permission`). |
| **Not-found vs forbidden** | A resource in another tenant returns **404**, never 403 — existence is not leaked. 403 is reserved for "your own tenant, insufficient role". |
| **Idempotency** | `Idempotency-Key` required on every `POST` that creates or records. Replay within 24 h returns the original status + body. |
| **Versioning** | Major in the path (`/api/v1`). Additive changes ship in place; breaking changes mint `/api/v2`. Every response carries `X-API-Version`. |
| **Rate limits** | `/public/*`: 30 req/min per IP, 10 writes/min per IP per event. Authenticated: 600 req/min per account. `429` + `Retry-After`. |
| **Time** | All timestamps RFC 3339 UTC. Events additionally carry `timezone` so a client renders wall-clock correctly without guessing. |

**Notation below:** `🔓` no auth · `👤` account JWT · `📟` device token · `⚙️` system/cron.
"Perm" is the permission from [§6](#6-authorization-model).

---

### 5.1 Identity and context

| Method | Path | Auth | Perm | Request | Response | Errors | Serves |
|---|---|---|---|---|---|---|---|
| `GET` | `/me` | 👤 | — | — | `Account` | 401 | Greeting on `/events`; `OrgSelector` profile block |
| `PATCH` | `/me` | 👤 | — | `UpdateMe` | `Account` | 400, 401 | `/profile` |
| `GET` | `/me/context` | 👤 | — | — | `{ account, organizations: OrgSummary[], activeOrganization, membership: { role, permissions[] }, entitlements, needsOnboarding: boolean }` | 401 | **The first call every screen makes.** Replaces `OrgSelector`'s unfiltered list + `usePremium` |
| `POST` | `/me/upgrade` | 👤 | — | `{ provider, token }` | `Account` | 400, 409 `already_permanent` | `/upgrade` (guest → real account) |
| `GET` | `/me/invitations` | 👤 | — | — | `Invitation[]` | 401 | Onboarding |
| `GET` | `/me/tickets` | 👤 | — | `?group=upcoming\|past&cursor=` | `Page<Ticket>` — **across every organisation** | 401 | **New** (D17) — the "My Tickets" surface |
| `GET` | `/me/attendance-history` | 👤 | — | `?cursor=` | `Page<AttendedEvent>` | 401 | **New** — personal attendance record |
| `POST` | `/me/claim` | 👤 | — | — | `{ claimed: n, organizations: n }` | 401 | **New** — link prior anonymous registrations matching a **verified** email (D17) |

> **`scope: 'account'`, not `'organization'`.** These four routes are the personal side of the product.
> They take no `X-Organization-Id`, they never consult `org_memberships`, and they read only rows where
> `people.account_id` is the caller. This is the surface that lets an attendee see the eleven events
> they've been to across seven different organisations without being a member of any of them.

### 5.1a Identity providers (enterprise SSO — D1)

| Method | Path | Auth | Perm | Request | Response | Errors |
|---|---|---|---|---|---|---|
| `GET` | `/auth/realm?email=` | 🔓 | — | — | `{ method: 'password'\|'sso', ssoUrl?, providerName? }` | 429 |
| `GET` | `/organizations/{id}/identity-providers` | 👤 | `org:update` | — | `IdentityProvider[]` | 403 |
| `POST` | `/organizations/{id}/identity-providers` | 👤 | `org:update` | `CreateIdP` | `IdentityProvider` | 400, 403, 409 `issuer_taken` |
| `PATCH` | `/organizations/{id}/identity-providers/{idpId}` | 👤 | `org:update` | `UpdateIdP` | `IdentityProvider` | 400, 403, 404 |
| `POST` | `/organizations/{id}/domains` | 👤 | `org:update` | `{ domain }` | `{ domain, verificationToken, dnsRecord }` | 400 `public_suffix`, 403, 409 `claimed` |
| `POST` | `/organizations/{id}/domains/{domainId}/verify` | 👤 | `org:update` | — | `OrgDomain` | 403, 404, 409 `dns_not_found` |
| `DELETE` | `/organizations/{id}/domains/{domainId}` | 👤 | `org:update` | — | `204` | 403, 404 |

`GET /auth/realm` is the only unauthenticated one — home-realm discovery has to work before sign-in. It
is rate-limited hard and returns the **same shape** for unknown and known domains, so it cannot be used
to enumerate which companies are customers.

### 5.2 Organizations and membership

| Method | Path | Auth | Perm | Request | Response | Errors | Serves |
|---|---|---|---|---|---|---|---|
| `POST` | `/organizations` | 👤 | — | `{ id?, name, slug?, timezone? }` | `Organization` | 400, 409 `slug_taken` | Onboarding; "New Organization" |
| `GET` | `/organizations` | 👤 | `org:read` | — | `Organization[]` (**caller's only**) | 401 | `OrgSelector`, `/profile` |
| `GET` | `/organizations/{id}` | 👤 | `org:read` | — | `Organization` | 404 | `/profile` |
| `PATCH` | `/organizations/{id}` | 👤 | `org:update` | `UpdateOrganization` | `Organization` | 400, 403, 404 | `/profile` org editor |
| `DELETE` | `/organizations/{id}` | 👤 | `org:delete` | — | `204` | 403, 404, 409 `has_events` | `/profile` |
| `GET` | `/organizations/{id}/members` | 👤 | `member:read` | `?cursor&limit` | `Page<Member>` | 403, 404 | `/profile` members list |
| `POST` | `/organizations/{id}/invitations` | 👤 | `member:invite` | `{ email, role }` | `Invitation` | 400, 403, 409 `already_member` | **New** (§7 delta) |
| `DELETE` | `/organizations/{id}/invitations/{invId}` | 👤 | `member:invite` | — | `204` | 403, 404 | **New** |
| `POST` | `/invitations/{token}/accept` | 👤 | — | — | `{ organization, membership }` | 404, 410 `expired` | **New** |
| `PATCH` | `/organizations/{id}/members/{accountId}` | 👤 | `member:update_role` | `{ role }` | `Member` | 400, 403, 404, 409 `last_owner` | Replaces `PUT /org-memberships/:id/role` |
| `DELETE` | `/organizations/{id}/members/{accountId}` | 👤 | `member:remove` | — | `204` | 403, 404, 409 `last_owner` | `/profile` |

### 5.3 Events

| Method | Path | Auth | Perm | Request | Response | Errors | Serves |
|---|---|---|---|---|---|---|---|
| `GET` | `/events` | 👤 | `event:read` | `?group=upcoming\|past&status=&from=&to=&q=&seriesId=&cursor=&limit=` | `Page<EventSummary>` — each carries **derived** `status`, `organizationName`, `counts:{registered,attended}` | 400, 403 | `/events` list, `/attendees` scope dropdown |
| `GET` | `/events/summary` | 👤 | `event:read` | `?` | `{ total, upcoming, ongoing, next: EventSummary\|null }` | 403 | Hero spotlight + the `"2 events · 1 upcoming · 0 live now"` subtitle |
| `GET` | `/events/calendar` | 👤 | `event:read` | `?month=YYYY-MM` | `{ days: [{ date, events: EventSummary[] }] }` | 400 | The calendar rail + "July 2026 · 1 EVENT" |
| `POST` | `/events` | 👤 | `event:create` | `CreateEvent` (id optional, D11) | `Event` `201` | 400, 402 `plan_limit`, 403 | `/events/new` |
| `GET` | `/events/{id}` | 👤 | `event:read` | — | `Event` (derived status, geo, `shortCode`, cover, counts) | 404 | `/events/$id` |
| `PATCH` | `/events/{id}` | 👤 | `event:update` | `UpdateEvent` + `?scope=this\|this_and_following\|all` | `Event` | 400, 403, 404, 409 | `/events/$id/edit` |
| `DELETE` | `/events/{id}` | 👤 | `event:delete` | `?scope=` | `204` | 403, 404 | Event row menu |
| `POST` | `/events/{id}/cancel` | 👤 | `event:cancel` | `{ reason?, notifyRegistered?: boolean }` | `Event` | 403, 404, 409 | Event row menu. Sets `cancelled_at`; optionally mails everyone registered (D18) |
| `POST` | `/events/{id}/close` | 👤 ⚙️ | `event:update` | — | `Event` | 403, 404 | Scheduler; manual "end event" |
| `GET` | `/events/{id}/calendar.ics` | 🔓 | — | — | `text/calendar` | 404 | "Add to calendar" (D13) |
| `GET` | `/events/{id}/grants` | 👤 | `event:read` | — | `EventGrant[]` | 403, 404 | Event team panel |
| `PUT` | `/events/{id}/grants/{accountId}` | 👤 | `event:update` | `{ role }` | `EventGrant` | 400, 403, 404 | |
| `DELETE` | `/events/{id}/grants/{accountId}` | 👤 | `event:update` | — | `204` | 403, 404 | |
| `POST` | `/events/{id}/cover` | 👤 | `event:update` | `{ assetId }` | `Event` | 400, 403, 404 | `EventComposer` "Add photo" |

### 5.4 Event series

| Method | Path | Auth | Perm | Request | Response | Errors |
|---|---|---|---|---|---|---|
| `POST` | `/event-series` | 👤 | `series:manage` | `CreateSeries` | `Series` `201` | 400, 403 |
| `GET` | `/event-series` | 👤 | `event:read` | `?cursor` | `Page<Series>` | 403 |
| `GET` | `/event-series/{id}` | 👤 | `event:read` | — | `Series` + `materialisedThrough` | 404 |
| `PATCH` | `/event-series/{id}` | 👤 | `series:manage` | `UpdateSeries` | `Series` | 400, 403, 404 |
| `DELETE` | `/event-series/{id}` | 👤 | `series:manage` | `?scope=future\|all` | `204` | 403, 404 |
| `POST` | `/event-series/{id}/materialise` | 👤 ⚙️ | `series:manage` | `{ through? }` | `{ created: n }` | 403, 404 |

### 5.5 People (attendees)

| Method | Path | Auth | Perm | Request | Response | Errors | Serves |
|---|---|---|---|---|---|---|---|
| `GET` | `/people` | 👤 | `person:read` | `?q=&eventId=&standing=attended\|no-show\|signed-up\|member&tag=&cursor=&limit=` | `Page<PersonRow>` — each carries **`standing`**, **`eventsAttended`**, `checkInTime?`, `role?` | 400, 403 | `/attendees` list. Kills the 150-line `useMemo` |
| `GET` | `/people/summary` | 👤 | `person:read` | `?eventId=` | `{ total, attended, signedUp, noShows }` | 403 | The lime billboard tiles |
| `POST` | `/people` | 👤 | `person:create` | `CreatePerson` | `Person` `201` | 400, 403, 409 `email_taken` | `/attendees/new` |
| `GET` | `/people/{id}` | 👤 | `person:read` | — | `Person` + `stats` + `recentEvents` | 404 | Right-sidebar profile |
| `PATCH` | `/people/{id}` | 👤 | `person:update` | `UpdatePerson` | `Person` | 400, 403, 404 | `/attendees/$id/edit` |
| `DELETE` | `/people/{id}` | 👤 | `person:delete` | — | `204` | 403, 404 | Row menu |
| `POST` | `/people/{id}/merge` | 👤 | `person:update` | `{ sourceId }` | `Person` | 400, 403, 404 | **New** — duplicate cleanup |

### 5.6 Attendance and check-in

| Method | Path | Auth | Perm | Request | Response | Errors | Serves |
|---|---|---|---|---|---|---|---|
| `GET` | `/events/{id}/attendees` | 👤 📟 | `attendance:read` | `?state=&q=&cursor=` | `Page<AttendanceRow>` (person embedded) | 403, 404 | `/attendees?eventId=`, kiosk lookup |
| `POST` | `/events/{id}/register` | 👤 | `attendance:record` | `{ personId } \| { firstName, lastName, email }` | `{ attendance, person }` `201` | 400, 403, 404, 409 `capacity_reached` | Staff-side sign-up |
| `POST` | `/events/{id}/check-in` | 👤 📟 | `attendance:record` | `{ pass } \| { personId } \| { firstName, lastName, email }` + `{ method }` | `{ attendance, person, alreadyRecorded, liveCount }` | 400 `invalid_pass`, 403, 404, 409 `event_closed`\|`capacity_reached` | **The kiosk's one endpoint** — scan, manual and walk-in all land here |
| `POST` | `/events/{id}/check-out` | 👤 📟 | `attendance:record` | `{ personId } \| { pass }` | `{ attendance }` | 400, 404, 409 | **New** (§7 delta) — `requireCheckOut` finally reachable |
| `PATCH` | `/attendance/{id}` | 👤 | `attendance:amend` | `{ state?, notes?, checkInTime? }` | `Attendance` | 400, 403, 404 | Correcting a mis-scan |
| `GET` | `/events/{id}/checkin-state` | 👤 📟 | `attendance:read` | — | `{ checkedIn, registered, capacity, remaining, updatedAt }` | 403, 404 | Kiosk counter on load (SSE takes over after) |
| `GET` | `/events/{id}/stream` | 👤 📟 | `attendance:read` | `Last-Event-ID?` | `text/event-stream` | 403, 404 | **Live counter across doors** (D5) |
| `GET` | `/events/{id}/passes/{personId}` | 👤 | `attendance:read` | — | `{ token, expiresAt, qrValue }` | 403, 404 | The pass QR (D12) |

### 5.7 Devices (kiosk pairing — D9, a proposed delta)

| Method | Path | Auth | Perm | Request | Response |
|---|---|---|---|---|---|
| `POST` | `/events/{id}/devices` | 👤 | `device:manage` | `{ label, expiresAt? }` | `{ device, pairingCode, token }` (token shown **once**) |
| `GET` | `/organizations/{id}/devices` | 👤 | `device:manage` | — | `Device[]` |
| `DELETE` | `/devices/{id}` | 👤 | `device:manage` | — | `204` |
| `POST` | `/devices/pair` | 🔓 | — | `{ pairingCode }` | `{ token, event, expiresAt }` |

### 5.8 Media

| Method | Path | Auth | Perm | Request | Response |
|---|---|---|---|---|---|
| `POST` | `/uploads` | 👤 | `media:upload` | `{ kind, contentType, byteSize }` | `{ assetId, uploadUrl, headers, expiresIn }` |
| `GET` | `/media/{assetId}` | 👤 | `media:read` | — | `MediaAsset` incl. `derivatives` |
| `DELETE` | `/media/{assetId}` | 👤 | `media:upload` | — | `204` |

### 5.9 Analytics

| Method | Path | Auth | Perm | Request | Response | Errors | Serves |
|---|---|---|---|---|---|---|---|
| `GET` | `/analytics/overview` | 👤 | `analytics:read` | `?scope=all\|<eventId>&range=week\|month\|year` | `AnalyticsResponse` (evolved — see [§10.6](#106-analytics)) | 400, 403 | `/analytics` |
| `GET` | `/analytics/export` | 👤 | `analytics:export` | `?scope&range&format=csv\|xlsx` | file | 402 `plan_required`, 403 | The "Export" button |

### 5.10 Public / attendee surface (unauthenticated, rate-limited)

This is the Eventbrite flow ([D17](#d17-new--the-attendee-surface-the-eventbrite-pattern)) end to end.

```mermaid
sequenceDiagram
    autonumber
    participant V as Visitor (no app, no account)
    participant API
    participant Mail
    V->>API: GET /public/events/{id}  ← the shared link
    API-->>V: event page: when, where, capacity left
    V->>API: POST /public/events/{id}/register {name, email}
    API->>API: find-or-create person IN THIS ORG · attendance(registered) · issue pass
    API-->>V: 201 {passUrl: "/p/{token}", pass, attendance}
    API->>Mail: enqueue pass email (async — never blocks the 201)
    Mail-->>V: "Your pass for {event}" → /p/{token}
    Note over V,API: days later, different device, no session
    V->>API: GET /p/{token}
    API-->>V: the pass: QR, event details, add-to-calendar
    V->>API: POST /p/{token}/check-in   (if allow_self_check_in)
    API-->>V: 200 checked in
    Note over V,API: optional, and entirely separate
    V->>API: sign in → POST /me/claim
    API-->>V: this pass, and every other one, now in /me/tickets
```

| Method | Path | Auth | Request | Response | Errors | Serves |
|---|---|---|---|---|---|---|
| `GET` | `/public/events/{id}` | 🔓 | — | `PublicEvent` (+ `coverUrl`, `capacityRemaining`, `organizationName`, derived `status`, `cancellationReason?`) | 404, 429 | `/e/$eventId` |
| `POST` | `/public/events/{id}/register` | 🔓 | `{ firstName, lastName, email }` | `201 { person, attendance, pass: { url, expiresAt } }` | 400, 404, 409 `event_ended`\|`capacity_reached`, 429 | Public register. **Returns the pass URL synchronously**; email is async (D18) |
| `POST` | `/public/events/{id}/resend-pass` | 🔓 | `{ email }` | `202` — **always**, whether or not the address is registered | 429 | "Didn't get it?" |
| `GET` | `/p/{token}` | 🔓 (bearer) | — | `{ pass, event, person: {firstName, initial}, canSelfCheckIn, attendance }` | 404, 410 `expired`\|`revoked`, 429 | **The pass page** (D19) |
| `POST` | `/p/{token}/check-in` | 🔓 (bearer) | — | `{ attendance, alreadyRecorded }` | 403 `self_checkin_disabled`, 409 `event_ended`\|`capacity_reached`, 410, 429 | Self check-in from the pass |
| `GET` | `/p/{token}/calendar.ics` | 🔓 (bearer) | — | `text/calendar` | 404, 410 | "Add to calendar" from the pass |
| `POST` | `/public/events/{id}/check-in` | 🔓 | `{ pass } \| { firstName, lastName, email }` | `{ attendance, alreadyRecorded }` | 400, 403, 409, 429 | Walk-up self check-in from the event page |
| `GET` | `/public/events/{id}/calendar.ics` | 🔓 | — | `text/calendar` | 404 | "Add to calendar" |

**Three deliberate details:**

- **`resend-pass` always answers `202`**, registered or not. Answering differently turns it into an
  oracle for "is this person attending this event", which for a church, a support group or a political
  meeting is a real disclosure.
- **`GET /p/{token}` returns `firstName` and a last **initial**, never the full email.** A forwarded
  pass should not leak the holder's contact details.
- **The old `POST /public/events/:id/attend` with its `mode` flag**
  ([`public.ts:96`](../services/core/src/routes/public.ts#L96)) splits into `register` and `check-in`.
  Each then carries its own gate (`allow_self_check_in` applies to only one), its own rate limit, and
  its own idempotency semantics. The old path stays as a shim through Phase 3.

### 5.11 Ops

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/health` | 🔓 | `{ status, version, commit }` |
| `GET` | `/health/ready` | 🔓 | `{ db, storage }` — real dependency probes |
| `GET` | `/openapi.json` | 🔓 | the generated document |
| `GET` | `/docs` | 🔓 | Scalar (D14) |
| `POST` | `/webhooks/stripe` | 🔓 (sig) | `204` — signature-verified (D15) |
| `POST` | `/internal/jobs/{name}` | ⚙️ | job runner (close-events, materialise-series, sweep-media, sweep-idempotency) |

### 5.12 Coverage proof — every screen maps to endpoints

| Screen | Endpoints |
|---|---|
| `/login` | Supabase directly; then `GET /me/context` |
| `/events` | `/me/context`, `/events/summary`, `/events`, `/events/calendar` |
| `/events/new` | `POST /events`, `POST /uploads` |
| `/events/$id` | `GET /events/{id}`, `/events/{id}/passes/{personId}`, `/events/{id}/calendar.ics` |
| `/events/$id/edit` | `GET`/`PATCH /events/{id}` |
| `/attendees` | `/people`, `/people/summary`, `/events` (scope dropdown) |
| `/attendees/new`, `/attendees/$id/edit` | `POST`/`PATCH /people`, `PUT /events/{id}/grants/{accountId}` |
| `/checkin/$eventId` | `GET /events/{id}`, `/events/{id}/checkin-state`, `/events/{id}/stream`, `POST /events/{id}/check-in` |
| `/e/$eventId` | `/public/events/{id}`, `/public/events/{id}/register`, `/public/events/{id}/check-in`, `/public/events/{id}/resend-pass` |
| **`/p/$token`** (new) | `GET /p/{token}`, `POST /p/{token}/check-in`, `/p/{token}/calendar.ics` |
| **`/me/tickets`** (new) | `GET /me/tickets`, `POST /me/claim` |
| `/analytics` | `/analytics/overview`, `/analytics/export`, `/events` (scope picker) |
| `/profile` | `/me`, `/organizations`, `/organizations/{id}/members`, `/organizations/{id}/invitations`, `/organizations/{id}/identity-providers`, `/organizations/{id}/domains` |
| `/upgrade` | `POST /me/upgrade`, `POST /me/claim`, `/me/context` |

No screen requires a value no endpoint returns. Deltas where a screen currently *invents* a value are
listed per-screen in [§10](#10-client-rewiring-plan).

---

## 6. Authorization model

### 6.1 Permission vocabulary

Permissions are `resource:verb` strings. There are 26; every endpoint in [§5](#5-complete-api-surface)
declares exactly one, **or** carries `scope: 'account'` / `scope: 'public'`, which are self-scoped and
bearer-scoped respectively and therefore have no org permission to declare.

```
org:read  org:update  org:delete  org:billing
member:read  member:invite  member:update_role  member:remove
event:read  event:create  event:update  event:delete  event:cancel
series:manage
person:read  person:create  person:update  person:delete
attendance:read  attendance:record  attendance:amend
analytics:read  analytics:export
device:manage  media:upload  media:read
```

`event:publish` is **not** in this list — dropping `draft` removed it
([D2](#d2--no-lifecycle-enum-status-is-derived-from-timestamps)). `org:update` covers SSO and domain
configuration; enterprise IdP setup does not get its own permission because it is exactly as sensitive
as the rest of org settings and splitting it would imply otherwise.

**The four scopes**, since three of them are new:

| Scope | Tenant comes from | Reads | Example |
|---|---|---|---|
| `organization` | `X-Organization-Id`, validated against memberships | that org's rows | `GET /events` |
| `account` | the token's account, **no org at all** | rows where `people.account_id = me`, across all orgs | `GET /me/tickets` |
| `public` | nothing | one resource named in the path | `GET /public/events/{id}` |
| `bearer` | the token in the URL | the one pass it names | `GET /p/{token}` |

A route must declare exactly one. `organization` additionally requires a `permission`; the other three
must **not** have one (declaring a permission on a public route is itself a boot failure — it means
someone misunderstood the route).

### 6.2 Org role × permission matrix

`owner` ⊃ `admin` ⊃ `organizer` ⊃ `checkin`; `viewer` is a separate read-only branch.

| Permission | owner | admin | organizer | checkin | viewer |
|---|:--:|:--:|:--:|:--:|:--:|
| `org:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `org:update` | ✅ | ✅ | — | — | — |
| `org:delete` | ✅ | — | — | — | — |
| `org:billing` | ✅ | — | — | — | — |
| `member:read` | ✅ | ✅ | ✅ | — | ✅ |
| `member:invite` | ✅ | ✅ | — | — | — |
| `member:update_role` | ✅ | ✅¹ | — | — | — |
| `member:remove` | ✅ | ✅¹ | — | — | — |
| `event:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `event:create` | ✅ | ✅ | ✅ | — | — |
| `event:update` | ✅ | ✅ | ✅² | — | — |
| `event:delete` | ✅ | ✅ | ✅² | — | — |
| `event:cancel` | ✅ | ✅ | ✅² | — | — |
| `series:manage` | ✅ | ✅ | ✅ | — | — |
| `person:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `person:create` | ✅ | ✅ | ✅ | ✅³ | — |
| `person:update` | ✅ | ✅ | ✅ | — | — |
| `person:delete` | ✅ | ✅ | — | — | — |
| `attendance:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `attendance:record` | ✅ | ✅ | ✅ | ✅ | — |
| `attendance:amend` | ✅ | ✅ | ✅ | — | — |
| `analytics:read` | ✅ | ✅ | ✅ | — | ✅ |
| `analytics:export` | ✅⁴ | ✅⁴ | ✅⁴ | — | — |
| `device:manage` | ✅ | ✅ | ✅² | — | — |
| `media:upload` | ✅ | ✅ | ✅ | — | — |
| `media:read` | ✅ | ✅ | ✅ | ✅ | ✅ |

¹ An admin may not change or remove an `owner`. Nobody may remove the **last** owner.
² Only for events the organizer created or holds an `event_grants` row on.
³ Only implicitly, via walk-in check-in — a `checkin` role cannot use `POST /people` directly.
⁴ Additionally gated by `EntitlementService.assert(ctx, 'analytics.export')`.

### 6.3 Event-scoped grants

An `event_grants` row **adds** permissions on one event; it never removes org-level ones.

| Event role | Adds |
|---|---|
| `organizer` | `event:update`, `event:delete`, `event:cancel`, `device:manage`, `attendance:amend` on that event |
| `co_host` | `event:update`, `attendance:amend` on that event |
| `staff` | `attendance:record`, `attendance:read`, `person:create` on that event |

**Effective permissions** = org-role permissions ∪ event-grant permissions (for the event in scope)
∪ device-token scopes (which are always a **subset**, never additive beyond their explicit list).

### 6.4 Where enforcement happens

Four layers. Each is independently sufficient to stop a leak; all four run.

```mermaid
flowchart TD
    R["Request"] --> A["1 · auth middleware<br/>verify JWT / device token"]
    A --> B["2 · caller resolution<br/>identities → account → memberships<br/>(one query, request-cached)"]
    B --> C["3 · route declaration<br/>requirePermission('event:update')<br/>declared in the OpenAPI registration"]
    C --> D["4 · TenantContext<br/>every repo call takes it; it cannot be constructed by a handler"]
    D --> E["5 · RLS<br/>SET LOCAL app.account_id; policies re-check independently"]
    E --> F["Postgres"]
    style C fill:#efe,stroke:#0a0
    style D fill:#efe,stroke:#0a0
    style E fill:#efe,stroke:#0a0
```

The declaration in layer 3 is the fail-closed hinge:

```ts
// shape only — the point is that scope + permission are non-optional
export const updateEvent = defineRoute({
  method: 'patch',
  path: '/events/{id}',
  scope: 'organization',              // 'organization' | 'account' | 'public' | 'bearer'
  permission: 'event:update',         // required iff scope === 'organization'; forbidden otherwise
  request:  { params: EventIdParams, body: UpdateEventSchema },
  responses: { 200: EventSchema, 403: Problem, 404: Problem },
  handler: async (ctx, input) => EventService.updateEvent(deps, ctx, input),
});
```

At boot, `assertRouteRegistryComplete()` walks every registered route and throws if any of these hold:
it has no `scope`; it is `scope: 'organization'` and has no `permission`; or it is any other scope and
*has* one. **A forgotten or mismatched declaration crashes the service on startup** — it cannot become
a silent leak. This is the mechanism the brief asks for in §5.1.

The third check exists because the failure mode is asymmetric: forgetting a permission on an org route
leaks data, while *adding* one to an account or public route means the author thought a self-scoped
route was tenant-scoped — which usually means they scoped it wrong somewhere else too.

---

## 7. Tenancy design

### 7.1 Layer 1 — application scoping

**`TenantContext` is not constructible by a handler.** It is produced by the tenant middleware and
carries a private brand:

```ts
declare const brand: unique symbol;
export interface TenantContext {
  readonly [brand]: 'verified';
  readonly organizationId: string;
  readonly accountId: string | null;
  readonly deviceId: string | null;
  readonly role: OrgRole | null;
  readonly permissions: ReadonlySet<Permission>;
  readonly eventGrants: ReadonlyMap<string, EventRole>;
}
```

The repository layer takes it as its **first argument, always**:

```ts
// every tenant-scoped table is reachable only through this
export function scoped(ctx: TenantContext) {
  return {
    events:     () => db.select().from(events).where(eq(events.organizationId, ctx.organizationId)),
    people:     () => db.select().from(people).where(eq(people.organizationId, ctx.organizationId)),
    attendance: () => db.select().from(attendance).where(eq(attendance.organizationId, ctx.organizationId)),
    // …
  };
}
```

Raw table access is behind an eslint `no-restricted-imports` rule: `services/**` may import
`scoped`, never the table objects directly. The only exemptions are `IdentityService` (pre-tenant, by
definition) and the migration scripts, both of which are explicitly allow-listed.

**How the active org is chosen.** `X-Organization-Id` header → validated against
`ctx.memberships` → 403 if not a member. Never from body or query. If the header is absent and the
caller has exactly one membership, that one is used; several ⇒ `400 organization_required`; zero ⇒
`needsOnboarding` and every org-scoped endpoint returns an empty page, not an error.

### 7.2 Layer 2 — RLS

Two things must be true for RLS to be a real second layer rather than theatre:

1. **The API must not bypass it.** It connects as `credopass_api` — `NOSUPERUSER`, `NOBYPASSRLS`, with
   `SELECT/INSERT/UPDATE/DELETE` grants and nothing more. Every request opens a transaction and issues
   `SET LOCAL app.account_id = $1` (and `app.device_id`, `app.organization_id`) before any query.
   Requires the pooler in **transaction** mode.
2. **`anon` must have nothing.** `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;` and drop every
   policy created by [`rls_dev_permissive.sql`](../services/core/drizzle/rls_dev_permissive.sql). The
   public event surface goes through the API, which is already narrow and token-optional by design.

A `SECURITY DEFINER` helper keeps policies readable and lets Postgres cache the membership lookup:

```sql
CREATE OR REPLACE FUNCTION app.current_org_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(array_agg(m.organization_id), '{}')
  FROM org_memberships m
  WHERE m.account_id = nullif(current_setting('app.account_id', true), '')::uuid
    AND m.status = 'active';
$$;

CREATE POLICY events_tenant ON public.events FOR ALL TO credopass_api
  USING      (organization_id = ANY (app.current_org_ids()))
  WITH CHECK (organization_id = ANY (app.current_org_ids()));
```

Every tenant-scoped table gets the identical policy on its `organization_id`. This is **why**
`attendance` and `event_grants` keep a denormalised `organization_id`: it turns each policy into a
single column comparison instead of a join, which matters when the policy runs per row.

**The personal scope needs a second predicate, and getting it wrong is how you build a leak.**
`GET /me/tickets` must read `people` and `attendance` rows belonging to the caller *across every
organisation* — which is exactly what the org policy above is designed to prevent. The naive fix (a
correlated subquery per row) is both slow and easy to write too permissively. Instead, a second
`SECURITY DEFINER` helper mirrors the first:

```sql
CREATE OR REPLACE FUNCTION app.current_person_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(array_agg(p.id), '{}')
  FROM people p
  WHERE p.account_id = nullif(current_setting('app.account_id', true), '')::uuid
    AND p.deleted_at IS NULL;
$$;

-- people: my own record in any org, or any record in an org I administer
CREATE POLICY people_access ON public.people FOR ALL TO credopass_api
  USING (organization_id = ANY (app.current_org_ids())
      OR account_id = nullif(current_setting('app.account_id', true), '')::uuid);

-- attendance: same shape, via the person array — an indexed = ANY, not a subquery per row
CREATE POLICY attendance_access ON public.attendance FOR ALL TO credopass_api
  USING (organization_id = ANY (app.current_org_ids())
      OR person_id = ANY (app.current_person_ids()));
```

Three properties make this safe rather than a hole:

1. **The self-branch is read-shaped only.** `WITH CHECK` on both policies omits the self predicate
   entirely — so a caller may *read* their own rows in another org but can never *write* one. An
   attendee cannot edit the organiser's record of them.
2. **`passes` gets no self predicate at all.** A pass is reached by presenting its token
   (`scope: 'bearer'`), which the API resolves before opening a tenant transaction. Adding a
   self-branch there would let a signed-in account enumerate its own pass tokens, which is a
   capability nothing needs.
3. **`org_memberships` gets no self predicate either.** This is the structural half of the
   "attending ≠ belonging" guarantee: even if a service tried, the personal scope has no policy path
   that reaches a membership row (T29, T30).

Indexes the policies depend on: `org_memberships(account_id)` (already specified), `identities(provider, subject)`,
and the `organization_id` leading column on every scoped table's primary index.

A migration test asserts that **every** table in `public` either has an RLS policy referencing
`app.current_org_ids()` or appears in an explicit `GLOBAL_TABLES` allow-list
(`accounts`, `identities`, `idempotency_keys`, `rate_limit_buckets`, `__drizzle_migrations`). A new
table with no policy fails CI. That is the DB-side twin of the startup assertion in [§6.4](#64-where-enforcement-happens).

### 7.3 Adversarial test matrix

Starting from [MULTI-TENANCY.md §5](MULTI-TENANCY.md#5-test-plan) and extended. **Every row is written
in Phase 0 and must be red before Phase 1 begins.**

| # | Scenario | Expected | Source |
|---|---|---|---|
| T1 | A lists events while B's exist | only A's | MT §5 |
| T2 | A sends `X-Organization-Id: <B's org>` | `403 not_a_member` | MT §5 |
| T3 | A `GET`s B's event by id | `404` (not 403) | MT §5 |
| T4 | A `PATCH`es B's event | `404`, row unchanged | MT §5 |
| T5 | A creates an event with B's org in the body | body field ignored; created in A's org | MT §5 |
| T6 | Brand-new account, no memberships | `needsOnboarding: true`, empty everything | MT §5 |
| T7 | Anonymous guest hits `/events` with no active org | empty page + onboarding, never another org | MT §5 (**amended per D16**) |
| T8 | Anonymous session hits `/public/events/{B's id}` | works, that id only | MT §5 |
| T9 | `viewer` attempts any write | `403 insufficient_permission` | MT §5 |
| T10 | Direct PostgREST read with the anon key | `401`/empty — anon has no grants | MT §5 |
| **T11** | A checks in a **person id belonging to B** | `404 person_not_found` | new |
| **T12** | A forges a pass for B's event | `400 invalid_pass` (signature) | new (D12) |
| **T13** | A device token for event X is used on event Y | `403 out_of_scope` | new (D9) |
| **T14** | A revoked/expired device token | `401 token_revoked` | new |
| **T15** | A requests `/analytics?scope=<B's event id>` | `404` | new |
| **T16** | A's presigned upload URL aimed at B's key prefix | signature invalid | new (§9.1) |
| **T17** | A replays B's `Idempotency-Key` | treated as new (keys are namespaced by caller) | new |
| **T18** | A subscribes to `/events/{B's id}/stream` | `404`, no frames | new |
| **T19** | A merges a B person into an A person | `404` | new |
| **T20** | Two orgs both register `john@x.com` | two distinct `people` rows, no cross-visibility | new — the `users` split |
| **T21** | A `GET`s `/people/{B's person}` | `404` | new |
| **T22** | A accepts an invitation token issued to another email | `403 invitation_mismatch` | new |
| **T23** | Last owner demotes themselves | `409 last_owner` | new |
| **T24** | New table added without an RLS policy | **CI fails** | new — structural |
| **T25** | New route registered without `scope`/`permission` | **service fails to boot** | new — structural |
| **T26** | A `GET`s `/media/{B's asset}` | `404` | new |
| **T27** | Concurrent check-in of the same person from two doors | exactly one `attendance` row; both `200`, one `alreadyRecorded: true` | new |
| **T28** | Check-in past capacity with `enforce_capacity` | `409 capacity_reached` | new |

**Attendee-scope attacks** (new in rev 2 — the `scope: 'account'` and `scope: 'bearer'` surfaces):

| # | Scenario | Expected |
|---|---|---|
| **T29** | Register for B's event, then call every org-scoped endpoint | **No `org_memberships` row exists.** `/me/context` shows zero organisations; `GET /events` returns empty. *This is the test for "attending ≠ belonging"* |
| **T30** | A registers for B's event, then tries `GET /organizations/{B}/members` | `404` |
| **T31** | `GET /me/tickets` while B has tickets too | only A's, but **across all of A's orgs** — a ticket in an org A doesn't administer must still appear |
| **T32** | `GET /me/tickets` returns a ticket for B's org; A then tries to `PATCH` that attendance row | `403` — the self-branch is read-only (`WITH CHECK` omits it) |
| **T33** | `POST /me/claim` with an **unverified** email matching B's people rows | `claimed: 0` — nothing linked |
| **T34** | `POST /me/claim` with a verified email | links only rows whose email matches exactly; case-insensitive; no membership created |
| **T35** | `GET /p/{token}` with a valid token for another person's pass | works — it is a bearer credential — but returns **first name + last initial only**, never the email |
| **T36** | `GET /p/{token}` after `revoked_at` / past `expires_at` | `410` |
| **T37** | `GET /p/{token}` with a tampered signature | `404`, and **no database query is issued** (assert via query log) |
| **T38** | `POST /p/{token}/check-in` when `allow_self_check_in = false` | `403 self_checkin_disabled` |
| **T39** | `POST /public/events/{id}/resend-pass` for an unregistered address | `202`, identical body and timing to the registered case — no enumeration oracle |
| **T40** | A signed-in account enumerates `passes` via any endpoint | no such endpoint exists; RLS has no self-branch on `passes` |

**Enterprise identity attacks** (new in rev 2):

| # | Scenario | Expected |
|---|---|---|
| **T41** | Register an org, claim `gmail.com`, skip DNS verification | domain inert — sign-in unaffected |
| **T42** | Claim `gmail.com` **with** valid DNS proof | `400 public_suffix` — blocklisted regardless of proof |
| **T43** | Token from an unregistered `iss` with an otherwise valid signature | `401` |
| **T44** | Token from org B's registered IdP, used to access org A | resolves to an account with no A membership ⇒ `403`/empty |
| **T45** | Two orgs configure Okta; a user exists at both | two `identities` rows, one account, two memberships, no collision |
| **T46** | IdP asserts `role: owner` in its claims | ignored — JIT grants `default_role` and nothing else |
| **T47** | Caller matched by `email` rather than `(iss, sub)` | **no code path does this** — asserted by a grep test in CI |

T24, T25, T29 and T47 are the ones that matter most: all four make a *class* of bug impossible rather
than catching one instance. T27 is the only genuinely concurrent path in the product.

---

## 8. Event lifecycle and recurrence

### 8.1 Lifecycle events

There is **no state machine** — that is the point of [D2](#d2--no-lifecycle-enum-status-is-derived-from-timestamps).
What follows is how a reader *perceives* the event over time, which is a different thing from how it is
stored. Nothing here is a transition that has to be guarded, because nothing here is a column.

```mermaid
stateDiagram-v2
    [*] --> scheduled: event.created
    scheduled --> ongoing: now ≥ start_at
    ongoing --> completed: now > end_at, or closed_at set
    scheduled --> cancelled: cancelled_at set
    ongoing --> cancelled: cancelled_at set
    completed --> [*]
    cancelled --> [*]
    note right of ongoing
      Derived, not stored.
      No row is written when
      an event "becomes" ongoing.
    end note
```

Only two of these correspond to a write: `cancelled_at` (an organiser action) and `closed_at` (the
scheduler, because no-show finalisation and the `event.closed` notification are side effects that must
happen exactly once). `scheduled → ongoing` writes **nothing at all** — the clock moves, and the
derived status changes with it.

**The event catalogue** (`domain_events.type`):

| Type | Emitted when | Payload | Consumed by |
|---|---|---|---|
| `event.created` | `POST /events` | `{ name, startAt, endAt, capacity }` | analytics, audit |
| `event.updated` | `PATCH /events/{id}` | `{ changed: {...} }` | audit, **change email to registrants** (D18) |
| `event.opened` | window start, or first check-in | `{ at }` | kiosk, analytics |
| `event.doors_opened` | first `attendance.recorded` | `{ at, personId }` | analytics ("arrival curve" t₀) |
| `event.capacity_reached` | check-in fills the last seat | `{ capacity }` | kiosk banner, alerting |
| `event.closed` | scheduler past `end_at`, or manual | `{ at, attended, registered, noShows }` | analytics, no-show finalisation |
| `event.cancelled` | `POST .../cancel` | `{ reason, by }` | kiosk, public page, **cancellation email to every registrant** |
| `attendance.registered` | register (staff or public) | `{ personId, source }` | analytics, **pass email** (D18) |
| `pass.issued` / `pass.revoked` | pass lifecycle | `{ passId, personId }` | audit |
| `pass.viewed` | `GET /p/{token}` | `{ passId, ip_hash }` | abuse detection — a pass viewed from 40 addresses has been forwarded |
| `attendance.recorded` | check-in | `{ personId, method, byAccountId, byDeviceId }` | **kiosk live counter**, analytics, audit |
| `attendance.checked_out` | check-out | `{ personId, dwellMinutes }` | dwell analytics |
| `attendance.amended` | manual correction | `{ from, to, by, reason }` | audit |
| `attendance.no_show_finalised` | at `event.closed` | `{ count }` | analytics |
| `person.created` / `person.merged` | | | audit |
| `membership.granted` / `.role_changed` / `.revoked` | | | audit |
| `device.paired` / `.revoked` | | | security audit |

**Write path** (one transaction, always):

```
BEGIN
  SET LOCAL app.account_id = …
  <state change>                        -- e.g. UPSERT attendance
  INSERT INTO domain_events (…)         -- same tx: no state change without its event
COMMIT
→ pg_notify('credopass_events', '{"orgId":…,"eventId":…,"seq":…}')
```

The `NOTIFY` fires post-commit via a deferred trigger, so a subscriber can never be told about a row
that then rolls back. Subscribers receive `{seq}` and read from `domain_events` — payloads never
travel through `NOTIFY`, so the 8 kB limit never binds.

**SSE frame:**

```
id: 10482
event: attendance.recorded
data: {"eventId":"…","personId":"…","firstName":"Ada","liveCount":37,"capacity":120}
```

`id` is `domain_events.seq`, so `Last-Event-ID` reconnection replays exactly the gap.

### 8.2 What this gives each consumer

- **Kiosk** — subscribes to one event; `liveCount` is authoritative and shared, replacing
  `useState(0)` at [`CheckIn/index.tsx:74`](../apps/web/src/Pages/CheckIn/index.tsx#L74), which today
  resets on reload and disagrees between doors.
- **Analytics** — `arrivalsByHour` and `checkInMethods` become a `date_trunc` group-by over
  `domain_events`, not a table scan; historical accuracy survives later corrections to `attendance`.
- **Audit** — "who checked this person in, when, from which device" is `SELECT … WHERE aggregate_id = ?`.

### 8.3 Recurrence model

```mermaid
flowchart LR
    S["event_series<br/>RRULE=FREQ=WEEKLY;BYDAY=SU<br/>tz=Europe/London, 10:00, 90min"]
    S -->|"daily job materialises<br/>26 weeks ahead"| E1["events<br/>occurrence_start 2026-08-02T09:00Z"]
    S --> E2["events<br/>occurrence_start 2026-08-09T09:00Z"]
    S --> E3["events (is_exception)<br/>occurrence_start 2026-08-16<br/>moved to 14:00, or cancelled"]
    E1 --> A1["attendance rows"]
    E2 --> A2["attendance rows"]
```

**Generation.** A daily job advances each series to `now + 26 weeks` (max 60 occurrences), inserting
missing `(series_id, occurrence_start)` pairs. Idempotent — a unique index on that pair means a
double-run is a no-op. Creating a series materialises the first horizon synchronously so the organiser
sees occurrences immediately.

**Edit semantics.** `PATCH /events/{id}?scope=`:

| scope | Behaviour |
|---|---|
| `this` | Update only this row; set `is_exception = true`. Future series edits skip it forever. |
| `this_and_following` | **Split the series**: close the original at this occurrence (`ends_at`), create a new series carrying the edits, re-point this and later non-exception occurrences at it. |
| `all` | Update the series template; rewrite all future **non-exception** occurrences. Past occurrences are never touched — they are historical records with attendance attached. |

**Cancelling one week** = `POST /events/{id}/cancel` on that occurrence. It keeps its row, its
attendance, its id, and its share URL — a printed poster still resolves and now says "cancelled".
The series ICS emits it as an `EXDATE`.

**Attendance attribution.** Always to the concrete occurrence. Series-level questions
("how has Sunday Service trended?") are `GROUP BY series_id` over occurrences —
`GET /analytics/overview?scope=series:{id}`.

**Timezone / DST.** The series stores an IANA zone and a *local wall-clock* anchor
(`anchor_start_local = '10:00'`). Materialisation computes each UTC instant from
`(occurrence_date, anchor_start_local, timezone)`. A 10:00 service stays 10:00 across the March and
October transitions — which storing a UTC offset, or a fixed UTC time, both get wrong.
Two edge cases handled explicitly: a local time that **does not exist** on a spring-forward date shifts
forward to the first valid instant; one that occurs **twice** on a fall-back date takes the first.

**Horizon rationale.** 26 weeks is long enough that "book the hall for next term" works, short enough
that a series edit rewrites tens of rows rather than thousands. Configurable per series later.

**Not in scope for MVP:** an occurrence-level attendee roster carried forward from the previous week,
and per-occurrence staff rotas. Both are natural follow-ons.

---

## 9. Infrastructure

### 9.1 S3 layout and upload flow

```
s3://credopass-media-{env}/
  org/{orgId}/events/{eventId}/cover/{assetId}/original.{ext}
                                              /w800.webp
                                              /w400.webp
                                              /thumb.webp
  org/{orgId}/people/{personId}/avatar/{assetId}/original.{ext}
                                                /w256.webp
```

The `org/{orgId}/` prefix is load-bearing: the presigned policy pins the key prefix, so a URL issued to
tenant A **cannot** be aimed at tenant B's objects (test T16).

```mermaid
sequenceDiagram
    participant C as Client
    participant API
    participant S3
    C->>API: POST /uploads {kind, contentType, byteSize}
    API->>API: validate type/size; create media_assets(state=pending)
    API-->>C: {assetId, uploadUrl, headers, expiresIn: 300}
    C->>S3: PUT uploadUrl (direct — bytes never touch the API)
    C->>API: POST /events/{id}/cover {assetId}
    API->>S3: HEAD object (verify real size + content-type)
    API->>API: media_assets.state = attached; enqueue derivatives
    API-->>C: Event {coverUrl}
```

| Concern | Decision |
|---|---|
| **Limits** | 8 MB; `image/jpeg`, `png`, `webp`, `avif`. Enforced at presign **and** re-verified by the HEAD — a client-declared size is not trusted |
| **Derivatives** | Generated on attach by a Cloud Run job (sharp). `w800`/`w400`/`thumb` for covers, `w256` for avatars |
| **Public read** | Event covers → CloudFront, `public-read`, `Cache-Control: max-age=31536000, immutable` (keys contain `assetId`, so they are content-addressed). The public event page needs no credential |
| **Private read** | Avatars → presigned GET, 15-minute TTL. They are PII-adjacent and should not be enumerable |
| **Cleanup** | `pending` older than 24 h → deleted. `attached` whose owner row is deleted → `orphaned`, deleted after 7 days (a window to undo). Both by the nightly `sweep-media` job |
| **Deletion** | Deleting an event marks its cover `orphaned`; it does not delete immediately, so a soft-deleted event can be restored intact |

### 9.1a Email (D18)

New infrastructure — there is none in the repo today.

| Concern | Decision |
|---|---|
| **Provider** | Resend, behind a `Mailer` port. The adapter is ~80 lines, so Postmark/SES is a file swap |
| **Templates** | React Email, rendered server-side, living in `services/core/src/emails/` |
| **Sending domain** | `mail.credopass.com` — a **subdomain**, so a deliverability incident never poisons the apex domain's reputation |
| **DNS, before the first send** | SPF, DKIM (2048-bit), DMARC starting at `p=none` and tightened to `p=reject` once reports are clean |
| **Queue** | `email_deliveries` rows in `queued`, drained by a worker; exponential backoff, 5 attempts, then `failed` |
| **Idempotency** | `UNIQUE(idempotency_key)` — a retry storm cannot double-mail an attendee |
| **Bounces / complaints** | Resend webhook → `state`; hard bounces suppress the address, and the attendee row shows "we couldn't reach this address" instead of failing silently forever |
| **Local dev** | Mailpit in `docker-compose.dev.yml`; `CREDOPASS_ENV=local` points the `Mailer` at it, so no mail ever leaves a developer's machine |
| **Never** | Marketing sends, tracking pixels, or a raw pass token in body text — only the `/p/{token}` link |

**The critical-path rule.** Registration returns `201` with the pass URL in the body **before** any
mail is attempted. A provider outage degrades to "you saw your pass but the email is late" and never
to a failed registration. `POST /public/events/{id}/resend-pass` is the recovery path.

### 9.2 Redis

Not provisioned (D6). The `EventBus`, `RateLimiter` and mail-queue ports exist so that adding it later
is a one-file change. Note that the mail queue is the most likely first reason to want it — but a
`queued` row plus a polling worker is entirely adequate at six message types and a handful of events.

### 9.3 Local development

The brief asks for "an easy way — either flag or config — to switch to local supabase db and local-api".

```bash
supabase start            # local Postgres :54322 + GoTrue + JWKS on :54321
bun run env:local         # writes .env.local files pointing everything at local
bun start                 # web :5001 (AirPlay owns :5000) + API :8080
```

One switch drives everything: `CREDOPASS_ENV` ∈ `local | staging | production`.

| Var | `local` | `production` |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:54322/postgres` | remote |
| `SUPABASE_URL` | `http://localhost:54321` | remote |
| `VITE_API_URL` | `http://localhost:8080/api/v1` | `/api/v1` |
| `S3_ENDPOINT` | MinIO `http://localhost:9000` | AWS |
| `AUTH_DISABLED` | **never** — local Supabase means real JWTs, so the auth path is exercised in dev | — |

> Killing `AUTH_DISABLED` matters. It is currently the only way to develop without hitting the remote
> Supabase project ([`middleware/auth.ts:34`](../services/core/src/middleware/auth.ts#L34)), which means
> the auth path is the *least* exercised code in local development — exactly backwards for the subsystem
> the whole rebuild rests on.

`docker/docker-compose.dev.yml` already runs Postgres 16 and is kept for the "no Supabase CLI" path;
MinIO is added to it for S3.

### 9.4 Migrations

| Today | Target |
|---|---|
| `**/drizzle/` gitignored ([`.gitignore:48`](../.gitignore)) — the 3 existing migrations are untracked | **Un-ignore it.** The new baseline is committed; every migration is reviewable |
| `nx run coreservice:migrate` writes to the **remote** instance | `migrate:local` (default, no confirmation) vs. `migrate:remote` (requires `--confirm` and prints the target host first) |
| No local database | `supabase start`, or the compose Postgres |
| `drizzle-kit push` available | Banned in CI; generate + migrate only |

Migration CI gate: apply every migration from scratch on an empty database, then run the RLS
completeness assertion ([§7.2](#72-layer-2--rls)) and the adversarial suite.

### 9.5 Secrets — what is actually at risk

**Correction to the brief (§3.4).** `apps/web/.env` and `services/core/.env` are **not** committed. They
are gitignored (`.gitignore:2-3`), absent from `git ls-files`, and
`git log --diff-filter=A -- '**/.env'` returns nothing — they have never been committed. The tracked
env files are the four `.env.example` templates.

**What *is* at risk, and it is worse.**
[`rls_dev_permissive.sql`](../services/core/drizzle/rls_dev_permissive.sql) creates
`FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)` on all seven tables, and
`VITE_SUPABASE_ANON_KEY` ships in the web bundle **by design** (that is what an anon key is for). If
that SQL has been applied to the live instance — and the file's own header says it was written
*because* PostgREST was returning `[]`, so it almost certainly has — then **anyone who opens the site
and reads one JS bundle can read and write every row in the database directly**, bypassing the API,
its auth middleware, and everything in this plan.

Verify in one command (returns rows ⇒ confirmed exposed):

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/users?select=id,email&limit=1" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

**Do this before anything else in this document**, independent of the rebuild:

```sql
DROP POLICY IF EXISTS users_dev_all ON public.users;          -- and the other six
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
```

The web app does not read PostgREST directly — it goes through the API
([`api-client/client.ts`](../packages/api-client/src/client.ts)) — so revoking `anon` should break
nothing. Confirm on staging first.

**Rotation list** (cheap, do it at cutover): DB password, Supabase `service_role` key, Mapbox tokens
(`VITE_MAPBOX_ACCESS_TOKEN` is public-by-design but should be URL-restricted — it is currently
returning **403**, see [§10.3](#103-eventsid--event-detail)), and any Vercel/GCP deploy tokens sitting
in the local `.env`. Move production secrets to GCP Secret Manager; `.env` files stay local-only.

### 9.6 Observability

- **Structured JSON logs** with `requestId`, `accountId`, `organizationId`, `route`, `durationMs`,
  `status`. Never log tokens, emails or `payload` contents.
- **OpenTelemetry** traces: HTTP → service → SQL. Export to Cloud Trace.
- **Metrics that map to the product:** check-ins/min per event, SSE connection count, p95 for
  `POST /events/{id}/check-in` (the one latency a human notices), idempotency-replay rate,
  `403 not_a_member` rate (**a spike here means a tenancy bug or an attack**).
- **Alerts:** any `500` on `/check-in`; RLS assertion failure; `domain_events` write lag; media sweep
  failures.

---

## 10. Client rewiring plan

### 10.0 The shape of the change

`@credopass/api-client` keeps its name, its position and its rule ("apps never `fetch` for app data").
Everything inside it is replaced:

```
packages/api-client/src/
  generated/schema.d.ts     ← openapi-typescript, checked in, `nx run api-client:generate`
  client.ts                 ← openapi-fetch instance + auth + org header + problem→Error
  hooks/                    ← TanStack Query hooks, one per endpoint group
  index.ts
  collections/              ← DELETED (9 files, ~1,100 lines incl. persisted-ids.ts)
```

Screens keep calling hooks. Only the hook bodies change — which is what makes this a mechanical,
screen-by-screen migration rather than a rewrite.

**Deleted outright:** all of `collections/`, `persisted-ids.ts`, `use-attendee-checkin.ts`,
`contexts/premium.tsx`, the `getStatus` duplicate, and `packages/lib/src/utils/events.ts`'s grouping
helpers.

The tables below flag **⚠️ = a value the screen renders today that the new API must now supply.**
Nothing in this list may silently disappear.

---

### 10.1 `/events`

| Value on screen | Today | New source |
|---|---|---|
| "Good evening, Israel" | `useEventSessionStore.currentUserName` — **hardcoded** `'Israel Agyeman-Prempeh'` at [`appStore.ts:127`](../packages/lib/src/stores/appStore.ts#L127) | ⚠️ `GET /me.displayName` |
| "2 events · 1 upcoming · 0 live now" | client `filter().length` over the full cache | ⚠️ `GET /events/summary` |
| Hero "Up next" / "Live now" | `useMemo` at [`Events/index.tsx:322`](../apps/web/src/Pages/Events/index.tsx#L322) | ⚠️ `summary.next` |
| Per-event `status` badge | client `getStatus` | `EventSummary.status` (derived server-side) |
| Org name on the event row ("Kharis Church") | a client-side join against `orgCollection` | ⚠️ `EventSummary.organizationName` |
| Upcoming/Past switch | client split | `?group=upcoming\|past` |
| Calendar rail + "July 2026 · 1 EVENT" | `getMonthEvents` in the browser | ⚠️ `GET /events/calendar?month=` |
| Search | client `filter` | `?q=` |
| Pro upsell card visibility | `usePremium` → `localStorage` | ⚠️ `meContext.entitlements.showUpgradePrompt` |
| **Empty state** | "Plan your next event" | ⚠️ **New:** when `needsOnboarding`, render "Create your organisation" instead (§10.9 D-A) |

### 10.2 `/attendees`

The heaviest migration: ~150 lines of `useMemo` become one call.

| Value | Today | New source |
|---|---|---|
| `standing` badge (Attended / No-show / Signed up / Member) | [`Attendees/index.tsx:342-435`](../apps/web/src/Pages/Attendees/index.tsx#L342-L435) | ⚠️ `PersonRow.standing` |
| "N attended" per row | `attendedCountByUser` — a scan of **every** attendance row ([`:295`](../apps/web/src/Pages/Attendees/index.tsx#L295)) | ⚠️ `PersonRow.eventsAttended` |
| Billboard tiles (34 people / 1 signed up / 1 attended) | client counts | ⚠️ `GET /people/summary` |
| Per-row check-in time | `attendanceForEvent` map | `PersonRow.checkInTime` |
| Per-row role | `eventMembers` join | `PersonRow.role` (from `event_grants`) |
| Scope dropdown, Upcoming/Past groups | client split | `GET /events?group=` |
| "34 shown" | `filteredRows.length` | page metadata + `/people/summary` |
| Search | client `filter` | `?q=` (trigram index) |

**Semantic change to flag:** "Member" standing today means *"a `users` row with no attendance and no
sign-up"* — i.e. mostly the seeded `@example.com` fixtures visible in
[`tablet-attendees.png`](../audit/shots/tablet-attendees.png). Post-rebuild it means *"a person on this
org's roll who hasn't yet attended anything"*, which is what the label always implied. The count will
drop sharply once the seed fixtures go (D10). **Expected, not a regression** — but it will look like
one, so it belongs in the release note.

### 10.3 `/events/$id` — event detail

| Value | Today | New source |
|---|---|---|
| Derived `status` pill | client | `Event.status` |
| Check-in code `#F6F82EC3–09D` | derived from the uuid client-side | ⚠️ `Event.shortCode` — a real, collision-checked code (it gets read aloud at a door) |
| Pass QR `{eventId}:{userId}` | [`:521`](../apps/web/src/Pages/Events/EventView/index.tsx#L521) | ⚠️ `GET /events/{id}/passes/{personId}` → signed token (D12) |
| Event share QR `{origin}/e/{id}` | client | **unchanged** — a URL, deliberately stable |
| "Add to calendar" | client ICS string ([`:146`](../apps/web/src/Pages/Events/EventView/index.tsx#L146)) | ⚠️ link to `GET /events/{id}/calendar.ics` (D13) |
| Map | `useGeocodedLocation` client-side | ⚠️ `Event.location.{lat,lng}`, geocoded on write |
| Cover photo | `(ev as {imageUrl?}).imageUrl` — always `null` | ⚠️ `Event.coverUrl` (§9.1) |
| Poster QR | client canvas | **unchanged** (pure presentation) |

> **Live bug found during the walk.** The map on `/e/$id` renders **"Map unavailable"** — the
> client-side geocoder is returning **HTTP 403** (`[useGeocodedLocation] lookup failed Error: Geocoding
> failed (HTTP 403)` on every event page load; visible in
> [`tablet-landscape-public-event.png`](../audit/shots/tablet-landscape-public-event.png)). The Mapbox
> token is rejected. Moving geocoding server-side fixes this and stops shipping a geocoding token to
> the browser at all.

### 10.4 `/checkin/$eventId` — the kiosk

| Value | Today | New source |
|---|---|---|
| "N checked in" | `useState(0)` at [`:74`](../apps/web/src/Pages/CheckIn/index.tsx#L74) — per tab, resets on reload, doors disagree | ⚠️ `GET /events/{id}/checkin-state` then `GET /events/{id}/stream` (D5) |
| Scan → who is this? | `users.find(u => u.id === userId)` over the full cache ([`:161`](../apps/web/src/Pages/CheckIn/index.tsx#L161)) | ⚠️ `POST /events/{id}/check-in { pass }` — the server resolves |
| Manual check-in | two collection writes + id reconciliation | one transactional `POST` |
| "Already checked in" | client cache lookup | `response.alreadyRecorded` |
| Capacity remaining | not shown | ⚠️ **New:** `checkin-state.remaining`; `409 capacity_reached` when full (§7 gap) |
| Cover on the maximised billboard | `imageUrl` cast, always null ([`:207`](../apps/web/src/Pages/CheckIn/index.tsx#L207)) | ⚠️ `Event.coverUrl` |
| Debug drawer | client log | keep; add the last 20 `domain_events` for this event |

The maximised door-tablet billboard is the screen landscape exists for — captured at
[`tablet-landscape-checkin-maximised.png`](../audit/shots/tablet-landscape-checkin-maximised.png). Its
"0 checked in" pill is the value that becomes live and cross-door.

### 10.5 `/e/$eventId` — public page

| Value | Today | New source |
|---|---|---|
| Event + org name + `allowSelfCheckIn` | `GET /public/events/:id` | unchanged shape |
| Register → pass | `POST .../attend {mode}` | `POST /public/events/{id}/register` → returns a signed pass |
| Self check-in | same endpoint, `mode: 'checkin'` | `POST /public/events/{id}/check-in` |
| Capacity / "Full" | not shown | ⚠️ **New:** `capacityRemaining`; register returns `409 capacity_reached` |
| Cover | absent | ⚠️ `coverUrl` |
| Map | client geocode (**403 today**) | ⚠️ server-side `lat`/`lng` |
| After registering | pass rendered into React state — **closing the tab loses it** | ⚠️ `pass.url` returned by `register`; page redirects to `/p/{token}` and the same URL is emailed (D17) |
| "Didn't get the email?" | does not exist | ⚠️ **New:** `POST /public/events/{id}/resend-pass` |

### 10.5a `/p/$token` — **new route** (D19)

The one genuinely new screen in this plan, and the smallest. It reuses `EventView`'s `public` variant
almost wholesale — billboard, when/where, the pass card that already exists at
[`EventView/index.tsx:555`](../apps/web/src/Pages/Events/EventView/index.tsx#L555) — rendered
standalone with no app shell and no auth.

| Element | Source |
|---|---|
| Pass QR | the token from the URL — no derivation, no lookup |
| Holder name | `pass.person.firstName` + last initial (never the email — T35) |
| Event billboard, when/where | `GET /p/{token}` |
| "Check in" button | shown iff `canSelfCheckIn`; posts to `/p/{token}/check-in` |
| "Add to calendar" | `/p/{token}/calendar.ics` |
| Expired / revoked / cancelled | `410` → a plain "this pass is no longer valid" state, with the organiser's name so the holder knows who to ask |

**No design decision is required** — it is the existing public event page with the pass card promoted
to the top. That is deliberate: a new visual language for the one screen an attendee sees most would be
the wrong place to spend design effort.

### 10.5b `/me/tickets` — **new route** (D17)

Reachable from the profile menu once signed in. Renders the same event row component `/events` uses,
grouped upcoming/past, with the **organisation name shown on every row** — because unlike every other
list in the app, this one spans organisations.

| Element | Source |
|---|---|
| Ticket list | `GET /me/tickets` — `scope: 'account'`, no `X-Organization-Id` |
| Org name per row | `Ticket.organizationName` ⚠️ — load-bearing here, not decoration |
| Row → pass | link to `/p/{token}` |
| "Find my past registrations" | `POST /me/claim` on first visit, then a manual retry button |

⚠️ **The empty state carries the explanation:** "Tickets you get from events you attend show up here.
Being on this list doesn't give you access to the organiser's account." That sentence is the user-facing
half of the guarantee T29 enforces.

### 10.6 `/analytics`

Every number is fabricated today ([`analytics/index.ts`](../services/core/src/analytics/index.ts)).
The contract in [`packages/lib/src/analytics/index.ts`](../packages/lib/src/analytics/index.ts) is
mostly right and mostly survives.

| Contract field | Fate |
|---|---|
| `kpis.*`, `stats`, `attendanceTrend`, `checkInsSeries`, `attendanceMix`, `arrivalsByHour`, `checkInMethods`, `funnel`, `dwell`, `topEvents`, `goal` | **kept**, backed by real aggregates over `attendance` + `domain_events` |
| `tiers` | ⚠️ **removed** (loyalty, brief §4.1) |
| `loyalty: { pointsIssued, tierUpgrades, activeStreaks }` | ⚠️ **removed** |
| `recentActivity` | **kept**, now the real `domain_events` feed |

⚠️ **A headline KPI tile disappears.** The top row currently reads
*Events this period · Total members · **Active streaks** · Live now* — see
[`tablet-landscape-analytics.png`](../audit/shots/tablet-landscape-analytics.png). "Active streaks" is
`kpis` fed from `loyalty` and has no successor. **Recommendation:** replace it with **Repeat rate**,
which is already in the contract (`kpis.repeatRate`), is the metric a church or society actually cares
about, and needs no layout change. The "Sample data" badge is removed at the same commit.

### 10.7 `/profile`, `/organizations`, `OrgSelector`

| Value | Today | New source |
|---|---|---|
| Org list | `organizationCollection` — **every org in the database** | ⚠️ `meContext.organizations` (memberships only) |
| Active org | auto-selects `organizations[0]` at [`OrgSelector/index.tsx:64`](../apps/web/src/containers/OrgSelector/index.tsx#L64) — **the line that produces the shared identity** | ⚠️ **Deleted.** Zero orgs ⇒ onboarding; one ⇒ that one; several ⇒ last used, persisted per account |
| Profile block "Israel / iz@credopass.com" | **hardcoded** at [`OrgSelector/index.tsx:113-118`](../apps/web/src/containers/OrgSelector/index.tsx#L113-L118) | ⚠️ `GET /me` |
| Plan badge | `org.plan` | unchanged |
| Members list | `GET /organizations/:id/members` (unscoped) | `GET /organizations/{id}/members`, permission-gated |
| Premium toggle | flips `localStorage` | ⚠️ **Removed.** Replaced by real entitlements; keep a dev-only override behind `import.meta.env.DEV` |

### 10.8 `/upgrade` and `/login` — the loyalty copy consequence

Brief §4.1 asks for the copy consequence of deleting loyalty. It reaches **two** screens, not one:

| Location | Current copy | Action |
|---|---|---|
| [`Upgrade/index.tsx:9`](../apps/web/src/Pages/Upgrade/index.tsx#L9) | "Earn loyalty points at every event" | ⚠️ replace — suggest "Keep every check-in on your record" |
| [`Upgrade/index.tsx:25,29`](../apps/web/src/Pages/Upgrade/index.tsx#L25) | Pass mock showing **"Points"** and **"Tier"** stat blocks | ⚠️ replace with "Events" and "Since" (same layout, two stat blocks — **no redesign**) |
| [`Upgrade/index.tsx:82`](../apps/web/src/Pages/Upgrade/index.tsx#L82) | "…start climbing the loyalty tiers." | ⚠️ replace — "…and keep your attendance history." |
| **`/login` marketing panel** | "Attendance, membership and **loyalty** for live events" and "Member **loyalty** & analytics dashboard" — see [`tablet-landscape-login.png`](../audit/shots/tablet-landscape-login.png) | ⚠️ **Not previously flagged.** Same treatment |

No layout changes on either screen — string swaps only.

### 10.9 Proposed workflow deltas (accept/reject individually)

Each is separable. Rejecting any one leaves the rest of the plan intact.

| # | Delta | Why | Cost | Recommend |
|---|---|---|---|---|
| **D-A** | **Onboarding: "Create your organisation"** | Once tenancy is enforced a new account correctly sees nothing and has nowhere to land. Without this, Phase 1 *breaks the product* | 1 screen, 1 endpoint (already in §5.2) | **Accept — it is a prerequisite, not a feature** |
| **D-B** | **Invitations** | `invitedBy`/`invitedAt`/`acceptedAt` are modelled but unwired; a second person cannot join an org. CredoPass is not multi-user without it | `invitations` table, 4 endpoints, 1 email template, 1 accept screen | **Accept** |
| **D-C** | **Scoped kiosk device tokens** (D9) | A door tablet currently holds a full org session | 1 table, 4 endpoints, a pairing screen | **Accept** — highest security value after tenancy |
| **D-D** | **Capacity enforced at check-in** | Capacity is stored and displayed but never enforced | `enforce_capacity` flag + one check | **Accept** — opt-in per event, so no behaviour change unless enabled |
| **D-E** | **No-show finalisation on close** | Currently inferred at render time, so "no-show" is not a recorded fact and can't be corrected or audited | Scheduler job + `attendance.state` | **Accept** — falls out of D2 |
| **D-F** | **Check-out** | `requireCheckOut`/`checkOutTime` modelled, no UI or endpoint. Unlocks the `dwell` analytics panel that already exists in the contract | 1 endpoint + a kiosk mode toggle | **Accept** — small, and the contract already assumes it |
| **D-G** | **Recurring events** (D3) | "Weekly Sunday service" is the maintainer's stated case; today it is manual re-creation | `event_series`, 6 endpoints, a job, composer UI | **Accept, but Phase 5** — it is the largest delta and nothing else depends on it |
| **D-H** | **`person_tags`** (D7) | Cheap answer to "organisations-as-groups" without a second scoping dimension | 2 tables, filter param, chip UI | **Defer** — post-MVP; the model supports it whenever wanted |
| **D-I** | **`external_auth` check-in** | A `checkInMethod` value and two org columns exist; nothing implements it | Provider abstraction + secret storage | **Reject for now.** No named customer. Dropping the two columns (§3.2) until there is one |
| **D-J** | **`POST /people/{id}/merge`** | Find-or-create-by-email inevitably produces duplicates (typos, `+` aliases) | 1 endpoint | **Accept** — cheap insurance |
| **D-K** | **Emailed pass + `/p/{token}` page** (D17/D19) | An attendee's pass currently survives only as long as their browser tab. This is the Eventbrite flow, and the product does not work on a phone without it | `passes` + `email_deliveries` tables, Resend, 1 route, 4 endpoints | **Accept — this is the attendee product**, not a nicety |
| **D-L** | **`/me/tickets` + claiming** (D17) | An attendee's identity is personal and spans organisers. Also the screen that makes "attending ≠ belonging" legible to a user | 3 endpoints, 1 route, `people.account_id` | **Accept** — small, once D-K exists |
| **D-M** | **Enterprise SSO: per-org IdP + verified domains** (D1) | Table-stakes for any org above a few dozen people; retrofitting identity later is the most expensive refactor there is | 2 tables + issuer registry in **Phase 1**; the OIDC/SAML flows in **Phase 7** | **Accept the schema now, defer the flows.** The schema is cheap; re-modelling identity later is not |
| **D-N** | **Drop `draft`** (D2) | Never produced by any code path — the composer hardcodes `'scheduled'` | negative (removes a column, an endpoint, a permission) | **Accept** — your call, and the code agrees with it |

### 10.10 `apps/mobile`

**Correction to the brief's framing.** The mobile app needs no migration, because it has no data
wiring to migrate. Every screen is a stub:

```tsx
// apps/mobile/src/screens/Events/EventListScreen.tsx
// TODO: Implement using useEvents hook from @credopass/lib
return <View><Text>Event List Screen - To be implemented</Text></View>;
```

That pattern holds across all 13 screens (`Events`, `Members`, `CheckIn`, `Analytics`,
`Organizations`, `Home`, `Tables`). `grep -rn "getCollections" apps/mobile/src` returns **nothing**;
the only integration point is `configureAPIClient` in
[`apps/mobile/src/app.tsx:8`](../apps/mobile/src/app.tsx#L8).

**So the mobile plan is one line:** point `configureAPIClient` at the generated client and the app is
*unblocked* — it gains a fully typed, decided API to build against, which is strictly better than the
position it is in now. It is **out of scope** for this rebuild's phases; nothing in Phases 0-6 depends
on it, and nothing in it will break.

---

## 11. Phased execution plan

Each phase is independently shippable, independently verifiable, and independently revertible. Every
phase ships the API change **and** the client screens that consume it — there is no "big-bang client
rewrite" phase, because that could not be shipped safely.

```mermaid
gantt
    dateFormat X
    axisFormat %s
    section Security
    P-1 Revoke anon (do today)      :crit, p0, 0, 1
    section Rebuild
    P0 Foundations                  :p1, 1, 3
    P1 Identity + tenancy           :crit, p2, after p1, 4
    P2 Events + people reads        :p3, after p2, 3
    P3 Writes + delete local-first  :p4, after p3, 3
    P4 Domain events + live kiosk   :p5, after p4, 3
    P5 Recurrence                   :p6, after p5, 3
    P6 Media + entitlements + real analytics :p7, after p6, 4
    P7 Enterprise SSO (OIDC/SAML)   :p8, after p7, 3
```

---

### Phase −1 — Revoke `anon` **(do this before reading further)**

| | |
|---|---|
| **Scope** | Drop the seven permissive policies; `REVOKE ALL … FROM anon`. Nothing else |
| **Depends on** | Nothing |
| **Landed when** | The `curl` in [§9.5](#95-secrets--what-is-actually-at-risk) returns `401`/empty, and the web app still works end to end |
| **Risk** | Something reads PostgREST directly that we have not found. **Low** — the client goes through the API |
| **Rollback** | Re-apply `rls_dev_permissive.sql` (30 seconds) |

---

### Phase 0 — Foundations (no user-visible change)

| | |
|---|---|
| **Scope** | Local Supabase + MinIO; un-ignore and commit `drizzle/`; `@hono/zod-openapi` + Scalar skeleton; problem+json error envelope; `defineRoute` + the startup assertion; the `TenantContext` brand and `scoped()` repo layer (unused); **the full adversarial suite from [§7.3](#73-adversarial-test-matrix), written and red**; contract test harness; CI |
| **Depends on** | Phase −1 |
| **Landed when** | `GET /api/v1/health` and `/api/v1/docs` serve; `bun test` shows 28 failing tenancy tests and 0 failing others; adding a route without `permission` fails to boot (proved by a test); `supabase start && bun start` works with **no** remote credentials |
| **Risk** | Low. Nothing user-facing moves |
| **Rollback** | Additive only — `/api/core/*` untouched |

---

### Phase 1 — Identity, tenancy, onboarding ⚠️ **the P0**

| | |
|---|---|
| **Scope** | `accounts` · `identities` · `org_identity_providers` · `org_domains` · `people` · `invitations`; migrate `users` → the split; the **issuer registry** with Supabase as its only entry (D1); caller resolution keyed on `(iss, sub)`; tenant middleware; RLS policies **including the self-scope branch** ([§7.2](#72-layer-2--rls)) + the completeness assertion; `GET /me`, `/me/context`, org CRUD, members, invitations (D-B). **Client:** `OrgSelector` (delete the `organizations[0]` fallback), `/profile`, onboarding screen (D-A), login → `/me/context` |
| **Depends on** | Phase 0 |
| **Landed when** | **All 47 adversarial tests green**; a brand-new guest sees onboarding, not "Kharis Church"; the anon-key probe returns nothing; two seeded orgs cannot see each other in a manual walk; T47's grep test proves no code path matches a caller by email |
| **Note** | The SSO **schema and registry** land here; the OIDC/SAML **flows** are Phase 7. Doing the schema now costs two tables and makes Phase 7 additive rather than a re-model |
| **Risk** | **Highest in the plan.** Once RLS bites, any row without a resolvable membership vanishes. Mitigate: run the import (D10) into a staging DB first and diff row counts per table before/after |
| **Rollback** | Feature-flag `TENANCY_ENFORCED`. Off ⇒ the old unscoped path. Keep the flag for exactly one release, then delete it — a permanent bypass flag is a permanent vulnerability |

---

### Phase 2 — Events and people read paths

| | |
|---|---|
| **Scope** | `EventService` (the one `deriveStatus`), `PeopleService` (standing + lifetime counts); `GET /events`, `/events/summary`, `/events/calendar`, `/events/{id}`, `/people`, `/people/summary`, `/people/{id}`, `/events/{id}/attendees`. **Client:** `/events` and `/attendees` fully off collections for reads |
| **Depends on** | Phase 1 |
| **Landed when** | `/attendees` renders identical badges and counts to today with **zero** `useMemo` derivation; `/events` hero and calendar match; the 150-line block at [`Attendees/index.tsx:342`](../apps/web/src/Pages/Attendees/index.tsx#L342) is deleted; a golden-file test diffs old-vs-new standing for a seeded fixture |
| **Risk** | Standing semantics drift subtly (the "Member" change in [§10.2](#102-attendees)). Mitigate with the golden-file test and the release note |
| **Rollback** | Per-screen — collections still exist until Phase 3 |

---

### Phase 3 — Write paths, and local-first deleted

| | |
|---|---|
| **Scope** | `AttendanceService` + `PassService` + `TicketService` + `NotificationService`; `passes` and `email_deliveries` tables; Resend + DNS (D18); `POST /events/{id}/check-in`, `/register`, `/check-out` (D-F), capacity (D-D); public register/check-in split, `resend-pass`; **`/p/{token}` and `/me/tickets` (D-K, D-L)**; device tokens (D-C); event + person create/update/delete; idempotency + client ids (D11). **Client:** kiosk, `/e/$id`, the two new routes, both composers. **Delete `packages/api-client/src/collections/` entirely, including `persisted-ids.ts`** |
| **Depends on** | Phase 2. **DNS (SPF/DKIM/DMARC) must be live before the first send** — start it in Phase 2, it has propagation lag |
| **Landed when** | Every `getCollections()` call site is gone (`grep -r getCollections apps/` returns nothing); the concurrent-check-in test (T27) is green; a double-tapped check-in produces one row; `persisted-ids.ts` is deleted; **register on a phone, close the browser, open the email on a laptop, and check in at the door** — the full D17 walk; T29-T40 green |
| **Risk** | Two critical paths at once. Check-in: ship behind `USE_NEW_CHECKIN` for a week with both paths writing, and diff. Email: deliverability is the unknown — send to a seed list across Gmail/Outlook/iCloud and check spam placement **before** the first real attendee sees it |
| **Rollback** | Flags per surface. The pass URL is returned in the response body regardless of mail, so even total mail failure leaves registration working |

---

### Phase 4 — Domain events, live kiosk, lifecycle jobs

| | |
|---|---|
| **Scope** | `domain_events` + dual-write; `LISTEN/NOTIFY` → SSE hub; `GET /events/{id}/stream` + `/checkin-state`; scheduler (close events, finalise no-shows — D-E); audit surface in the debug drawer. **Client:** kiosk live counter |
| **Depends on** | Phase 3 |
| **Landed when** | Two browser tabs on the same event show the same count within 1 s of a check-in; killing the SSE connection and reconnecting replays the gap with no duplicates (`Last-Event-ID` test); an event past its window shows `completed` and its no-shows are **recorded rows**, not inferences |
| **Risk** | SSE connection leaks under Cloud Run scaling. Mitigate: a connection-count metric plus a hard cap per instance |
| **Rollback** | Fall back to 10 s polling of `/checkin-state` — same data, worse latency |

---

### Phase 5 — Recurrence (D-G)

| | |
|---|---|
| **Scope** | `event_series`, materialisation job, `?scope=this\|this_and_following\|all`, exceptions, series ICS, composer "Repeats" control |
| **Depends on** | Phase 4 (uses `event.*` domain events) |
| **Landed when** | A weekly Sunday series materialises 26 weeks; cancelling one week leaves the others intact and its share URL resolving; a DST-boundary occurrence stays at 10:00 local (an explicit test across the March and October transitions); "this and following" splits the series without touching past attendance |
| **Risk** | Edit semantics are genuinely hard. Mitigate: ship `this` + `all` first; `this_and_following` in a follow-up |
| **Rollback** | Series are additive — one-off events are unaffected |

---

### Phase 6 — Media, entitlements, real analytics

| | |
|---|---|
| **Scope** | S3 + presigned uploads + derivatives + sweeps; `EntitlementService` + Stripe webhook stub (D15); `AnalyticsService` over real data; server-side geocoding; the loyalty copy changes ([§10.8](#108-upgrade-and-login--the-loyalty-copy-consequence)); "Sample data" badge removed |
| **Depends on** | Phase 4 (analytics reads `domain_events`) |
| **Landed when** | An event cover uploads, renders on `/e/$id`, the kiosk billboard and the poster; `/analytics` shows real numbers for a seeded org and **zeroes** for an empty one; the Pro overlay gates on `organizations.plan`, not `localStorage`; the map renders (fixing the live 403) |
| **Risk** | Real analytics will look "wrong" next to the fabricated numbers people are used to. Mitigate: ship with a "now showing real data" note |
| **Rollback** | Per-feature flags; the fabricated generator stays in the tree until analytics is signed off |

---

### Phase 7 — Enterprise SSO (D1, D-M)

| | |
|---|---|
| **Scope** | The OIDC authorization-code flow and the SAML assertion flow against the `org_identity_providers` config landed in Phase 1; `GET /auth/realm` home-realm discovery; DNS TXT domain verification; JIT provisioning; `enforce_sso`; the SSO settings panel on `/profile` |
| **Depends on** | Phase 1 only — it is additive to the schema and registry already shipped, which is the whole reason for landing those early |
| **Landed when** | A test tenant with a real Okta dev instance signs in end to end; a user at a verified domain is routed to their IdP; JIT creates the account at `default_role` and **not above**, whatever the IdP asserts (T46); an unverified domain does nothing (T41); `gmail.com` is refused even with valid DNS proof (T42) |
| **Risk** | SAML is genuinely fiddly, and a broken sign-in path locks out a paying customer. Mitigate: OIDC first (covers Okta, Entra, Google Workspace, Auth0); SAML only when a customer needs it; **never** enable `enforce_sso` without a break-glass owner account on password auth |
| **Rollback** | Per-org `enabled` flag on the IdP row — disabling it falls back to Supabase auth immediately, with no deploy |

---

### Explicitly **not** in scope

- Stripe checkout, customer portal, proration, dunning (D15 — webhook stub only)
- `external_auth` check-in (D-I — rejected; the two org columns are dropped)
- `apps/mobile` implementation ([§10.10](#1010-appsmobile) — unblocked, not built)
- Offline / optimistic caching — deleted, not deferred; may return **later** as a pure cache over an
  API that already decides everything
- A nested `groups` entity (D7) and `person_tags` (D-H, deferred)
- Push notifications, email **digests** or any marketing send (transactional only — D18)
- **SCIM provisioning** — the schema is ready (`provisioned_by`, `external_id`); the endpoints are not built
- Apple/Google Wallet passes — `/p/{token}` is the substrate they'd hang off, so this stays open
- Paid ticketing, seat selection, waitlists — CredoPass records attendance, it does not sell tickets
- i18n
- `apps/website` (marketing) — untouched throughout

---

## 12. Testing strategy

### 12.1 The layers

| Layer | Tool | What it covers | Runs |
|---|---|---|---|
| **Unit (services)** | `bun test` | Domain logic with fake `Clock`, in-memory repo, fake `EventBus`. `deriveStatus` boundaries; standing computation; capacity; no-show finalisation; RRULE expansion incl. DST | every commit, <5 s |
| **Contract** | `openapi-response-validator` middleware, test-mode only | **Every** response in the integration suite validated against the emitted schema. A response the doc doesn't describe **fails the test** | every commit |
| **Integration** | `bun test` + Testcontainers Postgres | Real DB, real migrations, real RLS, real transactions | every commit, <90 s |
| **Adversarial tenancy** | dedicated suite, own CI job | The 47 cases in [§7.3](#73-adversarial-test-matrix) — tenancy, attendee scope, and enterprise identity | every commit; **a failure blocks merge unconditionally** |
| **Structural** | boot + migration assertions | Undeclared route ⇒ boot failure (T25); table without an RLS policy ⇒ CI failure (T24) | every commit |
| **E2E** | Playwright | The kiosk flow and the public register→pass→check-in flow, on the tablet-landscape viewport already used for [`audit/shots/`](../audit/shots/) | pre-release |
| **Load** | k6 | 50 concurrent check-ins on one event; 20 concurrent SSE streams | before Phase 4 ships |

### 12.2 Which tests come before which phase

| Written in | Tests | Must be |
|---|---|---|
| **Phase 0** | All 47 adversarial tests · structural assertions (T24, T25, T47) · contract harness | **RED.** This is the whole point — a tenancy bug's failure mode is silent leakage that passes every happy-path test |
| **Phase 1** | Caller resolution by `(iss, sub)`; membership scoping; **self-scope RLS** (direct SQL as `credopass_api` asserting the read/write asymmetry of T32); invitation lifecycle; last-owner protection; domain-verification refusals | green by phase end; T1-T14, T20-T23, T26, T41-T47 flip green |
| **Phase 2** | `deriveStatus` boundary + **precedence** table (below); standing golden-file; pagination stability under concurrent inserts | green |
| **Phase 3** | **Check-in suite** (below); **the D17 attendee walk** (below); idempotency replay; client-supplied id honoured; pass signature/forgery/expiry/revocation; mail idempotency and suppression | green; T12, T27-T40 flip green |
| **Phase 4** | SSE replay with `Last-Event-ID`; no gap, no duplicate; transactional event-log consistency (roll back the state change, assert no orphan event); scheduler idempotency | green; T18 flips green |
| **Phase 5** | RRULE expansion; DST across both transitions; exception preservation under `scope=all`; series ICS validity | green |
| **Phase 6** | Presigned prefix confinement (T16); HEAD-verifies-size; entitlement gating; analytics aggregates against a known fixture (exact numbers, not ranges) | green |
| **Phase 7** | OIDC round trip against a containerised IdP (Keycloak); JIT never exceeds `default_role` (T46); `enforce_sso` leaves a break-glass owner reachable | green |

### 12.3 The check-in flow specifically

The product's critical path gets its own suite. Every case runs against a real Postgres.

| Case | Expectation |
|---|---|
| First check-in, known person | `201`, `state='attended'`, `check_in_time` set, `attendance.recorded` emitted |
| Repeat check-in, same person | `200`, `alreadyRecorded: true`, **`check_in_time` unchanged**, no second event emitted |
| **Concurrent check-in, two doors, same person** | Exactly one row. Both `200`. One `alreadyRecorded`. No deadlock, no unique-violation leaking as a `500` |
| Walk-in (name + email, no person row) | Person created in **this** org; `people` unique index respected; a same-email person in another org is untouched (**the T20 pairing**) |
| Walk-in whose email exists in this org | Existing person reused; no duplicate |
| Registered person checks in | `registered` → `attended`; `registered_at` preserved |
| Check-in on a `completed` event | `409 event_closed` |
| Check-in on a `cancelled` event | `409 event_closed` |
| Capacity full, `enforce_capacity=true` | `409 capacity_reached`; `event.capacity_reached` emitted once, not per attempt |
| Capacity full, `enforce_capacity=false` | `201` — capacity is advisory (preserves today's behaviour) |
| Forged pass | `400 invalid_pass` |
| Expired pass | `400 pass_expired` |
| Pass for a different event | `400 invalid_pass` — **not** a check-in on the wrong event |
| Device token, wrong event | `403 out_of_scope` |
| Revoked device token | `401 token_revoked` |
| Same `Idempotency-Key`, different body | `409 idempotency_key_reuse` |
| Public self check-in, `allow_self_check_in=false` | `403 self_checkin_disabled` |
| Public check-in, rate limit exceeded | `429` + `Retry-After` |

### 12.3a The attendee walk (D17) — one end-to-end test, run on every build

The scenario from your question, automated exactly as stated. It crosses three "devices" (three
isolated HTTP clients with no shared cookie jar), which is the only way to prove the pass is durable
rather than session-bound.

| Step | Client | Assertion |
|---|---|---|
| 1 | Phone, no account | `GET /public/events/{id}` → `200`, no auth header sent |
| 2 | Phone | `POST .../register` → `201`; body contains `pass.url`; **no `org_memberships` row exists** (T29) |
| 3 | — | An `email_deliveries` row is `queued` for that address with template `pass_issued` |
| 4 | **Discard the phone client entirely** | simulates closing the tab |
| 5 | Laptop, fresh client | `GET /p/{token}` from the email body → `200`, correct event, first name + last initial, **no email address in the body** (T35) |
| 6 | Laptop | `GET /p/{token}/calendar.ics` → valid ICS with CRLF, `UID`, `DTSTAMP` |
| 7 | Kiosk, device token | `POST /events/{id}/check-in {pass}` → `200`, `state='attended'` |
| 8 | Kiosk again | same call → `200`, `alreadyRecorded: true`, `check_in_time` **unchanged** |
| 9 | Laptop, now signs in with that email, verified | `POST /me/claim` → `claimed: 1` |
| 10 | Laptop | `GET /me/tickets` → contains the ticket, with `organizationName` |
| 11 | Laptop | `GET /events` → **empty**, `/me/context` shows **zero organisations** (T29 again, from the other side) |
| 12 | Laptop | `PATCH /attendance/{id}` on that row → `403` (T32) |

Steps 2, 11 and 12 are the ones that would catch the failure you were worried about: attending an
event silently granting access to the organiser's tenant.

### 12.4 `deriveStatus` boundary table

The rule is duplicated in three places today and is the most-touched piece of logic in the product.
It gets an exhaustive table test:

| `cancelled_at` | `closed_at` | now vs. window | Expected |
|---|---|---|---|
| set | any | any | `cancelled` — **wins over everything**, including a past event |
| — | set | any | `completed` regardless of the clock |
| — | — | `now < start` | `scheduled` |
| — | — | `now == start` (exact) | `ongoing` |
| — | — | `start < now < end` | `ongoing` |
| — | — | `now == end` (exact) | `ongoing` |
| — | — | `now > end` | `completed` |
| — | — | `end == start` (zero length) | impossible — the write-time default forces `end = start + 1h` |

Precedence order is asserted explicitly, because it is the one thing a reimplementation gets wrong:
**`cancelled` > `completed` > `ongoing` > `scheduled`**. A cancelled event that is also past reads
`cancelled`, not `completed` — the organiser needs to see *why* it didn't happen.

### 12.5 The honest bit

The current suite is one 133-line file that **skips itself entirely** when `DATABASE_URL`,
`SUPABASE_URL` or `SUPABASE_ANON_KEY` are absent
([`routes.test.ts:22`](../services/core/src/test/routes.test.ts#L22)) — so in a bare CI checkout it
reports success while running nothing. That pattern does not survive: after Phase 0, Testcontainers
means the DB is always available, and a suite that cannot connect **fails** rather than skips.

---

## 13. Disagreements, corrections and responses

Stated plainly, as asked.

1. **"`apps/web/.env` and `services/core/.env` are committed with live credentials" (§3.4) is not
   true.** They are gitignored, untracked, and were never committed. But the real exposure is *worse*
   than the claim: the permissive RLS policies plus the by-design-public anon key mean the database may
   be directly readable and writable by anyone with the site open. See
   [§9.5](#95-secrets--what-is-actually-at-risk). Fix that today, before any of this plan.

2. **The brief asks for the mobile app to get "the same treatment" (§9.10). There is nothing to
   treat.** All 13 mobile screens are `TODO: Implement` stubs; `getCollections` appears zero times in
   `apps/mobile`. Presenting mobile as a migration would be padding. It is unblocked by this work, not
   migrated by it. ([§10.10](#1010-appsmobile))

3. **I differ from [MULTI-TENANCY.md](MULTI-TENANCY.md)'s guest recommendation, and the brief endorses
   it (§5.2).** That document says guests get no user row and stay confined to the public surface. But
   `/login`'s "Continue as guest" currently lands you in the console, and §2 says workflows must not
   change. Confining guests to `/e/$id` *would* change it. My answer (D16) keeps the workflow and
   removes the leak: a guest reaches the console with **zero memberships** and lands on onboarding.
   That also gives `/upgrade` — a screen that already exists to convert a guest into an account — a real
   job instead of a decorative one.

4. **The brief's framing that `users.id` lacking an `authId` link is "the keystone defect" (§3.3) is
   one level too shallow.** Adding `authId` to `users` would let the server identify its caller, but
   `users` would still be a *global* table with a *globally* unique email, conflating operators with
   attendees. Two orgs still could not both have `john@gmail.com` on their rolls, and a person would
   still have no tenant. The keystone is the **`accounts` / `people` split** ([§3.2](#32-table-by-table));
   `identities` falls out of it for free and supports Okta/BetterAuth as §5.2 asks.

5. **On "the API is the product, not the UI" — agreed, and the plan is built on it. One caveat worth
   recording.** Taken as the design principle it is (rather than a literal portability promise), it
   holds throughout: every screen in [§5.12](#512-coverage-proof--every-screen-maps-to-endpoints) maps
   to endpoints, and nothing in `apps/` decides anything. The caveat: **the tenancy guarantee is not
   purely an HTTP-layer property.** RLS policies, `SET LOCAL app.account_id`, `app.current_org_ids()`
   and `LISTEN/NOTIFY` are Postgres-specific and are the *second* of the two enforcement layers. A
   reimplementation against the same Postgres inherits it; one against a different datastore has to
   re-earn it, and would be a strictly weaker system if it didn't. Worth writing down so nobody
   discovers it during a migration.

6. **On dropping `draft` and `cancelled` — I took half of it and used the request to remove something
   larger.** `draft` goes: verified dead, never produced by any code path. `cancelled` stays: it is in
   the past-filter group and both the kiosk and event view branch on it, and "just delete the event"
   loses the attendee roll and 404s every link already printed on a poster. But the request pointed at
   something better than either — **the enum itself**. Two nullable timestamps and a pure derivation
   function replace a 5-value column, a 3-value column, a publish endpoint, a permission, and every
   transition guard ([D2](#d2--no-lifecycle-enum-status-is-derived-from-timestamps)). That is a larger
   simplification than dropping both states would have been, and it makes a stale status structurally
   impossible rather than merely unlikely.

7. **On "don't tie auth to a vendor" — the instinct is right, aimed one level off.** Outsourcing
   *authentication* is correct and universal; outsourcing *authorization* is the mistake. The plan
   keeps Supabase as an issuer, moves the identity model into four tables we own, and makes the
   verifier a registry keyed on `iss` so a tenant's Okta is a config row rather than a deploy
   ([D1](#d1--identity-is-ours-idps-are-pluggable-the-answer-to-52)). The concrete test of whether
   this was done right is T47: **no code path anywhere identifies a caller by email address.** Today
   exactly one does ([`org-memberships.ts:97`](../services/core/src/routes/org-memberships.ts#L97)),
   and it is the only authorization check in the entire system.

8. **`GET /events/{id}/calendar.ics` is not optional presentation (§3.1 leaves it open).** The current
   client-side ICS emits `\n` line endings with no `UID` or `DTSTAMP`
   ([`EventView/index.tsx:146`](../apps/web/src/Pages/Events/EventView/index.tsx#L146)) — that is invalid
   per RFC 5545 and some clients reject it outright. Serving it is a bug fix, not a preference (D13).

9. **Three things the brief does not list that are more urgent than several things it does.** The pass
   QR is forgeable (D12); the kiosk holds a full org session (D9); and an attendee's pass does not
   survive a closed browser tab (D17). The first two are exploitable by anyone who walks past a door
   tablet or reads one URL. The third is not a security issue but is the reason the attendee half of
   the product does not currently work on a phone. All three belong above recurrence and analytics in
   priority order, which is where I have put them.

---

## Appendix A — screenshots captured for this plan

14 tablet-landscape shots at 1180×900 (the rotation of the existing 900×1180 portrait set), in
[`audit/shots/`](../audit/shots/):

`tablet-landscape-login` · `events` · `events-new` · `event-detail` · `event-edit` · `attendees` ·
`attendees-new` · `checkin-kiosk` · **`checkin-maximised`** · `analytics` · `profile` ·
`organizations` · `upgrade` · `public-event`

`checkin-maximised` is additional to the portrait set: landscape *is* the door-tablet case, and the
maximised billboard is the screen that mode exists for.

Two live defects surfaced during the walk, both recorded above:
the Mapbox geocoder returns **403** on every event page ([§10.3](#103-eventsid--event-detail)), and the
kiosk counter reads `0 checked in` from per-tab `useState` ([§10.4](#104-checkineventid--the-kiosk)).
