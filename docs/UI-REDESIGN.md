# UI-REDESIGN — the mobile pass

> **Status: in progress.** This is a live working document, not a finished plan. The route
> checklist in §1 says exactly which screens have been walked and which have not — do not read an
> absent screen as a screen with no problems.
>
> **Method.** Real device emulation at 375×812 in a Chromium pane, against the **deployed** API
> (`nx run web:serve:remote`), signed in as a real account. Findings are things observed on screen
> or measured in the DOM, not inferred from source.
>
> **Started:** 2026-11-06. Companion to [`NEXT-UI-LIST.md`](NEXT-UI-LIST.md) (the functional
> backlog) — this file is about form, that one is about missing features.

---

## 1. Route checklist

| # | Route | Walked | Notes |
|---|---|---|---|
| 1 | `/events` (Upcoming) | ✅ | §3.1, §3.2 |
| 2 | `/events` (Past) | ✅ | §3.3 |
| 3 | `/events/$eventId` | ✅ | §3.4, §3.8 — walked both completed and ongoing |
| 4 | `/events/new` | ✅ | §3.7 |
| 5 | `/events/$eventId/edit` | ⬜ | |
| 6 | `/attendees` | ⬜ | |
| 7 | `/attendees/new` | ⬜ | |
| 8 | `/attendees/$userId/edit` | ⬜ | |
| 9 | `/checkin/$eventId` | ✅ | §3.11 |
| 10 | `/e/$eventId` | ⬜ | public event page |
| 11 | `/p/$token` | ✅ | §3.10 |
| 12 | `/analytics` | ⬜ | currently an empty state (U1) |
| 13 | `/account?tab=profile` | ⬜ | |
| 14 | `/account?tab=organizations` | ✅ | §3.5 |
| 15 | `/account?tab=members` | ⬜ | |
| 16 | `/account?tab=settings` | ⬜ | |
| 17 | `/upgrade` | ⬜ | |
| 18 | `/upgrade/checkout` | ⬜ | |
| 19 | `/invitations/$token` | ⬜ | needs a real token |
| 20 | `/login` | ✅ | §3.6 |

---

## 2. The structural findings

These are not per-screen nits. Each one affects every screen, and each one is a decision to make
before any cosmetic work is worth doing.

### R1 · The app scrolls an inner container, not the document — **fix first**

Measured on `/events/$eventId`:

```
document.scrollHeight = 812   document.clientHeight = 812   → the page itself never scrolls
.page-content          907                           700    → the content scrolls inside a box
```

The shell is a fixed-height frame with an internal scroller. On a desktop browser this is
invisible. On a real phone it costs you four things:

1. **The browser chrome never collapses.** Mobile Safari and Chrome hide the address bar in
   response to *document* scroll. An inner scroller does not trigger it, so roughly 60–100px of a
   phone screen is permanently spent on browser UI that would otherwise get out of the way. On a
   375×812 device that is over 10% of the viewport, on every screen, forever.
2. **No pull-to-refresh.** A list of live attendance that cannot be pulled to refresh is a
   surprising thing on a phone, particularly for the check-in use case.
3. **`100vh` and the keyboard.** Fixed-height shells and the iOS software keyboard are a notorious
   pairing: the keyboard resizes the visual viewport but not `100vh`, so the focused field can end
   up underneath it. This needs testing on a real device — the emulator will not show it.
4. **Scroll restoration breaks.** Going back to a long list returns you to the top, because the
   router restores document scroll and the document never moved.

**Recommendation:** move to document scroll with `position: sticky` headers. This is the single
highest-value change in this document and everything else is cosmetic next to it. It is also the
most invasive, which is why it goes first rather than last.

### R2 · Loading states are rendered as confident content

`/events` renders **"Good afternoon, there"** and **"0 events · 0 upcoming · 0 live now"** for
roughly two seconds before the real values arrive. Both are plausible, neither is marked as
provisional, and a slow connection holds them on screen indefinitely.

This is the same defect as **B2** (`NEXT-PHASE-PLAN.md` §5.2), where the composer shows
"No organization" while a request is in flight — and the same as what we watched happen when the
API was CORS-blocked: every screen reported *empty*, none reported *unavailable*. It is a pattern,
not three bugs:

> **The app has no vocabulary for "I do not know yet".** It renders the zero value instead.

"there" is the worst of them, because it is a greeting addressed to no one. Fixing B2 alone leaves
the pattern in place.

