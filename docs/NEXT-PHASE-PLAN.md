# Next phase — the public API, data ownership, and the product backlog

> **Status: plan only. Nothing here is built.** Written 2026-11-06 from a list of ideas, grounded
> against the code as it stands that day.
>
> Two halves, deliberately separated because they have different audiences, different risk and
> different timelines:
>
> - **Part A — the CredoPass API** (§1–§4). A paid, public, read-only API with webhooks, a test
>   mode, and a data-ownership story for churches that will not hand over member PII. This is a
>   *product line*, not a feature. It is Phase 8 in the [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md)
>   numbering.
> - **Part B — the product backlog** (§5). Fixes and features for the app people already use. Two
>   of these are **confirmed bugs**, one of them severe.
>
> Companions: [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) (the architecture and the phase map) ·
> [`REBUILD-LOG.md`](REBUILD-LOG.md) (what actually happened — **wins over any plan**) ·
> [`NEXT-UI-LIST.md`](NEXT-UI-LIST.md) (the existing UI backlog) ·
> [`LIVE-UPDATES.md`](LIVE-UPDATES.md) (polling → SSE; §2.4 below shares its machinery).

---

## Read this first: start with §5, not §1

The exciting half of this document is Part A. **Do Part B first**, and specifically **§5.1**.

While checking the ideas against the code, two turned out to be real bugs rather than wishes, and
one of them is worse than reported: **⌘V, ⌘A, ⌘N, ⌘T and ⌘P are intercepted globally with no check
for where focus is.** Paste does not work inside any input in the console. Select-all does not work.
That is a few hours of work and it is blocking every person using the product today, including
every evaluation a prospective church does.

Shipping a public API on top of an app where paste is broken is the wrong order.

---

# Part A — the CredoPass API

## 1. What is being sold, and to whom

A church with a tech team wants to put attendance on a foyer screen, sync membership into their own
CRM, and trigger their own workflows when someone checks in. Today the only way is to ask for
database access, which is the thing the whole tenancy rebuild exists to prevent.

The offer is three things, and they are separable — ship them in this order:

| | What | Why this order |
|---|---|---|
| **A1** | Read-only REST over a stable contract, keyed per organisation | Needs no new write-path safety work. Everything it exposes, the console already computes. |
| **A2** | Webhooks | Needs a change feed that does not exist yet, and that feed is also what SSE needs ([`LIVE-UPDATES.md`](LIVE-UPDATES.md) D27–D30). Build it once. |
| **A3** | Test mode | Only meaningful once A1 and A2 exist to test *against*. |

### D31 · Read-only first, and say so in the name

**Decision: the first public release exposes no writes at all.**

Not because writes are hard — the console does them — but because every write is a new way for an
integration to corrupt a tenant's attendance record, and `attendance` is the thing this product
claims to be authoritative about. A church that double-posts check-ins through a buggy script and
then disputes its own numbers is a support problem that costs more than the subscription.

Writes become a separate, later decision with its own idempotency design. Say "read-only" in the
pricing page and the docs so nobody builds against an assumption.

**What this means for the "simulate event creation" idea in the source list:** simulation happens in
**test mode** (§4), against a sandbox organisation, through the *console* API with a test-mode key —
not by opening up public writes.

### D32 · A separate base path: `/api/v1/public`

`CLAUDE.md` already states the reason the `/core` suffix exists: more services sit beside it later.
This is the first of them.

```
/api/v1/core/*     the console's own API. Shapes are tuned to screens and WILL churn.
/api/v1/public/*   the paid contract. Breaking it costs customers.
```

Do **not** expose `/api/v1/core` with an API key. Its response shapes exist to make one screen
render in one request — `EventSummary` carries `counts`, `organizationName` and door config because
the events list needed them in one payload. The moment a paying customer depends on that shape, the
console cannot change it without a migration plan. Two surfaces, two rates of change.

They share everything below the HTTP layer: the same `services/`, the same `TenantContext`, the same
`ProblemError`. Only the route modules and the response schemas are new.

