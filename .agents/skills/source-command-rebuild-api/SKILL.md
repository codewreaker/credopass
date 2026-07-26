---
name: "source-command-rebuild-api"
description: "Produce the in-depth implementation plan for rebuilding CredoPass as an API-first platform (services layer, OpenAPI contract, real tenancy, no local-first)"
---

# source-command-rebuild-api

Use this skill when the user asks to run the migrated source command `rebuild-api`.

## Command Template

# Brief: plan the CredoPass API-first rebuild

You are the senior engineer owning a ground-up rebuild of the CredoPass **backend** — the API, the
domain layer, and the data model. Your deliverable for this task is **a plan, not code**. Read this
brief in full, do your own verification pass against the repo, then produce the plan described in
§9.

---

## 1. The thesis

Today CredoPass is a React app with a database attached. Meaningful behaviour — who counts as an
attendee, whether an event is "ongoing", whether someone is a no-show, how a check-in is recorded —
is computed in browser memory from full-table client caches. The server is a generic CRUD passthrough.

After this rebuild **the product is the API**. The invariant to design against:

> If CredoPass had no web UI at all — just the API and the database — every capability the current
> product offers must still be reachable, with the same rules enforced, by an operator with `curl`.

Consequences you must hold throughout:

- The UI becomes a **rendering client**. It sends intent, receives decided answers. It never
  computes a business fact.
- **The OpenAPI document is the contract**, and it is the source of truth for every client — TS or
  otherwise. A future Go or Python backend that satisfies the same document is a drop-in replacement.
- Business logic lives in **`services/`** — plain, framework-free, injectable modules. Routes are
  thin HTTP adapters over them. A CLI, a queue worker, a cron job, or a test must be able to call
  the same service function directly, with no Hono `Context` in sight.
- Local-first is **deleted, not deferred**. It may return later as a purely optimistic cache layer
  over an API that already decides everything. Nothing in this rebuild may assume it.

## 2. The current UI is the requirements document

The web app in `apps/web` is at a state the maintainer is happy with. **Treat its screens and
workflows as the functional spec.** The rebuild:

- **MUST NOT** change the screens, the navigation, or the user-visible workflow.
- **MAY** completely rewrite the UI's data wiring — `@credopass/api-client`
- **MAY & WILL** completely dispose TanStack DB collections, every `getCollections()` call site, the in-component derivations. All of it is disposable.As we are removing the local-first layer as it has business logic
- **MAY propose workflow improvements** where the current flow is genuinely deficient (§7 lists the
  ones already identified). Propose them explicitly as deltas, with a rationale, so they can be
  accepted or rejected individually — do not smuggle them in.

Run `bun start` and walk the app yourself before planning. There are existing screenshots in `/Users/israelagyeman-prempeh/Dev-Ops/credopass/audit/shots` you just have to add shots of the tablet in horizontal-view. Note: **macOS AirPlay Receiver occupies
port 5000**, so Vite falls back to **5001**; the API is on 8080. `/login` auto-signs you in as an
anonymous Supabase guest, so the whole console is reachable without credentials.

## 3. Verified forensics — start from here, don't re-derive

Everything below was confirmed against the running system and the source. Verify anything you intend
to rely on heavily, but do not spend the budget rediscovering it.

### 3.1 Business logic currently living in the client

This is the extraction backlog. Each item is a rule that must end up behind an endpoint.

