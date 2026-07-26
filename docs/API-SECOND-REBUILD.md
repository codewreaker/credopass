# API-SECOND-REBUILD — the UI rewiring plan

> **Read this before touching `apps/web`.** The API was rebuilt from the ground up. The web app has
> not moved, and currently **does not compile** — 18 files import modules that no longer exist.
>
> Part 1 tells you what the API now is. Part 2 is the work.

**Status:** ready to build · **Date:** 2026-07-27
**Companion docs:** [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) (the original plan) ·
[`REBUILD-LOG.md`](REBUILD-LOG.md) (what was actually built, and what broke)

---

# Part 1 — What the API is now

## 1.1 The single most important thing

```
apps/web is BROKEN. It will not build.
```

`packages/api-client/src/collections/` was deleted. So was `/api/core`, and the `users`,
`event_members` and `loyalty` tables. Eighteen files still import them:

```
apps/web/src/main.tsx
apps/web/src/containers/OrgSelector/index.tsx
apps/web/src/containers/OrganizationForm/index.tsx
apps/web/src/containers/RightSidebar/OverviewView.tsx
apps/web/src/Pages/Analytics/index.tsx
apps/web/src/Pages/Analytics/use-analytics.ts
apps/web/src/Pages/Attendees/index.tsx
apps/web/src/Pages/Attendees/MemberComposer/index.tsx
apps/web/src/Pages/Attendees/MemberComposer/use-member-form.ts
apps/web/src/Pages/CheckIn/index.tsx
apps/web/src/Pages/Events/index.tsx
apps/web/src/Pages/Events/EventComposer/index.tsx
apps/web/src/Pages/Events/EventComposer/org-field.tsx
apps/web/src/Pages/Events/EventComposer/use-event-form.ts
apps/web/src/Pages/Events/EventView/index.tsx
apps/web/src/Pages/Events/use-attendee-checkin.ts
apps/web/src/Pages/Events/use-public-event.ts
apps/web/src/Pages/Organizations/index.tsx
```

This is expected and was authorised. It is not a bug to investigate.

## 1.2 What changed, in one page

```
BEFORE                                     AFTER
──────                                     ─────
React app with a database attached         API with rendering clients

Business rules in the browser              Business rules in services/
Tenant = whatever the client sent          Tenant = from the token, branded type
Errors = { error: "..." }                  RFC 9457 problem+json
OpenAPI hand-written, always stale         Generated from the Zod that validates
TanStack DB full-table caches              Server decides; client renders
7 tables, no real tenancy                  13 tables, RLS, two-scope model
```

| | Before | After |
|---|---|---|
| Base path | `/api/core` | **`/api/v1/core`** |
| Auth | Supabase JWT only | Supabase JWT **or** device token (`cpd_…`) |
| Data access | `getCollections()` | **generate a client from `openapi.json`** |
| Event status | a `status` column that went stale | derived from timestamps, server-side |
| A person | `users`, globally unique email | `accounts` (signs in) + `people` (per-org) |
| Attendee pass | `{eventId}:{userId}`, forgeable | signed token, revocable, emailable URL |
| Kiosk credential | full org session | scoped device token, one event |

## 1.3 The two-scope model — the thing to internalise

This is the concept the UI must respect everywhere.

```
account ──org_memberships──► ORGANISATION scope   the console; one org at a time
   └─────people.account_id──► PERSONAL scope      my tickets; across ALL orgs
anonymous ───pass token────► BEARER scope         one pass, no account at all
```

**Attending an event never grants access to the organisation running it.** A person who registers for
a church's event gets a `people` row and an `attendance` row. They do **not** get an
`org_memberships` row, cannot see the console, and cannot see the org exists.

The UI must never blur these. Concretely:
- The console (`/events`, `/attendees`, `/analytics`) is organisation scope.
- `/me/tickets` — when built — is personal scope and spans organisations.
- `/p/{token}` is bearer scope: no shell, no nav, no sign-in prompt.