**Recommendation:** a shared skeleton treatment for any value that comes from a request — the
greeting name, the three counts, the org pill. Tie it to B4's work on distinguishing *loading*,
*offline* and *failed*, since they are the same missing concept.

### R3 · The GET STARTED billboard is permanent

"Plan your next event" occupies about a third of the first phone screen. It renders identically
whether you have no events or six, so the most valuable area of the screen is spent on onboarding
copy that stops being useful after the first event.

This is **B6** territory (`NEXT-PHASE-PLAN.md` §5.6) approached from the other side: that item asks
for a first-run narrative, and the answer is partly to make *this* the first-run narrative and
retire it afterwards. A returning organiser should see their next event there instead.

### R4 · Primary navigation hides on scroll

The bottom tab bar is `fixed bottom-0 … z-2000 sm:hidden` with a transition, and it leaves the
screen as you scroll down. On a 59px bar that buys very little room, and the cost is that the
primary navigation — including the central **+** action — is unreachable without scrolling back up.

Hiding chrome on scroll earns its place on reading surfaces. A console whose main job is "get to
the event and check someone in" is not one.

### R5 · The app already knows how to fail honestly — in exactly one place

Typing into the location sheet with the geocoder unreachable produces:

> **Could not reach the address service. You can still type a location.**

That is the right answer in one sentence: it names what broke, it does not blame the user, and it
tells them the task is still completable. It is also the *only* place in the app that does this.
Everywhere else a failure renders as emptiness (R2).

**Use this as the model for B4.** The pattern does not need inventing — it needs copying to the
three states B4 identifies (browser offline, API unreachable, single request failed).

---

## 3. Per-screen notes

### 3.1 `/events` — Upcoming, with a live event

The strongest screen in the app on mobile. The LIVE NOW hero is genuinely good: lime billboard,
event name, time, location, registered count, and two actions — **Check in guests** and
**Attendees** — which are the two things anyone opening the app during an event wants.

Below it, status-grouped sections (`ONGOING 1`, `SCHEDULED 2`) with date-chip cards.

- The date chip shows `NOV 16` on one card and bare `9` on another. If that is "only repeat the
  month when it changes", the rule is invisible at a glance and reads as a rendering bug.
- The **Calendar View / View Organisations** row is a horizontal scroller whose second button is
  clipped at the right edge. There is no page-level overflow, so this is intentional — but nothing
  signals that the row scrolls. A partial third item or a fade would.

### 3.2 `/events` — empty

Billboard, then an illustration, then a second "You have no events yet / Create your first event"
block that repeats the billboard's message almost word for word. Two calls to action for the same
action, stacked.

### 3.3 `/events` — Past

`COMPLETED 1` with a full-width card. Correct, and the filter transition is smooth. The GET STARTED
billboard still sits above it (R3).

### 3.4 `/events/$eventId`

Genuinely well designed. Lime hero with the org chip and a `COMPLETED` status badge, title,
timezone, then a three-up stat row — **REGISTERED / ATTENDED / CAPACITY** — which is exactly the
right summary for this product. Below: the check-in code `#CZYG2XME` with its QR, and
**View summary / Share / Poster QR**. Then start/end rows, location, and ABOUT.

- The location block carries a subtitle reading "Offline location or virtual link", which is the
  **B3** online-events work (`NEXT-PHASE-PLAN.md` §5.3) already anticipated in the UI copy. Worth
  knowing before building B3 — the design intent is partly there.
- The sub-header (**← Back to Events**, plus a people icon and a pencil icon) scrolls away under
  the top bar. On the event page those two icons are the only route to attendees and editing, so
  they should be sticky.
- Not found on this screen during the pass: end event, cancel event, add attendee. They may be
  behind the two icons. **Unverified** — see §1, this needs a second look.

### 3.5 `/account?tab=organizations`

Four tabs rendered as a horizontal row — Profile, Organizations, Members, Settings. Legible at
375px. Org rows carry an avatar letter, name, `owner · free`, and an `ACTIVE` badge or a **Switch**
button. The switch works and re-scopes the console without a reload, as documented.

### 3.6 `/login`

The marketing panel stacks above the sign-in card at phone width and reads well. One **Continue
with Google** button, which is the whole of auth (D20).

---

## 4. Not yet assessed

Typography scale, tap-target sizes, contrast ratios in both themes, safe-area insets on notched
devices, landscape, and the kiosk at tablet width. None of these have been measured; absence from
this document is absence of evidence.