**Versioning promise, written down now because it is cheap now and expensive later:** additive
changes (new fields, new endpoints) ship whenever; removals and type changes require `/api/v2/public`
and 6 months of overlap. Put this in the docs page, not just here.

---

## 2. Design

### 2.1 Authentication: API keys, not JWTs

A Supabase JWT represents a human who signed in, expires in an hour, and cannot be rotated
independently. A server-to-server integration is none of those things.

**New table `api_keys`** — modelled directly on `passes`, which already solves this problem
(`token_hash`, never the token itself):

| column | notes |
|---|---|
| `id` | uuid pk |
| `organization_id` | the tenant. **Every public query filters on it** (golden rule 7) |
| `name` | "Foyer screen", "CRM sync" — shown in the UI, the only way to tell keys apart |
| `prefix` | first 8 chars, stored in clear, shown in the UI and in logs. `cpk_live_a1b2c3d4` |
| `token_hash` | SHA-256 of the full key. **The key itself is shown once, at creation, and never again** |
| `environment` | `live` \| `test` (§4) |
| `scopes` | text[] — `events:read`, `attendance:read`, `people:read` |
| `created_by_account_id` | who made it, for the audit trail |
| `last_used_at` | so an operator can spot a key nothing uses and revoke it |
| `expires_at` | nullable. Offer 90/365/never at creation |
| `revoked_at` | soft, never deleted — a revoked key's id still appears in delivery logs |

Index `uq_api_keys_token_hash` unique, plus `idx_api_keys_organization_id`.

Middleware `requireApiKey` sits where `requireCaller` does, and builds the **same branded
`TenantContext`** — so every existing service is reusable unchanged and golden rule 4 still holds.
Scopes map onto the existing `Permission` vocabulary in `authz/permissions.ts` rather than
introducing a second authorization model; a key can never exceed `viewer`.