## 1.4 The schema — 13 tables

```
accounts · identities · org_identity_providers · org_domains
organizations · org_memberships · invitations
people · events · event_grants · attendance · passes · device_tokens
```

Gone: `users` (split), `event_members` (narrowed to `event_grants`), `loyalty` (deleted).

Things that will surprise you:
- **`events` has no `status` column.** Status is `deriveStatus(cancelled_at, closed_at, start_at, end_at, now)`.
  The API returns it; never compute it client-side.
- **`attendance.state`** is `registered | attended | no_show | cancelled`. The `attended` boolean is gone.
- **A sign-up is an `attendance` row with `state='registered'`.** `event_grants` is *only* for
  delegating management of an event.
- **All columns are snake_case in the DB**, camelCase in TypeScript. The API speaks camelCase.

## 1.5 Every endpoint that exists (38 operations)

Marked: 👤 account JWT · 📟 device token · 🔓 none · 🎫 pass token in URL

### Identity — `scope: 'account'`
| | Endpoint | Notes |
|---|---|---|
| 👤 | `GET /me` | The signed-in account |
| 👤 | `GET /me/context` | **The first call every screen makes.** account + memberships + activeOrganization + permissions[] + `needsOnboarding` |

### Organisations & membership
| | Endpoint | Notes |
|---|---|---|
| 👤 | `POST /organizations` | You become owner, same transaction |
| 👤 | `GET /organizations` | **Yours only** — never every org |
| 👤 | `GET /organizations/{id}` · `PATCH` · `DELETE` | 409 `has_events` on delete |
| 👤 | `GET /organizations/{id}/members` | |
| 👤 | `PATCH /organizations/{id}/members/{accountId}` | 409 `last_owner` |
| 👤 | `DELETE /organizations/{id}/members/{accountId}` | 409 `last_owner` |
| 👤 | `GET`/`POST /organizations/{id}/invitations` | POST returns `token` **once** |
| 👤 | `DELETE /organizations/{id}/invitations/{invitationId}` | |
| 👤 | `POST /invitations/{token}/accept` | Requires a **verified** matching email |

### Events (read only — see §1.6)
| | Endpoint | Notes |
|---|---|---|
| 👤 | `GET /events` | `?group=upcoming\|past&status=&from=&to=&q=&cursor=&limit=` — derived status, counts, org name |
| 👤 | `GET /events/summary` | `{ total, upcoming, ongoing, next }` — the hero |
| 👤 | `GET /events/calendar?month=YYYY-MM` | days → events |
| 👤 | `GET /events/{id}` | |

### People (read only — see §1.6)
| | Endpoint | Notes |
|---|---|---|
| 👤 | `GET /people` | `?q=&eventId=&standing=&cursor=` — `standing` and `eventsAttended` **pre-computed** |
| 👤 | `GET /people/summary?eventId=` | The billboard tiles |
| 👤 | `GET /people/{id}` | + lifetime stats |

### Attendance
| | Endpoint | Notes |
|---|---|---|
| 👤📟 | `POST /events/{id}/register` | Returns a **pass URL** |
| 👤📟 | `POST /events/{id}/check-in` | **The kiosk's one endpoint.** Idempotent; `alreadyRecorded` |
| 👤📟 | `POST /events/{id}/check-out` | |
| 👤📟 | `GET /events/{id}/checkin-state` | `{ checkedIn, registered, capacity, remaining }` |
| 👤 | `POST /events/{id}/close` | Finalises no-shows |

### Devices
| | Endpoint | Notes |
|---|---|---|
| 👤 | `POST /events/{id}/devices` | Returns a **pairing code**, never a token |
| 👤 | `GET /organizations/{id}/devices` | status: pending/active/revoked/expired |
| 👤 | `DELETE /devices/{deviceId}` | |
| 🔓 | `POST /devices/pair` | Tablet redeems the code → token, shown **once** |