| Rule | Today | Must become |
|---|---|---|
| **Event status derivation** (`draft`/`scheduled`/`ongoing`/`completed` from the start/end window; no end time ⇒ assume 1h) | Duplicated in `packages/api-client/src/collections/events.ts` (`getStatus`) **and** `services/core/src/routes/public.ts` (`deriveStatus`). The DB never ages a status. | One server-side authority. Decide: derived-on-read vs. materialised by a scheduler (see §5.4). |
| **Attendee "standing"** — `attended` / `no-show` / `signed-up` / `member`, computed by joining users × attendance × eventMembers × the event's past/future position | `apps/web/src/Pages/Attendees/index.tsx` (~150 lines of `useMemo`) | A server-computed field on a paginated attendee-list endpoint. |
| **Lifetime attendance counts per person** (`eventsAttended`) | Same file, `attendedCountByUser` — a full scan of every attendance row in the browser | An aggregate on the API. |
| **Upcoming vs. past event split, "next event" spotlight, per-status grouping and counts** | `apps/web/src/Pages/Events/index.tsx`, `packages/lib/src/utils/events.ts` | Query parameters + server-side ordering. |
| **Check-in: find-or-create user by email, then one attendance row per (event, patron), don't double-record** | `apps/web/src/Pages/Events/use-attendee-checkin.ts` — reads `userCollection.toArray` to decide existence, i.e. **decides on a client cache** | A single transactional `POST .../check-in` on the server. |
| **Attendee → event-member linking with role** | `apps/web/src/Pages/Attendees/MemberComposer/use-member-form.ts` — two sequential collection writes plus a manual id-reconciliation step | One transactional endpoint. |
| **Premium / plan entitlement** | `apps/web/src/contexts/premium.tsx` — a `localStorage` boolean the user flips by hand | Server-issued entitlements (§5.6). |
| **Active organization selection** | `OrgSelector` auto-selects `organizations[0]` from an unfiltered global list | Derived from the caller's memberships. |
| **Analytics** | `services/core/src/analytics/` returns **deterministic fabricated numbers** behind a real contract (`packages/lib/src/analytics/index.ts`); the UI shows a "Sample data" badge and blurs most panels behind a Pro overlay | Real aggregates behind the same (or an evolved) contract. |
| **ICS generation, QR poster rendering** | Client-side string building in `EventView` | Decide: keep as pure presentation, or serve `GET /events/{id}/calendar.ics`. Recommend one. |

### 3.2 The optimistic-id hack (a symptom to design away)

`packages/api-client/src/collections/persisted-ids.ts` exists because the client generates a UUID,
the `Create*Schema` strips it, and the CRUD factory mints a different one server-side — so the
optimistic row and the real row have different keys, and any FK written from the client points at a
row that will never exist. The rebuild should make this class of problem structurally impossible.
Consider client-supplied idempotency keys and/or accepting a client-provided id.

### 3.3 Current data model (7 tables, `packages/lib/src/schemas/tables/`)

`organizations` · `orgMemberships` · `users` · `events` · `eventMembers` · `attendance` · `loyalty`

Salient details: `attendance` is unique on `(eventId, patronId)` and carries a **denormalised**
`organizationId`; `events.checkInMethods` is a `text[]` of `qr|manual|external_auth`;
`events.allowSelfCheckIn` gates whether a guest may flip their own row to attended;
`organizations` already carries `plan`, `slug`, `stripeCustomerId`, `externalAuthEndpoint`,
`externalAuthApiKey`; `orgMemberships` already has `invitedBy`/`invitedAt`/`acceptedAt` (unwired).
Every table has `.enableRLS()`.

**`users.id` is `defaultRandom()` with no link to Supabase `auth.users.id`.** This is the keystone
defect — RLS cannot be expressed and the server cannot identify its caller.

### 3.4 Current API (`services/core`)

- Hono on Bun, base path `/api/core`, port 8080. Public surface mounted *before* auth.
- `src/util/crud-factory.ts` generates GET/GET:id/POST/PUT/DELETE per table. It is riddled with
  `@ts-ignore`, **never reads the caller's identity**, treats `organizationId` as an *optional
  client-supplied query filter*, has a `requireOrganizationId` flag no route sets, and its PUT
  uniqueness check computes a query and discards the result (a no-op).
- `jwtPayload` is consumed in exactly **one** place in the entire codebase:
  `routes/org-memberships.ts` `PUT /:id/role`, matched **by email**.
- `routes/public.ts` is the one place with real domain logic (register vs. check-in, status gating,
  find-or-create patron) — and it is the correct shape. It is a useful model for the rest.
- OpenAPI is a **hand-written stub object** in `src/index.ts` listing paths with no schemas.
  Swagger UI is served at `/api/core/docs`.