**Key format:** `cpk_live_` + 32 bytes base62. The prefix is load-bearing — it lets a secret scanner
(GitHub's, ours) recognise a leaked CredoPass key, and it makes `cpk_test_` visually distinct in a
screenshot so nobody pastes a live key into a demo.

### 2.2 Rate limiting — the thing that must exist before launch

`problem.rateLimited` already exists in `services/core/src/http/problem.ts` and **nothing calls it.**
A public API without a limiter is an outage waiting for its first enthusiastic `while (true)`.

**D33 · Start with a Postgres fixed-window counter, not Redis.**

The API runs on Coolify/Hetzner; adding Redis is a new container, new failure mode and new secret.
A single-row-per-(key, window) upsert in Postgres handles the volumes a church API will see by
several orders of magnitude, and the table doubles as the usage record billing will want.

```sql
-- one row per key per minute; delete anything older than an hour on write
api_key_usage(api_key_id, window_start, request_count, primary key (api_key_id, window_start))
```

Revisit when a single instance is no longer enough — the interface (`checkRateLimit(keyId)`) does not
change, only what backs it.

Answer every request with `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and on a 429 a
`Retry-After` plus the existing `rate_limited` problem body. Limits per plan, in `plans.ts` beside
the other entitlements — never hard-coded in the middleware.

### 2.3 The endpoints

Deliberately small. Every one of these maps to a service call that already exists.

```
GET  /api/v1/public/events                 list, cursor paginated, ?status= ?from= ?to=
GET  /api/v1/public/events/{id}
GET  /api/v1/public/events/{id}/attendance list, cursor paginated
GET  /api/v1/public/people                 list, cursor paginated, ?updated_since=
GET  /api/v1/public/people/{id}
GET  /api/v1/public/organization           the caller's own org
GET  /api/v1/public/openapi.json           generated, never hand-written (golden rule 3)
```

`?updated_since=` is the one addition worth making up front: without it every CRM sync is a full
table scan, forever. It needs `idx_people_organization_id_updated_at`.

**Response shapes are their own schemas**, not re-exported console ones. Yes, that is duplication.
It is the duplication that lets the console change.

### 2.4 Webhooks, and the outbox that makes them honest

**D34 · A transactional outbox, not a fire-and-forget call in the service.**

The naive version — `await postToWebhook()` at the end of `recordCheckIn` — is wrong twice over: it
fires for transactions that later roll back, and it loses the event entirely if the process dies.
For an attendance product whose pitch is "this is the durable record", a silently dropped
`attendance.checked_in` is the worst possible bug.

```
domain change ──┐
                ├── ONE transaction ──► committed together, or neither
outbox row ─────┘
                         │
                         ▼
                  drain worker ──► HTTP POST ──► retries, backoff, dead-letter
```

**New tables:**

- `outbox_events(id bigserial, organization_id, type, payload jsonb, occurred_at, processed_at)` —
  written inside the domain transaction, by the service, never by a route.
- `webhook_endpoints(id, organization_id, url, secret_hash, event_types text[], disabled_at, …)`
- `webhook_deliveries(id, endpoint_id, outbox_event_id, attempt, status_code, response_body_snippet,
  next_attempt_at, delivered_at)`

**Events to emit** (start here, resist adding more until someone asks):
`event.created`, `event.updated`, `event.cancelled`, `event.closed`,
`attendance.registered`, `attendance.checked_in`, `attendance.no_show`.

**Signing:** `CredoPass-Signature: t=<unix>,v1=<hmac-sha256(t + "." + body, endpoint_secret)>`. The
timestamp is in the signed payload so a captured delivery cannot be replayed a week later. Document
a 5-minute tolerance and tell integrators to reject outside it. Derive endpoint secrets the way
`PassService` derives per-org keys from `PASS_SIGNING_KEY` — one root secret, already managed.

**Delivery:** at-least-once, so every payload carries a stable `id` and the docs say *be idempotent*.
Retry at 10s, 1m, 10m, 1h, 6h, then disable the endpoint and surface it in the UI. A `POST
/webhook-endpoints/{id}/deliveries/{id}/replay` on the console API saves an enormous amount of
support.

**The payoff beyond webhooks:** `outbox_events` is a change feed. [`LIVE-UPDATES.md`](LIVE-UPDATES.md)
needs exactly that for SSE (D27–D30), and `bigserial` gaps in replay are already discussed there.
Build it once, use it twice. **If you only take one thing from Part A, take this table.**

### 2.5 Where the drain worker runs

**D35 · A loop inside the existing service, not a new deployment.**

`services/core` is one Coolify application. A second always-on worker is a second thing to deploy,
monitor and pay for. Start with a `setInterval` drain in-process, guarded by a Postgres advisory lock
so multiple instances cannot double-send — the same mechanism `ensureDefaultOrganization` already
uses. Split it out when the volume or the deploy story demands it, which it will not for a long time.

---

## 3. Data ownership for churches that will not hand over PII

This is the most interesting idea in the source list and the one most likely to be mis-built. The
phrasing was: *"let mega churches own the personal data of the members, and we tie a user to our
CredoPass db through some sort of link so there's no way of knowing who the individual is."*

### What that actually means

| Option | What we store | Verdict |
|---|---|---|
| **1. Field-level encryption, church holds the key** | Encrypted name/email/phone | **No.** Breaks search, dedupe and every future email. Key loss destroys their data with no recovery. Looks like control, is mostly risk. |
| **2. Pseudonymous reference** | An opaque `external_ref` the church maps internally. No name, no email. | **Yes.** This is what was described, and it is the right shape. |
| **3. Per-org choice between hosted PII and referenced** | Both, selected by the org | **Yes — this is option 2 plus a flag.** Most churches want us to hold the data; the ones that don't, really don't. |

### D36 · `organizations.pii_mode = 'hosted' | 'referenced'`, set at creation and hard to change

```
hosted      (default)  people.first_name / last_name / email / phone are ours. Today's behaviour.
referenced             people.external_ref only. The PII columns are NOT NULL-free and stay empty,
                       enforced by a CHECK constraint, not by convention.
```

`people` gains `external_ref text` and `display_label text` (optional, church-supplied, intended to
be a pseudonym like "Member 4821" — **not** validated as such, because we cannot tell).

A CHECK constraint is the point. "The app won't write PII for those orgs" is a promise; a constraint
is a fact you can show an auditor.

### Tell the customer the truth about what this costs them

This is a sales conversation as much as an engineering one, and the honest list is short:

- **Check-in by name stops working.** The kiosk's manual search is over `people.first_name /
  last_name / email`. In `referenced` mode there is nothing to search. Those doors become QR-only, or
  search-by-external-ref — which means their staff type member numbers. **This is the real cost and
  it should be said out loud before the contract, not discovered at the first service.**
- **No email, ever**, for those members. Currently moot ([`CLAUDE.md`](../CLAUDE.md): no email
  exists yet) but it forecloses the roadmap for those orgs.
- **Passes still work.** `passes` is keyed on `person_id` and signed; it never needed a name.
- **Attendance and analytics still work.** Counts do not need identities — which is precisely why
  this mode is viable at all.
- **Dedupe becomes theirs.** Two `external_ref`s for one human is their bug to find.

### What it is worth

For a UK church this is a genuine GDPR position: CredoPass processes pseudonymous data, the church
remains the only party that can re-identify, and a breach of our database exposes attendance
patterns against opaque ids. That is a real answer to a real objection, and it is an
`enterprise`-tier feature.

**Open question for Israel:** must `hosted` and `referenced` members coexist *within one
organisation* (a church that references its members but hosts its visitors)? If yes, the flag moves
from `organizations` to `people` and the CHECK constraint gets more complicated. **Assume no until
someone asks** — it is much easier to loosen this later than to tighten it.

---

## 4. Test mode

The source list says *"a test branch with rate limiting that they can simulate event creation,
attendance, signing in etc."*

### D37 · A test *mode*, not a test *branch*

A separate branch or deployment is a second environment to keep in sync, and it will drift. The
industry-standard answer, and the right one here, is Stripe's: the same code, the same deployment,
keyed by the credential.

- `cpk_test_…` keys resolve to a **sandbox organisation** automatically provisioned for the account.
- Sandbox data is seeded on creation and resettable: `POST /api/v1/core/sandbox/reset`.
- Webhooks fire from sandbox exactly as from live, so integrators see real signatures and real
  retries.
- Lower rate limits, and never counted toward billing.
- **Everything rendered in the console is marked.** A test-mode banner that cannot be dismissed. The
  one failure mode that matters is someone demoing sandbox numbers to their elders believing they
  are real.

`POST /api/v1/core/sandbox/simulate` drives the simulation: `{ type: 'check_in', eventId, count: 20 }`
generates plausible attendance so a webhook integration can be exercised without forty people walking
through a door.

---

# Part B — the product backlog

Sizes: **S** ≤ half a day · **M** 1–3 days · **L** a week or more. Verified-against-code items say so.

## 5.1 B1 · Keyboard shortcuts hijack typing anywhere in the app · S — ✅ **SHIPPED 2026-11-06**

> Fixed as written, all three parts, plus the B8b cheat sheet. `apps/web/src/hooks/shortcuts.ts` is
> the single registry; navigation moved to `g` chords; the nine duplicate `useHotkey('Mod+…')` calls
> in the palette are gone. The diagnosis below is kept because it is the record of what was wrong.
> See [`REBUILD-LOG.md`](REBUILD-LOG.md).


The reported symptom was "an analytics shortcut triggered while I was typing". The cause is worse
than that.

`apps/web/src/hooks/index.tsx` binds a global `keydown` listener that, under `metaKey || ctrlKey`,
calls `preventDefault()` and navigates for **e, n, m, v, a, t, p** — with **no check for where focus
is**. In the console today:

| You press | You expect | You get |
|---|---|---|
| **⌘V** | paste | navigate to `/events` |
| **⌘A** | select all | navigate to `/analytics` |
| **⌘N / ⌘T / ⌘P** | new window / new tab / print | navigate |

Paste is broken in every input in the product. That is not a shortcut nit; it is a serious usability
defect in a form-heavy app.

**The fix, in three parts:**

1. **Ignore events originating in a text entry** — `input`, `textarea`, `[contenteditable]`,
   `[role="textbox"]`, and anything inside an open dialog. One guard at the top of the handler.
2. **Stop colliding with the browser.** ⌘V, ⌘A, ⌘T, ⌘N, ⌘P are native shortcuts people rely on, and
   overriding them is wrong even outside an input. Move navigation to **`g` chords** — `g e` events,
   `g a` analytics, `g p` profile — which is what Linear, GitHub and Gmail do, and which cannot
   collide with anything native. Keep ⌘K for the palette; it is the one everyone expects.
3. **Delete the duplicate system.** Shortcuts are currently bound in *two* places —
   `hooks/index.tsx` and `useHotkey` inside `containers/Command/index.tsx` — which is how ⌘P ended up
   doing different things depending on which fired. One registry.

Then add a shortcuts cheat-sheet to the palette, since the bindings will have changed.

## 5.2 B2 · "No organization" should never be shown · S — **CONFIRMED**

`OrganizationPill` in `apps/web/src/Pages/Events/EventComposer/event-composer.tsx:34` reads:

```tsx
const active = organizations.find((org) => org.id === organizationId);
<span>{active?.name ?? 'No organization'}</span>
```

`organizations` comes from `useOrganizations()` — a *second* request. Between first paint and that
request resolving, `active` is undefined and the composer tells you that you have no organisation.
It is a loading state wearing an error message. (Observed live: the pill read "No organization" on a
freshly signed-in account that owned one.)

**The ask was to rename it to "Default Organisation". Don't — that just makes the wrong state
quieter.** Two real fixes, do both:

1. **Add `name` to `OrgSummarySchema` in `/me/context`** (`services/core/src/api/v1/core/me.ts`). The
   session context already knows which org is active; it should know what it is called. Then the
   pill needs no second request and cannot race. Regenerate the client (`nx run api-client:generate`).
2. **Render a skeleton while it is genuinely loading**, and keep "No organization" only for the case
   where the caller truly has none — which `requireCaller`'s `ensureDefaultOrganization` makes nearly
   impossible, and which the composer already handles separately via `missingOrganization`.

While there: organisations are auto-named `"Israel's organization"` by `defaultOrganizationName` in
`services/core/src/services/membership.ts`. If "Default organisation" is the preferred wording,
that is the function to change — one place, and it only affects orgs created after the change.

## 5.3 B3 · Online events, and optional location · M

Needs a schema change, so it follows the full procedure in
[`DATABASE-MIGRATION.md`](DATABASE-MIGRATION.md).

Today `events.location_text` is `NOT NULL` (`packages/lib/src/schemas/tables/events.ts:38`) and the
API enforces `z.string().min(1).max(300)`.

```
events.format        text not null default 'in_person'   -- in_person | online | hybrid
events.meeting_url   text                                 -- online/hybrid only
events.location_text text                                 -- DROP NOT NULL
```

A CHECK constraint keeps the combinations honest: `online` requires `meeting_url`; `in_person`
requires `location_text`; `hybrid` requires both.

Then: `EventSummary` gains `format` and `meetingUrl` · the composer gets a three-way control and
swaps the location field for a URL field · the public event page renders a join button instead of a
map · **and the ticket/pass highlights a missing location when the event is not online**, which was
the specific ask. `nx run api-client:generate` after.

## 5.4 B4 · Handle the server being offline · M

Today: `apps/web/src/lib/query-client.ts` retries 5xx and network failures twice, then the error
surfaces as whatever the calling screen does with it — usually nothing, or a toast that scrolls away.
There is no app-level notion of "the backend is down" and no notion of "this browser is offline".

Three distinct states, three different messages — conflating them is the usual mistake:

| State | How you know | What to show |
|---|---|---|
| Browser offline | `navigator.onLine`, TanStack's `onlineManager` | A persistent banner. Not a modal — reading cached screens is still useful. |
| API unreachable / 5xx | `ApiError.status >= 500`, or a thrown fetch | A service-unavailable screen, reusing the `/auth/error` pattern built this week |
| A single request failed | a 4xx | Inline, where it happened. Already the behaviour. |

`GET /api/v1/core/health` already reports a `503` with `Database unreachable` — use it rather than
inferring liveness from whichever query happened to fail first.

## 5.5 B5 · Generate posters from the event title · L — **scope this down hard**

The idea is a poster generated from the title so the organiser does not have to think about it. The
instinct in the note was "some internal model". Push back on that:

**D38 · Template composition first. No model.**

A model that renders legible text on an image is a hard, expensive problem; diffusion models are
notoriously bad at typography, which is the *entire content* of an event poster. Meanwhile a dozen
good typographic templates driven by the design system's own palette will produce better posters,
instantly, free, deterministically, and on brand.

Ship: pick a template by event `format`/time-of-day, composite title + date + location + the QR code
(`GlowingQRCode` exists), export PNG. Server-side with `sharp` — already planned in
[`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) §media for derivatives — or client-side on a canvas,
which needs no new infrastructure at all and is the right first version.