### Public attendee surface
| | Endpoint | Notes |
|---|---|---|
| 🔓 | `GET /public/events/{id}` | The shared link |
| 🔓 | `POST /public/events/{id}/register` | Returns `pass.url` synchronously |
| 🔓 | `POST /public/events/{id}/check-in` | Respects `allowSelfCheckIn` |
| 🔓 | `POST /public/events/{id}/resend-pass` | **Always 202**, registered or not |
| 🎫 | `GET /p/{token}` | firstName + last **initial** only |
| 🎫 | `POST /p/{token}/check-in` | |

### Ops
`GET /health` · `GET /health/ready` · `GET /openapi.json` · `GET /docs` (Scalar, with a live client)

## 1.6 ⚠️ What does NOT exist yet

**Do not plan UI against these. They are not endpoints.**

| Missing | Consequence for the UI |
|---|---|
| `POST /events`, `PATCH /events/{id}`, `DELETE`, `POST /events/{id}/cancel` | **The event composer cannot save.** Build the form; wire it when the endpoint lands. |
| `POST /people`, `PATCH /people/{id}`, `DELETE` | Same for the attendee composer. |
| `PATCH /me` | The account page can display but not edit the profile. |
| `GET /me/tickets`, `POST /me/claim`, `POST /me/upgrade` | The personal-scope screens cannot be built yet. |
| `GET /analytics/overview`, `/export` | **`/analytics` has no data source at all.** |
| `GET /events/{id}/stream` (SSE) | Kiosk counter must poll `/checkin-state`. |
| `GET /events/{id}/calendar.ics` | "Add to calendar" has no source. |
| `POST /uploads`, media | No event cover images. |
| Email (`NotificationService`) | Pass URLs are returned in the response and **not emailed**. The UI must show the URL. |

**Sequence this correctly:** the event and person write endpoints are the biggest blocker. Either build
them first, or build the forms with the network call stubbed behind a single function.

## 1.7 Conventions the UI must follow

1. **`GET /me/context` first, on every app load.** It returns `needsOnboarding`, the org list, the
   active org, and the caller's `permissions[]`. Render from that array — never re-derive from a role
   string.
2. **Send `X-Organization-Id`** on every organisation-scoped request. Routes addressed as
   `/organizations/{id}/…` take it from the path instead.
3. **Errors are RFC 9457.** Branch on `body.code`, never on `body.detail` (which is prose and will
   change). Codes worth handling: `not_a_member`, `organization_required`, `insufficient_permission`,
   `last_owner`, `capacity_reached`, `event_closed`, `self_checkin_disabled`, `slug_taken`,
   `already_member`, `invitation_mismatch`.
4. **404 vs 403.** Another tenant's resource is **404**. A 403 means your own tenant, wrong role.
   Render them differently: 404 is "gone or never existed", 403 is "ask an admin".
5. **Pagination is cursor-based.** `{ data, page: { nextCursor, hasMore } }`. No page numbers, no
   totals — counts come from `/summary` endpoints.
6. **Never compute what the API returns.** Status, standing, counts, remaining capacity are decided
   server-side. If you find yourself writing a `useMemo` that derives one, stop.

## 1.8 How to build the client

```bash
nx run coreservice:openapi:export     # writes services/core/openapi.json
```

Generate types with `openapi-typescript`, call with `openapi-fetch` (D14). `packages/api-client`
keeps its name and position — apps still never `fetch` directly — but its insides are now:

```
packages/api-client/src/
  generated/schema.d.ts    ← openapi-typescript, checked in
  client.ts                ← openapi-fetch + auth header + org header + problem→Error
  hooks/                   ← TanStack Query hooks, one per endpoint group
```

TanStack **Query** stays. TanStack **DB** collections are gone and are not coming back.

---

# Part 2 — The UI plan

## 2.1 Forensic breakdown: every screen

Legend — **Broken**: imports deleted modules · **Rewire**: works conceptually, needs new data source ·
**New**: does not exist · **Delete**: remove entirely

