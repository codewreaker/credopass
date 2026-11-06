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
| 5 | `/events/$eventId/edit` | ✅ | §3.12 |
| 6 | `/attendees` | ✅ | §3.13 |
| 7 | `/attendees/new` | ✅ | §3.14 |
| 8 | `/attendees/$userId/edit` | ✅ | §3.13 |
| 9 | `/checkin/$eventId` | ✅ | §3.11 |
| 10 | `/e/$eventId` | ✅ | §3.15 — walked both ended and scheduled |
| 11 | `/p/$token` | ✅ | §3.10 |
| 12 | `/analytics` | ✅ | §3.16 — **not** an empty state; see the correction |
| 13 | `/account?tab=profile` | ✅ | §3.17 |
| 14 | `/account?tab=organizations` | ✅ | §3.5 |
| 15 | `/account?tab=members` | ✅ | §3.18 |
| 16 | `/account?tab=settings` | ✅ | §3.19 |
| 17 | `/upgrade` | ✅ | §3.20 |
| 18 | `/upgrade/checkout` | ⬜ | not walked — a live billing surface on a real account |
| 19 | `/invitations/$token` | ⬜ | needs a real token |
| 20 | `/login` | ✅ | §3.6 |

---

## 2. The structural findings

These are not per-screen nits. Each one affects every screen, and each one is a decision to make
before any cosmetic work is worth doing.

### R1 · The app scrolls an inner container, not the document — **implemented 2026-11-06, not yet verified on screen**

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

### 3.12 `/events/$eventId/edit`

The best-composed screen in the product. The event name is edited **in the lime billboard itself**,
with an `EDITING` chip where the status chip normally sits, so you are editing the thing you are
looking at rather than a form that represents it. Start and end are pill buttons that open a
bottom-sheet calendar; location and description are rows that say `Tap to change`.

Three things worth keeping:

- **Moving the start moves the end with it.** Changing `Fri 6 Nov` to `Fri 13 Nov` carried the end
  date along, so you cannot accidentally create an event that ends a week before it starts.
- **A photo slot already exists** — an `Add photo` button over an illustrated placeholder at the
  top. B5 (generated posters) has somewhere to land; it does not need a new surface.
- Saving shows an `Event updated` toast and returns to the detail screen.

Problems:

| | |
|---|---|
| **The confirm control in the date sheet is an unlabelled circle** | A lime disc with a tick, bottom-right; `Reset` is plain text bottom-left. The destructive-ish action is a word and the committing action is a glyph. Both should be labelled. |
| **The sheet does not take the screen** | The bottom navigation bar stays visible beneath it. On a phone a modal sheet should own the viewport. |
| **The toast lands on top of the billboard** | It covers the event name and status on arrival, which is the one thing you look at to confirm the save did what you meant. |
| **No way to cancel or delete the event from here** | The edit screen is the obvious home for it. (`WHEN IT'S OVER` on the detail screen has the end/cancel actions.) |

### 3.13 `/attendees` and `/attendees/$personId/edit`

The list is strong: a lime stat billboard (`3 PEOPLE · 1 SIGNED UP · 2 ATTENDED`), a scope filter,
then one card per person with a status chip and an attendance count.

The detail opens as a **right-anchored sheet** covering about 75% of the width, leaving a dead
strip of list behind it. That is a desktop drawer rendered at phone width. On a phone it should be
a bottom sheet or a full screen — the leftover strip is not usable and not decorative.

Inside the sheet the content is excellent and worth keeping as-is: `EVENTS ATTENDED 1`,
`TURN-UP RATE 100%`, `1 of 1 events they signed up for`, and a masked `ATTENDEE ID ••••••929` with
`TAP TO COPY`.

Two real defects:

1. **Only the chevron opens a person.** Tapping the card — the name, the avatar, the chips — does
   nothing. The chevron is a ~24px target at the right edge, which is also the hardest place to
   reach one-handed. The whole card should be the target.
2. **`Edit attendee` takes about two seconds, with the old sheet still on screen.** The URL changes
   immediately; the detail sheet stays rendered, unchanged, with no spinner, until the edit screen
   appears. For two seconds the app looks broken. This is R2 in its most literal form — the UI
   stating something that is no longer true.

The subtitle is **clipped, not wrapped**: `Everyone who has been to one of your pr…`. Truncating a
one-line description to save a line of vertical space is a bad trade on a 375px screen, and it
recurs — three truncated emails on the members tab, a truncated surname in the register form.

### 3.14 `/attendees/new`

Same billboard-as-form idea as the edit screen, and it reads well.

**Three tiles below the contact fields do nothing.** `QR check-in`, `Attendance history` and
`Event invites` are rendered as bordered, icon-topped buttons with proper tap targets, and tapping
any of them has no effect. They are presumably meant as a preview of what you get once the person
exists — but nothing says so, and on a creation screen the natural reading is "these are options
for the attendee I am adding". Either label them as what-comes-next, or remove them until they do
something.

The placeholder name in the billboard (`First name / Last name`, with `their@email.com` beneath) is
grey-on-lime at the largest type size on the screen. It is the lowest-contrast text in the product
at the biggest size — an unusual combination, and it reads as data rather than as a prompt. Same
family as R2.

