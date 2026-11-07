# ROADMAP — the one ordered plan

> **Written 2026-11-07**, from the maintainer's testing feedback of the same day, checked line by
> line against the code and against the 18 screenshots in
> [`apps/website/public/how-to/`](../apps/website/public/how-to/).
>
> **This file answers "what is done and what is next, in what order".** It does not replace the
> two documents it draws on — it sequences them:
>
> - [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) — the *why* and the design for the public API
>   (Part A) and the product backlog B1–B8. Decisions D31–D38 live there.
> - [`UI-REDESIGN.md`](UI-REDESIGN.md) — the *evidence*: a measured walk of all 20 routes at
>   375×812. Findings R1–R7 and per-screen notes §3.1–§3.21.
>
> Neither is stale, and neither is the plan. **This is the plan.** When an item here ships, tick it
> here, write the outcome in [`REBUILD-LOG.md`](REBUILD-LOG.md), and leave the design doc alone.

---

## 0. The document shuffle, settled (2026-11-07)

Three files were deleted and the deletion was swept up by whatever auto-commits this repo
(`ab3e9cd`, "Refactor code structure…" — not written by a human or an agent in that session).
Resolved as follows, so nothing load-bearing was lost:

| File | What happened |
|---|---|
| `NEXT-UI-LIST.md` | **Stays deleted.** U5–U8 shipped; U1–U4 and its platform table are absorbed into §1 and stages 1, 2 and 5 below. |
| `API-FIRST-REBUILD.md` | **Restored to [`archive/`](archive/API-FIRST-REBUILD.md).** Phases 4–7 never shipped, **D1–D26 live in it**, and ~40 source files cite it by section number. Deleting it would orphan every one of those comments. |
| `DATABASE-MIGRATION.md` | **Restored to `docs/`.** It is not a plan — it is the procedure for every schema change, which stages 3 and 4 both need, and `CLAUDE.md` tells agents to follow it. |

**Also corrected here, because the first draft of this file got them wrong:**

- **`UI-REDESIGN.md` is not complete.** The *audit* is — all 20 routes walked. The *findings* mostly
  are not: only **R1** (`0bccc7c`) and **R4** (`bb62ef7`) have commits. R2, R3, R5, R6, R7 and most
  per-screen notes are still open and are scheduled in stages 1, 2 and 5.
- **B2 ("No organization") is not fixed.** `apps/web/src/Pages/Events/EventComposer/event-composer.tsx:34`
  still reads `active?.name ?? 'No organization'` against a second request. It *looks* fixed because
  the race usually resolves fast. It is in stage 1.

## 1. The ledger — what is actually done

Verified against the code on 2026-11-07, not copied from a plan.

### Shipped

| | Work | Evidence |
|---|---|---|
| ✅ | Phase 0 + most of Phase 1: accounts / identities / people / invitations / SSO tables, RLS policies, issuer registry, auth + tenant middleware, `/me`, `/me/context`, organizations, members, invitations | `services/core/src/api/v1/core/` |
| ✅ | The web app reads `/api/v1/core` through `@credopass/api-client` only. `/api/core` is gone | `docs/archive/API-SECOND-REBUILD.md` |
| ✅ | Sign-up funnel; Google is the only sign-in; no guest tier, no onboarding screen, no device tokens | `docs/archive/API-THIRD-REBUILD.md`, D20–D26 |
| ✅ | **B1** — keyboard shortcuts no longer hijack ⌘V/⌘A/⌘N/⌘T/⌘P; one registry, `g` chords, cheat sheet in ⌘K | `apps/web/src/hooks/shortcuts.ts` |
| ✅ | **U5** — every pass link was dead in production (wrong host, wrong scheme). Fixed with a configured app origin | `services/core/src/config/public-url.ts` |
| ✅ | **U6** — a pending invitation's link can be recovered; `inviteMember` rotates instead of inserting | members tab shows `New link` |
| ✅ | **U8** — re-registering silently killed a live pass. Rotation is a schema invariant, so the fix was to say so in all three places a pass is issued | commit `77b6cce` |
| ✅ | **R1** — the document scrolls, not an inner box | commit `0bccc7c`, verified on screen |
| ✅ | **R4** — the bottom tab bar no longer hides on scroll; glass tab bar + glass sidebar | commit `bb62ef7` |
| ✅ | Adversarial tenancy suite green (51 tests) and gating the deploy | `nx run coreservice:test:adversarial` |

### Open, and already specified somewhere

