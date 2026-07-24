# CredoPass — Phase 2 UX Audit, Target Workflows & Build Plan

> **Status:** Draft for review — authored during the Phase 2 forensic audit.
> **Method:** Live app driven with Playwright against the running stack (web `:5004`,
> Core API `:8080`, hosted Supabase Postgres), plus a codebase + data-model traversal.
> Screenshots referenced below were captured desktop (1440×900) and mobile (390×844)
> for every primary flow.
> **Scope guard:** No backend DB refactor is performed here. Where the target
> experience needs a schema change, it is **documented as a proposal** (§4.6, §6) for
> the owner to approve — not applied.

---

## 0. How to read this document

Four parts, in the order the task asked for them:

1. **§2 — Forensic audit.** What exists, what works, what's broken, what the
   architecture is reaching for. Evidence-backed.
2. **§3 — Target workflows & user stories.** The best-in-class flow for each persona
   (unsigned visitor, host/organiser, attendee), screen-by-screen.
3. **§4–6 — Build plan.** Sequenced, with the service/UI changes and the (review-gated)
   data-model proposals kept separate.
4. **§7 — Handoff for the next agent.** A cold-start runbook: how to boot the stack,
   re-take screenshots, where every relevant file lives, and the exact first tickets
   to pick up. **Read this first if you are the continuing agent.**

---

## 1. Product thesis (what CredoPass is — and is not)

The login hero states it plainly:

> **"Know who actually shows up. Attendance, membership and loyalty for live events —
> without the ticketing overhead."**
> Feature list: *QR check-in from any device · Real-time attendance tracking ·
> Member loyalty & analytics · Works alongside Eventbrite & Meetup.*

This is the single most important framing for everything below:

- CredoPass is an **attendance / membership / loyalty layer**, deliberately **not** a
  ticketing or payments platform. It sits *alongside* Eventbrite/Meetup.
- The core loop is **check-in**, not **checkout**. The unit of value is a confirmed
  *attendance* record and the *loyalty/streak* history built from it.
