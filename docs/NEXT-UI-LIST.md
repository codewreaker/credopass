# NEXT-UI-LIST — the open UI backlog

> **Read this if you are picking up the web app.** It is the live list of what is *not* done.
>
> What *was* done lives in [`REBUILD-LOG.md`](REBUILD-LOG.md) — this file no longer duplicates it.
> Companions: [`API-SECOND-REBUILD.md`](archive/API-SECOND-REBUILD.md) (moving the web app onto
> `/api/v1/core`) · [`API-THIRD-REBUILD.md`](archive/API-THIRD-REBUILD.md) (the sign-up funnel, D20–D26) ·
> [`DATABASE-MIGRATION.md`](DATABASE-MIGRATION.md).
>
> **Last refreshed:** 2026-07-27, after the account/profile pass and the repo-wide documentation
> cleanup.
>
> **See also [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md)** (2026-11-06) for the next round of product work and the
> public-API plan. Two confirmed bugs live there rather than here because they were found while writing it:
> **B1** — ⌘V/⌘A/⌘N/⌘T/⌘P intercepted globally with no focus guard, so paste did not work in any
> input (**fixed 2026-11-06**; navigation is `g` chords now, registry in
> `apps/web/src/hooks/shortcuts.ts`) — and **B2**, the composer showing "No organization" as a
> loading state (still open).

---

## Premises that have changed — re-read these before working from an older note

Four items on the previous version of this list were written against a product that no longer exists.
They are recorded here rather than silently dropped, because notes elsewhere still reference them.

| Was on the list | Status now |
|---|---|
| "Brand the onboarding flow" | **Moot.** There is no onboarding flow and no `/onboarding` route. Signing in commissions an organisation (`ensureDefaultOrganization`). That *is* onboarding (D22). |
| "Auto-create a default organization — decide" | **Decided and shipped**, once the guest tier went. The objection was unbounded orgs from anonymous visitors; there are no anonymous visitors any more (D20). |
| "Device tokens — do what Luma does" | **Deleted.** A door tablet is a person signed in with the `checkin` role. `/checkin/pair` and the Account → Devices tab are gone. Do not reintroduce a second authentication system for doors (D24). |
| "Loyalty copy in `apps/website`" | **Done.** `Home.tsx` and `HowItWorks.tsx` no longer sell a loyalty programme, an offline-first kiosk, or SOC 2 compliance, and the pricing block now mirrors `services/core/src/authz/plans.ts`. |
| "No way to toggle premium in the UI" | **Done.** The billing API landed; `/upgrade` reads `GET /plans` and `PUT /organizations/{id}/plan` changes the tier. The checkout in front of it is still an openly-labelled mock — **no money moves** (D15). |

---

## Open · UI

### U1 ⬜ Restore `/analytics` with an unmissable "fabricated data" banner · S

`/analytics` currently renders an empty state. The maintainer wants the dashboard back, with the
fabrication made explicit rather than the page removed.

The numbers come from `services/core/src/services/analytics/` — deterministic placeholders behind the
real `AnalyticsResponse` contract. They do not read the database.

**The banner is the point.** Not a small "Sample data" badge — a full-width, unmissable strip at the
top saying every figure below is placeholder. People screenshot dashboards; the warning has to
survive the screenshot.

Rewiring notes: read events via `useEvents`, gate on `organization.plan` (`hasFullAnalytics` in
`authz/plans.ts` owns which tiers unlock it), and use `useAnalytics` rather than restoring the old
`fetchAnalytics`.

Real endpoints (`GET /analytics/overview`, `/analytics/export`) remain Phase 6.

### U2 ⬜ QR scan check-in is broken · M — **needs reproduction first**

Never diagnosed; it has not been run. What is known, so the next person does not start cold:

- `/p/$token` renders `GlowingQRCode value={pass.qrValue}`, and `qrValue` is **the raw pass token**
  (`services/core/src/api/v1/core/public.ts`).