| | Work | Spec | Size |
|---|---|---|---|
| ✅ | **B2** — the composer rendered "No organization" while `useOrganizations()` was in flight. `/me/context` ships the name now | shipped 2026-11-07 | S |
| ⬜ | **R2** — the same defect everywhere: the app renders the zero value instead of "I don't know yet" (`Good afternoon, there`, `0 events`, the stale attendee sheet) | `UI-REDESIGN.md` §2 R2 | S–M |
| ⬜ | **R5** — only the geocoder fails honestly; copy that sentence to the other three failure states | `UI-REDESIGN.md` §2 R5 | S |
| ✅ | **U4** — `PATCH /me` exists; the Profile tab edits the display name | shipped 2026-11-07 | S |
| ✅ | **F11/F15** — posters upload to object storage and persist. Presigned PUT, `assets` table, tenant-scoped | shipped 2026-11-07 | — |
| ✅ | **F12** — images are downscaled to 2048px and re-encoded in the browser before upload (805KB → 248KB measured) | shipped 2026-11-07 | — |
| ⬜ | **F12b** — server-side derivatives (AVIF/WebP at card and thumbnail widths, via `sharp`) | stage 4.2 | M |
| ⬜ | **F13** — the curated set and AI generation | stage 4.3 | M–L |
| 🟡 | **U2** — "QR scan check-in is broken", never reproduced. The likely cause (the kiosk opened on a code its own scanner refuses) is **fixed**; still wants confirming with a real camera | shipped 2026-11-07 | M |
| ⬜ | **U1** — `/analytics` draws a full dashboard from fabricated numbers; the warning is only at the top, `Arrivals by hour` is off-palette blue, `Export` is offered on made-up data | `UI-REDESIGN.md` §3.16 | S |
| ⬜ | **B3** — online events and optional location (`events.location_text` is `NOT NULL`; the UI copy already promises "Offline location or virtual link") | `NEXT-PHASE-PLAN.md` §5.3 | M |
| ⬜ | **B4** — no app-level notion of "browser offline" / "API unreachable" | `NEXT-PHASE-PLAN.md` §5.4 | M |
| ⬜ | **B6** — first-run narrative; **R3** — the GET STARTED billboard is permanent | §5.6 / R3 | M |
| ⬜ | **B7** — the AG-UI chat panel (`services/ai-chat`, no backend yet) | §5.7 | L |
| ⬜ | Live updates: a check-in does not reach other screens — polling, then SSE | `LIVE-UPDATES.md` | M→L |
| ⬜ | No email. Every pass URL and invitation link must be shown on screen | D18 | M |
| ⬜ | RLS is inert on the API path — the API connects as `postgres` | `CLAUDE.md` | M |
| ⬜ | No data migration from the pre-rewrite `users` table | `CLAUDE.md` | M |
| ⬜ | Account linking: two provider identities for one address get two accounts | — | decision first |
| ⬜ | **R6** text is truncated where it should wrap · **R7** the pass page's load-bearing sentence has no copy button | `UI-REDESIGN.md` §5 | S |
| ⬜ | Part A: the paid public API, webhooks, test mode, `pii_mode` | `NEXT-PHASE-PLAN.md` §1–§4 | L |

---

## 2. The feedback of 2026-11-07, itemised

Every point from the testing pass, kept whole, each with a verdict from the code. **F-numbers are
the reference** — use them in commits.

### The events screen

| | Feedback | Verdict |
|---|---|---|
| **F1** | The welcome reads "Good Morning, israel.agyeman.prempeh". Extract the first name from what Google gives us — `user_metadata` reliably has `full_name` / `name`, not always `given_name`, so check and fall back to splitting the full name. | **Confirmed, and the root cause is server-side.** `services/core/src/services/identity.ts:163` sets `displayName: asString(input.claims.name)` — the **top-level** `name` claim. Supabase does not send one; the name lives in `user_metadata`. So `accounts.display_name` is `NULL`, and `useDisplayName()` (`apps/web/src/contexts/session.tsx:121`) falls back to the email local part. Two bugs, not one: it is read from the wrong place, **and** it is only written when the account is *created* — never refreshed on later sign-ins, so existing accounts stay `NULL` after a fix. |
| **F2** | A very small edit button next to the name, which opens the profile. | **Not built.** `apps/web/src/Pages/Events/index.tsx:398` renders a bare `<h1>`. Worth pairing with **U4** — today `/account?tab=profile` says "Read-only for now", so the button would lead to a dead end. |
| **F3** | Drop the "2 events · 1 upcoming · 0 live now" line. Put the Upcoming/Past toggle directly under the welcome instead — but keep the numbers *and* the live count visible. | **Confirmed as described.** The line is `index.tsx:401`; the toggle is `StatusFilterSwitch` in `events-header-right`. The counts come from `useEventsSummary()`, so folding them into the toggle is a prop change, not a new request. |
| **F4** | Timezone is permanent now — it is not a filter. Remove the timezone toggle and put **Calendar View** and **View Organisations** in the space it frees. | **Confirmed.** `enableTimezone` defaults to `false` in `packages/lib/src/hooks/use-status-filter.ts:122` and is threaded through four call sites; the button is `StatusFilterSwitch.tsx:71`. The two actions are in `apps/web/src/containers/ActionCards/index.tsx`, currently a horizontal scroller whose second button clips at the right edge (`UI-REDESIGN.md` §3.1). |