| Screen | Route | State | What must happen |
|---|---|---|---|
| Login | `/login` | Rewire | Supabase auth stays. After sign-in call `GET /me/context`; if `needsOnboarding` go to `/onboarding`, else the console. Strip "loyalty" from the marketing copy. |
| **Onboarding** | `/onboarding` | **New** | §2.2 |
| Events list | `/events` | Broken | §2.3 |
| Event detail | `/events/$eventId` | Broken | §2.4 |
| Event composer | `/events/new`, `/events/$id/edit` | Broken | Form can be built; **save has no endpoint** (§1.6) |
| Attendees | `/attendees` | Broken | §2.5 |
| Attendee composer | `/attendees/new`, `/$id/edit` | Broken | Same blocker as the event composer |
| Kiosk | `/checkin/$eventId` | Broken | §2.6 |
| Public event | `/e/$eventId` | Broken | §2.7 |
| **Pass** | `/p/$token` | **New** | §2.8 |
| Analytics | `/analytics` | Broken | **No endpoint.** Keep the route, render an honest empty state. Remove the fabricated numbers and the "Sample data" badge. |
| Profile | `/profile` | Broken | Replaced by the Account page — §2.9 |
| Organizations | `/organizations` | Broken | Folds into the Account page |
| Upgrade | `/upgrade` | Rewire | Strip loyalty copy. Gate on `meContext.entitlements`, not `localStorage`. |
| **My tickets** | `/me/tickets` | **New, blocked** | Endpoint does not exist. Design it; do not build it. |

## 2.2 Onboarding — new, and a prerequisite

**Why this is not optional.** Tenancy is now enforced. A brand-new account belongs to no organisation,
so `GET /events` correctly returns an empty page. Without somewhere to land, enforcing tenancy *breaks
the product for every new user*. This is the first thing to build.

**Route:** `/onboarding` — no app shell, no sidebar. A focused three-step flow.

```
┌─ Step 1 ─────────────────────────────────────┐
│  Welcome. Create your organisation.          │
│  [ Name              ]  → slug auto-derived  │
│  [ Timezone ▾        ]  → default from       │
│                           Intl.DateTimeFormat│
│  POST /organizations                         │
└──────────────────────────────────────────────┘
┌─ Step 2 (skippable) ─────────────────────────┐
│  Invite your team.                           │
│  email + role, repeatable                    │
│  POST /organizations/{id}/invitations        │
│  ⚠️ Show the invite LINK — no email yet      │
└──────────────────────────────────────────────┘
┌─ Step 3 (skippable) ─────────────────────────┐
│  Create your first event.                    │
│  BLOCKED: POST /events does not exist.       │
│  Ship steps 1–2; add this when it lands.     │
└──────────────────────────────────────────────┘
```

**Entry:** `GET /me/context` → `needsOnboarding === true`. Redirect from anywhere in the console.

**Also needed — the invitation acceptance screen.** `/invitations/$token` calls
`POST /invitations/{token}/accept`. Handle three failures explicitly, because they mean different
things: `403 invitation_mismatch` ("this was sent to a different address — sign in with that one"),
`410 expired`, `404`.

**Delete the "auto-select organizations[0]" behaviour** in `OrgSelector`. That single line is what
made every user see Kharis Church. Zero orgs → onboarding. One → use it. Several → last used,
persisted per account.

## 2.3 `/events`

| Value on screen | Old source | New source |
|---|---|---|
| "Good evening, Israel" | **hardcoded** in `appStore.ts` | `GET /me` → `displayName` |
| "2 events · 1 upcoming · 0 live now" | `filter().length` over a cache | `GET /events/summary` |
| Hero "Up next" / "Live now" | a `useMemo` | `summary.next` |
| Status badge | client `getStatus` | `EventSummary.status` — **already derived** |
| Org name on each row | client join against org cache | `EventSummary.organizationName` |
| Upcoming/Past tabs | client split | `?group=upcoming\|past` |
| Calendar rail | `getMonthEvents` in the browser | `GET /events/calendar?month=` |
| Search | client `filter` | `?q=` |
| Empty state | "Plan your next event" | **If `needsOnboarding`, "Create your organisation"** |