- The kiosk's `handleScan` (`apps/web/src/Pages/CheckIn/index.tsx`) rejects anything containing `/e/`
  as "that's the event link", strips a `/p/` prefix if present, and posts `{ pass, method: 'qr' }`.
- The server resolves it via `Pass.verify` and 400s `invalid_pass` for another event's pass.

Check in this order:

1. **Is it the event QR being scanned?** The big QR on the kiosk and event page is `/e/{id}` — the
   *share* link, not a pass. Scanning it correctly errors. If that is the report, the fix is UX: the
   kiosk's "Event QR" mode shows a code its own "Scan passes" mode rejects.
2. **Camera permissions / secure context.** `html5-qrcode` needs HTTPS. `localhost` is fine; a LAN IP
   over plain HTTP is not, and it fails silently.
3. **The debug drawer** (bug icon in the kiosk toolbar) logs every raw scan, the parse outcome and
   the error. Use it — it shows exactly what string arrives.
4. **`paused`** — the scanner pauses on `successPerson || checkIn.isPending`. Confirm it resumes.
5. **Old QR format.** Anything generated before the rebuild is `{eventId}:{userId}` and will never
   verify. Regenerate passes after `db reset`.

### U5 ✅ Every pass link is dead in production · S — **CONFIRMED 2026-11-06, FIXED 2026-11-06**

Found by walking the add-attendee flow against the deployed API. A pass URL handed to an organiser
reads:

```
http://api.credopass.com/p/CP1.…
```

Two faults in one string, and either alone breaks it:

| | |
|---|---|
| **Wrong host** | `/p/$token` is a **web app** route. `api.credopass.com` does not serve it. |
| **Wrong scheme** | `http://`, not `https://`. |

Measured:

| URL | Result |
|---|---|
| as printed | 302 → **404** |
| `https://api.credopass.com/p/…` | **404** |
| `https://app.credopass.com/p/…` | **200** |

So the pass — the single artefact this product exists to hand an attendee, and the only copy of it,
since nothing is emailed (D18) — resolves to a 404 for every organiser using the live product.

**Root cause, one line.** `services/core/src/api/v1/core/attendance.ts:109` and
`services/core/src/api/v1/core/public.ts:112` both build the link with:

```ts
origin: originOf(c.req.url)   //  → the origin of the INCOMING API request
```

`services/core/src/services/pass.ts:141` then does `${origin}/p/${token}`. The origin of a request
to the API is the API's own host, which is the wrong host; and the service sits behind a TLS
terminator, so `c.req.url` is plain `http` — there is **no `X-Forwarded-Proto` handling anywhere in
the service**, which is the other half.

**Fix:** a configured public app origin — an env var such as `PUBLIC_APP_URL=https://app.credopass.com`
— read once at boot and used for every user-facing link, instead of inferring an origin from the
request. Inferring it can never be right: the API host is by definition not the app host. Those are
the only two `originOf` callers, so the change is contained.

Needs a deploy-config change (the variable must be set in Coolify) as well as the code change.

Invitation links are **not** affected — the client builds `/invitations/$token` against its own
origin.

**Fixed 2026-11-06.** `services/core/src/config/public-url.ts` holds the app origin and both call
sites use it: `https://app.credopass.com` under `NODE_ENV=production`, `http://localhost:5000`
otherwise, with `PUBLIC_APP_URL` as an override. There is one production web app and its host is
not a surprise, so requiring the deployment to restate it would buy nothing and cost a boot failure
the first time someone forgot.

`X-Forwarded-Proto` is deliberately *not* read — it is a client-settable header, and it would fix
the scheme while leaving the host wrong.

**No deploy-config change needed.** Passes already issued stay dead — their URL was stored nowhere,
only printed, so there is nothing to backfill.

### U6 ✅ A pending invitation's link cannot be recovered · S — **CONFIRMED and FIXED 2026-11-06**

`/account?tab=members` tells you, correctly:

> CredoPass does not send email yet — copy each link and pass it on yourself.

