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

### U6 🔴 A pending invitation's link cannot be recovered · S — **CONFIRMED 2026-11-06**

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

Until one of those lands, `Invite` creates something that only works if you copy the link in the
same breath — which is not stated anywhere.

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