**Delete** `getStatus` and the grouping helpers in `packages/lib/src/utils/events.ts`. The rule now
lives in exactly one place, server-side.

**A behaviour that will look like a bug and is not:** a *cancelled future* event appears under **Past**,
not Upcoming. It is not going to happen. This is deliberate.

## 2.4 `/events/$eventId`

| Value | New source |
|---|---|
| Status pill | `Event.status` |
| Check-in code `#F6F82EC3–09D` | `Event.shortCode` — a real code, read aloud at doors |
| Counts | `Event.counts.{registered,attended}` |
| Event share QR | `{origin}/e/{id}` — **unchanged** |
| Attendee pass QR | ⚠️ endpoint not built; use the URL from `register` |
| Add to calendar | ⚠️ blocked — no ICS endpoint |
| Map | ⚠️ blocked — geocoding is server-side but not populated |
| Cover photo | ⚠️ blocked — no media endpoints |

**New on this page: the Devices panel** (§2.10).

## 2.5 `/attendees`

The heaviest win. **~150 lines of `useMemo` become one call.**

| Value | Old | New |
|---|---|---|
| `standing` badge | `Attendees/index.tsx:342-435` | `PersonRow.standing` |
| "N attended" | a scan of **every** attendance row | `PersonRow.eventsAttended` |
| Billboard tiles | client counts | `GET /people/summary` |
| Per-row check-in time | a client map | `PersonRow.checkInTime` |
| Search | client filter | `?q=` |

**Delete the entire derivation block.** If you keep any of it, you have two implementations of
`standing` and they will disagree.

**Flag in the release note:** "Member" now means "on the roll, hasn't attended yet". The count will
drop. That is a correction, not a regression.

## 2.6 `/checkin/$eventId` — the kiosk

Two modes now, and this is the significant change.

**Mode A — staff kiosk.** Signed-in user, as today.

**Mode B — paired device.** The tablet holds a device token and **nothing else**.

```
┌─ /checkin/pair ── new, unauthenticated ──────┐
│   Enter the pairing code from the event page │
│        [ _ _ _ _  _ _ _ _ ]                  │
│   POST /devices/pair → { token }             │
│   Store it. It is shown once.                │
└──────────────────────────────────────────────┘
```

| Value | Old | New |
|---|---|---|
| "N checked in" | `useState(0)` — per tab, reset on reload, doors disagreed | `GET /events/{id}/checkin-state`, **poll every 5s** (SSE is Phase 4) |
| Scan → who is this? | `users.find()` over a browser cache | `POST /events/{id}/check-in { pass }` — server resolves |
| Manual check-in | two collection writes + id reconciliation | one `POST` |
| "Already checked in" | cache lookup | `response.alreadyRecorded` |
| Capacity | not shown | `checkin-state.remaining`; `409 capacity_reached` |

**Handle `401 token_revoked`** distinctly: the device was turned off from the console. Show "This
device has been revoked — ask an admin to re-pair it", not a generic sign-in prompt.

## 2.7 `/e/$eventId` — public event page

| Value | New source |
|---|---|
| Event, org name, self check-in flag | `GET /public/events/{id}` |
| Capacity / "Full" | `capacityRemaining` |
| Cancelled | `status === 'cancelled'` + `cancellationReason` — **still resolves, does not 404** |
| Register | `POST /public/events/{id}/register` → **redirect to `pass.url`** |
| Self check-in | `POST /public/events/{id}/check-in` |
| "Didn't get it?" | `POST /public/events/{id}/resend-pass` — always succeeds |

⚠️ **No email exists yet.** After registering you *must* show the pass URL on screen and prompt the
user to save it. Do not write "check your email".

## 2.8 `/p/$token` — the pass. New, and the smallest.

