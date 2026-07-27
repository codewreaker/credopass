# API-THIRD-REBUILD — the sign-up funnel

> **In one line.** The guest tier and the device tier are deleted, onboarding *is* signing in,
> and `/events/new` is the front door — the composer renders for a visitor who has never heard
> of CredoPass, with sign-in laid over it rather than in front of it.

| Doc | What it is |
|---|---|
| [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) | Target architecture, D1–D19, schema, endpoint list. Still authoritative except where D20–D26 below supersede it. |
| [`API-SECOND-REBUILD.md`](API-SECOND-REBUILD.md) | The UI rewiring onto `/api/v1/core`. Done. Its device sections (§1.5 Devices, §2.10) are obsolete. |
| ~~`GUEST-ONBOARDING.md`~~ | A design study for anonymous guest onboarding. **Deleted** — this document superseded it, and the guest tier it assumed no longer exists. Its conclusion (§10.1: measure before building) was right; the answer was "don't". Recoverable from git history if the reasoning is ever wanted again. |
| [`REBUILD-LOG.md`](REBUILD-LOG.md) | What actually happened. |

---

# Part 0 — Why this is almost entirely deletion

The product direction moved: acquire organisers the way Luma does, by putting the composer in
front of a visitor before asking for anything. The API already supported it. What stood in the
way was three systems that had stopped meaning anything:

1. **A guest tier that could not be entered.** `signInAnonymously` was removed on 2026-07-27 and
   its machinery was left behind. `accounts.is_guest` could only be set from an `is_anonymous`
   claim, and nothing issued one — so `Account.isGuest` was a contract field that was a
   compile-time constant `false`, and `!caller.isGuest` was a dead branch on the hot path.
2. **An onboarding wizard that was already unreachable.** `ensureDefaultOrganization` gives every
   account an organisation on its first authenticated request, which made `needsOnboarding`
   permanently `false`, `OnboardingGate` a spinner that never blocked, and the 548-line wizard
   reachable only by typing the URL. Its third step was "create your first event" — the reason
   creating an organisation required creating an event.
3. **Device-token pairing for door tablets.** A parallel authentication system — table, four
   endpoints, pairing screen, 32 tests, a 210-line explainer — for a job the existing `checkin`
   role already did, with exactly the same permissions.

**Net: 26 files deleted, ~2,900 lines removed, 3 added.** The funnel itself is one route guard,
one overlay component, one dialog and a link.

---

# Part 1 — Decisions (continuing D1–D19)

### D20 — There is no guest tier

Three kinds of caller, and only three:

| Caller | Credential | Reaches |
|---|---|---|
| **Visitor** | none | `scope: 'public'` — the shared event link, public register, walk-up check-in, resend |
| **Attendee** | the pass token *in the URL* | `scope: 'bearer'` — their own pass, and check-in from it |
| **Account** | a verified JWT | `scope: 'account'` and `scope: 'organization'` |

**D16 is retired.** It forbade provisioning an organisation for someone who had merely visited.
That is now structurally impossible: there is no way to authenticate without being a real person,
so every account `resolveCaller` creates belongs to somebody.

### D21 — The composer is the landing surface, and there is no draft

`/events/new` renders for an unauthenticated visitor with the sign-in panel over it. The fields
are inert (`<fieldset disabled>`), so there is nothing typed to preserve across an OAuth
round-trip — which is precisely why this is simpler than saving a draft would have been.

**The overlay is presentation; the middleware is the control.** `POST /events` is
`scope: 'organization'`, so `requireCaller` answers 401 before any handler runs. Deleting the
overlay in devtools and re-enabling a field yields a form whose submit is refused.

A server-side `drafts` table was considered and rejected (in the since-deleted `GUEST-ONBOARDING.md` §7.1):
it needed an owner, and the only owner available for a visitor was an anonymous account.

### D22 — Onboarding is signing in

No onboarding screen, no gate, no `needsOnboarding` field. A boolean that is always `false` is
worse than no boolean — the next reader writes a branch for it.

### D23 — Creating an organisation is one POST with one field

`POST /organizations` was always `scope: 'account'` and always stood alone. Only the wizard
coupled it to events. It now lives on the Account page's Organizations tab as a `SheetDialog`
with one input.

### D24 — A door is a person with the `checkin` role, not a paired device