### Event creation

| | Feedback | Verdict |
|---|---|---|
| **F5** | Recurring event dates — and what that means on the backend. | **Nothing exists.** `series:manage` is in `services/core/src/authz/permissions.ts` and `organizations.ts:14` names `event_series` as the intended shape, but there is no table, no column, no route. Design is in §3, stage 3. |

### QR codes

| | Feedback | Verdict |
|---|---|---|
| **F6** | As the organiser it should be obvious the QR you are looking at is the *event invite*, not your ticket — a ring around it, say. Attendee tickets stay as they are. | **Confirmed.** Every QR in the product renders through the same `GlowingQRCode` (`packages/ui/src/components/glowing-qr-code/`) with no variant. The event-detail QR, the kiosk's "Event QR" and the pass QR are visually identical. |
| **F7** | The shared QR carries the creator's **organisation**. An invited person does not need that — why is it there at all? Is it a backend issue? | **Partly.** `organizationName` is in `PublicEventSchema` (`services/core/src/api/v1/core/public.ts:43`) on purpose: a public event page naming its host is normal and is not a tenancy leak. **The real problem is what the name is.** `defaultOrganizationName` (`services/core/src/services/membership.ts:160`) builds it from the account's first name, so the public page and the pass both read *"Israel's organization"* — a personal name published to strangers. Fix the default name and the privacy concern goes away without removing a legitimate field. |
| **F8** | Scanning a QR in order to be given *another* QR is counter-intuitive. When I present a QR, that QR should be the pass. | **Correct observation, and the two cannot be collapsed.** A poster QR is one code shared by everyone; a pass is one code per person. The poster code therefore cannot *be* a pass. What can be fixed is that the two look the same — see F6/F9 and stage 2. |
| **F9** | The confusion is between *event-information* QRs and *passes*. Putting a poster image on the event flyer might make it read as a flyer rather than a check-in code. Analyse. | **Agreed, and that is the fix.** Three surfaces show an event-link QR (`/e/{id}`): the event detail card, the kiosk's "Event QR" tab, the Poster QR sheet. One shows a pass (the raw token): `/p/$token`. Make *invitation* QRs always appear inside a poster-shaped card — cover image, title, date, "scan to register" — and *pass* QRs stay the bare high-contrast square on full-bleed lime with the holder's name. Then the two are never mistaken, and the poster work in stage 4 is what delivers it. This is also the most likely explanation of **U2** ("QR scan broken"): the kiosk opens on a code that its own other tab rejects. |
| **F10** | On the kiosk, when the scan counter goes up, tapping it should jump to the attendance list — and back to scanning. | **Not built.** The counter is a non-interactive `<div>` in `apps/web/src/Pages/CheckIn/components/CheckInHeader.tsx`. |

### Posters

| | Feedback | Verdict |
|---|---|---|
| **F11** | S3 storage so users can generate or add posters. | **Greenfield.** `events.cover_asset_id` exists as a bare `uuid` with no `assets` table and no FK (`packages/lib/src/schemas/tables/events.ts:58`). MinIO is already in `docker/docker-compose.dev.yml` and nothing uses it. The composer holds a blob URL and nothing more — `TODO(event-image)` at `event-composer.tsx:103` lists the four steps. |
| **F12** | Uploads must be compressed before storage — there will be many, and tickets must load fast. | **Agreed, non-negotiable.** Design in stage 4. |
| **F13** | Auto AI-generated image options when creating an event, the way Luma offers them — plus a set of predefined images, plus your own upload. | **This supersedes D38.** `NEXT-PHASE-PLAN.md` §5.5 decided "typographic templates, no image model". The decision stands for *posters with text on them* — diffusion models still cannot set type — but it was answering a different question. What is asked for here is a **background image**, chosen at creation, with the title rendered by us on top. That is both achievable and the right split. Recorded as **D39** in §4. |
| **F14** | Keep the poster area on the composer. Even with no model, make it a placeholder showing the illustration we have now, with a mechanism to paste an arbitrary poster image that can be swapped out. | **The slot exists and persists nothing.** `EventImage` renders a blob URL held in React state (`event-composer.tsx:112`); it is discarded on submit. This is the smallest honest slice of F11 and it does not wait for storage: one `text` column holding a URL, and the picker gains a "paste a link" path. Scheduled as **stage 1b** so it ships this week rather than with the bucket. |
| **F15** | Uploaded an image from a file and could not see it afterwards. | **Known and deliberate for now, but the message is not doing its job.** Stage 1b persists a pasted *link*; an uploaded *file* has nowhere to go until there is a bucket, so it previews and is dropped on save. The picker says so in a line of muted 11px text under the image — clearly not enough, since it was read right past. **Two changes, not one:** make the not-saved state unmissable at the moment of picking (a warning on the image itself, not a footnote), and bring **stage 4.1 forward** so the answer stops being a caveat. Until then nobody should be able to pick a file and be surprised. |
| **F16** | An event cannot be created with the address left blank. | **Confirmed, and already on the list as B3.** `events.location_text` is `NOT NULL` (`packages/lib/src/schemas/tables/events.ts:38`) and the API enforces `z.string().min(1).max(300)` (`events.ts:234`), while the composer's own copy already offers "Offline location or virtual link". The UI has been promising optional/virtual locations for weeks and the schema refuses them. Scheduled at **stage 5b**; it needs a migration (drop the NOT NULL, add `format` + `meeting_url`, CHECK the combinations), which is why it is not a one-line fix. |