Standalone: **no app shell, no nav, no sign-in prompt.** Someone opened a link from a message.

```
┌──────────────────────────────┐
│   [ QR: pass.qrValue ]       │
│   Walk I.                    │
│   Sunday Service             │
│   Sun 3 Aug · 10:00          │
│   Kharis Church, Main hall   │
│   [ Check in ]  ← if canSelfCheckIn
└──────────────────────────────┘
```

`GET /p/{token}` returns first name and last **initial** only — never the email. Do not add fields.

Handle `410` as a calm state: "This pass is no longer valid", with the organiser's name so the holder
knows who to ask. Handle `404` the same way.

## 2.9 The Account page — new, replaces `/profile` and `/organizations`

`/account`, with tabs. This is where all the new capability surfaces.

| Tab | Contents | Endpoints |
|---|---|---|
| **Profile** | Name, email, avatar. ⚠️ `PATCH /me` not built — read-only for now | `GET /me` |
| **Organisations** | Your orgs with roles; switch active; create; leave | `GET /organizations`, `POST /organizations` |
| **Members** | List, change role, remove, invite, revoke invitations, copy invite links | `GET /organizations/{id}/members`, `PATCH`/`DELETE` `/members/{accountId}`, `GET`/`POST`/`DELETE` invitations |
| **Devices** | Paired tablets, status, revoke, pair new | `GET /organizations/{id}/devices`, `DELETE /devices/{deviceId}` |
| **Organisation settings** | Name, slug, timezone; delete org | `PATCH`/`DELETE /organizations/{id}` |
| **Security (later)** | SSO providers, verified domains | Schema exists; endpoints are Phase 7 |
| **Billing (later)** | Plan | `organizations.plan` |

**Permission-gate every control from `meContext.membership.permissions`.** Hide what the caller cannot
do; do not render a button that will 403.

**Two invariants the UI must handle gracefully, not discover:**
- `409 last_owner` — you cannot demote or remove the only owner. Disable the control and explain why.
- `409 has_events` — you cannot delete an org that still has events.

## 2.10 Devices panel on `/events/$eventId`

```
Devices at this event                    [ Pair a tablet ]
─────────────────────────────────────────────────────────
Main door        ● active    last seen 2 min ago  [Revoke]
Side entrance    ○ pending   code K7QM4XPD (14m)  [Revoke]
```

`POST /events/{id}/devices` returns a **pairing code, not a token** — display it large and legible.
It expires in 15 minutes and works once.

## 2.11 Endpoint → UI coverage

Every endpoint must have a feature. Anything unclaimed after the rewrite is either dead or a missing
screen.

| Endpoint | Where it is used |
|---|---|
| `GET /me` | Account → Profile; greeting on `/events` |
| `GET /me/context` | App bootstrap; org switcher; every permission gate |
| `POST /organizations` | Onboarding step 1; Account → Organisations |
| `GET /organizations` | Org switcher; Account |
| `GET`/`PATCH`/`DELETE /organizations/{id}` | Account → Organisation settings |
| `GET /organizations/{id}/members` | Account → Members |
| `PATCH`/`DELETE .../members/{accountId}` | Account → Members row actions |
| `GET`/`POST`/`DELETE .../invitations` | Account → Members; onboarding step 2 |
| `POST /invitations/{token}/accept` | `/invitations/$token` |
| `GET /events` | `/events` list; `/attendees` scope dropdown |
| `GET /events/summary` | `/events` hero |
| `GET /events/calendar` | `/events` calendar rail |
| `GET /events/{id}` | `/events/$id`; kiosk header |
| `GET /people` | `/attendees` |
| `GET /people/summary` | `/attendees` billboard |
| `GET /people/{id}` | Attendee profile sidebar |
| `POST /events/{id}/register` | `/events/$id` "Add attendee" |
| `POST /events/{id}/check-in` | Kiosk — all three paths |
| `POST /events/{id}/check-out` | Kiosk, when `requireCheckOut` |
| `GET /events/{id}/checkin-state` | Kiosk counter (poll) |
| `POST /events/{id}/close` | `/events/$id` "End event" |
| `POST /events/{id}/devices` | Devices panel |
| `GET /organizations/{id}/devices` | Account → Devices |
| `DELETE /devices/{deviceId}` | Both device lists |
| `POST /devices/pair` | `/checkin/pair` |
| `GET /public/events/{id}` | `/e/$id` |
| `POST /public/events/{id}/register` | `/e/$id` |
| `POST /public/events/{id}/check-in` | `/e/$id` walk-up |
| `POST /public/events/{id}/resend-pass` | `/e/$id` "Didn't get it?" |
| `GET /p/{token}` | `/p/$token` |
| `POST /p/{token}/check-in` | `/p/$token` |