- `drizzle/rls_dev_permissive.sql` grants `anon` `USING (true)` on all seven tables; the anon key
  ships in the client bundle.
- `**/drizzle/` is gitignored, and `nx run coreservice:migrate` writes to the **remote** Supabase
  instance. There is no local database and no reproducible migration history.
- `apps/web/.env` and `services/core/.env` are committed with live credentials.

### 3.5 Confirmed live behaviour

Signing in as a brand-new anonymous guest lands directly in the maintainer's organisation
("Kharis Church"), showing 34 people and every event. This is the product's defining defect.

### 3.6 Screens and routes to preserve

`/login` (guest auto-login; email/GitHub manual) · `/events` (greeting hero, next-event spotlight,
status filter, calendar rail, Pro upsell card) · `/events/new` · `/events/$id` (billboard, shareable
pass + QR, when/where/about, capacity, poster) · `/events/$id/edit` · `/attendees` (event-scoped
switcher, standing badges, summary tiles) · `/attendees/new` · `/attendees/$id/edit` ·
`/checkin/$eventId` (kiosk: Event-QR mode ↔ pass-scan mode, manual check-in sheet, success screen,
maximised door-tablet billboard, debug drawer) · `/e/$eventId` (public, token-optional: register →
pass → optional self check-in) · `/analytics` · `/profile` (**organizations live here now;
`/organizations` redirects to `/profile`**) · `/upgrade` (converts a **guest session into a real
account** — distinct from plan upgrade, which is the separate Pro upsell).

Two QR payload formats are in play and must be preserved or deliberately versioned: the **event
share URL** (`{origin}/e/{eventId}`, on posters and the kiosk billboard) and the **attendee pass**
(`{eventId}:{userId}`, scanned by the kiosk).

## 4. Explicit scope changes the maintainer has decided

1. **Delete loyalty.** The `loyalty` table, its routes, its collection, and the analytics fields that
   depend on it (`tiers`, `loyalty`, tier upgrades, streaks) come out. The `/upgrade` billboard
   currently advertises points/tiers — plan the copy-level consequence and flag it, but do not
   redesign the screen.
2. **Rethink the org selector.** Organisations were built as an ad-hoc way to make *groups*. Decide
   what the tenant boundary actually is and what, if anything, "groups" should become. This is a
   modelling decision, not a UI one — but it must not change what the org-switcher screen *does*.
3. **Delete local-first.** Remove `@credopass/api-client`'s TanStack DB collections entirely and
   replace them with a generated, typed client over the OpenAPI document.
4. **Fresh infrastructure is available.** A new Postgres/Supabase instance, an S3 bucket, and Redis
   can all be provisioned. Do not let the current schema constrain the design — but do produce a
   migration/cutover story for the existing data.

## 5. What the rebuilt platform must do

### 5.1 Tenancy isolation (the P0)

Read `docs/MULTI-TENANCY.md` — it contains a four-root-cause analysis and a phased remediation. Your
plan supersedes it (this is a rebuild, not a patch), but it must satisfy or better every guarantee
in its §5 test matrix.

The invariant: **the tenant is derived from the token, never from the request body or query string.**
A client may say *which* of its orgs it wants; it may never assert which org it belongs to.
Design for two deliberately redundant layers — application-level scoping and database RLS — and make
scoping **fail closed**: a resource with no declared tenancy rule must be a startup error, not a
silent leak.

### 5.2 Identity, roles and permissions
_ This app is currently using the supabase authentication, though it will continue to do so, during your
redesign feel-free to add tables or columns in the DB that will allow the permissions/auth/role layers
to be able to be driven by supabase, okta or betterauth.

- Link app users to Supabase `auth.uid()` properly. Resolve the caller once, server-side, per request.
- Decide the fate of **anonymous guest sessions**: they currently power the kiosk and the public
  page. Recommend a coherent model (the existing recommendation is that guests get no user row and no
  membership, staying confined to the public surface).
- Replace the two ad-hoc role enums (`owner|admin|member|viewer` at org level,
  `host|co-host|staff` at event level) with a permission model you can actually
  enforce and test. Every endpoint must declare the permission it requires. Produce the full
  **permission × role matrix** as part of the plan.