The `checkin` role already carried exactly the permissions a door needs — `org:read`,
`event:read`, `person:read`, `attendance:read`, `attendance:record`, `media:read` — and the
device branch already borrowed it (`role: 'checkin'`, intersected with the token's scopes). The
kiosk screen already worked for a normally signed-in user.

**What this costs, stated plainly:**

| Lost | Replacement |
|---|---|
| Per-event token scoping (`assertEventInScope`) | A `checkin` member can open the kiosk for any event in the org |
| Revoking one tablet without touching people | Remove the member, or change their role |
| Auto-expiry at event end + 24h | Membership persists until removed |
| A tablet needing no account | Someone signs in on it |

### D25 — The sign-up nudge is copy and a link

No endpoint, no lookup, no conditional. It sits on the pass screen below the pass — not in the
register dialog, where it would compete with the one action that matters.

### D26 — The public surface never reveals whether an address has an account

The nudge is unconditional. There is no "is this email registered?" lookup, and no different
response for a known address. Same rule that makes `POST /public/events/{id}/resend-pass` answer
an identical `202` either way: a different answer is an oracle for "does this person use
CredoPass", and through `/e/{id}`, for "is this person attending this event".

**`/me/tickets` and `/me/claim` are deferred.** They are the "My Tickets" feature, not a
prerequisite for the nudge. `claimByVerifiedEmail` stays in `services/identity.ts`, unrouted and
commented as such.

---

# Part 2 — What changed in the contract

Two fields removed, one field tightened. All three land in the checked-in
`generated/schema.d.ts`.

| Change | Where | Why |
|---|---|---|
| `Account.isGuest` — **removed** | `GET /me`, `GET /me/context` | Constant `false` since anonymous sign-in went |
| `MeContext.needsOnboarding` — **removed** | `GET /me/context` | Constant `false` since auto-provisioning |
| `MeContext.membership.permissions` — `z.string()` → **`z.enum(PERMISSIONS)`** | `GET /me/context` | See below |
| 4 device operations — **removed** | `POST /events/{id}/devices`, `GET /organizations/{id}/devices`, `DELETE /devices/{deviceId}`, `POST /devices/pair` | D24 |

**The permission-enum change was load-bearing, not cosmetic.** `packages/api-client/src/types.ts`
derived its `Permission` union from `ApiBody<'/events/{id}/devices', 'post'>['scopes']` — the
device-pairing request body was the only place in the whole document where a permission was named
in a *request*, so that is where the literal union was read back from. Deleting the device routes
would have deleted the type and left `useCan` taking a bare `string`.

`/me/context` now declares the enum on the response that actually carries the permissions, and
the client anchors on that. Stabler, and more honest: the field ships a closed set, so the
contract says so.

**41 operations remain** (was 45).

---

# Part 3 — Schema

One migration, [`0003_drop_device_tokens_and_guest_tier.sql`](../services/core/drizzle/0003_drop_device_tokens_and_guest_tier.sql):

```sql
DROP TABLE "device_tokens" CASCADE;
DROP TABLE "event_grants" CASCADE;
ALTER TABLE "accounts"   DROP COLUMN "is_guest";
ALTER TABLE "attendance" DROP COLUMN "checked_in_by_device_id";
DROP TYPE  "public"."event_role";
```

`CASCADE` takes the `device_tokens_tenant` RLS policy from `0002` with it. No other policy
referenced either table.

### `event_grants` — an authorization surface that silently did nothing

Found during the sweep, not in the brief. `event_grants` backed a per-event role system
(`organizer` / `co_host` / `staff`) consulted by `canOnEvent`, which read `ctx.eventGrants` — a
map **`requireCaller` never populated**. It was always empty, so every grant that was supposed to
widen access evaluated to `false`, and the only code exercising it was unit tests fabricating a
context by hand.

Deleted rather than wired up. A permanently-empty authorization surface is worse than none,
because it reads as working: `permissions.ts` documented organizer's row-scoped rights as
"enforced in EventService" against a table nothing wrote to.

**`org_identity_providers` and `org_domains` look equally unused and are KEPT** — they are
deliberate Phase 7 SSO scaffolding (D-M: "accept the schema now, defer the flows"), and
`identities.orgIdentityProviderId` already references them.

> ⚠️ **The migration has been generated but NOT applied.** `nx run coreservice:migrate` writes to
> the remote Supabase instance in `services/core/.env`. Applying it is a deliberate act — see
> "What you need to do next" in the handover.

---

# Part 4 — The funnel

| Piece | File |
|---|---|
| Route renders unauthenticated | [`routes/events/new.tsx`](../apps/web/src/routes/events/new.tsx) — `beforeLoad: requireAuth` removed |
| Composer + inert fields + overlay | [`Pages/Events/EventComposer/index.tsx`](../apps/web/src/Pages/Events/EventComposer/index.tsx) |
| The glass panel | [`EventComposer/sign-in-overlay.tsx`](../apps/web/src/Pages/Events/EventComposer/sign-in-overlay.tsx) — **new** |
| Create-organisation form | `NewOrganizationDialog` in [`Pages/Account/index.tsx`](../apps/web/src/Pages/Account/index.tsx) — **new** |
| Sign-up nudge | `SignUpNudge` in [`Pages/Pass/index.tsx`](../apps/web/src/Pages/Pass/index.tsx) — **new** |
| Marketing CTA | [`apps/website/src/pages/Home.tsx`](../apps/website/src/pages/Home.tsx) — `startCreating` → `/events/new`, `signIn` → `/login` |

The overlay shows **on load**, not on first interaction. With the fields disabled, an
interactive-looking form that silently does nothing would be worse than an honest ask.

`/events/new` is the one private-looking route with no `requireAuth`. It renders no tenant data,
so there is nothing to leak.

---

# Part 5 — Bugs found on the way

Four, none of them in the brief.

### `apps/web/.env.production` pointed at a dead base path

```diff
- VITE_API_URL=https://api.credopass.com/api/core
+ VITE_API_URL=https://api.credopass.com/api/v1/core
```

The service only serves `/api/v1/core` and 404s everything else
([`index.ts:50-61`](../services/core/src/index.ts#L50-L61)). `apps/mobile` had the same problem
against `localhost:3000/api/core`. This is a live bug, not cleanup.

### `/upgrade` told signed-in users they were guests

Two live callers navigate to it — [`OrgSelector`](../apps/web/src/containers/OrgSelector/index.tsx)
and the `UpgradeSpotlight` on `/events` — and both mean *upgrade your plan*. What rendered was
*"You're in guest mode. Create a free account to save your check-ins"*, with a **"Continue as
guest instead"** button and a sign-up form whose submit was a one-second `setTimeout` standing in
for an API call that was never wired.

Replaced with the plan screen its callers assume: current `plan` from `/me/context`, and an
honest statement that billing is not wired up (D15 defers Stripe) rather than a button that does
nothing. Tier limits are deliberately not restated — `authz/plans.ts` owns those numbers.

### T6 only passed against a pristine database

The adversarial `beforeAll` never calls `harness.reset()`, and T6 used a hardcoded
`fresh@example.test`. A second run of the suite hit `uq_accounts_email` and the test failed with
a 500 from `GET /me` that had nothing to do with tenancy. Now uniquified like every other
fixture; the suite is idempotent, verified across three consecutive runs.

### `joinAs`'s `label` parameter inferred the role union

`label = role` made `label`'s type the four-role union, so a test naming an actor after what it
proves (`'ambiguous'`) failed to compile. Annotated `label: string`.

---

# Part 6 — Where things stand

| | Before | After |
|---|---|---|
| Unit + structural tests | 68 pass | **68 pass** |
| Integration tests | 136 pass | **105 pass** (31 device tests deleted) |
| Adversarial tenancy | 38 pass / 12 todo / **1 fail** | **39 pass / 12 todo / 0 fail** |
| API operations | 45 | **41** |
| Permissions | 26 | **25** (`device:manage` gone) |
| Tables | 13 | **11** |

`apps/web` and `apps/website` build; `coreservice` and `web` lint clean. Two pre-existing
typecheck errors remain in `Pages/ResetPassword/index.tsx` and
`packages/ui/src/components/login/email-password-form.tsx` — Zod/TanStack Form `StandardSchemaV1`
mismatches, unrelated to this work and confirmed identical on the untouched tree.

### The tests that replaced the deleted ones

Deleting 31 device tests without replacing the claims they made would be a real loss of coverage.
Three took their place:

- **`tenant-context.test.ts` · "the checkin role is the door"** — asserts the door can do
  everything the kiosk needs, cannot touch the event, cannot populate the roll or read the member
  list, and is *strictly narrower than organizer*. That last one is what replaced device-scope
  intersection: the cap is now the role, so it must be at least as tight.
- **T13** — A's door staff cannot check anyone into B's event (404, not 403).
- **T14** — removing a door member ends their access on the next request. This is the revocation
  story: a tablet was revoked by deleting its row, a person by removing their membership, and it
  must take effect immediately.

**T7 was rewritten.** It asserted §7.3's `200 []` for "a guest with no active org" against
`requireTenant`'s `403 not_a_member`, and had been left deliberately red as a recorded product
decision. Both halves of that conflict are now unreachable — no guest tier, and no authenticated
caller is a member of nothing. T6 already covers what a fresh account sees, so T7 now guards the
*ambiguous* case instead: a caller in several organisations must name one, because the dangerous
failure is silence — picking one on their behalf would put another tenant's rows on screen under
a heading naming neither.

---

# Part 7 — Still open

- **`PATCH /me`** — the Account page shows the profile and says, in place, that editing is not
  built. Deferred with the rest of the personal scope.
- **`/me/tickets`, `/me/claim`** — deferred (D26). `claimByVerifiedEmail` is written and unrouted.
- **No email.** `NotificationService` does not exist. Every pass URL is shown on screen; no copy
  anywhere claims an email was sent, including the new nudge.
- **`analytics:read` / `analytics:export`** survive in the matrix with no endpoint behind them,
  and `NAV_ITEMS` is not permission-filtered — so a `checkin` user sees an Analytics link that
  403s. Left as-is; filtering the nav is a small separate change.
- **RLS cutover.** The API still connects as `postgres`, which bypasses RLS. Unchanged by this
  work.
- **`scoped.ts` is gone and golden rule 7 is rewritten.** It had zero importers; all ten services
  filter on `ctx.organizationId` by hand. The rule now describes the code.