---

## 3. The plan, in order

Each stage is shippable on its own and leaves the product better than it found it. Do them in this
order.

### Stage 1 — Who you are, and the first screen · ✅ **SHIPPED 2026-11-07**

Everything on `/events` above the fold, plus the one confirmed bug that shares its cause.

1. **F1a — read the name from the right claim.** In `services/core/src/services/identity.ts`, take
   `displayName` from `user_metadata.full_name` → `user_metadata.name` → top-level `name`, and
   derive the first name by splitting on whitespace only when `given_name` is absent.
   **Do not trust `user_metadata` for anything but display** — it is user-writable
   (`auth.updateUser({ data })`), which is exactly why `identities.email_verified` is never trusted
   from it. A display name is cosmetic; an identity decision is not.
2. **F1b — refresh it on every sign-in.** The `existing.length > 0` branch already updates the
   identity row; update `accounts.display_name` there too when it is `NULL` or has changed. Without
   this, every account created before the fix keeps the email local part forever.
3. **F2 — the edit affordance.** A small pencil beside the greeting → `/account?tab=profile`.
4. **U4 — make that destination real.** `PATCH /me` with `displayName`, and wire the Profile tab.
   Four lines of route, and it is what makes F2 worth tapping. `nx run api-client:generate` after.
5. **F3 — one control, not two.** Delete the summary paragraph. Move `StatusFilterSwitch` directly
   under the greeting and carry the counts on it: `Upcoming 1` / `Past 1`, with the live count as a
   separate pulsing chip when `summary.ongoing > 0` (it is the only number that is urgent).
6. **F4 — timezone always on.** Remove the toggle from `StatusFilterSwitch`, remove
   `enableTimezone` / `toggleTimezone` from `use-status-filter.ts` and its four call sites, and
   pass `timezone` as a constant `true`. Move **Calendar View** and **View Organisations** into the
   row the toggle vacated, and fix the right-edge clip (`UI-REDESIGN.md` §3.1) while you are there.
7. **B2 + R2 — stop rendering zeroes as facts.** Add `name` to `OrgSummarySchema` in
   `/me/context` so the org pill needs no second request, and give the greeting, the counts and the
   pill a shared skeleton. `Good afternoon, there` and `0 events` must never appear.

**Done when:** a fresh Google sign-in greets you by your first name, the header is
greeting → toggle-with-counts → the two action buttons, no timezone toggle exists anywhere, and
nothing on the screen states a number before it has one.

---

### Stage 1b — The poster slot, persisted · ✅ **SHIPPED 2026-11-07**

**F14.** The composer already has the right *shape* — an image well above the billboard, with the
calendar illustration as its empty state. What it lacks is anywhere to put the answer. Do the
minimum that makes it real, and leave the bucket to stage 4:

```
events.cover_image_url text null   -- an absolute https URL, nothing more
```

- `EventImage` keeps the illustration as its default and gains **"Paste an image link"** beside the
  existing file/camera pick. A pasted `https://` URL is validated, previewed, and saved with the
  event; **Remove** puts the illustration back.
- A picked *file* still previews as a blob and still does not persist — say so in the UI rather
  than silently dropping it, until stage 4.1 gives it somewhere to go. One sentence: *"Pasted links
  are saved. Uploads arrive with poster storage."*
- `cover_image_url` is carried on `EventSummary`, the event detail payload **and the public event
  payload**, and rendered on the EventView billboard, the event row's date-icon slot, `/e/{id}` and
  the pass. That is what makes an invitation QR read as a flyer (F9).