### 3.7 `/events/new` — the composer

Cover-photo well with **Add photo** at the top (the `TODO(event-image)` slot, untested), then the
lime hero carrying the org pill and a `NEW` badge with the event-name field reversed out of it.
Below: start/end rows, timezone, location, description, and an `EVENT OPTIONS` group holding
**Capacity** and **Self check-in**.

- **Only one real text input on the whole form** (`name`). Date, time, location and description are
  all buttons that open pickers or sheets. That is defensible on a phone — native pickers beat
  inline fields — but it means creating an event is a sequence of modal round-trips rather than a
  form you fill top to bottom.
- `EVENT OPTIONS` sits below the fold while the submit button appears pinned above it, so capacity
  and self-check-in are easy to never discover.
- The org pill rendered correctly here, but this is the B2 component — it races on a cold load.
- **Validation is good.** Submitting without a location gives an inline
  "Location must be at least 3 characters", outlines the field, and scrolls it into view.
- The location sheet's placeholder reads "Search for an address **or paste a link**", and the
  summary row under it reads "Offline location or virtual link" — the online-event concept (B3) is
  already written into the copy on both the composer and the event page, while the schema still
  requires a location. The UI is ahead of the model.

### 3.8 `/events/$eventId` — an ongoing event

Resolves the open question from §3.4: the controls are **status-dependent**, not missing. An
`ONGOING` event shows three header icons and an **Add an attendee** row; the `COMPLETED` event
showed two icons and no add row. The stat strip also adapts — two columns when capacity is
unlimited, three when it is set.

### 3.9 Add an attendee → the pass

A sheet with first name, last name and an optional email, under the best sentence in the product:

> Registering does not check anyone in — an attendance record means they actually turned up.

That is the entire thesis of CredoPass, placed exactly where someone is about to misunderstand it.
It should be reused in the marketing copy.

Submitting opens a **Their pass** sheet: QR, the URL, **Copy pass link**, and
"Send this to them yourself — CredoPass does not email passes yet, and this is the only copy",
which is D18 handled properly.

- The sheet title truncates — "Add an attendee to ZZ TEST - Audit E…".
- **The pass URL in this sheet is broken in production.** It is not a design problem, so it is
  filed as [`NEXT-UI-LIST.md`](NEXT-UI-LIST.md) **U5**, but it is worth knowing that this otherwise
  excellent screen is currently handing out a dead link.

### 3.10 `/p/$token` — the pass

The best screen in the product. Full-bleed lime, the CredoPass wordmark, a large high-contrast QR,
then **ZZTest A.** — first name and last initial, a quiet privacy decision that is exactly right
for a code someone holds up in a room. Event name, time, organisation and location beneath, a
**Check in** button, and "Save this link. It is the only copy of your pass."

Self check-in works end to end: the button becomes **Checked in at 14:57** and a toast confirms it.
The kiosk counter moved to `1 IN` at the same time, so the write is real.

- The footer upsells "A free CredoPass account keeps every pass in one place" → **Create a free
  account**. That is the `/me/tickets` personal scope, which [`NEXT-UI-LIST.md`](NEXT-UI-LIST.md)
  lists as designed but not built. **Where this CTA leads is unverified** — if it leads nowhere it
  is promising a feature that does not exist, on the one screen attendees actually see.
- This page is the argument for fixing **U5**. It is excellent, and in production nobody can reach
  it.

### 3.11 `/checkin/$eventId` — the kiosk at phone width

Header with the event name (truncated), an `ongoing` badge and a live `1 IN` counter. Two modes as
pill tabs: **Event QR** and **Scan passes**. Event QR shows a code with "Scan to open this event",
a **Maximise** action, and **Manual check-in** below.

**This screen contains U2.** `NEXT-UI-LIST.md` U2's first hypothesis — "is it the event QR being
scanned?" — is visible in the design: the kiosk *opens* on Event QR, displays a `/e/{id}` share
code, and its own other mode will reject that exact code as "that's the event link". One screen
shows a QR and refuses it a tab away.

That is a UX trap, not a scanner bug, and it is the most likely explanation for the report. It
needs confirming with a real camera, but the next person should start here rather than in
`html5-qrcode`.

**Design fix, independent of the diagnosis:** the two modes answer different questions —
"how do people get their pass" versus "I am taking passes now". They are not peers and should not
be equal pill tabs. Scanning is the kiosk's job; the event QR is setup, and belongs behind the
Maximise/share affordance.
