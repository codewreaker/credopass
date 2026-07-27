# NEXT-UI-LIST — handover

> **Read this first if you are picking up the web app.** It records what was done on 2026-07-27, what
> is still open, and eight items the maintainer raised after reviewing the result.
>
> Companion docs: [`API-SECOND-REBUILD.md`](API-SECOND-REBUILD.md) (the plan this executed) ·
> [`REBUILD-LOG.md`](REBUILD-LOG.md) (the running record) ·
> [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) (the API's own plan)

**Status:** `apps/web` compiles and reads `/api/v1/core`. Build, typecheck and unit tests pass.

**Update 2026-07-27 (second session):** items **2.2** (declined, with a live-reproduced D16 violation
recorded), **2.3** (fixed) and **2.6** (analysed, decision pending) are done — see each section. The
API path has now been exercised against a live local stack via curl; **the browser pass in 2.8 is
still not done.**

---

# Part 1 — What was done (2026-07-27)

## 1.1 The client (`packages/api-client`)

Was: a bare `client.ts` + generated schema. Now three layers.

```
generated/schema.d.ts    openapi-typescript output, checked in
client.ts                openapi-fetch + auth header + org header + problem→ApiError
types.ts                 contract types DERIVED from `paths` — never restated by hand
query-keys.ts            every org-scoped key starts ['org', organizationId, …]
active-organization.ts   the active org, held outside React
hooks/                   TanStack Query hooks, one file per endpoint group
```

Two decisions to preserve:

- **The active organization is part of every org-scoped query key.** Switching re-keys the cache
  instead of mutating it, so the previous tenant's rows cannot survive a switch. This replaced
  `window.location.reload()` in `OrgSelector`.
- **Contract types are extracted, not rewritten.** `ApiResponse<'/events', 'get'>` reads the real 200
  body, so a server-side shape change becomes a type error at the call site.

Regenerate after **any** API change: `nx run api-client:generate`.

## 1.2 Two API changes came out of the rewiring

1. **`.nullable()` on a `$ref`'d Zod schema produces uninhabited TypeScript.**
   `MeContext.activeOrganization` and `EventsSummary.next` were `Schema.nullable()`, which renders as
   `allOf: [{$ref}, {type:["object","null"]}]`. openapi-typescript emitted `OrgSummary & Record<string, never>`
   — a type nothing satisfies — and **silently dropped the nullability**. Both are now
   `z.union([Schema, z.null()])`. Recorded as a rule in `CLAUDE.md`.
2. **`EventSummary` now carries `allowSelfCheckIn` and `requireCheckOut`.** The kiosk could not honour
   `requireCheckOut` without it, and the composer silently reset the self-check-in toggle on every edit.

## 1.3 Screens built or rewired

| Route | What happened |
|---|---|
| `/onboarding` | **New.** Three steps: create org → invite team (shows links, no email exists) → first event. |
| `/invitations/$token` | **New.** Handles `403 invitation_mismatch`, `410 expired`, `404` as three distinct screens. |
| `/account` | **New**, replaces `/profile` and `/organizations` (both now redirect). Tabs: profile, organizations, members, devices, settings. Every control gated on `meContext.membership.permissions`. `last_owner` and `has_events` explained in place, not discovered. |
| `/p/$token` | **New.** The pass. No shell, no nav, no sign-in prompt. First name + last initial only. |
| `/checkin/pair` | **New**, unauthenticated. Redeems a pairing code for a device token. |
| `/events` | Hero from `GET /events/summary`, list from `?group=&q=`, calendar rail from `GET /events/calendar?month=`. Delete falls back to cancel on 409. |
| `/events/$eventId` | Real `shortCode`, real counts, devices panel, end/cancel, add-attendee (shows the pass URL). |
| `/attendees` | `standing` and `eventsAttended` come off the row. ~150 lines of `useMemo` deleted. |
| `/checkin/$eventId` | One endpoint for arrivals. Counter polls `/checkin-state` every 5s. Handles `token_revoked` and `capacity_reached` distinctly. Check-out offered only when `requireCheckOut`. |
| `/e/$eventId` | Register → redirect to the pass. Walk-up self check-in when `allowSelfCheckIn`. "Lost your pass" always 202. |
| Composers | Event + person, create/edit, fully wired. |
| `/analytics` | **Replaced with an empty state — see item 4 below, the maintainer wants this reverted.** |

## 1.4 Deleted (not commented out)

`getStatus` + grouping in `packages/lib/src/utils/events.ts` · the Attendees derivation block ·
`OrgSelector`'s `organizations[0]` auto-select · `useEventSessionStore` + `useOrganizationStore` ·
`contexts/premium.tsx` · `useGeocodedLocation` · `use-attendee-checkin.ts` · `use-public-event.ts` ·
`EventDetails.tsx` (map) · `org-field.tsx` · `role-field.tsx` · `QuickSelectDropdown.tsx` ·
all loyalty copy on `/login` and `/upgrade` · loyalty helpers in `packages/lib`.

## 1.5 Verification as it stands

| | |
|---|---|
| `nx run coreservice:verify` | ✅ **65 tests** (61 + 4 for `guestDisplayName`) |
| `nx run coreservice:test:integration` | ✅ **127 tests** (119 + 8 for the `resolveCaller` race) |
| `nx run web:build` | ✅ |
| `apps/web` typecheck | ✅ 0 errors (was 151) |
| `nx run web:lint` | ✅ 2 warnings, both pre-existing |
| `ui:lint`, `lib:lint` | ❌ **pre-existing**, confirmed against a stashed tree. `map.tsx`, `bottom-nav.tsx`, `date-time-range-picker.tsx`, `use-toolbar-context.ts` — none touched by this work |
| Run against a live API | ✅ Local stack (`dev:up` + `db reset` + `bun start`), verified by curl and by a real browser |
| Browser pass (Playwright) | ✅ **4/4** on the onboarding + `/events/new` path — 0 console errors, 0 failed requests. **The other 17 routes in 2.8 are still unchecked.** |

> **Playwright is available** — `@playwright/test` 1.61.1 is already a dependency and Chromium is
> installed. There is no `playwright.config.*` and no `e2e` target yet, so scripts are run directly
> (`node script.mjs` with `node_modules` resolvable). Worth formalising for the 2.8 route audit.

---

# Part 2 — The maintainer's list (2026-07-27)

Ordered as given. Sizes are rough.

## 2.1 ⬜ Brand the onboarding flow · S

The forms work; they look like forms. Give the flow an experience.

- `apps/web/public/` already holds `empty-state-one.svg`, `empty-state-two.svg`, `login-cuate.svg`,
  `empty-state-two.svg`. `AuthScreen` (`apps/web/src/containers/AuthScreen/`) is the existing pattern
  for a lime billboard + illustration + feature list — **reuse it rather than inventing a third
  layout**, so `/login`, `/upgrade` and `/onboarding` read as one product.
- One illustration per step, and a reason for each: step 1 is "your organization", step 2 is "your
  team", step 3 is "your first event".
- The step rail is currently three bars. Consider naming what the user gets, not what step they're on.
- Keep it fast. Onboarding is the one screen where a slow hero is a bounce.

Files: `apps/web/src/Pages/Onboarding/index.tsx`, `apps/web/src/containers/AuthScreen/index.tsx`.

## 2.2 ✅ Auto-create a default organization — **analysed, declined** (2026-07-27)

**Decision: no.** [D16](docs/API-FIRST-REBUILD.md#L486) had already settled it — a guest sign-in gets a
lazy account with zero memberships and lands on onboarding; it does not get an organization. Auto-org
contradicts that directly.

**What the analysis turned up, which is the part that matters:** the code already violates D16.
`resolveCaller` (`services/core/src/services/identity.ts`) inserts an `accounts` row on **first token
verification**, not on first write — while §4.1's own invariant table reads *"A guest account is
created lazily, never on token verification alone (D16)."*

Reproduced against a live API: five read-only `GET /me` calls with fresh anonymous tokens took
`accounts` from 1 → 5, all guests, all with zero memberships. Every visitor who lands on `/` gets a
row, because `/` redirects to `/login` and `useGuestAutoLogin` signs them in with no interaction.
D16's stated mitigation — a 30-day reaper — **does not exist**; there is no scheduler in the service.

So auto-org would not have introduced unbounded growth, it would have multiplied growth that is
already happening, adding an `organizations` row, an `org_memberships` row and a live RLS-policied
tenant per bot visit.

**What was built instead** (the middle path): onboarding step 1 prefills the organization name from
the account's display name, so it is one Enter press. Guests are skipped — their display name is a
generated label and would read as noise. Organization creation stays deliberate.

### ✅ Bonus find — `resolveCaller` raced on a new account's first request (fixed)

Found by the browser pass, not by reading. A new visitor's first page load showed a **500 on
`GET /me/context`** in the console.

`resolveCaller` did SELECT-then-INSERT with no conflict handling. A brand-new caller's first load
fires several requests at once; every one missed the SELECT and every one tried to insert, so
`uq_identities_issuer_subject` rejected all but one. Reproduced by hand: **3 of 4 concurrent first
requests returned 500.** Because the `accounts` insert came *before* the `identities` insert, each
loser also left an **orphan account** behind — 7 accumulated on the local DB before the fix.

Fixed in `services/core/src/services/identity.ts`: the identity insert now tolerates the conflict
(`onConflictDoNothing` on `(issuer, subject)`) and re-reads the winner, and the account+identity pair
is wrapped in one transaction so a lost race rolls the account back instead of orphaning it. Both
halves earn their place — the transaction stops orphans, the conflict handling stops the 500.

Covered by `src/test/integration/identity.test.ts` (8 tests). Confirmed the tests catch the
regression: with the conflict handling removed they fail with `code: 23505` on
`uq_identities_issuer_subject`, the exact production error. After the fix, 30 concurrent first
requests across 5 new tokens returned **200 every time**, created exactly 5 accounts, and added zero
orphans.

**Still open, and worth doing on its own:** the D16 violation itself. Either make guest accounts lazy
on first write (touches the auth path every request goes through) or add the reaper D16 promised
(needs somewhere to run it). Neither was in scope here.

### Guest display names — done

Guests asserted no `name` claim, so `display_name` was `null` everywhere. `guestDisplayName(subject)`
in `services/core/src/services/identity.ts` now derives a `Guest 4821` label — deterministic from the
subject, so the same anonymous user reads the same way twice. Four unit tests in
`src/test/guest-name.test.ts`. Verified live: a fresh anonymous token returns
`"displayName":"Guest 9810"`.

<details>
<summary>Original brief (kept for context)</summary>

### Auto-create a default organization for every new account — **analysis first, then decide** · M

The maintainer wants this considered, *with* the security and architecture implications. Do the
analysis before writing code; it is not obviously right.

**The case for.** Onboarding exists only because a new account belongs to nothing. If signing up
created "Israel's organization" automatically, `/events` would work immediately and step 1 of
onboarding could become optional.

**What to think hard about:**

| Concern | Why it matters here |
|---|---|
| **Guest accounts** | `/login` silently signs visitors in as Supabase anonymous users (`useGuestAutoLogin`). Auto-creating an org per account means **an organization per anonymous visitor** — unbounded row growth from bots and link-openers, and every one of them a tenant with RLS policies attached. This is the single biggest objection. |
| **Slug collisions** | `POST /organizations` 409s on `slug_taken`. Auto-derivation from a display name will collide constantly (`john`, `john-2`, …). Decide the disambiguation rule *before* it is a data migration. |
| **Ownership on upgrade** | A guest who later creates a real account: does their auto-org follow them? `/me/claim` and `/me/upgrade` do not exist yet (§1.6). Without them, an auto-created guest org is orphaned. |
| **Attendees are not accounts** | Someone registering for a church event gets a `people` row, not an `org_memberships` row (§1.3). If registration ever creates an account, auto-org would hand every attendee an organization they never asked for. |
| **Deletion** | `DELETE /organizations/{id}` 409s on `has_events`. An auto-created org with a stray event cannot be cleaned up automatically. |
| **Audit** | An org nobody deliberately created has no `created_by` story. |

**A middle path worth costing:** keep organizations deliberate, but make the *first* one cheap —
auto-fill the name from the account's display name and let step 1 be a single Enter press. That gets
most of the benefit with none of the guest-account blast radius.

**If it does go ahead:** gate it on `isGuest === false`, do it in the same transaction as account
creation, and add a test that an anonymous sign-in produces **zero** organizations.

Also mentioned: "same as a random user id for guest users". Clarify what is wanted — guests already
get a Supabase anonymous user id. If the ask is a friendly display name (`Guest 4821`) rather than a
raw UUID, that is a small change in `services/core/src/middleware/caller.ts` / the account row.

</details>

## 2.3 ✅ "Create event" with no organization · S — **fixed 2026-07-27, but the brief was wrong**

Two of the three claims in the original brief did not reproduce. Recording that, because the wrong
diagnosis would have sent the next person to the wrong files.

| Claim | Reality |
|---|---|
| "The API answers `400 organization_required`" | ❌ It answers **`403 not_a_member`**. `organization_required` fires only when a caller has **2+ organizations and sends no header** (`middleware/caller.ts`). Verified live. |
| "The composer's submit path swallows the error" | ❌ It has a `try/catch` that toasts (`use-event-form.ts`). |
| "Audit every `mutateAsync` call site for a `catch` that toasts" | ❌ Already done — **all 30 sites** across 13 files already handle errors. |
| "`/events/new` has no org guard" | ✅ **True, and this was the actual bug.** |

**The real cause.** `OnboardingGate` navigated from a `useEffect` while sitting *beside* the outlet.
Effects run after children mount, so org-scoped screens mounted anyway, fired their queries, and could
accept a submit in the frame before the redirect landed.

**The fix.** `OnboardingGate` now **wraps** the outlet (`apps/web/src/routes/__root.tsx`) and renders a
spinner instead of children while a redirect is pending. That closes it once for **every** org-scoped
route rather than needing a `beforeLoad` guard per route — which would have had to re-fetch
`/me/context` outside the api-client and break golden rule 2. It fails open (a failed `/me/context`
renders normally), which is right: this is a UX redirect, not a security control. The server still
enforces tenancy.

**Left alone deliberately:** `not_a_member` copy reads "You are not a member of this organization.",
which is misleading for someone who has no organization at all — the server uses one code for two
situations, distinguished only by `detail`, and `lib/errors.ts` correctly refuses to branch on
`detail`. With the gate in place the zero-org case no longer reaches a mutation from the UI. Fixing it
properly means a new problem code on the API.

<details>
<summary>Original brief (kept for context)</summary>

Two fixes, both wanted:

1. **Do not let it happen.** `/events/new` should redirect to `/onboarding` in `beforeLoad` when
   there is no active organization — same shape as `OnboardingGate` in `routes/__root.tsx`. The hero
   already switches its CTA to "Create organization" when `needsOnboarding`; the route did not get
   the same treatment.
2. **Say something when it does.** `errorMessage()` already maps `organization_required` →
   "Pick an organization first." It is not being surfaced because the composer's submit path toasts
   only on a thrown error and the guard swallows it earlier. Audit every `mutateAsync` call site for
   a `catch` that toasts — `apps/web/src/lib/errors.ts` has the copy.

Worth a broader sweep: **any org-scoped mutation reachable with no active organization** has the same
hole (add attendee, pair device, invite member).

</details>

## 2.4 ⬜ Restore `/analytics` with a "dummy data" banner · S

I deleted the page (~750 lines of charts) and replaced it with an empty state. The maintainer wants it
back, with the fabrication made explicit rather than the page removed.

**Restore from git:**

```bash
git show c3da21b^:apps/web/src/Pages/Analytics/index.tsx > apps/web/src/Pages/Analytics/index.tsx
git show c3da21b^:apps/web/src/Pages/Analytics/use-analytics.ts > apps/web/src/Pages/Analytics/use-analytics.ts
```

Then it needs rewiring, because its old imports are gone:

- `fetchAnalytics` was removed from `@credopass/api-client`. Either restore it or point
  `use-analytics.ts` at `services/core/src/analytics/` through a new endpoint.
- `getCollections()` and `usePremium()` no longer exist. Gate on `organization.plan` (see 2.7) and
  read events via `useEvents`.
- `EventType` → `Event` from `@credopass/api-client`.

**The banner is the point.** Not a small "Sample data" badge — a full-width, unmissable strip at the
top of the page saying the analytics endpoints do not exist and every figure below is placeholder.
People screenshot dashboards; the warning has to survive the screenshot.

Real endpoints (`GET /analytics/overview`, `/analytics/export`) remain Phase 6.

## 2.5 ⬜ QR scan check-in is broken · M — **needs reproduction first**

Not diagnosed; it was never run. Here is what is known, so the next agent does not start cold.

**How it is meant to work now:**
- `/p/$token` renders `GlowingQRCode value={pass.qrValue}`, and `qrValue` is **the raw pass token**
  (`services/core/src/api/v1/core/public.ts:284`).
- The kiosk's `handleScan` (`apps/web/src/Pages/CheckIn/index.tsx`) rejects anything containing `/e/`
  as "that's the event link", strips a `/p/` prefix if present, and posts `{ pass, method: 'qr' }`.
- The server resolves it via `Pass.verify` and 400s `invalid_pass` for another event's pass.

**Check in this order:**
1. **Is it the event QR being scanned?** The big QR on the kiosk and event page is `/e/{id}` — the
   *share* link, not a pass. Scanning it correctly errors. If that is the report, the fix is UX: the
   kiosk's "Event QR" mode shows a code that its own "Scan passes" mode rejects, which is confusing.
2. **Camera permissions / HTTPS.** `html5-qrcode` needs a secure context. `localhost` is fine;
   a LAN IP over plain HTTP is not. This silently fails to start the camera.
3. **The debug drawer.** The kiosk has one (bug icon in the toolbar) that logs every raw scan, the
   parse outcome and the error. Use it — it will show exactly what string arrives.
4. **`paused`.** The scanner pauses on `successPerson || checkIn.isPending`. Confirm it resumes.
5. **Old QR format.** Anything generated before the rebuild is `{eventId}:{userId}` and will never
   verify. Regenerate passes after `db reset`.

## 2.6 🔍 Device tokens — **analysed 2026-07-27, decision still yours**

Two corrections to the framing below before you decide.

1. **Device tokens are not necessarily event-scoped.** `device_tokens.event_id` is **nullable**
   (`packages/lib/src/schemas/tables/device-tokens.ts`). The "scoped to one event" half of the
   trade-off is optional, not structural. What actually distinguishes a device token is `revoked_at` —
   per-*tablet* revocation.
2. **`event_grants` is plumbing with no producer.** The table exists, `tenancy/context.ts` reads it and
   `db/scoped.ts` exposes it, but **nothing writes it** — no route, no service. It can only ever be
   empty today, so adopting it as "the natural home for per-event scoping" is new work, not a
   migration.

**The argument for your instinct that the brief doesn't make:** a `cpd_` token lives in `localStorage`
(`apps/web/src/lib/device-token.ts`) and **takes precedence over the Supabase session**. That is an
unsupervised bearer credential at the door outranking real auth.

**The argument against:** the device path is load-bearing in middleware, not a leaf. It is a whole
caller *kind* — `middleware/caller.ts` has both a token branch and a tenant branch with role/scope
intersection. Deleting it is a schema + API + UI change, not a UI cleanup.

**The deciding question, which needs your answer:** are doors staffed by *volunteers you would add as
members* (the Luma model works cleanly — the `checkin` role already exists in `authz/permissions.ts`
and is already assignable from Account → Members), or by *unattended tablets* (no person to attach a
role to, which is exactly what device tokens are for)?

<details>
<summary>Original brief (kept for context)</summary>

### Rethink device tokens — do what Luma does · L

The maintainer wants the whole `cpd_…` device-token approach reconsidered: **a limited role plus a
shared QR, not a device credential.**

**What exists today** (built to `API-SECOND-REBUILD` §2.6, and now in question):
- `device_tokens` table, `POST /events/{id}/devices` → pairing code, `POST /devices/pair` → token.
- `apps/web/src/lib/device-token.ts` persists it, and it takes precedence over any Supabase session.
- `/checkin/pair`, the devices panel on the event page, the devices tab on `/account`.

**The Luma model, as described:** there is no device identity. A door is staffed by a *person* whose
role can do one thing — record attendance — and the shared QR is just the event link. Nobody at the
door holds anything that reaches the account.

**What that would mean here (worth noting: much of it already exists):**
- The `checkin` role is **already in the schema and the permission matrix**
  (`services/core/src/authz/permissions.ts`, `orgRole` in `packages/lib/src/schemas/tables/enums.ts`)
  — "works the door, nothing else". The Account → Members tab can already assign it.
- So the shift is mostly *deletion*: drop `device_tokens`, the pairing flow, `/checkin/pair`, the
  devices panel, the devices tab, `lib/device-token.ts`, and the device-token branch in
  `main.tsx`'s `getAuthToken`.
- **The trade-off to weigh before deleting:** a device token is scoped to *one event* and is
  revocable per tablet. A `checkin` member is scoped to the *whole organization* and can work any
  event. If a volunteer's phone is lost, revoking a device is surgical; removing a member is not.
  Decide whether that granularity is worth the complexity — the maintainer's judgement is that it
  is not.
- Also decide what happens to `event_grants`, which delegates management of a *single* event and is
  the natural home for per-event scoping if it is still wanted.

This is a schema + API + UI change. Do the API side first, then delete the UI in one pass.

</details>

## 2.7 ⬜ No way to toggle premium in the UI · S

I removed `contexts/premium.tsx` (a `localStorage` boolean, flipped by hand from the old Profile page)
because §2.12 said to gate on the server's answer instead. The upgrade card on `/events` now checks
`organization.plan === 'free'`. **Nothing in the UI can change `plan`, so premium can no longer be
tested.**

Options, cheapest first:

1. **Dev-only toggle on `/account` → Settings.** `PATCH /organizations/{id}` does not accept `plan`
   (`CreateOrganizationSchema` strips it deliberately). Either allow it behind an env flag, or add a
   small dev-only endpoint. Guard it with `import.meta.env.DEV` so it cannot ship.
2. **Seed both plans.** Make `nx run coreservice:seed` create one `free` and one `pro` organization
   and switch between them — no new API surface at all. **Probably the right answer.**
3. Restore the `localStorage` override *purely as a dev affordance*, clearly labelled, reading the
   server value as the default. Rejected once already; only if 1 and 2 are both unworkable.

Whatever is chosen, document it in `CLAUDE.md` under Commands — the current gap is that the
capability vanished with no note.

## 2.8 ⬜ Audit every screen · M

A pass over all 21 routes, checking each one actually works against a live API. Nothing below has been
run in a browser. Use this as the checklist.

Legend: **Wired** = reads the new API, unverified · **Verify** = needs a live run · **Open** = known gap

| # | Route | State | Check |
|---|---|---|---|
| 1 | `/` | Wired | Redirects to `/login`. Should a signed-in user land on `/events` instead? |
| 2 | `/login` | Verify | Guest auto-login still works? `?redirect=` honoured after sign-in? Loyalty copy is gone — confirm the panel still reads well. |
| 3 | `/onboarding` | Verify | All three steps; skip paths; invite links copy correctly. **Item 2.1 (branding).** |
| 4 | `/invitations/$token` | Verify | Needs a real invitation token. All three failure screens: mismatch, expired, 404. |
| 5 | `/events` | Verify | Hero counts, up-next card, Upcoming/Past switch, search, calendar rail month change, delete→cancel 409 fallback. |
| 6 | `/events/new` | **Open** | **Item 2.3** — silent failure with no org. |
| 7 | `/events/$eventId` | Verify | Short code, counts, share, poster, end event, cancel, add attendee → pass URL shown. |
| 8 | `/events/$eventId/edit` | Verify | Seeds from the API; `allowSelfCheckIn` round-trips (only works since the `EventSummary` change). |
| 9 | `/attendees` | Verify | Scope dropdown, search, billboard tiles, standing badges, soft delete. |
| 10 | `/attendees/new` | Verify | With and without `?eventId=`. With one, it creates **and registers**, and the pass link toasts. |
| 11 | `/attendees/$userId/edit` | Verify | Notes field is new. |
| 12 | `/checkin/$eventId` | **Open** | **Item 2.5** — QR scan. Also: counter polling, manual, check-out when `requireCheckOut`, revoked device. |
| 13 | `/checkin/pair` | **Open** | **Item 2.6** may delete this entirely. |
| 14 | `/e/$eventId` | Verify | Register → pass redirect; walk-up check-in; resend; cancelled event still resolves; full event. |
| 15 | `/p/$token` | Verify | QR, self check-in, 410 and 404 as calm states. **No email exists — confirm the copy says so.** |
| 16 | `/account` (profile) | Verify | Read-only — `PATCH /me` does not exist. Sign out. |
| 17 | `/account` (organizations) | Verify | Switching re-scopes without reload. |
| 18 | `/account` (members) | Verify | Role change, remove, invite, revoke. **Last-owner control is disabled with a reason — confirm.** |
| 19 | `/account` (devices) | **Open** | Depends on item 2.6. |
| 20 | `/account` (settings) | Verify | Name/slug save, `slug_taken`, delete org with `has_events`. |
| 21 | `/analytics` | **Open** | **Item 2.4** — restore with a banner. |
| 22 | `/upgrade` | **Open** | **Item 2.7** — no way to reach or test the premium state. |
| — | `/profile`, `/organizations` | Verify | Both redirect into `/account`. |

**Also worth auditing, not a route:** the right sidebar (`ProfileView` now shows real person stats;
`OverviewView` fetches one month), the command palette (`containers/Command/` — check every entry
still points somewhere real), and `ActionCards` (still links to "View Organisations").

---

# Part 3 — Everything else still open

Carried from `API-SECOND-REBUILD.md` §3, unchanged by this work.

| Item | Blocks | Note |
|---|---|---|
| `NotificationService` (Resend) | Emailed passes and invitations | **Until this lands, every pass URL and invite link must be shown on screen.** Never write "check your email". |
| `PATCH /me` | Account → Profile editing | Small. The page already says it is read-only. |
| `/me/tickets`, `/me/claim`, `/me/upgrade` | The whole personal scope | An attendee's own view across organizations. Designed, not built. |
| `GET /analytics/overview` + `/export` | Real analytics | See item 2.4 for the interim. |
| Media / uploads | Cover photos | The composer has a `TODO(event-image)` with the full plan in it. |
| ICS endpoint | "Add to calendar" | Deliberately absent from `/e/$id` — the old client-side generator emitted invalid ICS. |
| SSE (`GET /events/{id}/stream`) | Live kiosk counter | Polling every 5s until then. |
| Service accounts | The Phase 4 scheduler | §3.1 of `API-SECOND-REBUILD.md`. Nothing can authenticate as "the system" yet. |
| Adversarial suite fixtures | Trustworthy security tests | 39 of 50 red because the actors are placeholders with `token: ''`. **Until they mint real tokens, those tests prove nothing.** |
| RLS cutover | Layer 2 actually biting | The API connects as `postgres` (BYPASSRLS). Needs `SET LOCAL app.account_id` per transaction first. |
| `ui:lint` / `lib:lint` | A clean `nx affected -t lint` | 4 pre-existing React-compiler errors in `map.tsx`, `bottom-nav.tsx`, `date-time-range-picker.tsx`, `use-toolbar-context.ts`. |
| Loyalty copy in `apps/website` | — | `Home.tsx` and `HowItWorks.tsx` still sell a loyalty programme that no longer exists. §2.12 only scoped `apps/web`. |

---

# Part 4 — Getting started

```bash
nx run coreservice:db reset      # rebuild + seed two orgs with every event status
bun start                        # web + API together
# kill with: pkill -f "nx run web:serve|nx run coreservice:start"
```

Web lands on **:5001** (AirPlay holds 5000). API on :8080. Scalar docs at
`http://localhost:8080/api/v1/core/docs` — it sends real requests; use it before writing UI against
any endpoint.

```bash
nx run coreservice:token                  # mint a JWT for the Scalar auth box
nx run coreservice:db join <account-id>   # make yourself an owner
nx run api-client:generate                # after ANY API change
```

Before saying a change is done:

```bash
nx run coreservice:verify     # lint + typecheck + test
nx run web:build              # the web app has no standalone typecheck target
nx run web:lint
```

## One thing to know about this repo's git

Two commits appeared during the 2026-07-27 session that the agent did not make (`2beae29`,
`c3da21b`) — something is auto-committing the working tree. Check `git log` before assuming your
changes are unstaged.