Every invitation already in the list then says **`link not shown`**. Two are in that state in
production today.

So the screen instructs you to do the one thing it will not let you do, and an invitation you
created yesterday can never be delivered. Same shape as U5: a link that exists in principle and is
unreachable in practice, in a product that has no email to fall back on (D18).

The token is in the row; the question is whether showing it again is acceptable. It is a bearer
credential, so three options, in order of preference:

1. **Regenerate** — a `Regenerate link` action that rotates the token and shows the new one once.
   Keeps the "shown once" property and fixes the dead end.
2. **Show it** — simplest, and consistent with the pass, which is also a bearer URL shown on screen.
3. **Say so** — if neither, the row must say *"this link can no longer be shown — delete and
   re-invite"* rather than `link not shown`, which reads like a loading state.

**Fixed 2026-11-06 — option 1, and it closed a second bug on the way.**

`inviteMember` now rotates a live invitation instead of inserting beside it. Inviting an address
that already has a pending invitation updates that row's token hash, role and expiry and returns
the new token once. So "send it again" is the same request as "send it" — no new endpoint, no new
concept, and the shown-once rule is untouched because the old token stops working the moment the
new one is issued.

The second bug: nothing checked for an existing invitation before inserting, and
`uq_invitations_org_email_pending` makes `(organization, lower(email))` unique while a row is
neither accepted nor revoked. So **inviting the same person twice hit a constraint violation** — a
500, not the 409 the route documents. It would also have blocked re-inviting anyone whose
invitation had merely expired. Two integration tests cover it now: rotation returns the same row
with a different token, and the previous token is refused afterwards.

In the UI, `link not shown` is replaced by a `New link` button on the row, and the section says
"A link is shown once; use New link if you lose it."

**Not verified end to end against production** — the deployed API still has the old code, so the
button will 500 there until the next deploy.

### U8 ✅ Registering someone twice silently kills the pass they are holding · M — **CONFIRMED and ADDRESSED 2026-11-06**

Measured against production. Register, keep the link, register the same person for the same event
again, then open the first link:

```
410 Gone — "That pass has been revoked."
```

`Attendance.register` is careful to make the attendance row idempotent, and says so:

```ts
// Idempotent: registering twice returns the original row rather than failing
// on the unique index. A double-tapped button is not an error.
```

Then, five lines later, it calls `Pass.issue` unconditionally — and `issue` revokes every live pass
for that `(event, person)` before minting a new one. So the double-tapped button *is* an error: it
destroys the credential the attendee already saved. The comment's promise is broken by the next
statement.

**Why it matters more here than it would elsewhere.** There is no email (D18), so the pass URL
shown at registration is the only copy. Three ordinary sequences silently invalidate it:

| | |
|---|---|
| The attendee taps **Register** twice, or goes back and resubmits | Their first link dies. They do get a new one on screen, so they are not stranded — unless they saved the first on another device. |
| The attendee returns to the public link later and registers again *because* they lost the pass | Reasonable behaviour, and it works, but only by luck — nothing told them this is the recovery path. |
| **Staff register someone who had already self-registered** | The attendee's saved pass dies **remotely and silently**. The replacement URL appears on the staff member's screen, not theirs. This is the bad one. |

Revoking on re-issue is right in itself — two live credentials for one seat is worse. The defect is
that it happens as a side effect of an action that claims to be idempotent, with nothing said to
anyone.

**The fix proposed above was wrong, and the database said so.** Two attempts, recorded because the
reasoning matters more than the patch:

1. *"Let `register` skip minting when a live pass exists, and make `resend-pass` the rotation
   point."* Dead on arrival: `POST /public/events/{id}/resend-pass` does nothing. It calls
   `findRegistration` and returns `202 {accepted: true}` **whatever it finds**, on purpose — a
   different answer for a registered address would turn it into an oracle for "is this person
   attending this event" (T39). With no email (D18) it has nothing to deliver either. It is a
   placeholder for a notification service that does not exist.