**This slots into work already specced:** `events.cover_asset_id` exists and is unused, the MinIO/S3
upload path is designed in §9.1, and `EventComposer` carries a `TODO(event-image)` listing exactly
the four steps needed. Do those, with templates as the generator.

Revisit a model only when real organisers say the templates are the problem. If so, a *hosted* image
model with moderation — not an in-browser one.

## 5.6 B6 · First-run and empty-state narrative · M

Three items from the list are one piece of work: an animation that entices you to create an event, an
"about" link back to the marketing story, and a first-time welcome to help navigate.

**The constraint that matters:** D21/D22 removed onboarding deliberately — signing in commissions an
organisation, and that *is* onboarding. A welcome **tour** is not an onboarding **gate**. Build
something dismissible, re-openable from the help menu, and never blocking. If it can stop someone
reaching `/events`, it has become the thing that was deleted.

The `/events` empty state already exists ("You have no events yet") — that is where the enticement
belongs, not on a new screen.

## 5.7 B7 · The chat panel (AG-UI) · L — groundwork now, backend later

This is the front end of the agent in `services/ai-chat` — a separate Python service (pydantic-ai),
which holds no database of its own: every read and write goes through the existing v1 TypeScript API
carrying the caller's own token. That service owns the agent; do not design a second one here.