**Unclaimed: none.** Every endpoint has a home.

## 2.12 Dead code to delete

Delete, do not comment out.

| Path | Why |
|---|---|
| `packages/api-client/src/collections/` | Already gone — remove remaining imports |
| `apps/web/src/Pages/Events/use-attendee-checkin.ts` | Replaced by `POST /check-in` |
| `apps/web/src/Pages/Events/use-public-event.ts` | Replaced by `GET /public/events/{id}` |
| `apps/web/src/contexts/premium.tsx` | `localStorage` entitlements — use `meContext` |
| `packages/lib/src/utils/events.ts` grouping + `getStatus` | Server derives status |
| `Attendees/index.tsx` derivation block (~lines 295, 342-435) | `standing`, `eventsAttended` come from the API |
| `OrgSelector` `organizations[0]` auto-select | **The line that caused the shared-identity leak** |
| Hardcoded `'Israel Agyeman-Prempeh'` in `appStore.ts` | `GET /me` |
| Hardcoded profile block in `OrgSelector/index.tsx:113-118` | `GET /me` |
| All loyalty references | Table deleted. Copy on `/upgrade` **and `/login`** |
| `persisted-ids.ts` | Client-supplied ids are honoured server-side |
| Client-side ICS in `EventView/index.tsx:146` | Invalid ICS; server endpoint coming |
| `useGeocodedLocation` | Geocoding moves server-side |

**Loyalty copy — two screens, not one:**
- `Upgrade/index.tsx:9` "Earn loyalty points at every event" → "Keep every check-in on your record"
- `Upgrade/index.tsx:25,29` "Points"/"Tier" stat blocks → "Events"/"Since"
- `Upgrade/index.tsx:82` "…start climbing the loyalty tiers" → "…and keep your attendance history"
- **`/login` marketing panel** — "Attendance, membership and **loyalty**…" appears twice

## 2.13 Suggested order

1. **Generate the client.** `openapi-typescript` + `openapi-fetch`, auth + org headers, problem→Error.
   Nothing else can start.
2. **Bootstrap + onboarding.** `GET /me/context`, the routing decision, `/onboarding`,
   `/invitations/$token`. Fix `OrgSelector`. **The product is unusable for a new account until this
   exists.**
3. **`/events` and `/attendees` reads.** Highest ratio of deleted code to work.
4. **Kiosk + `/checkin/pair`.** Then the Devices panel.
5. **Public surface: `/e/$id` and `/p/$token`.** The attendee half of the product, which has never
   properly existed.
6. **Account page.**
7. **Composers.** Blocked on write endpoints — build the forms, stub the call.
8. **Analytics.** Blocked entirely. Honest empty state.

---

# Part 3 — What comes after

## 3.1 Service accounts — the known gap

**The problem.** Three routes in the plan are marked ⚙️ (system/cron): `POST /internal/jobs/{name}`,
`/events/{id}/close`, `/event-series/{id}/materialise`. **No credential exists for ⚙️.** Supabase JWTs
expire hourly and belong to humans; device tokens are scoped to one event.

Phase 4's scheduler must close expired events across **every** organisation, every few minutes. It is
not a person and belongs to no org.