- The current `PUT /org-memberships/:id/role` email-matching check is the only authorization in the
  system. Everything else is unguarded.

### 5.3 Event lifecycle as domain events

The maintainer wants "an event-based aspect for tracking when an event starts and things happening
within the event." Design an append-only domain-event stream — event opened, doors opened, first
check-in, capacity reached, event closed, cancelled, attendance recorded, no-show finalised — that:

- gives analytics a real substrate rather than table scans,
- gives the kiosk something to subscribe to for live counts,
- provides an audit trail ("who checked this person in, when, from which device").

Address transport (SSE? WebSocket? polling? kafka? [PostgreSQL + Event Table + Redis/WebSockets]? ), durability (Postgres table vs. Redis stream), and
whether check-in becomes event-sourced or stays a mutable row with an event log beside it.
Recommend one — the kiosk needs a live "N checked in" counter across multiple doors, which today is
a `useState` local to one browser tab.

### 5.4 Recurring events

Weekly Sunday service, and the general case. Decide and justify: a recurrence rule on a series
parent with **materialised occurrences**, versus **virtual occurrences** expanded on read. Cover
exceptions (a cancelled or moved single week), edits ("this occurrence" vs. "this and following"),
attendance attribution across a series, timezone/DST correctness, and how far ahead occurrences are
generated. The current `events` table has a single `startTime`/`endTime` and no notion of a series.

### 5.5 Object storage (S3)

Event cover photos and user avatars. `EventComposer` has an "Add photo" control that is
**preview-only** — no column, no bucket, no upload. `CheckIn` and `EventView` already have
`imageUrl` seams cast in place. Plan presigned upload flow, validation, size/type limits,
image derivatives, cleanup on delete, and CDN/public-read strategy for the public event page.

### 5.6 Plans, entitlements, billing

Replace the `localStorage` boolean. The API must serve the caller's entitlements; the analytics page
must gate on real ones. `organizations` already carries `plan` and `stripeCustomerId`. Decide how far
to go: entitlement service only, or Stripe wiring too. Recommend a scope and say what you're deferring.

### 5.7 API surface, contract and documentation

- **`@hono/zod-openapi`** for every route. The document is generated from the same Zod schemas that
  validate requests — no hand-written spec, ever again.
- Swagger UI (or Scalar — recommend one) for interactive exploration.
- Design the surface **resource- and use-case-first**, not table-first. The CRUD factory produced
  seven table endpoints that forced the client to do the joins; that is the thing being replaced.
  Endpoints like `POST /events/{id}/check-in`, `GET /events/{id}/attendees?standing=no-show`,
  `POST /events/{id}/register`, `GET /me/context` are the shape to aim for.
- Specify pagination, filtering, sorting, error envelope, idempotency, and versioning **once**,
  consistently, and state them as rules the plan enforces.
- Say how the typed client is generated from the document and where it lives.

### 5.8 Non-functional

Migrations committed and reproducible; a **local** database so migrations are not tested against
production; secret rotation for the committed `.env` files; observability; rate limiting on the
public surface (it is unauthenticated and writes rows); an honest test strategy — the current suite
is one 133-line file, and the failure mode of a tenancy bug is *silent leakage that passes every
happy-path test*. Adversarial cross-tenant tests must exist and must start red.
An easy way either flag or config to switch to local supabase db and local-api.

## 6. Architectural rules the plan must encode

1. `services/` holds pure domain logic: no `Context`, no `Request`, no framework imports. Injectable
   dependencies (db, clock, storage, event bus) so it is testable and callable from anywhere.
2. `routes/` are adapters: parse → authorize → call a service → serialize. No business rules.
3. Schema-first stays: Drizzle tables generate Zod validators and TS types. Never hand-write a type
   that duplicates a table.
4. Nothing in `apps/` may contain a business rule. If a screen needs a derived fact, the API returns
   that fact.
5. Authorization is declarative and enforced centrally, not per-handler by hand.
6. Every endpoint appears in the OpenAPI document with full request/response schemas.