- Render it behind the lime billboard at low opacity rather than as a separate band, so a bad image
  cannot wreck the screen.

**Why a URL column and not the `assets` FK now:** stage 4 replaces the *source* of the URL, not the
column. `cover_asset_id` already exists for when the bucket does; a nullable URL beside it costs one
migration and unblocks the whole visual half of this roadmap today.

---

### Stage 2 — Tell a pass apart from an invitation · ✅ **SHIPPED 2026-11-07**

F6, F8, F9 and F10 are one piece of work, and it closes U2.

1. **Give `GlowingQRCode` a `variant`.** `pass` is today's treatment. `invitation` adds the ring
   the feedback asks for — a distinct outer frame, a label, and a different corner radius — so the
   difference survives a glance and a photograph.
2. **Apply it everywhere an event link is shown**: the event detail card, the kiosk's Event QR tab,
   the Poster QR sheet. The pass page is the only `pass` variant, and it does not change.
3. **Demote the kiosk's Event QR.** `UI-REDESIGN.md` §3.11 is right: "how do people get a pass" and
   "I am taking passes now" are not peers. The kiosk opens on **Scan passes**; the event QR moves
   behind the Maximise/share affordance. This alone probably resolves **U2** — confirm with a real
   camera before closing it, using the debug drawer.
4. **F10 — make the counter a button.** Tapping it opens the attendance list for this event, and
   that view has an unmissable way back to scanning. Treat it as an overlay over the kiosk rather
   than a navigation away from it, so "back to scanning" is one tap and the camera does not
   re-initialise.
5. **F7 — stop publishing a person's name as an organisation.** Change
   `defaultOrganizationName` so a new account's org is not *"Israel's organization"*. Existing rows
   are not renamed automatically; the Settings tab already allows a rename, so prompt once instead.

**Done when:** an organiser cannot confuse the two codes, U2 is either reproduced-and-fixed or
closed with the explanation, and the kiosk's counter is a route to the attendance list.

---

### Stage 3 — Recurring events · ⏸️ **PAUSED 2026-11-07** — see [`RECURRING-EVENTS.md`](RECURRING-EVENTS.md)

**F5 — what it means on the backend.** The honest answer, and the one the schema was already
designed for:

> **Materialise occurrences. Do not store a rule and compute dates at read time.**

Attendance, passes, capacity and analytics all hang off `events.id`. A recurrence rule that is
expanded on the fly has no stable id to hang them from, so the first time someone checks in to
"the third Sunday" there is nothing to write the row against. Luma, Eventbrite and Google Calendar
all materialise for the same reason.

```
event_series
  id, organization_id, name, timezone,
  rrule text            -- RFC 5545, the record of what was asked for
  until / count         -- the horizon
events
  series_id uuid null references event_series(id)
  series_index int null -- which occurrence this is
```

- The composer gains a **Repeat** control (never / weekly / fortnightly / monthly-by-weekday) and
  an end condition. Creating a recurring event creates the series **and** its occurrences in one
  transaction, capped at a horizon (12 months or 52 occurrences — whichever the first customer
  needs, decided in §4).
- Editing one occurrence edits that row. Editing the series asks **"this event, or all future
  ones?"** — the question every calendar app asks because there is no good default.
- Cancelling an occurrence cancels that event; everyone's pass for it still resolves, per D18 and
  the existing cancel path.
- A far-horizon series needs a top-up job eventually. Not in this stage — a 12-month horizon buys
  a year, and the Phase 4 scheduler is where it belongs.

Follow `DATABASE-MIGRATION.md` end to end: edit the tables in `packages/lib/src/schemas/tables/`,
`bunx drizzle-kit generate`, read the SQL, `nx run coreservice:migrate`,
`nx run api-client:generate`. Remember the gotcha — a new column makes *every* query ask for it, so
every database must be migrated before the code ships.

---

---

## ⏸️ Recurring events — PAUSED. Full brief in [`RECURRING-EVENTS.md`](RECURRING-EVENTS.md)

> The implementation was removed the same day it was built. The UI stays, showing an
> "in development" notice. **[`RECURRING-EVENTS.md`](RECURRING-EVENTS.md) is the file to read
> before restarting it** — every edge case, and the library recommendations. The risks below are
> why it was paused.

> **Read this before anyone runs a real programme through it.** Recurrence shipped on 2026-11-07
> and the expansion arithmetic is well covered (102 unit tests, DST included). What follows is the
> honest list of what is *not* handled — written because the failure mode here is somebody turning
> up to a church hall on a Sunday when the event is not in the system.
>
> Ranked by how likely they are to cost someone an event.

### 🔴 R-1 · A series stops dead at the horizon, and nothing says so