**The wrong answers, and why:**

| Approach | Why not |
|---|---|
| Shared secret in a header | No identity, no audit trail, no revocation, ends up in a log |
| A "robot" human account | Needs a membership in every org — a caller that legitimately sees everything, special-cased in every RLS policy |
| `BYPASSRLS` on the job runner | Discards layer 2 for the caller with the broadest reach |

**The secure answer.** A `service_accounts` table alongside `accounts`:

```
service_accounts
  id · name · token_hash · scopes[] · created_by_account_id
  expires_at · revoked_at · last_used_at
  cross_tenant boolean          ← explicit, never implicit
```

- Tokens prefixed `cps_`, hashed like device tokens.
- Scopes, not roles. A scheduler gets `job:run` and nothing else.
- A **third** context type beside `TenantContext` and `AccountContext` — `SystemContext` — which
  reaches only an allow-listed set of operations. The branded types from Phase 0 already give the
  shape: a function that needs a tenant cannot accept a system caller by accident.
- Every use written to the audit log with the service account's identity.

**Roughly half a day.** It is additive — nothing existing gets re-modelled — so deferring is cheap.
The risk is not technical debt; it is that someone hits "the scheduler can't authenticate" at 11pm
and reaches for `if (header === process.env.CRON_SECRET)`.

## 3.2 Live notifications — what they actually require

The maintainer asked whether service accounts block live notifications. **They enable them.** The full
chain:

```
1. domain_events table          every state change, same transaction  (D4)
2. LISTEN/NOTIFY → SSE hub      GET /events/{id}/stream               (D5)
3. Scheduler                    close events, finalise no-shows       ← needs a service account
4. Outbound webhooks            "someone checked in" → customer's URL  ← NOT YET DESIGNED
```

Steps 1–2 are Phase 4 as planned. Step 3 needs §3.1. **Step 4 is not in the plan at all** and should
be — it is the shape customer-facing integrations want, and it is cheaper than hosting an automation
tool.

## 3.3 The rest of the backlog

| Item | Blocks | Notes |
|---|---|---|
| **Event & person write endpoints** | Both composers, onboarding step 3 | **Highest priority.** The UI cannot create anything. |
| `NotificationService` (Resend) | Emailed passes, invitations | Until then the UI must show URLs on screen |
| `PATCH /me` | Account → Profile editing | Small |
| `/me/tickets`, `/me/claim` | The personal scope | The attendee's own view across orgs |
| Analytics over real data | `/analytics` | Currently no endpoint at all |
| Media/uploads | Cover photos | S3 + presign |
| ICS endpoint | "Add to calendar" | Client version emits invalid ICS |
| SSE | Live kiosk counter | Poll `/checkin-state` until then |
| **Adversarial suite fixtures** | Trustworthy security tests | 39 of 50 red because actors are placeholders with `token: ''`. Until they mint real tokens, those tests prove nothing. |
| RLS cutover | Layer 2 actually biting | API connects as `postgres` (BYPASSRLS). Needs `SET LOCAL app.account_id` first. |

## 3.4 Where the truth lives

| Question | Answer |
|---|---|
| What endpoints exist? | `services/core/openapi.json`, or `/api/v1/core/docs` |
| What does this endpoint return? | The Zod schema in `services/core/src/api/v1/core/` |
| What are the rules? | `services/core/src/services/` |
| What is the schema? | `packages/lib/src/schemas/tables/` |
| What was decided, and why? | [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) |
| What actually happened? | [`REBUILD-LOG.md`](REBUILD-LOG.md) |

Run the API and use the Scalar client at `/api/v1/core/docs` before writing UI against any endpoint.
It sends real requests. Guessing at shapes when the contract is one command away is how drift starts.

```bash
nx run coreservice:db reset    # rebuild + seed two orgs with every event status
nx run coreservice:start
nx run coreservice:token       # mint a JWT
nx run coreservice:db join <account-id>   # make yourself an owner
```