2. *"Let several live passes coexist, since they all resolve to the same attendance row."* The
   integration suite failed with `23505 uq_passes_event_person_live`. `passes` carries a partial
   unique index on `(event_id, person_id) WHERE revoked_at IS NULL`. **One live pass per person
   per event is a schema invariant**, not an incidental choice in the service — and the comment on
   `Pass.issue` that said so was right.

So rotation on re-registration is **required**. Given that, and given the token is stored only as
a hash and cannot be re-shown, the defect is not that the pass rotates. It is that it rotates
**silently**, and that the person who loses their link is often not the person looking at the
screen.

**What was done instead — say it, unconditionally, in all three places a pass is issued:**

| Where | Copy |
|---|---|
| `/p/$token` | "Save this link — it is the only copy of your pass, and it replaces any earlier one you were sent." |
| The public register sheet | "…save the link, it's the only copy, and it replaces any pass you were sent before." |
| Staff `Add an attendee` | "If they had already registered, their previous link has stopped working. This is now their only pass." — in `text-warning`, because this is the case where someone *else's* link just died. |

Each is phrased as a fact about the page rather than a branch on what the server found, so none of
them becomes the oracle that `resend-pass` is careful to avoid. The pass page's line also moved
from `/45` to `/60` opacity — it is load-bearing and was the faintest text on the screen (R7).

**Still open, and now the honest version of this ticket:** there is no way to recover a pass
without replacing it, and no way to warn the attendee that it happened. Both need
`NotificationService` (D18). Until then the copy above is the whole mitigation.

**Related, unchanged:** `register` returns `alreadyRecorded: false` as a hardcoded literal. Left
alone deliberately — returning the truth would hand the public endpoint exactly the oracle
described above.

### U3 ⬜ Audit every screen in a browser · M

A pass over all 19 routes against a live API. **Nothing below has been run in a browser** except the
`/events/new` path, which passed 4/4 in Playwright with 0 console errors.

| # | Route | Check |
|---|---|---|
| 1 | `/` | Should a signed-in user land on `/events` rather than `/login`? |
| 2 | `/login` | `?redirect=` honoured after sign-in; the side panel still reads well without the loyalty copy. |
| 3 | `/invitations/$token` | Needs a real token. All three failure screens: mismatch, expired, 404. |
| 4 | `/events` | Hero counts, up-next card, Upcoming/Past switch, search, calendar rail month change, delete→cancel 409 fallback. |
| 5 | `/events/new` | ✅ passed in Playwright. Re-check the signed-out overlay after any auth change. |
| 6 | `/events/$eventId` | Short code, counts, share, poster, end event, cancel, add attendee → pass URL shown on screen. |
| 7 | `/events/$eventId/edit` | Seeds from the API; `allowSelfCheckIn` round-trips. |
| 8 | `/attendees` | Scope dropdown, search, billboard tiles, standing badges, soft delete. |
| 9 | `/attendees/new` | With and without `?eventId=`. With one, it creates **and registers**, and the pass link toasts. |
| 10 | `/attendees/$userId/edit` | The notes field. |
| 11 | `/checkin/$eventId` | **U2** — QR scan. Also counter polling, manual entry, check-out when `requireCheckOut`. |
| 12 | `/e/$eventId` | Register → pass redirect; walk-up check-in; resend; cancelled event still resolves; full event. |
| 13 | `/p/$token` | QR, self check-in, 410 and 404 as calm states. **No email exists — confirm the copy says so.** |
| 14 | `/account?tab=profile` | Read-only (`PATCH /me` does not exist). Plan section links to `/upgrade`. Sign out. |
| 15 | `/account?tab=organizations` | Switching re-scopes without a reload. |
| 16 | `/account?tab=members` | Role change, remove, invite, revoke. **Last-owner control is disabled with a reason — confirm.** |
| 17 | `/account?tab=settings` | Name/slug save, `slug_taken`, delete org with `has_events`. |
| 18 | `/analytics` | **U1**. |
| 19 | `/upgrade`, `/upgrade/checkout` | Plan cards from `GET /plans`; non-owner sees no button; the mock checkout writes the column. |
| — | `/profile`, `/organizations` | Both redirect into the matching `/account` tab. |