### 3.15 `/e/$eventId` — the public event page

Walked in both states. **Ended:** billboard, time, location, and a single grey row,
`This event has ended`. Correct and calm. **Scheduled:** the same, plus
`Here now? Check yourself in`, `Already registered but lost your pass?` and a full-width
`Register`.

`Already registered but lost your pass?` is the recovery path for exactly the situation U5 created,
and it is styled in the same muted grey as disabled text, directly under a lime link. It does not
read as something you can tap.

The register sheet is prefilled with the **signed-in** user's name and email when a session exists.
That is convenient for an organiser testing their own link, and surprising on a page whose whole
premise is that it works for people with no account. Worth a decision rather than leaving it
implicit.

The body copy is the best in the product:

> Let the host know you're coming to "…". We'll show your pass on the next screen — save the link,
> it's the only copy.

### 3.16 `/analytics` — **a correction to the docs**

`CLAUDE.md` and `docs/README.md` both say this screen "deliberately renders an empty state rather
than drawing charts from" the fabricated numbers. **It does not.** It renders the entire dashboard
— average attendance 83%, 15 events, 1,352 people, a 90% attendance goal gauge, arrivals by hour,
check-in method breakdown — above a banner that reads:

> **These numbers are made up.** This dashboard runs on a placeholder service — a deterministic
> generator, not your attendance records. It is here so the layout, the contract and the
> permissions are real before the aggregates are. Don't report anything from this page.

That is a better decision than an empty state, and the warning is well written. But:

| | |
|---|---|
| **The warning is only at the top** | Scroll two screens and you are reading confident charts with no reminder. The disclosure should ride with the content — a repeated chip, or a watermark. |
| **`Arrivals by hour` is blue** | Every other chart in the product is lime. The bars are the only off-palette element seen anywhere in this audit. |
| **`Export` is offered on fabricated data** | It carries a lock icon, so presumably it is plan-gated rather than wired — but exporting made-up numbers is precisely what the banner tells you not to do. Hide it until the data is real. |

The doc text should be corrected either way.

### 3.17 `/account?tab=profile`

Also a correction: an earlier note in this audit recorded the profile fields as blank. They are
not — that was the CORS session, not the screen. Signed in properly it shows the avatar, name,
email, a `STARTER` plan card and `Sign out`, and says plainly
`Read-only for now — editing your profile isn't built yet` (that is U4).

One nit: the display name is `israel.agyeman.prempeh` — the email local part, not the account's
real name. Supabase gives a name claim; this screen is not using it.

### 3.18 `/account?tab=members` — **a second dead link**

The tab is honest about email:

> CredoPass does not send email yet — copy each link and pass it on yourself.

And then every existing invitation in the list says **`link not shown`**.

So the screen instructs you to do the one thing it does not let you do. A pending invitation whose
link is not recoverable is as dead as a pass URL that 404s — same shape as U5, and it is sitting in
production right now with two invitations in that state. Either show the link, or offer
`regenerate`, or say the invitation must be deleted and re-created.

**Fixed 2026-11-06** — the row now carries a `New link` button, and re-inviting rotates the
invitation server-side. See `NEXT-UI-LIST.md` U6.

Three emails are truncated mid-string on this tab (`israel.agyeman.prem…`,
`developer.agyeman.prem…`, `developer.prempeh@gma…`), which makes two different invitations for
two different addresses visually indistinguishable.

Good detail worth keeping: `An organization needs at least one owner, so the only one cannot be
demoted or removed` — the rule is explained where it bites, instead of a disabled button.

### 3.19 `/account?tab=settings`

Name, web address (slug, in a monospaced field), `Save changes`, a delete block, and a
`Coming later — Built in the schema, not yet reachable from here` section. Honest and tidy.

`Save changes` is dim olive — presumably disabled until the form is dirty, but it reads as a
permanently-disabled button rather than an idle one. The delete block explains why deletion may be
refused *before* you try it (`You always belong to at least one organization…`), which is the right
way round and the same instinct as the owner rule above.

### 3.20 `/upgrade`

Current plan in a lime billboard, then Free / Starter / Pro / Enterprise as full-width cards with
tick lists. Clear, and the feature lines are concrete (`QR, manual and walk-in check-in`,
`Attendance records that persist`).

`Change takes effect immediately` sits above a `Switch to Free` button, and there is no visible
confirmation step for a downgrade. **Not exercised** — this is a real billing surface on a real
account — so treat this as a question rather than a finding: does switching down ask first, and
what happens to organisations beyond the Free limit?

---

## 5. Second pass — what the rest of the walk added

The five structural findings in §2 all survived the remaining screens. Two should be promoted, and
one new one emerged:

### R6 · Text is truncated where it should wrap

Counted on this pass: the attendees subtitle, three emails on the members tab, a surname in the
register form, an organisation name in a chip. All single-line clips with an ellipsis, all on a
375px screen where a second line costs 20px and the clipped half of an email address is the half
that identifies it. Truncation is for lists of hundreds, not for the one description at the top of
a page.