**Supersedes the learning project.** This used to point at `PYTHON-LEARNING-PLAN.md` and
`services/core-v2`. Both were deleted on 2026-11-06 — the eight-week Python curriculum and the
`/api/v2/core` port it was built around are not happening, and `credopass_v2_dev` went with them.
`services/ai-chat` is the AI feature on its own terms, not a teaching vehicle.

What can land in the web app before any Python exists:

- A right-hand panel in the existing `RightSidebar` container, collapsible, remembering its width.
- An **AG-UI event-stream client** — read the protocol's event types and render them (text deltas,
  tool-call start/args/result, state patches, the approval interrupt). This is the bulk of the work
  and it is entirely independent of what produces the stream.
- A mock stream fixture so the UI is buildable and testable with no backend.
- The approval UI for destructive tools — the most interesting part to get right, and a hard
  requirement before any tool can write.

**On "free models that work in-browser" — an honest read.** WebLLM and `transformers.js` can run 1–3B
models via WebGPU, but: a 1–2 GB download before first token, no reliable tool-calling at that size,
and tool-calling is the entire feature. They are a fine *demo* and a poor *product*. If the panel
needs to work without a backend, scope it to "explain this screen", not "query my data". For the real
thing, a hosted small model is cheaper per useful answer than the engineering to make a 1B model
behave.