A programme materialises at most **104 occurrences**. "Every Sunday until 2030" silently becomes
"every Sunday for two years". The sheet warns at creation — and then nothing ever mentions it
again. There is no top-up job (that is the Phase 4 scheduler), no reminder, and no banner on the
last occurrence.

**So a church that set this up in good faith finds the calendar simply empty one week.** This is
the single most dangerous thing on the list.

*What to build:* `event_series.materialised_through` already exists for exactly this. Either a
scheduled top-up, or — cheaper and honest — a visible "this programme ends on 12 April" line on
every occurrence, and a nudge when fewer than N remain.

### 🔴 R-2 · There is no way to change or cancel a whole programme

Repeat is **create-only**. 104 events created by mistake must be removed one at a time, and
`DELETE /events/{id}` refuses with 409 the moment anyone has registered, so the fallback is
cancelling each occurrence by hand.

**The asymmetry is the problem: one tap creates 104 rows, and undoing it is 104 actions.**

*What to build:* this is the "this event, or all future ones?" question already open in §4. It
needs answering before recurrence is offered to anyone who is not the maintainer.

### 🟡 R-3 · The series is reckoned in the BROWSER's timezone

`EventComposer` sends `timezone: Intl.DateTimeFormat().resolvedOptions().timeZone`. An organiser
who creates a London programme while travelling gets a series pinned to the timezone they happened
to be standing in, and every occurrence after the next DST change is an hour out for the
congregation.

`organizations.timezone` exists and is documented as "the org's default event timezone.
Recurrence needs it (D3)" — it is simply not read. *Fix:* default to the organisation's zone,
let the composer override, and show which zone is in force.

### 🟡 R-4 · "Every Month" on a 29th/30th/31st produces a sparse series

Monthly is by **weekday** — "the second Sunday". An event on the 29th is usually the *fifth*
Sunday, and most months have no fifth week, so those months are skipped. A year of "Every Month"
can be five events, not twelve.

This is defensible (nudging to the 4th would invent events nobody asked for) and the sheet now
shows the **exact** count and says so in words. But it will still surprise people, and "last
Sunday of the month" — which is what most of them actually mean — is not offered.

### 🟢 R-5 · Resolved, but worth knowing

| | Behaviour | Status |
|---|---|---|
| A wall time that does not exist (01:30 on a spring-forward night) | Rolls forward to 02:30. The occurrence always exists — it is never dropped. | ✅ tested |
| A wall time that happens twice (01:30 on a fall-back night) | One occurrence, reading 01:30. | ✅ tested |
| An event spanning a DST boundary | Duration preserved exactly, so 23:00–01:00 stays 23:00–01:00. | ✅ tested |
| A long sparse monthly series | Reaches its end date or the cap. **Was truncating silently** at ~128 steps; fixed 2026-11-07. | ✅ tested |
| Short-code collision within one batch | Codes are reserved across the batch, not just checked against the table. | ✅ tested |
| Deleting the series | `ON DELETE SET NULL` — occurrences and their attendance survive. | ✅ tested |
| The count shown before you commit | Runs the server's own expander (`@credopass/lib`). **Was an average-month approximation** that said ~22 for a series of 8; fixed 2026-11-07. | ✅ |

### The rule for this feature

**Do not promote recurrence beyond the maintainer's own use until R-1 and R-2 are done.** Both are
about a programme that has already been created going wrong quietly, and quiet is the problem: an
attendance product that loses an event is worse than one that never offered to repeat it.

---

### Stage 4 — Posters, storage and images · **L, a week+, schema change**

F11, F12, F13 and the visual half of F9. The biggest piece of work on this list, and the one that
most changes how the product looks.

**4.1 Storage (F11).** ✅ **SHIPPED 2026-11-07.** An `assets` table — id, organization_id, bucket key, content type, width,
height, byte size, checksum — and a real FK from `events.cover_asset_id`, which is currently a
dangling uuid. MinIO locally (already in `docker-compose.dev.yml`), S3-compatible in production.
Upload is a **presigned PUT** straight from the browser to the bucket; the API issues the
signature, validates the content type and the declared size, and records the row on completion.
Postgres holds the key and the metadata, never bytes.

**Production bucket: not provisioned yet** — the service boots without one and only poster
*uploads* fail, with a clear `Storage is not configured` 500. The decision is **Cloudflare R2 on
the `r2.dev` public URL** (D43); the walkthrough is [`STORAGE.md`](STORAGE.md) §5 and the CORS
policy is committed at `services/core/r2-cors.json`. A custom domain is deliberately **not** part
of this stage — see the Stage 6 prerequisite.

**4.2 Compression (F12).** 🟡 **Browser half shipped 2026-11-07**; server derivatives still open. Two layers, and both are needed:

- **In the browser, before upload** — downscale to a maximum edge (2048px) and re-encode. This is
  what stops a 12MB phone photo ever crossing the network.
- **Server-side derivatives with `sharp`** — AVIF and WebP at poster, card and thumbnail widths,
  generated once on upload, served with far-future cache headers. The pass and the public event
  page load a thumbnail, never the original.

A hard ceiling on the accepted upload size, enforced in the presign — not only in the UI.

**4.3 The three ways to get an image (F13).** Offered side by side at creation, exactly as asked:

1. **A curated set.** A dozen on-brand backgrounds shipped as static assets. Zero cost, instant,
   always available, and the fallback when the other two fail. **Build this first** — it is a day's
   work and it makes the composer stop looking empty.
2. **Upload your own.** 4.1 + 4.2.
3. **Generate one.** A hosted image model, server-side, called at creation with a prompt derived
   from the event name, time of day and format. Generates **backgrounds, not posters** — the title,
   date and QR are composited by us in the template layer, which is the half of D38 that was right.
   Needs: a queue (generation takes seconds, the composer must not block), moderation on the
   output, a per-organisation rate limit, and a plan gate. Falls back to the curated set on any
   failure.

**4.4 The poster itself.** Compose cover image + title + date + location + the invitation QR into a
downloadable PNG. This is what makes F9 true: an invitation QR is never again shown as a naked
square. `GlowingQRCode` and the Poster QR sheet already exist to build on.

**Sequence within the stage:** 4.3.1 (curated) → 4.1 → 4.2 → 4.4 → 4.3.3 (generation last; it is
the only part with a running cost and an external dependency).

**F15 moved 4.1 up the queue.** The first person to use the poster slot picked a file, not a link,
and lost it. Pasting a URL is the unusual path — picking a photo is what people reach for — so the
gap between "the slot exists" and "the slot takes an upload" should be days, not the end of a
week-long stage.

---

### Stage 5 — The rest of the product backlog · **M each**

Already specified, unchanged by this feedback, ordered by cost of leaving them:

| | Work | Spec |
|---|---|---|
| 5a | **B4** offline / API-unreachable handling, modelled on the geocoder's one honest failure message (R5) | §5.4 |
| 5b | **B3 + F16** online events and optional location — a blank address is refused today, while the composer's own copy offers "Offline location or virtual link" | §5.3 |
| 5c | **U1** analytics: repeat the "made up" disclosure down the page, make `Arrivals by hour` lime, hide `Export` | `UI-REDESIGN.md` §3.16 |
| 5d | **R6 / R7** wrap instead of truncate; a `Copy link` button on the pass | `UI-REDESIGN.md` §5 |
| 5e | Live updates — polling, then SSE | `LIVE-UPDATES.md` |
| 5f | **R3 / B6** retire the permanent GET STARTED billboard; make it the first-run narrative | §5.6 |
| 5g | Platform: RLS cutover, `users` → `accounts` + `people` migration | `CLAUDE.md` |

---

### Stage 6 — Part A, the public API · **L**

Unchanged from [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) §1–§4 and its sequencing table: the
outbox first (it also unblocks SSE), then keys + rate limiting + read endpoints, then webhook
delivery, then test mode. `pii_mode` when a named customer asks. **B7**, the chat panel, tracks
`services/ai-chat` and lands whenever its backend does.


#### Stage 6 prerequisite — move `credopass.com` DNS to Cloudflare

**Not needed before this stage. Do not do it for the posters.** Recorded 2026-11-07 so the
reasoning does not have to be rebuilt.

**Why it belongs here and not earlier.** `api.credopass.com` resolves straight to the Hetzner
box (`62.238.37.104`). Namecheap's DNS publishes that address, so the origin is directly
reachable and scannable by anyone who resolves the name. Proxied through Cloudflare the record
returns a Cloudflare address instead, which gives DDoS absorption and — the part that matters
for this stage — **rate limiting and firewall rules at the edge, before a request reaches Bun**.
Stage 6 otherwise means writing rate limiting in application code for a paid public API.

**Where DNS is today.** Registrar Namecheap, nameservers `DNS1/DNS2.REGISTRAR-SERVERS.COM`
(Namecheap BasicDNS). Vercel and Hetzner are only *records* in that zone, not nameservers.

| Record | Value | After the move |
|---|---|---|
| `credopass.com` A | `216.198.79.1` | Vercel — **DNS-only (grey cloud)** |
| `www` CNAME | `…vercel-dns-017.com` | Vercel — **DNS-only** |
| `app` CNAME | `…vercel-dns-017.com` | Vercel — **DNS-only** |
| `api` A | `62.238.37.104` | Hetzner — **proxied (orange)**, the point of the exercise |
| MX ×5 | `eforward1–5.registrar-servers.com` | Replaced by Cloudflare Email Routing |
| TXT | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | Replaced to match Email Routing |