## 7. Workflow gaps you may propose fixing

Flag each as an accept/reject delta; do not assume approval:

- No onboarding path: once tenancy is enforced, a new user correctly sees nothing and has nowhere to
  land. "Create your organisation" as a first-run flow is a prerequisite, not a nice-to-have.
- Invitations are modelled (`invitedBy`/`invitedAt`/`acceptedAt`) but unwired — a second person
  cannot join an org.
- Check-out is modelled (`requireCheckOut`, `checkOutTime`) but has no UI or endpoint path.
- No-show finalisation is inferred at render time rather than recorded when an event closes.
- The kiosk's live count is per-browser-tab and resets on reload; two doors cannot agree.
- `external_auth` is a `checkInMethod` value and `organizations.externalAuthEndpoint`/`ApiKey` exist,
  but nothing implements it.
- Capacity is stored and displayed but never enforced at check-in.

## 8. Open decisions — resolve each with a recommendation

Do not present a survey of options. Pick, justify in a few lines, and note the trade-off:

1. Supabase (Auth + Postgres + RLS) retained, or Postgres + an auth layer you control?
2. Event status: derived on read, or materialised by a scheduler?
3. Recurrence: materialised occurrences or virtual expansion?
4. Domain events: Postgres table, Redis stream, or both?
5. Live updates to the kiosk: SSE, WebSocket, or polling?
6. Is Redis actually needed for the MVP, or is it premature? Say so if it is.
7. What replaces `organizations`-as-groups — a rename, a nested group entity, or nothing?
8. Attendance: mutable row (current), or event-sourced with a projection?
9. Does the public/kiosk surface stay a separate router, or become a scoped-token surface?
10. How does the existing production data migrate — and is it worth migrating at all?

## 9. Deliverable

A single planning document. It must contain:

1. **Executive summary** — the target architecture in one page, and what changes for whom.
2. **Decisions register** — every item in §8 plus any you surface, each with the choice, the
   reasoning, and the trade-off accepted.
3. **Target data model** — full schema with column-level detail, an ER diagram, indexes, constraints,
   and an explicit diff against the current 7 tables (added / changed / dropped).
4. **Domain services catalogue** — each service module, its responsibilities, its public functions,
   its invariants, and which UI workflow each one backs.
5. **Complete API surface** — every endpoint: method, path, auth requirement, required permission,
   request schema, response schema, error cases. Each one traceable to the screen or workflow it
   serves, so coverage is provable.
6. **Authorization model** — the full permission × role matrix and where enforcement happens.
7. **Tenancy design** — both enforcement layers, the fail-closed mechanism, and the adversarial test
   matrix (start from `docs/MULTI-TENANCY.md` §5 and extend it).
8. **Event/recurrence design** — lifecycle events, the recurrence model, and the edge cases in §5.4.
9. **Infrastructure** — S3 layout and upload flow, Redis (if justified), local dev environment,
   migration and secret-rotation plan.
10. **Client rewiring plan** — how `apps/web` moves off TanStack DB, screen by screen, with the
    generated client. **Explicitly note anywhere a screen currently renders a value the new API must
    now supply**, so nothing silently disappears. Same treatment for `apps/mobile`.
11. **Phased execution plan** — ordered, each phase independently shippable and verifiable, with
    explicit dependencies, a "how do we know this landed" check per phase, and the risks/rollback
    for each. State plainly what is *not* in scope.
12. **Testing strategy** — unit (services), contract (OpenAPI conformance), integration, adversarial
    tenancy, and the check-in flow specifically. Say which tests must be written before which phase.

**Rules for producing it:**

- Verify claims against the repo before building on them; cite `file:line` where it matters.
- Where you must assume, state the assumption inline and keep going. Only stop and ask if proceeding
  either way would waste substantial work.
- Recommend; don't enumerate. The maintainer wants a decided plan, not a menu.
- Call out anything in this brief you believe is wrong or will not work. Disagreement with reasoning
  is more useful than compliance.
- **Write no implementation code.** Schema sketches, endpoint signatures, and type definitions that
  make the plan concrete are expected and welcome — a working feature is not.