## 5.8 B8 · Smaller items

| | Item | Size | Note |
|---|---|---|---|
| B8a | "About" link to the marketing story | S | `apps/website` already has `/how-it-works`. Link it; do not rebuild it. |
| B8b | Shortcuts cheat-sheet in ⌘K | S | ✅ Shipped with B1 — the palette renders it from `hooks/shortcuts.ts`. |

---

## 6. Sequencing

Ordered by value per unit of effort, not by excitement.

| Order | Work | Size | Why here |
|---|---|---|---|
| 1 | **B1** shortcuts | S | Paste is broken for every user today. Nothing else competes. |
| 2 | **B2** org pill | S | Same day's work, visible on the first screen a new customer sees. |
| 3 | **B4** offline handling | M | Cheap, and it stops the next outage looking like a broken app. |
| 4 | **B3** online events | M | First *feature* on the list, and schema changes get easier the sooner they happen. |
| 5 | **A2's outbox** (§2.4) | M | Pure infrastructure, no public surface. Also unblocks SSE. Build it before it has customers. |
| 6 | **A1** keys + rate limit + read endpoints | L | The sellable thing. |
| 7 | **A2** webhook delivery on top of the outbox | M | |
| 8 | **A3** test mode | M | Needed before the first external integrator, not before the first demo. |
| 9 | **B5** posters (templates) | M | Genuinely nice, genuinely not urgent. |
| 10 | **§3** pii_mode | L | Enterprise-gated. Do it when a named customer asks — the design above is what to build, not a reason to build it now. |
| 11 | **B6** first-run, **B7** chat panel | L | B7 tracks the Python plan's own schedule. |