**The order, and the traps.**

1. Add `credopass.com` to Cloudflare (free plan); let it scan, then verify all six records by
   hand — the scan misses things.
2. Set up **Cloudflare Email Routing** before cutting over. Namecheap's free forwarding only
   works on Namecheap nameservers, so mail stops the moment the nameservers change. Email
   Routing is free and better (catch-all, per-address rules, Gmail send-as).
3. Switch the nameservers at Namecheap.
4. Proxying Vercel breaks it — certificate and redirect-loop problems. Those records stay
   DNS-only, permanently.
5. Proxying `api` needs SSL mode **Full (strict)**, because Coolify terminates TLS itself.
6. Cloudflare's [proxy read timeout is 125s](https://developers.cloudflare.com/fundamentals/reference/connection-limits/).
   Harmless for request/response, but the SSE half of [`LIVE-UPDATES.md`](LIVE-UPDATES.md)
   needs a heartbeat comfortably inside it. Third-party reports put the practical ceiling nearer
   100s; unconfirmed by Cloudflare's own docs. The polling phase is unaffected.

**The bonus, not the reason.** It is also what `media.credopass.com` would need, since R2 serves
a custom domain through Cloudflare and so requires the zone to live in the same Cloudflare
account. A partial (CNAME) setup would avoid moving the nameservers but is
[Business-plan only](https://developers.cloudflare.com/dns/zone-setups/partial-setup/), and
CNAMEing your own domain at an `r2.dev` subdomain is an explicitly unsupported access path.

---

## 4. Decisions and open questions from this round

| | Decision |
|---|---|
| **D39** | **Image generation is for backgrounds, not posters.** D38's "no model" stands for anything that must render legible type — we composite the title, date and QR ourselves. A hosted model may produce the background behind them, server-side, moderated, rate-limited and plan-gated, with a curated set as the always-available fallback. |
| **D40** | **Recurring events materialise their occurrences.** A series stores the rule for the record; the rows are real `events`. Nothing may hang attendance off a computed date. |
| **D41** | **An invitation QR and a pass QR must never look alike.** One variant each, enforced in `GlowingQRCode`, and an invitation code is always shown inside a poster, never as a naked square. |
| **D42** | **Timezone is always displayed.** It is not a filter and never was one. |
| **D43** | **Posters are served from the `r2.dev` URL for now, and a custom domain is a Stage 6 concern.** Cloudflare rate-limits `r2.dev` at hundreds of requests/second and calls it non-production, which is three orders of magnitude above one church on a Sunday. Switching `S3_PUBLIC_URL` later is cheap — `assertCoverImageAllowed` sends a URL on an unrecognised host to its plain-https branch, where it passes, so old posters keep loading and old events keep saving ([`STORAGE.md`](STORAGE.md) §6.6). What a switch leaves is objects on the old hostname, fixed by one UPDATE. The custom domain rides along with the DNS move under Stage 6. |

**Open — answer before the stage that needs them**

1. ~~**Recurrence horizon**~~ — **answered by building it.** The organiser picks an end DATE
   (Apple's model: "until the end of term" is answerable, "how many Sundays is that" is not), and
   the server caps the result at 104 occurrences and says so in the sheet when the cap bites.
2. **"This event or all future ones"** (stage 3, still open): the Repeat control is **create-only**
   today. Editing one occurrence already works — it is an ordinary event row. Changing a whole
   programme needs this question answered first, because some occurrences will already have people
   registered against them.
3. **Which image model** (stage 4.3.3), at what cost per generation, and on which plans?
4. **Does the curated set need to be per-organisation?** A church and a conference want different
   twelve images. Assume one global set for v1 unless told otherwise.
5. **Renaming existing organisations** (stage 2.5): prompt the owner once, or leave every existing
   *"X's organization"* alone?
6. **Profile editing scope** (stage 1.4): is `PATCH /me` display-name-only, or does it take an
   avatar too — which would make it depend on stage 4's storage?

---

## 5. Housekeeping when a stage ships

Per [`docs/README.md`](README.md) §5, every time:

1. Write the outcome in [`REBUILD-LOG.md`](REBUILD-LOG.md) — what was built, what was decided
   differently, what broke.
2. Tick the stage here and the matching row in §1.
3. `nx run coreservice:lint && nx run coreservice:typecheck && nx run coreservice:test`, plus
   `nx run web:build`. Say plainly what you could not verify.
4. When `NEXT-PHASE-PLAN.md` Part B and `UI-REDESIGN.md` are fully absorbed by shipped stages,
   `git mv` them to [`archive/`](archive/) — not before.