**Also worth auditing, not routes:** the top-bar `UserMenu` (new — profile, plan badge, theme
toggle, sign out), the right sidebar (`ProfileView` shows real person stats; `OverviewView` fetches
one month), the command palette (`containers/Command/` — check every entry still points somewhere
real), and `ActionCards`.

### U4 ⬜ `PATCH /me` and profile editing · S

The Profile tab says "read-only for now" because the endpoint does not exist. Small piece of work;
the page is already shaped for it.

---

## Open · platform

Carried from `API-SECOND-REBUILD.md` §3, still true.

| Item | Blocks | Note |
|---|---|---|
| **RLS cutover** | Layer 2 actually biting | The API connects as `postgres` (BYPASSRLS), so the policies are untested code. Needs `SET LOCAL app.account_id` per transaction first. Ordered fix in [`DATABASE-MIGRATION.md` §6](DATABASE-MIGRATION.md). |
| **`users` → `accounts` + `people` migration** | The remote Supabase cutover | Not written. Shape and constraints in [`DATABASE-MIGRATION.md` §5.4](DATABASE-MIGRATION.md). |
| **Adversarial suite fixtures** | Trustworthy security tests | Many actors are placeholders with `token: ''`. Until they mint real tokens, those tests prove less than the count suggests. |
| `NotificationService` (Resend) | Emailed passes and invitations | **Until this lands, every pass URL and invite link must be shown on screen.** Never write "check your email". |
| `/me/tickets`, `/me/claim` | The personal scope | An attendee's own view across organizations. Designed, not built. |
| `GET /analytics/overview` + `/export` | Real analytics | See U1 for the interim. |
| Media / uploads | Cover photos | The composer has a `TODO(event-image)` with the full plan in it. |
| ICS endpoint | "Add to calendar" | Deliberately absent from `/e/$id` — the old client-side generator emitted invalid ICS. |
| SSE (`GET /events/{id}/stream`) | Live kiosk counter | Polling every 5s until then. |
| Service accounts | The Phase 4 scheduler | Nothing can authenticate as "the system" yet. |
| Real payment capture | Actually charging | `PUT /organizations/{id}/plan` writes a column. The checkout is a labelled mock (D15). |
| SSO endpoints | Tenant-brought identity providers | `org_identity_providers` and `org_domains` have schema, no routes. |
| `ui:lint` / `lib:lint` | A clean `nx affected -t lint` | Pre-existing React-compiler errors in `map.tsx`, `bottom-nav.tsx`, `date-time-range-picker.tsx`, `use-toolbar-context.ts`. |

### Unused design-system components

These have no importer anywhere. They are **not** dead code in the usual sense — a design system
legitimately holds primitives ahead of use — but they are also not exercised by anything, so treat
them as unverified:

`alert` · `alert-dialog` · `checkbox` · `chip-filter` · `combobox` · `date-time-range-picker` ·
`grid-table` · `input-group` · `item` · `loader` · `map-with-marker` · `popover` · `tooltip`

`packages/ui/src/components/user/` **was** in this list and has been deleted — a 376-line
config-driven user menu nothing used. Its one genuinely missing feature, a theme switcher, now lives
in `apps/web/src/containers/UserMenu/`.

---

## Getting started

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
nx run coreservice:db join <account-id>   # make yourself an owner of the seeded org
nx run api-client:generate                # after ANY API change
```

Before saying a change is done:

```bash
nx run coreservice:verify     # lint + typecheck + test
nx run web:build              # the web app has no standalone typecheck target that passes
nx run web:lint
```

## One thing to know about this repo's git

Commits have appeared during past sessions that the agent did not make — something is auto-committing
the working tree. Check `git log` before assuming your changes are unstaged.