---

## 7. Risks and open questions

**Risks**

- **The outbox is the load-bearing piece.** Get `outbox_events` wrong and webhooks, SSE and the
  change feed are all wrong together. It deserves integration tests against a real Postgres before
  anything depends on it — including a crash-mid-drain test.
- **Rate limiting is the only thing between a public API and an outage.** It is listed as part of A1
  for that reason; do not ship the endpoints and add limits later.
- **`pii_mode` is close to irreversible.** Switching an org from `referenced` to `hosted` means
  backfilling PII that, by design, we never had.
- **The adversarial suite does not cover the public surface.** Every new route needs its tenancy
  tests in `src/test/adversarial/` — a key scoped to one org must 404 on another's event, not 403.

**Open questions — these change the design, so they are worth answering before starting Part A**

1. **Price and tier** for the public API. `plans.ts` needs `publicApi: boolean` and
   `webhookEndpointLimit`; what are they per tier?
2. **Which webhook events** does the first customer actually want? The list in §2.4 is a guess.
3. **Mixed PII mode** within one organisation — see §3. Assume no unless told otherwise.
4. **Who writes the API docs?** Scalar renders the generated OpenAPI, which covers reference but not
   a quickstart. A public API without a quickstart gets support tickets instead of integrations.
5. **Is read-only going to hold?** If the first three prospects all want to write attendance from
   their own kiosk, D31 needs revisiting early rather than after launch.

---

## 8. Decisions recorded here

Continuing the numbering from [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) (D1–D26) and
[`LIVE-UPDATES.md`](LIVE-UPDATES.md) (D27–D30).

| | Decision |
|---|---|
| **D31** | The public API is read-only in its first release, and says so in its name and pricing. |
| **D32** | It lives at `/api/v1/public`, with its own response schemas, so `/api/v1/core` stays free to churn. |
| **D33** | Rate limiting is a Postgres fixed-window counter before it is Redis. |
| **D34** | Webhooks are driven by a transactional outbox written in the domain transaction — never a direct call from a service. |
| **D35** | The outbox drain runs in-process behind an advisory lock, not as a separate deployment. |
| **D36** | Data ownership is `organizations.pii_mode`, enforced by a CHECK constraint, not by convention. |
| **D37** | Test mode is a credential (`cpk_test_…`) against a sandbox organisation, not a separate branch or deployment. |
| **D38** | Posters are composed from typographic templates. No image model until templates are demonstrably the problem. |