### R7 · The most consequential sentence on the pass page is the quietest

`/p/$token` ends with, in the smallest and lowest-contrast type on the screen:

> Save this link. It is the only copy of your pass.

Above it, in full-contrast body text, is the much less important `Show this at the door`. And there
is **no copy button** — the only place the link exists is the browser's address bar, which an
in-app browser may not even show. The sentence is true, load-bearing, and styled as fine print.

This is the user-facing half of U5: the server now builds a correct URL, and the page still makes
it hard to keep. A `Copy link` button and an `Add to home screen` hint would close it.

### Promote: R2 now has three confirmed instances

The "add attendee" two-second gap with a stale sheet (§3.13), the greeting that says
`Good afternoon, there`, and `0 events` while loading. It is the single most repeated defect in the
product and it is one decision, not three fixes: **a screen must never render a value it does not
have.**

### 3.21 Found while preparing the screenshots

- **The command palette offers `Sign In` while you are signed in.** It sits in `QUICK ACTIONS`
  above `New Event` and `Add Attendee`.
- **A person's email is masked in the detail sheet (`••••••com`, `TAP TO COPY`) and shown in full
  in the list behind it.** One of the two is wrong; the list is the one more people see.
- **Tapping outside the contact-field sheet discards what you typed, silently.** The `EMAIL`,
  `PHONE` and `NOTES` rows on the attendee composer are buttons that open a one-field bottom sheet
  with a `Done` button. Dismissing it any other way throws the value away with no warning, and the
  row behind it still reads as if nothing happened. Standard sheet behaviour, but this sheet holds
  a value the user has just typed rather than a selection they can redo at a glance.

**A retraction.** An earlier version of this section, and `NEXT-UI-LIST.md` U7, claimed that
editing an attendee's email reported success and changed nothing. That was wrong, and the mistake
was in how it was tested, not in the product: the contact rows are buttons, so clicking one opened
the sheet, the typed text went into the sheet, and the next click dismissed the sheet rather than
saving. The `Attendee updated` toast came from the name change in the same submit.

Driven properly — tap the row, type, `Done`, `Save changes` — the email persists through a reload.
Verified 2026-11-06. The server was never at fault: `updatePerson` in
`services/core/src/services/people.ts` handles `email` like every other field.

---

## 6. R1 as built (2026-11-06)

The shell no longer clips to the viewport. `height: 100svh` became `min-height`, the three
`overflow: hidden` rules in `.app-container` / `.app-layout` / `.main-content` are gone, and
`.page-content` lost `overflow-y: auto`. The header is `position: sticky; top: 0`; the sidebar was
already `position: fixed` in `packages/ui`, so it needed nothing.

**The design system was not changed.** `SidebarProvider`'s wrapper is `h-svh … overflow-hidden`,
which would have re-imposed the frame. `cn` is tailwind-merge and the app is the component's only
consumer, so `className="h-auto min-h-svh overflow-visible"` at the call site overrides it. A
sidebar shell that clips to the viewport is a reasonable default for the component; it is this
app's shell that should not.

**Two pages had built their own frames on top of it**, and this is the part the original finding
understated:

- **`/events`** wrapped the list in `h-[calc(100vh-400px)]` / `h-[calc(100vh-350px)]` /
  `md:h-[calc(100vh-274px)]` — three hardcoded offsets that had to track the header, the action
  cards and a separator, and were wrong the moment any of them moved — with `h-full overflow-auto`
  inside. All removed. The calendar beside the list is `sticky top-20` so it still follows on
  desktop.
- **`/attendees`** pinned its header, billboard and scope dropdown in a `shrink-0` block and
  scrolled the list inside `min-h-0 flex-1 overflow-auto`. On a 375px screen that is R3 and R4 in
  one: a third of the screen permanently spent on a billboard you could not scroll away. Now one
  flow.

Percentage heights that resolved against the old frame were re-anchored rather than deleted:
`.events-page` and `.event-detail-page` take `min-height: 100%`, and the centred states
(`.event-detail-page.loading-state`, `.not-found`, the kiosk's `.loading-state`, the attendees
loading and empty states) take an explicit `min-height` so `justify-content: center` still has
something to centre within.

**What is verified:** `web:build` and `web:lint` pass; no `calc(100vh…)` offsets remain outside the
right sidebar's own panel.

**What is not:** nothing has been looked at on screen. The shell only renders on authenticated
routes — every unauthenticated route is in `STANDALONE_ROUTES` and bypasses it — and the local
session's refresh token expired mid-change (a 400 from Supabase), so the app redirects to
`/login`. Sign in once at `localhost:5001` and these are the checks:

1. `document.documentElement.scrollHeight > clientHeight` on `/events` — the measurement that
   defined this finding. It read 812/812 before.
2. No element left with `overflow-y: auto|scroll` and overflowing content, apart from the right
   sidebar panel.
3. The header stays put while the page moves under it, and the desktop sidebar does not scroll away.
4. `/events` and `/attendees` scroll as one page, and the events calendar follows on desktop.
5. Going back to a scrolled list restores the position.