- The archetypal customer is a **recurring-community host** — a church ("Kharis
  Church" is the seeded org), a gym/fitness club, a meetup, a class — who runs the
  *same people* through *many events* and wants to know who actually turns up over time.

Every workflow recommendation in §3 is optimised for that loop. We do **not** turn
CredoPass into Eventbrite.

---

## 2. Forensic audit

### 2.1 What the architecture is trying to achieve

| Layer | Reality on the ground |
|---|---|
| **Frontend** | `apps/web` — React + Vite, TanStack **Router** (file-based routes) + TanStack **DB** (client collections synced via TanStack Query) + Supabase JS. Design system in `packages/ui` (Base UI primitives + Tailwind, the lime "billboard" language). |
| **Backend** | `services/core` — Hono API on Bun, Drizzle ORM → Postgres (hosted on Supabase). A generic `crud-factory` generates REST for each table. Auth is Supabase JWT verified via JWKS on **every** route. |
| **Data** | Postgres tables: `organizations`, `users` (patrons), `events`, `attendance`, `event_members` (co-organisers), `org_memberships`, `loyalty`. Supabase Auth is a **separate** identity store from the `users` patron table. |
| **Shared** | `packages/lib` (schemas, hooks, theme, constants), `packages/api-client` (collections + fetch). Also `apps/mobile` (Expo) and `apps/website` (marketing) exist but are out of scope for this audit. |

The intent is a **local-first, real-time** organiser console: TanStack DB holds events /
users / attendance client-side, mutations optimistically write and sync to the Core API,
and the UI reads from the live collections. It's a genuinely modern stack and the
console half works well.

### 2.2 What works (keep these)

- **Design language is excellent and consistent.** The lime billboard heroes, pill
  toggles, and borderless list cards read as one system across every screen, light
  logic intact, desktop and mobile. *(shots: `03-events-list`, `05-attendees`,
  `06-analytics`, `09-event-detail`.)*
- **Organiser event lifecycle is coherent.** Create → view → edit → attendees →
  check-in kiosk all exist and share components (`EventComposer` ⇆ `EventView`, the
  Phase 1 #2 reuse goal). The composer defaults the org, the timezone, a placeholder
  cover, and a Casio-style time picker — all Phase 1 wins, all live.
- **Check-in kiosk is well-built.** Event-QR ⇄ Scan slider, manual fallback, a DEV
  debug drawer that surfaces the raw scanned QR + parse/decode errors (#3), and the
  new `html5-qrcode` scanner (#11). *(shot: `11-checkin-kiosk`.)*
- **Analytics screen is visually first-class** and has a clean Pro-gating/blur pattern.
  *(shot: `06-analytics`.)* — but see §2.3 on the data being mock.
- **Guest auto-login already exists** (`useGuestAutoLogin`) — the seed of the public
  access model is present; it's just not wired to the public event path.

### 2.3 What's broken or half-built (evidence-backed)

Ordered by severity.

#### 🔴 B1 — Public event page is unusable logged-out (the #10 blocker)
The public `/e/:eventId` page renders `EventViewPage`, which reads from the **events
collection** → `GET /api/core/events`. That endpoint requires a Supabase JWT (auth
middleware guards every route). Logged out, there is no token.

- **Observed:** logged-out `/e/:eventId` fires **three consecutive `401`s** on
  `/api/core/events` and then **hangs on an infinite loading spinner forever** — it
  never even reaches the "Event not found" copy. *(shot: `10-public-event-loggedout.mobile`
  = a black screen with a spinner; console: `401 …/api/core/events` ×3.)*
- **Impact:** the entire attendee-facing half of the product is dead for its intended
  audience (people who don't have accounts). Every QR you share leads here.
- **Root cause is two-sided** (frontend + backend), exactly as the owner diagnosed:
  1. Backend: no token-optional public read path for a single event.
  2. Frontend: the public page reuses the authenticated **list** collection instead of
     fetching one event by id; and there is no route-level auth boundary to redirect
     or degrade gracefully.

#### 🔴 B2 — No registration / RSVP concept, though the schema half-supports it
The attendees screen shows **"30 people · 0 signed up · 2 attended."** *(shot:
`05-attendees`.)* "Signed up" is surfaced in the UI but **no flow ever produces it.**

- The `attendance` table already has `attended: boolean (default false)` + a nullable
  `checkInTime`. So the model **can** represent *registered-but-not-yet-arrived*
  (`attended=false`), but the only writer (`useAttendeeCheckIn`) always writes
  `attended=true`. The registration state is stranded.
- **Consequence:** hosts cannot answer "who *said* they're coming?" — only "who came."
  For a recurring community that plans capacity/food/rooms, that's a core miss. This is
  the architectural gap the owner flagged, and it is real.

#### 🟠 B3 — Auth identity is decoupled from the patron record
`users` (patron directory, unique email) is a **different table** from Supabase Auth
users. A logged-in CredoPass user has no link between their auth identity and a `users`
row. So the "logged-in ⇒ instant check-in, skip the form" goal (owner's #10) has
nothing to key on yet — there's no "this auth user *is* patron X" edge.

#### 🟠 B4 — Event status lifecycle isn't respected in the UI
A **COMPLETED** event still shows a prominent **"Check-in Guests"** CTA + live QR on
both the detail page and kiosk. *(shots: `09-event-detail`, `11-checkin-kiosk` — both
show `completed`/`COMPLETED` with full check-in affordances.)* Status is derived
correctly server-side (`getStatus`) but the UI ignores it for gating actions.

#### 🟠 B5 — Analytics numbers are fabricated
`fetchAnalytics` returns server-fabricated figures ("numbers are fabricated server-side
for now"). The screen shows **"1,152 total members"** against **30** real patrons and
**"190 active streaks"** with no loyalty writes happening. *(shot: `06-analytics`.)*
Presenting mock data as real in a shipped-looking dashboard is a trust risk.

#### 🟡 B6 — Fragile error/empty states
- The check-in **Scan** mode renders a bare **"Something went wrong!"** with an *empty*
  red error box when the camera can't start (no permission / headless). *(shot:
  `12-checkin-scan.mobile`.)* No guidance, no fallback surfaced inline.
- The public page's failure mode is an infinite spinner (B1), not an error state.

#### 🟡 B7 — Mobile layout overflow on the kiosk summary
On the check-in kiosk header, the "**0 IN / Unlimited**" capacity chip **overflows off
the right edge** on a 390px viewport. *(shot: `11-checkin-kiosk.mobile`.)*

#### 🟡 B8 — Empty-feeling home when nothing is "upcoming"
The events home derives Upcoming/Past from event times. With all 11 seeded events in the
past, the hero reads "**0 upcoming · 0 live now**" and the whole home feels empty
despite a populated account. *(shots: `03-events-list` desktop + mobile.)* The default
filter/empty state doesn't guide the user to their (existing) past events or to create.

#### 🟡 B9 — Blank region on the desktop event detail
The desktop event detail has a large empty black band low on the page (the map/cover
region rendering nothing at that width). *(shot: `09-event-detail.desktop`.)* Possibly
related to the Phase 1 #8 map-resize area; worth a targeted check.

### 2.4 Current flows, as they actually behave

**Unsigned visitor**
```
/e/:eventId  ──▶  GET /events (401 ×3)  ──▶  ∞ spinner  ✗ DEAD END (B1)
/login       ──▶  guest auto-login       ──▶  /events (becomes an anon "user")
```

**Host / organiser** (works)
```
/login ▶ /events (home/dashboard, NOT a plain list)
      ▶ /events/new (composer: org, time, cover, capacity)
      ▶ /events/:id (billboard + pass + when/where/what + organiser actions)
      ▶ /attendees (all patrons; "signed up" always 0 — B2)
      ▶ /checkin/:id (Event-QR ⇄ Scan ⇄ Manual; DEV drawer)
      ▶ /analytics (mock data — B5)
      ▶ /profile (orgs live here; /organizations redirects in)
```

**Attendee** (intended, currently broken)
```
scan QR ▶ /e/:eventId ▶ [logged out] ∞ spinner (B1)
                       ▶ [if it loaded] "Check in" ▶ name/email form ▶ ticket QR
Logged-in fast path: does not exist (B3)
Registration/RSVP ahead of the event: does not exist (B2)
```

---

## 3. Target workflows & user stories (best-in-class)

Design principle, restated: **optimise the check-in loop for recurring communities;
never require an account to attend; make the host's "who's coming / who came" instant.**

### 3.1 Personas

| Persona | Who | Primary goal |
|---|---|---|
| **Visitor** | Someone who opened a shared link/QR, no account | Understand the event; optionally register; check in at the door with zero friction |
| **Attendee (returning)** | A patron who has attended before (has a `users` record), may or may not have an auth login | One-tap "I'm here" / register; carry their pass & loyalty across events |
| **Host / organiser** | Runs events for an org (church, gym, meetup) | Publish an event, see who registered, check people in fast, know who actually showed |
| **Team member** | Co-organiser (`event_members` already models this) | Help run the door without full org-admin rights |

### 3.2 Visitor → attendee flow (the one that's dead today)

```
      scan QR / open link
              │
              ▼
     ┌───────────────────┐   public, NO auth required (read-only)
     │  /e/:eventId       │   ── event billboard, when/where/what, host, capacity
     │  (public event)    │   ── primary CTA depends on event state (§3.5)
     └───────────────────┘
              │
     ┌────────┴─────────────────────────────┐
     ▼                                       ▼
  BEFORE the event                     AT / DURING the event
  "Register / RSVP"                    "Check in"
     │                                       │
     ▼                                       ▼
  minimal form (name+email)            logged-in? ──yes──▶ 1-tap check-in ▶ pass QR
  OR 1-tap if known                    │
     │                                 no
     ▼                                 ▼
  creates attendance                 name+email form ▶ attendance(attended=true)
  (attended=false, registered)         ▶ pass QR (eventId:userId)
     │                                       │
     └──────────────▶ personal pass  ◀──────┘
                      (QR the host scans; also the loyalty anchor)
```

**User stories**

- *As a visitor, I can open a shared event link without logging in and read everything
  about the event* (fixes B1).
- *As a visitor, before the event I can register/RSVP with just my name + email so the
  host knows I'm coming* (fixes B2).
- *As a visitor at the door, I can check in with name + email and immediately get my
  pass QR* (already built; unblock via B1).
- *As a returning/logged-in attendee, check-in is one tap — no form — because the app
  already knows who I am* (fixes B3; owner's explicit #10 ask).
- *As any attendee, my pass and my attendance history persist so streaks/loyalty accrue*
  (activates the dormant `loyalty` table).

### 3.3 Host / organiser flow (tighten what exists)

```
/events (home) ─▶ Create Event ─▶ publish ─▶ share link/QR
      │
      ├─▶ Registrations tab   NEW: who RSVP'd (attended=false)  ── B2
      ├─▶ Attendees / check-in: door mode, live count, scan/manual
      ├─▶ Post-event: attendance summary, no-shows (registered − attended)
      └─▶ Analytics: REAL attendance %, repeat-rate, streaks  ── B5
```

**User stories**

- *As a host, I can see registrations before the event and attendance after, as two
  distinct numbers* ("12 registered · 9 attended · 3 no-shows").
- *As a host, once an event is completed the UI stops offering "check-in" and shows me
  the summary instead* (fixes B4).
- *As a host, the analytics I see are real numbers derived from actual attendance*
  (fixes B5).
- *As a host on my phone at the door, the kiosk fits the screen and never overflows*
  (fixes B7), *and if the camera is blocked I get a clear inline fallback to manual*
  (fixes B6).

### 3.4 Access-control model (the §10 rearchitecture)

The clean rule set:

| Route class | Examples | Logged out | Logged in |
|---|---|---|---|
| **Public read** | `/e/:eventId` | ✅ read event (public endpoint) | ✅ read + fast check-in |
| **Public write (scoped)** | attendee check-in / register for that event | ✅ allowed (that's the point) | ✅ allowed |
| **Private (console)** | `/events`, `/attendees`, `/analytics`, `/profile`, `/checkin/:id`, composer | ➡ redirect to `/login?redirect=…` | ✅ |

Two enabling changes (detailed in §4):
1. **Backend:** a token-optional **public read** for a single event (and the minimal
   fields the public page needs), plus a token-optional **scoped write** for
   register/check-in on that event. Everything else stays authenticated.
2. **Frontend:** a route-level auth boundary (`beforeLoad`) on the private route group
   that redirects to `/login?redirect=…`; the public page fetches **one event by id**
   (not the list collection) and degrades to a real error state, never an infinite
   spinner.

### 3.5 State-driven CTA on the public page

The public event page's primary action should follow event state:

| Event state | Primary CTA | Secondary |
|---|---|---|
| `scheduled` (future) | **Register / RSVP** | Add to calendar |
| `ongoing` (now) | **Check in** | Add to calendar |
| `completed` / `cancelled` | *(none — show "This event has ended")* | View host's other events |

This one rule simultaneously fixes B4 and makes the register-vs-checkin split (B2)
legible to the visitor.

---

## 4. Build plan

Sequenced so each milestone is shippable and the risky/reviewable data change is
isolated. **UI + `services/core` are in scope; DB schema changes are proposals only
(§4.6 / §6) pending owner review.**

### M0 — Foundations & safety nets (no behaviour change)
- Add a route-level auth utility and a shared `requireAuth` `beforeLoad`.
- Add an error boundary + real empty/error states component the public page can use.
- **Files:** `apps/web/src/routes/__root.tsx`, new `apps/web/src/routes/_authed` group
  (or per-route `beforeLoad`), `packages/ui` empty/error components.

### M1 — Public read (fixes B1, part 1) — *highest priority*
- **Backend:** add a token-optional `GET /api/core/public/events/:id` returning the
  read-only public fields for one event (name, org name, when/where/what, capacity,
  status). Keep it off the JWT middleware (extend `PUBLIC_SUFFIXES`/mount before auth).
- **Frontend:** `EventViewPage(variant="public")` fetches that single endpoint (a new
  `usePublicEvent(id)` hook) instead of reading the authenticated events collection.
  Replace the infinite spinner with load / not-found / error states.
- **Files:** `services/core/src/routes/` (+ mount in app), `services/core/src/middleware/auth.ts`,
  `apps/web/src/Pages/Events/EventView/index.tsx`, `apps/web/src/Pages/Events/PublicEventPage.tsx`,
  `packages/api-client/src/client.ts`.
- **Acceptance:** logged-out `/e/:id` renders the event with **zero 401s** and no
  spinner-hang. (Re-run the §7 logged-out probe: "API errors while logged out: none".)

### M2 — Private redirect (fixes the console-side of #10)
- Apply `requireAuth` to the private route group → `redirect({ to: '/login', search: { redirect } })`.
- `/login` honours `redirect` after auth (guest or real).
- **Files:** the `_authed` group / `beforeLoad`s, `apps/web/src/Pages/Login`, `apps/web/src/hooks/index.tsx` (`useGuestAutoLogin` already navigates post-auth — extend to honour `redirect`).
- **Acceptance:** logged-out `/events` → `/login?redirect=/events` → back to `/events` after auth.

### M3 — State-driven public CTA (fixes B4 on the public side)
- Public page CTA switches on `event.status` per §3.5; hide check-in on completed/cancelled.
- Mirror the gating on the organiser detail + kiosk (completed ⇒ show summary, not a live QR).
- **Files:** `apps/web/src/Pages/Events/EventView/index.tsx`, `apps/web/src/Pages/CheckIn/index.tsx`.

### M4 — Registration / RSVP (fixes B2) — **uses existing columns, no schema change**
- **Backend:** a token-optional scoped write to create/mark an `attendance` row with
  `attended=false` (register) for a given event, distinct from check-in
  (`attended=true`). Reuse the `attendance` table's existing `attended` flag.
- **Frontend:** public page "Register / RSVP" path (name+email) for `scheduled` events;
  organiser "Registrations" view = attendance where `attended=false`; attendees summary
  shows registered / attended / no-show as three real numbers.
- **Files:** `services/core/src/routes/attendance.ts` (or a dedicated register handler),
  `apps/web/src/Pages/Events/use-attendee-checkin.ts` (add a `register` sibling),
  `apps/web/src/Pages/Events/EventView/index.tsx` (AttendeeCheckInDialog → add register mode),
  `apps/web/src/Pages/Attendees/*`.
- **Note:** this is the point to confirm with the owner whether "register" should be a
  reused `attendance(attended=false)` row (**no DB change — recommended**) or a
  dedicated `registrations` table (**DB change — see §6**).

### M5 — Logged-in fast check-in (fixes B3)
- Link the auth identity to a patron `users` row (see §6 proposal). With that link, a
  logged-in attendee on `/e/:id` gets a **one-tap check-in** that skips the form.
- **Depends on** the §6 decision (needs either a nullable `authUserId` on `users` or a
  mapping table). Until then, ship a *soft* version: prefill the form from the logged-in
  session's email/name if available.

### M6 — Real analytics (fixes B5)
- Replace fabricated figures with aggregates over `attendance` (attendance %, repeat
  rate, no-shows, live-now count) and `loyalty` (streaks) — or clearly label the screen
  "sample data" until wired.
- **Files:** `services/core` analytics handler, `packages/api-client/src/client.ts::fetchAnalytics`.

### M7 — Polish (B6–B9)
- Inline camera-permission fallback on Scan mode; fix kiosk mobile overflow (B7); guide
  the empty home toward past events / create (B8); fix the desktop detail blank band (B9).

### 4.6 Dependency graph
```
M0 ─┬─▶ M1 (public read) ─┬─▶ M3 (state CTA)
    │                      └─▶ M4 (register) ─▶ M6 (real analytics)
    └─▶ M2 (private redirect)
                              M5 (fast check-in) ── needs §6 decision
                              M7 (polish) ── independent, anytime
```
**Recommended first PR:** M0 + M1 together — it revives the entire attendee half and is
the highest-leverage, lowest-risk change. Everything else stacks on it.

---

## 5. Non-goals (explicitly out of scope for Phase 2)
- Payments / paid tickets — CredoPass is not a ticketing platform (§1).
- Backend DB **refactoring** — proposals in §6 are for review, not implementation.
- `apps/mobile` and `apps/website` — console + public web only.

---

## 6. Data-model proposals (REVIEW REQUIRED — not applied)

These are the *only* places the target experience wants schema help. Presented for the
owner to approve/reject; nothing here is implemented in Phase 2.

1. **Link auth ↔ patron (enables M5, fast check-in).**
   Add nullable `authUserId uuid` to `users` (or a `user_identities` mapping table),
   set on first authenticated check-in/login. Nullable ⇒ non-breaking; walk-in patrons
   created at the door simply have it null.

2. **Make "registration" first-class *(optional — only if M4's reuse of
   `attendance.attended=false` proves insufficient).*
   A `registrations` (or `event_signups`) table with `status` (registered / waitlisted /
   cancelled) if you later need waitlists, capacity holds, or a registration distinct
   from an attendance row. **Recommendation: don't — reuse `attendance.attended` first.**

3. **Activate `loyalty` (enables real streaks in M6).**
   The `loyalty` table exists but has no writer. Decide the accrual rule (e.g. +1 per
   attended event, streak = consecutive attended events in a window) and write on
   check-in. No schema change needed to start; a `streak`/`points` denormalisation may
   help later.

---

## 7. Handoff runbook — for the next agent (read this first)

You are continuing Phase 2 in a fresh context. Everything you need to resume:

### 7.1 Where you are
- Branch: **`feat/phase-2-ux-audit`** (this doc lives at `docs/PHASE-2-UX-AUDIT.md`).
- Phase 1 is complete and pushed on `feat/phase-1-event-fixes` (QR scanner, DEV drawer,
  copy-link, Casio clock, attendees scroll, map resize, image picker, default org). The
  **only** Phase-1 item intentionally deferred to Phase 2 is **#10 (auth/access +
  registration)** — it is the spine of this plan (B1/B2/B3, milestones M1/M2/M4/M5).
- No implementation code for Phase 2 has been written yet. The recommended first PR is
  **M0 + M1** (§4).

### 7.2 Boot the stack (verified working)
The DB is **hosted Supabase** (`DATABASE_URL` in `services/core/.env` points at
`db.*.supabase.co`) — **you do NOT need Docker/local Postgres.**

```bash
# Core API — MUST run from services/core so Bun loads services/core/.env
cd services/core && NODE_ENV=development PORT=8080 bun --watch src/index.ts
#   healthy log: "🔑 Env: SUPABASE_URL=✓  DATABASE_URL=✓"
#   GET http://localhost:8080/api/core/events  → 401 when unauthenticated (correct)

# Web — from repo root; picks the first free port from 5000 (often 5004 locally)
npx nx serve web
#   note the "Local: http://localhost:PORT" line — ports 5000–5003 are often taken
#   (macOS AirPlay holds :5000). Use whatever port it prints as BASE below.
```
Env keys already populated: `apps/web/.env` (VITE_SUPABASE_URL/ANON_KEY, VITE_MAPBOX…,
VITE_API_URL=http://localhost:8080/api/core) and `services/core/.env`
(DATABASE_URL, SUPABASE_URL). If Core logs `Env: …=✗ missing`, you launched it from the
wrong cwd — Bun auto-loads `.env` from the working directory.

### 7.3 Re-take screenshots (Playwright, no extra installs)
`@playwright/test@1.61` + Chromium are already installed. **Scripts must live at the
repo root** (ESM needs `node_modules` resolvable) and be `.gitignore`d or deleted after.
Auth pattern: hit `/login` first → `useGuestAutoLogin` mints a guest session and
redirects to `/events`; the Supabase token then lives in `localStorage` (key contains
`auth-token`) and you can pull `access_token` from it to call the API directly.

Minimal driver skeleton (adapt BASE to the printed port):
```js
// .shot.mjs  (repo root; delete when done)
import { chromium } from '@playwright/test';
const BASE = process.env.BASE || 'http://localhost:5004';
const b = await chromium.launch();
const p = await b.newContext({ viewport:{width:390,height:844}, isMobile:true }).then(c=>c.newPage());
p.on('response', r => { if (r.status()>=400 && r.url().includes('/api/')) console.log('HTTP', r.status(), r.url()); });
await p.goto(`${BASE}/login`, {waitUntil:'networkidle'}); await p.waitForTimeout(2500); // guest login
// ... navigate + p.screenshot({ path: 'shot.png' }) ...
// logged-OUT public probe = a FRESH context that never visits /login:
await b.close();
```
- **Discover a real event id:** in a logged-in page, read the Supabase token from
  `localStorage` and `fetch('/api/core/events')` with `Authorization: Bearer <token>`.
  (Event cards are not `<a href>` links, so DOM scraping won't yield ids.)
- **Reproduce B1:** open `/e/:id` in a **fresh (logged-out) context**; you should see the
  spinner-hang and three `401 …/api/core/events` in the console. After M1, that probe
  must print no API errors.

### 7.4 File map (the seams you'll touch)
| Concern | Path |
|---|---|
| Auth middleware (make a public read path) | `services/core/src/middleware/auth.ts` (`PUBLIC_SUFFIXES`) |
| Generic REST | `services/core/src/util/crud-factory.ts`, `services/core/src/routes/events.ts` |
| API client / fetch / auth header | `packages/api-client/src/client.ts`, `packages/api-client/src/collections/events.ts` |
| Public event page | `apps/web/src/routes/e/$eventId.tsx`, `apps/web/src/Pages/Events/PublicEventPage.tsx` |
| Shared event view + attendee check-in dialog | `apps/web/src/Pages/Events/EventView/index.tsx` |
| Check-in kiosk + DEV drawer | `apps/web/src/Pages/CheckIn/index.tsx`, `.../components/QRScanner.tsx` |
| Check-in / (future) register mutation | `apps/web/src/Pages/Events/use-attendee-checkin.ts` |
| Attendees (registered vs attended) | `apps/web/src/Pages/Attendees/*`, `apps/web/src/routes/attendees/*` |
| Route root + standalone list + guest login | `apps/web/src/routes/__root.tsx`, `apps/web/src/hooks/index.tsx` (`useGuestAutoLogin`) |
| Analytics (real numbers) | `services/core` analytics handler, `packages/api-client/src/client.ts::fetchAnalytics` |
| Data model | `packages/lib/src/schemas/tables/*.ts` (esp. `attendance.ts`, `users.ts`, `event-members.ts`, `loyalty.ts`) |

### 7.5 Key facts you must not re-derive
- `attendance.attended` (boolean, default false) already exists → **register = an
  attendance row with `attended=false`; check-in flips it true.** No schema change to
  start M4.
- Supabase Auth users ≠ `users` patron rows (unique email); there is **no link** — that's
  B3, and M5 needs §6 proposal #1 to be truly one-tap.
- Every Core route is JWT-guarded except paths ending in `/health`, `/docs`,
  `/openapi.json`. That's why the public page 401s.
- `getStatus()` in `packages/api-client/src/collections/events.ts` derives
  scheduled/ongoing/completed from event times — trust it for the §3.5 state-driven CTA.
- Analytics figures are **fabricated** server-side today (B5) — don't trust the
  1,152/190 numbers.

### 7.6 First tickets to pick up (in order)
1. **M0** — add `requireAuth` `beforeLoad` scaffolding + a reusable error/empty state.
2. **M1** — public single-event read endpoint + `usePublicEvent` + kill the
   spinner-hang. *(Acceptance: §4 M1.)*
3. **M2** — private redirect to `/login?redirect=…`.
4. Then M3 → M4, pausing at M4 to get the owner's §6 decision on register-vs-schema.

---

*End of Phase 2 audit. Screenshots referenced were captured live during this audit at
desktop 1440×900 and mobile 390×844; regenerate them with the §7.3 runbook.*
