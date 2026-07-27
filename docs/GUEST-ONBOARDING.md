# Guest / anonymous onboarding — design recommendation

**Status:** research + recommendation. Nothing here is implemented.
**Date:** 2026-07-27
**Scope:** `/api/v1/core` only. `/api/core` is not touched (it is deleted in Phase 3).
**Companion docs:** [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) (D16, D17) · [`MULTI-TENANCY.md`](MULTI-TENANCY.md) · [`REBUILD-LOG.md`](REBUILD-LOG.md)

---

## 0. Executive summary

**Recommendation: Option D — hybrid.** Browser-local draft first; a Supabase anonymous
user is created only at the moment the visitor asks for durability ("Save this" / "Email
me this link"), never on page load.

Three findings drive it, and each is a change from what a reader of the current docs
would assume:

1. **There is no draft storage anywhere in the product.** [D2](API-FIRST-REBUILD.md)
   deliberately removed event `status`; an event's state is *derived* from timestamps
   ([`events.ts:15-21`](../packages/lib/src/schemas/tables/events.ts#L15-L21)). An
   `events` row is live and world-readable via `/public/events/{id}` the instant it is
   written. So "draft an event as a guest" cannot reuse `events` — it needs a new,
   self-scoped table. This is the single largest piece of work, and it is *independent*
   of which auth option is chosen.

2. **Anonymous sign-in was already built here and then deliberately removed** — on the
   client only. The server half survives intact: `is_anonymous` → `accounts.is_guest`,
   `guestDisplayName()`, and an explicit guest exemption in the tenant middleware. The
   removal note says why, and it names the exact precondition for bringing it back:
   *"Do not reintroduce `signInAnonymously` without an account-linking flow to go with
   it"* ([`auth.ts:11-21`](../packages/lib/src/supabase/auth.ts#L11-L21)).

3. **Supabase preserves the user id across conversion.** An anonymous user who links an
   email or OAuth identity keeps the same `sub`. Because CredoPass keys accounts on
   `(issuer, subject)` and nothing else, *the common upgrade path requires no data
   migration at all* — the `identities` row already points at the right account. Only
   the "signed into a **different**, pre-existing account" case needs a transfer
   mechanism.

**One open security gap found in current code, independent of this feature:**
`POST /organizations` is `scope: 'account'` and has no guest check
([`organizations.ts:90-121`](../services/core/src/api/v1/core/organizations.ts#L90-L121)
→ [`membership.ts:66-86`](../services/core/src/services/membership.ts#L66-L86)). If
anonymous sign-in were switched back on today, a guest could create a real organisation
and become its owner. That directly violates the constraint *"do not create
organisations merely because an anonymous auth user exists."* Fix this **before** any
guest work, not as part of it.

---

## 1. Current-state findings

### 1.1 Authentication flow, end to end

| Step | Where | Behaviour |
|---|---|---|
| Browser gets a token | [`packages/lib/src/supabase/auth.ts`](../packages/lib/src/supabase/auth.ts) | Email+password, email signup, GitHub OAuth, password reset. **No `signInAnonymously`** — removed, with a comment explaining why (L11-21). |
| Token attached | [`apps/web/src/main.tsx:37-40`](../apps/web/src/main.tsx#L37-L40) | `getDeviceToken() ?? getAccessToken()` — a paired tablet's `cpd_…` token wins over any account session. |
| Route guard | [`apps/web/src/lib/auth-guard.ts`](../apps/web/src/lib/auth-guard.ts) | Any Supabase session passes. **Doc comment is stale**: it still describes `useGuestAutoLogin`, which no longer exists (see [`hooks/index.tsx:80-87`](../apps/web/src/hooks/index.tsx#L80-L87)). |
| Token verified | [`middleware/caller.ts:57-110`](../services/core/src/middleware/caller.ts#L57-L110) | `requireCaller`: device-token prefix branch, else issuer-registry JWKS verify → `resolveCaller`. |
| Legacy verifier | [`middleware/auth.ts`](../services/core/src/middleware/auth.ts) | `/api/core` only. `AUTH_DISABLED=true` bypass lives here — **must never be reachable from `/api/v1`**. |
| Identity → account | [`services/identity.ts:102-217`](../services/core/src/services/identity.ts#L102-L217) | `(issuer, subject)` → `identities` → `accounts`. Email is *recorded*, never *identifying* (T47 enforces by grep). |
| Tenant resolution | [`middleware/caller.ts:143-221`](../services/core/src/middleware/caller.ts#L143-L221) | `requireTenant`: `X-Organization-Id` or path param, validated against memberships. Header mismatch → 403; path mismatch → 404. |
| Permission | [`middleware/caller.ts:227-238`](../services/core/src/middleware/caller.ts#L227-L238) | `requirePermission` against the branded `TenantContext`. |

### 1.2 The guest machinery that already exists (server side)

| Artifact | File | What it does today |
|---|---|---|
| `accounts.is_guest` | [`accounts.ts:41`](../packages/lib/src/schemas/tables/accounts.ts#L41) | Boolean column, default false. Comment cites D16. |
| `accounts.email` nullable | [`accounts.ts:31`](../packages/lib/src/schemas/tables/accounts.ts#L31) | Partial case-insensitive unique index; several guests may share `NULL`. |
| `is_anonymous` → `isGuest` | [`identity.ts:105`](../services/core/src/services/identity.ts#L105) | Read straight off the JWT claims. |
| `guestDisplayName()` | [`identity.ts:85-91`](../services/core/src/services/identity.ts#L85-L91) | Deterministic `Guest 4821` label derived from `sub`. |
| Guest exemption from auto-org | [`caller.ts:92`](../services/core/src/middleware/caller.ts#L92) | `if (caller.memberships.length === 0 && !caller.isGuest)` — a guest is **not** given a default organisation. This is D16, enforced. |
| `isGuest` on the wire | [`me.ts:26-32`](../services/core/src/api/v1/core/me.ts#L26-L32) | `/me` and `/me/context` both return it. |
| Web consumes it | [`Onboarding/index.tsx:67-77`](../apps/web/src/Pages/Onboarding/index.tsx#L67-L77) | Suppresses the "Israel's organization" name suggestion for guests. |
| `/upgrade` screen | [`apps/web/src/routes/upgrade.tsx`](../apps/web/src/routes/upgrade.tsx) · [`Pages/Upgrade/index.tsx`](../apps/web/src/Pages/Upgrade/index.tsx) | **Live route, currently unreachable state.** Says "You're in guest mode" and offers "Continue as guest instead" — but nothing can produce a guest session. |
| `claimByVerifiedEmail()` | [`identity.ts:265-300`](../services/core/src/services/identity.ts#L265-L300) | Implemented and unit-tested; **has no route**. Tests T33/T34 are `it.todo` ([`attendee-scope.test.ts:105-119`](../services/core/src/test/adversarial/attendee-scope.test.ts#L105-L119)). |

### 1.3 Every place that assumes an authenticated user is a *permanent* user

Ranked by severity if anonymous sign-in were re-enabled today.

| # | Location | Assumption | Consequence |
|---|---|---|---|
| **1** | [`organizations.ts:90`](../services/core/src/api/v1/core/organizations.ts#L90) `POST /organizations` (`scope: 'account'`) → [`membership.ts:66`](../services/core/src/services/membership.ts#L66) `createOrganization` | Any caller with an account may own an org | **A guest becomes an org owner.** Violates the stated constraint. Also mints an unrecoverable tenant: cleared storage = orphan org with no owner who can be contacted. |
| **2** | [`organizations.ts:148`](../services/core/src/api/v1/core/organizations.ts#L148) `POST /invitations/{token}/accept` (`scope: 'account'`) | Whoever holds the token is a real person | A guest accepts a staff invitation and gains a real role in a real tenant, with no verified email behind it. |
| **3** | [`membership.ts:146-156`](../services/core/src/services/membership.ts#L146-L156) `assertCanOwnAnother` + [`plans.ts:23-30`](../services/core/src/authz/plans.ts#L23-L30) | Quota is per *account* | Guest accounts are free and unlimited to mint, so the plan cap is trivially bypassed by making a new browser profile. |
| **4** | [`identity.ts:265`](../services/core/src/services/identity.ts#L265) `claimByVerifiedEmail` | Caller has a verified email | Safe as written (guests have none, so it returns `{claimed:0}`), but it is the *only* thing standing between a guest and other tenants' `people` rows. Do not weaken the `email_verified` gate. |
| **5** | [`auth-guard.ts:7-10`](../apps/web/src/lib/auth-guard.ts#L7-L10) | Any session may enter the private console | Console renders for guests. Currently lands on onboarding (correct per D16), but every screen must tolerate `organizations: []`. |
| **6** | `drizzle/0001_rls.sql` — all policies | `app.current_account_id()` is a real person | Policies key on account id and never consult `is_guest`. A guest account is, to Postgres, a normal account with zero memberships. Correct by accident, not by construction. |
| **7** | [`devices.ts:191`](../services/core/src/api/v1/core/devices.ts#L191) `POST /devices/pair` (`scope: 'public'`) | Pairing code holder is legitimate | Not guest-specific, but note that device pairing is already accountless — guests must not gain a *second* path to it. |

### 1.4 Resources: guest-ownable vs permanent-account-only

| Resource | Table / route | Verdict | Why |
|---|---|---|---|
| Public event page | `GET /public/events/{id}` ([`public.ts:56`](../services/core/src/api/v1/core/public.ts#L56)) | **No identity needed at all** | Already `scope: 'public'`. Signing a browser in to read a poster is pure cost. |
| Event registration | `POST /public/events/{id}/register` | **No identity needed** | D17: returns a durable bearer pass URL. Already solved; do not route this through guest accounts. |
| Pass / ticket | `passes` table, `/p/{token}` | **Bearer, no account** | The URL *is* the credential. |
| **Org draft** | *does not exist* | **Guest-ownable** | Pure text, private, no tenant, no publication. |
| **Event draft** | *does not exist* | **Guest-ownable** | Same. Must **not** be an `events` row (see §1.5). |
| Organisation | `organizations` | **Permanent only** | Creating one mints a tenant, an owner membership and a plan. Unrecoverable if the guest's storage is cleared. |
| Event (real) | `events` | **Permanent only** | Immediately world-readable via `/public/events/{id}`; no draft state exists to hide behind. |
| Invitations | `invitations` | **Permanent only** | Both directions: a guest may neither send nor accept. |
| Passes (issuance) | `passes` | **Permanent only** | Issuance is a tenant act; holding one is not. |
| Attendee data | `people`, `attendance` | **Permanent only** | Other people's PII. Hard line. |
| Device tokens | `device_tokens` | **Permanent only** | A door credential. |
| Staff roles | `org_memberships` | **Permanent only** | Structurally unreachable from guest scope — keep it that way. |
| Uploads | *no route exists yet* | **Guest: none in v1** | Storage lands in Phase 6. Give guests zero upload capability; revisit when there is something to gate. |
| Payments / billing | `org:billing` | **Permanent only** | Not reachable without an org anyway. |
| Analytics / export | `analytics:*` | **Permanent only** | Org-scoped. |

### 1.5 Why a draft cannot be an `events` row

This is the finding that shapes the whole design.

```
packages/lib/src/schemas/tables/events.ts:15
  "Note what is ABSENT: there is no `status` column and no enum for one."
```

[D2](API-FIRST-REBUILD.md) removed the state machine on purpose. Status is derived from
`start_at`/`end_at`/`closed_at`/`cancelled_at`
([`services/event-status.ts`](../services/core/src/services/event-status.ts)). Adding a
`draft` status would reintroduce exactly the stale-state bug D2 killed, and
`event:publish` was removed from the permission vocabulary with an explicit warning
against bringing it back ([`permissions.ts:5-7`](../services/core/src/authz/permissions.ts#L5-L7)).

Consequences:

- An `events` row cannot be private. `loadPublicEvent` reads any event by id with no
  auth ([`public-event.ts:39`](../services/core/src/services/public-event.ts#L39)).
- An `events` row cannot exist without an `organization_id` — it is in `ORG_SCOPED`
  ([`scoped.ts:36-46`](../services/core/src/db/scoped.ts#L36-L46)) and its RLS policy is
  `organization_id = ANY (app.current_org_ids())`.
- A guest has no organisation by design (D16, enforced at
  [`caller.ts:92`](../services/core/src/middleware/caller.ts#L92)).

→ **Guest drafts need a new self-scoped table**, keyed on `account_id`, sitting beside
`accounts` and `identities` rather than inside the tenant model. This is true whether
the guest identity comes from Supabase or from a custom cookie.

### 1.6 RLS: what is actually enforced right now

[`services/core/drizzle/0001_rls.sql`](../services/core/drizzle/0001_rls.sql) is
well-built: `credopass_api` is `NOBYPASSRLS`, `anon`/`authenticated` are revoked, and
`app.current_account_id()` reads a transaction-local GUC.

**But it is currently inert on the API path.** Per [`CLAUDE.md`](../CLAUDE.md): the API
connects as `postgres`, which bypasses RLS, and switching `DATABASE_URL` to
`credopass_api` requires wiring `SET LOCAL app.account_id` per transaction first.

Two implications for this design:

1. Any guest-draft isolation I propose is, until that switch lands, **enforced by layer 1
   only** (`scoped()` / explicit `account_id` predicates). That is the same exposure
   every other table already has, but it should be stated rather than assumed.
2. Because the browser has **no** direct Postgres access at all
   ([`sql/001_revoke_public_data_access.sql`](../services/core/sql/001_revoke_public_data_access.sql),
   applied 2026-07-26), the Supabase `is_anonymous` RLS pattern from the official docs
   **does not apply to CredoPass as written**. Supabase's examples assume PostgREST from
   the browser. Here, the `is_anonymous` claim is consumed by the *API*, and the
   database sees only `app.account_id`. Guest restriction therefore belongs in
   middleware + a `is_guest` predicate in policies, not in `auth.jwt()`.

> Doc correction: [`CLAUDE.md`](../CLAUDE.md) refers to `drizzle/0004_rls_tenancy.sql`.
> The file is `services/core/drizzle/0001_rls.sql`. There is no `0004`.

---

## 2. Supabase Anonymous Sign-Ins — verified behaviour

All from current official docs (fetched 2026-07-27).

| Question | Answer | Source |
|---|---|---|
| Does it create a user? | Yes — a real row in `auth.users`. "It behaves like a permanent user, except the user can't access their account if they sign out, clear browsing data, or use another device." | [auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) |
| Session persistence | Normal Supabase session: access token + refresh token in the client's storage adapter (localStorage in the browser by default). Lost on cleared storage; not portable across devices. | [auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) |
| Postgres role | **`authenticated`** — *not* `anon`. "Profiles created with anonymous sign-ins are also `authenticated`!" (`anon` is the role for the *API key* with no user at all.) | [blog](https://supabase.com/blog/anonymous-sign-ins) |
| JWT claim | `is_anonymous`, a required claim that cannot be removed. Also carries `sub`, `role`, `aal`, `session_id`. | [jwt-fields](https://supabase.com/docs/guides/auth/jwt-fields) |
| RLS distinction | Must be done explicitly, and **restrictively** — policies are permissive (OR-combined) by default, so a non-restrictive guest check is bypassed by any other passing policy. | [auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) |
| Identity linking | `updateUser({ email })` + OTP verify, or `linkIdentity({ provider })` for OAuth. **Manual linking must be enabled** in project auth config (`GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=true` self-hosted). | [identity-linking](https://supabase.com/docs/guides/auth/auth-identity-linking) |
| **Does the user id survive conversion?** | **Yes.** "After they have been converted, the user id remains the same, which means that any data associated with the user's id would be carried over." | [blog](https://supabase.com/blog/anonymous-sign-ins) |
| Conflict with an existing account | `updateUser()` rejects. Supabase's prescribed flow: detect the error → prompt sign-in with existing credentials → **reassign rows from the anonymous user id to the existing user id** → apply a merge/overwrite/ignore policy. Explicitly left to the application. | [auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) |
| Rate limit | IP-based, **30/hour**, token bucket bursting to 30, on `/auth/v1/signup` called without email or phone. ⚠️ *The two docs disagree on customisability*: the anonymous guide says "can be modified in your dashboard", the rate-limits page lists it as not customizable. **Verify in the dashboard before relying on either.** | [rate-limits](https://supabase.com/docs/guides/auth/rate-limits) · [auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) |
| CAPTCHA | "Strongly recommended" — invisible hCaptcha or Cloudflare Turnstile, enabled project-wide in Auth settings. | [auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) |
| Cleanup | **No automatic cleanup.** Manual only: `delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days';` Automatic cleanup is "planned but not yet available". | [auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) |

### 2.1 What this means for CredoPass specifically

**The linking story is unusually good here.** Because `resolveCaller` keys on
`(issuer, subject)` and the `sub` is preserved across conversion:

```
guest signs in anonymously   → sub=A, is_anonymous=true
                             → accounts{id:X, is_guest:true} + identities{iss:supabase, sub:A}

guest links email + verifies → sub=A, is_anonymous=false   ← SAME sub
                             → resolveCaller finds identities{sub:A} → account X
                             → drafts owned by X are untouched
```

The only server change needed for the happy path is **flipping `accounts.is_guest` to
false** when a token arrives with `is_anonymous: false` for an account currently marked
guest. That is roughly six lines in
[`identity.ts:115-122`](../services/core/src/services/identity.ts#L115-L122), where the
identity refresh already runs on every request. No data migration, no draft transfer, no
service-role key.

**The RLS story is different from the docs.** Supabase's `is_anonymous` RLS examples
assume browser→PostgREST. CredoPass revoked that path entirely. So:

- ✅ `is_anonymous` is read by the API in `resolveCaller` — already done.
- ❌ Do **not** add `auth.jwt() ->> 'is_anonymous'` policies. `auth.jwt()` is empty under
  the `credopass_api` role; the API's own GUC is `app.account_id`.
- ✅ Instead: add `app.current_account_is_guest()` (reading `accounts.is_guest` for the
  current account) and use it in a **restrictive** policy on the drafts table and on
  `org_memberships`.

**The gap the removal note named is now closable.** `auth.ts:19` says don't reintroduce
anonymous sign-in "without an account-linking flow". Supabase's `updateUser` /
`linkIdentity` *is* that flow, and the id-preservation property means it costs almost
nothing on our side. The original failure mode — "a guest who built something and
cleared their storage lost it permanently" — is mitigated (not eliminated) by §5.7.

---

## 3. Decision table

| | **A. Supabase anonymous** | **B. Custom guest cookie + guest tables** | **C. Browser-only drafts** | **D. Hybrid (local → anonymous on demand)** |
|---|---|---|---|---|
| **UX** | Seamless; nothing to click. Survives refresh and tab close on the same browser. | Same as A. | Instant, zero latency. Dies with the tab in private mode; no "email me my draft". | Best: instant start, durability offered exactly when the user wants it. |
| **Security / RLS complexity** | Low-**medium**. One new restrictive policy + a `is_guest` helper. Reuses the whole existing `(iss, sub)` → account path. The doc's `auth.jwt()` pattern doesn't apply (§2.1) — must not be copy-pasted. | **High.** A second, parallel identity system: new token format, signing, rotation, revocation, and a `TenantContext`-shaped hole where the branded-type guarantee doesn't reach. Every invariant re-proved from scratch. | **Lowest** — nothing server-side to secure. | Low-medium. Same surface as A, but the surface is only reached by users who asked for it, so the anonymous-user population is a fraction of visitors. |
| **Cross-device** | ❌ Same browser only. | ❌ Same browser only (unless a magic link is bolted on — which is B plus email, i.e. more work than A). | ❌ Same browser only. | ❌ by default; ✅ once a draft is upgraded via emailed claim link (§5.7). |
| **Cleanup burden** | **Two systems**: `auth.users` *and* app rows. No automatic cleanup from Supabase — we own the job. | One system, but we also own token expiry, sweeping, and the orphan cases. | **None.** | Same as A, but the volume swept is far smaller — only intentional saves. |
| **Abuse risk** | Medium. 30/hr/IP + CAPTCHA available out of the box. Row inflation in `auth.users` is the main cost. | Medium-high. We must build the rate limiting and the CAPTCHA integration ourselves; nothing is free. | **Nil** server-side. | **Low.** A bot must complete a real interaction *and* CAPTCHA before it costs us a row. |
| **Implementation effort** | Medium. Re-enable client call, add `requirePermanent`, add drafts table, add linking UI, add sweeper. | **Large.** Everything in A *plus* a whole identity subsystem, and it fights the codebase's "one identity model, `(iss, sub)`" invariant (T47). | Small — but doesn't deliver "preserve the work when they sign up" reliably, which is the actual requirement. | Medium+. A, plus a local-draft store and one promotion step. |
| **Fit for CredoPass** | Good. Slots into `is_guest`, `guestDisplayName`, D16, `/upgrade`. | **Poor.** Directly contradicts D1 and the invariant that `(issuer, subject)` is the only way to identify a caller. Would need its own exemption in `requireCaller`. | Partial. Right for the first 30 seconds, wrong for "keep my work". | **Best.** Uses A's strengths, pays A's costs only for users who convert. |

**Rejecting B outright.** It is not merely more work — it introduces a second answer to
"who is this?", which is precisely what
[`identity.ts:8`](../services/core/src/services/identity.ts#L8) and adversarial test T47
exist to prevent. Every future auth feature (SSO, JIT provisioning, `org_identity_providers`)
would need a "unless it's a guest cookie" branch.

**Rejecting C alone.** It cannot satisfy "preserve that work when they create an
account" across a private-browsing session, a browser crash, or the OAuth redirect
round-trip on iOS Safari (where an ITP-cleared localStorage after a cross-site redirect
is a real, reported failure mode). It is however the right *first* tier — hence D.

---

## 4. Recommended option: D (hybrid)

### 4.1 The three tiers

```
Tier 0  Anonymous visitor, no identity
        · /public/events/{id}, /p/{token}, marketing site
        · already works; changes nothing

Tier 1  Local draft (localStorage / IndexedDB)          ← DEFAULT for every new draft
        · created the moment someone types in the composer
        · no network, no account, no row anywhere
        · capped: 3 drafts, 32 KB each

Tier 2  Server draft, owned by a Supabase anonymous account   ← ON EXPLICIT ACTION ONLY
        · triggered by "Save draft" / "Continue on another device" / "Email me this"
        · CAPTCHA-gated signInAnonymously() → accounts{is_guest:true}
        · draft written to a new `drafts` table, account-scoped, 30-day TTL
        · guest may hold at most 3 server drafts

Tier 3  Permanent account
        · identity linked (same sub) OR signed into an existing account (different sub)
        · drafts become materialisable: org created, event created, published
```

### 4.2 The rule that keeps D16 intact

> **A guest account is created on the first explicit save, never on arrival — and it
> gets a `drafts` row, never an `organizations` row.**

This is a *narrowing* of D16. D16 said a guest account is created lazily "on first write
(i.e. when they create an organisation)". That clause must be retired: creating an
organisation is exactly what a guest must not do (§1.4, and the task's explicit
constraint). D16's *intent* — no account for a mere visitor, no org for a guest — is
preserved and strengthened.

**Proposed D16a**, to be recorded in [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md):

> A guest account is created on the first explicit save of a draft. A guest may own
> `drafts` rows and nothing else. Materialising a draft into an organisation or an event
> requires a permanent account. `/upgrade` performs the conversion by linking an
> identity, which preserves the Supabase `sub` and therefore the account.

---

## 5. Product rules

### 5.1 Guest capability matrix

Adopted from the default, with the revisions marked **[revised]** and justified below.

| Capability | Tier 0 (no identity) | Tier 2 (guest account) | Tier 3 (permanent) |
|---|:--:|:--:|:--:|
| Browse public event page `/public/events/{id}` | ✅ | ✅ | ✅ |
| Register for an event, receive a pass | ✅ | ✅ | ✅ |
| View a pass `/p/{token}` | ✅ | ✅ | ✅ |
| Begin an org/event draft (local) | ✅ **[revised]** | ✅ | ✅ |
| Save a draft to the server | ❌ | ✅ max 3 | ✅ |
| Reach the console shell (`/onboarding`, `/upgrade`) | ❌ | ✅ zero memberships | ✅ |
| Create / claim an organisation | ❌ | ❌ | ✅ |
| Publish an event | ❌ | ❌ | ✅ |
| Accept a staff invitation | ❌ | ❌ **[revised — new]** | ✅ |
| Invite staff / co-hosts | ❌ | ❌ | ✅ |
| Create kiosk / device tokens, pair a device | ❌ | ❌ **[revised — explicit]** | ✅ |
| Issue attendee passes | ❌ | ❌ | ✅ |
| Manage attendees / view `people` | ❌ | ❌ | ✅ |
| Payments / billing | ❌ | ❌ | ✅ (owner) |
| Export data / analytics | ❌ | ❌ | ✅ |
| Upload files | ❌ | ❌ **[revised — zero, not "restricted"]** | ✅ (Phase 6) |
| Access an existing organisation | ❌ | ❌ | per membership |
| `POST /me/claim` (link prior registrations) | ❌ | ❌ **[revised — new]** | ✅ verified email only |

**Revisions and why:**

1. **"Browse public event pages" needs no guest identity.** The default list put it under
   "guest may", implying a guest session. `GET /public/events/{id}` is already
   `scope: 'public'`. Signing a reader in would create an `auth.users` row per poster
   view — the exact abuse vector §6 is trying to close.
2. **"Begin a draft" starts local, not server.** Same reasoning; a keystroke is not
   consent to create an account.
3. **Accepting an invitation is added as an explicit ❌.** It is not in the default list
   but it is a live hole today (§1.3 #2) and is the cheapest privilege escalation
   available: an invitation token in a guest's hands turns into a real role in a real
   tenant.
4. **Device pairing spelled out.** `POST /devices/pair` is `scope: 'public'` by design;
   the matrix should say plainly that a guest gains no additional route to it.
5. **Uploads: zero, not "restricted".** There is no upload route yet. "Restricted
   uploads" would be a capability invented for guests before it exists for anyone.
6. **`POST /me/claim` is permanent-only.** `claimByVerifiedEmail` already requires a
   verified email so a guest gets `{claimed: 0}` — but the route (when built) should
   reject guests with 403 rather than returning a misleading zero.

### 5.2 Permanent account required for

Create/claim an organisation · publish an event · manage attendees and staff · create
device tokens · accept invitations · billing · export · uploads · every
`scope: 'organization'` route. In short: **everything that writes outside the caller's
own `drafts` rows.**

### 5.3 User stories and acceptance criteria

**US-1 — Start without signing up**
> As a visitor who followed a link, I can start composing an event without an account.

- Opening the composer creates **no** network request to `/auth/v1/signup`.
- Typing persists to local storage within 500 ms of the last keystroke.
- Reloading the tab restores the draft.
- `auth.users` row count is unchanged. *(assert in an integration test)*

**US-2 — Save a draft deliberately**
> As a visitor with a draft, I can press "Save draft" and have it survive my browser.

- "Save draft" is the **only** control that triggers `signInAnonymously()`.
- CAPTCHA (invisible) runs before the sign-in call.
- On success: `POST /me/drafts` returns 201; `accounts.is_guest = true`.
- The UI shows the expiry date explicitly: "Saved. Kept until 26 Aug 2026."
- A 4th save attempt returns 409 `draft_limit`; the UI offers to overwrite.

**US-3 — Guest cannot publish**
> As a guest I am told, clearly and before I invest effort, that publishing needs an account.

- The publish control is visible but disabled, labelled "Create a free account to publish".
- `POST /organizations` as a guest → **403 `guest_not_permitted`**, never 500 or 201.
- `POST /events` as a guest → 403 (no memberships → already 403 today; must stay 403 after `requirePermanent` lands, with the clearer code).
- `POST /invitations/{token}/accept` as a guest → 403 `guest_not_permitted`.

**US-4 — Upgrade in place (same person, new credentials)** ← the common path
> As a guest with drafts, I create an account and keep everything.

- `/upgrade` calls `updateUser({ email })` → OTP → `updateUser({ password })`, or `linkIdentity({ provider })`.
- The Supabase `sub` is unchanged. *(assert explicitly in the test)*
- On the next API request, `accounts.is_guest` flips to `false` and `accounts.email` is populated.
- **Zero draft rows are moved.** `drafts.account_id` never changes.
- The user lands back on the draft they were editing.
- `/me/context` now reports `isGuest: false`, and — per the existing
  [`caller.ts:92`](../services/core/src/middleware/caller.ts#L92) rule — the account
  receives its default organisation on that same request.

**US-5 — Sign into an existing account (different person-record, different `sub`)**
> As someone who already has a CredoPass account but drafted something while signed out,
> I choose what happens to that draft.

- `updateUser({ email })` returns a conflict error → the UI does **not** retry.
- Before sign-out, the guest session calls `POST /me/drafts/transfer-token`, receiving a
  single-use, 15-minute, HMAC-signed token bound to `(guest_account_id, draft_ids)`.
- The user signs into their real account. The UI presents: **"Keep the draft you just
  made?" → [Keep it] / [Discard it]**. Default focus on *Keep*.
- *Keep* → `POST /me/drafts/claim {token}` reassigns `drafts.account_id` to the permanent
  account, subject to that account's draft cap, and marks the guest account
  `deletion_requested_at = now()`.
- *Discard* → drafts deleted, guest account marked for deletion.
- **Transfer, never merge.** Merging two JSONB drafts has no correct answer and no UI
  that would make it legible. Explicit choice, transfer semantics.
- The token grants nothing except reassignment of the named draft ids. It cannot read,
  and it cannot touch any other table.

**US-6 — Guests are cleaned up**
> As an operator, guest accounts do not accumulate.

- A daily job deletes guest accounts with no memberships, no drafts touched in 30 days,
  and `last_seen_at` older than 30 days.
- Deletion order is `drafts` → `accounts` (cascades `identities`) → `auth.users`.
- The job emits counts and fails loudly (§6.5).
- Running it twice in a row is a no-op the second time.

### 5.4 Auth / session sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as Visitor
    participant W as Web (apps/web)
    participant L as localStorage
    participant S as Supabase Auth
    participant A as API /api/v1/core
    participant D as Postgres

    Note over U,L: Tier 1 — no identity exists
    U->>W: opens composer, types
    W->>L: debounced save (draft:local:<uuid>)
    Note right of L: no network call · no auth.users row

    Note over U,D: Tier 2 — first EXPLICIT save
    U->>W: clicks "Save draft"
    W->>W: invisible CAPTCHA (Turnstile)
    W->>S: signInAnonymously({ captchaToken })
    S-->>W: JWT { sub: A, is_anonymous: true, role: authenticated }
    W->>A: POST /me/drafts  (Bearer)
    A->>A: requireCaller → resolveCaller(iss, sub=A)
    A->>D: INSERT accounts{is_guest:true} + identities{iss,sub:A}
    A->>D: INSERT drafts{account_id:X, expires_at:+30d}
    A-->>W: 201 { id, expiresAt }
    W->>L: mark local draft as synced
    Note right of A: requireCaller does NOT provision an org<br/>(caller.ts:92 — D16)

    Note over U,D: Tier 3a — upgrade in place (same sub)
    U->>W: /upgrade → enters email
    W->>S: updateUser({ email })
    S-->>U: OTP email
    U->>W: enters OTP
    W->>S: verifyOtp → JWT { sub: A, is_anonymous: false }
    Note right of S: sub UNCHANGED — this is the whole trick
    W->>A: any request (Bearer, new JWT)
    A->>D: identities{sub:A} → account X (already exists)
    A->>D: UPDATE accounts SET is_guest=false, email=… WHERE id=X
    A->>D: ensureDefaultOrganization(X)   ← now allowed
    A-->>W: 200 · drafts still owned by X · nothing moved

    Note over U,D: Tier 3b — signed into a DIFFERENT existing account
    W->>S: updateUser({ email })
    S-->>W: 422 email already registered
    W->>A: POST /me/drafts/transfer-token  (still the guest JWT)
    A-->>W: { token, expiresIn: 900 }
    W->>S: signOut() → signInWithPassword(existing)
    S-->>W: JWT { sub: B, is_anonymous: false }
    W->>U: "Keep the draft you just made?" [Keep] [Discard]
    U->>W: Keep
    W->>A: POST /me/drafts/claim { token }
    A->>D: verify HMAC + single-use; UPDATE drafts SET account_id = accountOf(B)
    A->>D: UPDATE accounts SET deletion_requested_at = now() WHERE id = X
    A-->>W: 200 { claimed: 1 }
```

---

## 6. Lifecycle and abuse controls

### 6.1 When a guest identity is created

**Exactly one trigger:** the user activates a control whose label promises durability
("Save draft", "Continue on another device", "Email me this link"). Never on page load,
never on route entry, never on a keystroke, never on `beforeLoad`.

This is the direct fix for the failure recorded at
[`hooks/index.tsx:80-87`](../apps/web/src/hooks/index.tsx#L80-L87): the removed
`useGuestAutoLogin` "signed every first-time visitor in anonymously before they had
asked for anything."

### 6.2 Session lifetime and refresh

| Setting | Value | Note |
|---|---|---|
| Storage | Supabase default (localStorage) | Do **not** move to a custom cookie — that reintroduces option B's surface. |
| Access token TTL | Project default (1 h) | Unchanged. |
| Refresh | Standard Supabase rotation, `autoRefreshToken: true` | Guests refresh like anyone else. |
| Guest session hard stop | **30 days** since `accounts.last_seen_at` | Enforced by the sweeper, not by token expiry — a stale refresh token whose account was swept resolves to a 401, which the client treats as "your guest session expired". |
| `last_seen_at` update | On any authenticated request, throttled to once per hour per account | The column and index already exist ([`accounts.ts:47,55`](../packages/lib/src/schemas/tables/accounts.ts#L47)). |

### 6.3 Draft TTL and deletion schedule

| Rule | Value |
|---|---|
| Draft TTL | 30 days from `updated_at` (sliding — editing extends it) |
| Warning | UI shows the expiry date at save time and on every open |
| Guest draft cap | **3** |
| Permanent-account draft cap | 25 |
| Draft payload cap | **32 KB** JSONB, enforced by a `CHECK` constraint *and* a Zod max on the route |
| Guest uploads | none in v1 |
| Sweep cadence | daily, 03:00 UTC |
| Grace | drafts deleted at TTL; the guest account is deleted only when it has **no** remaining drafts and no membership |

### 6.4 Rate limits and CAPTCHA placement

| Control | Where | Value |
|---|---|---|
| Supabase anonymous sign-in | `/auth/v1/signup` (no email/phone) | 30/hr/IP, bursts to 30 — **built in**. Confirm in the dashboard whether it is adjustable (docs conflict, §2). |
| CAPTCHA | Supabase Auth settings, project-wide: **Cloudflare Turnstile, invisible** | Runs before `signInAnonymously()`. Note this applies to *all* sign-in endpoints, so the existing email/OAuth flows must pass a `captchaToken` too — a real, easy-to-miss consequence. |
| `POST /me/drafts` | API, per account | 10 writes/hour |
| `POST /me/drafts/transfer-token` | API, per account | 3/hour |
| `POST /me/drafts/claim` | API, per account | 5/hour; token is single-use regardless |
| Guest account creation | API, per IP (defence in depth behind Supabase's own limit) | 10/hour |

### 6.5 Lost sessions — cleared cookies, new device, private browsing

Be honest about this: **a guest draft is not recoverable across devices, full stop.**
This is inherent to every option including B and C, and it is exactly what killed the
first implementation. Mitigations, in order of value:

1. **Say so, at save time.** "Saved to this browser. [Email me a link] to open it
   anywhere." Not a toast — inline, next to the expiry date.
2. **Emailed claim link (recommended, small).** "Email me a link" collects an address,
   sends a URL containing a signed, single-use, 7-day draft-claim token. Opening it on
   any device claims the draft into whatever account signs in there — or into a fresh
   guest account. This is the *only* mechanism that gives cross-device recovery, and it
   reuses the same token machinery as US-5. **It depends on
   [D18](API-FIRST-REBUILD.md) (mail), which does not exist yet.** Until it does, US-5's
   transfer token is in-session only and cross-device recovery is not offered.
3. **Never claim durability the product cannot deliver.** No "your draft is safe" copy.
4. **Private browsing:** detect storage-partitioning failure and stay in Tier 1 with a
   visible "this window won't remember your draft" notice. Do not sign in anonymously in
   a context where the session cannot persist — that is a guaranteed orphan row.

### 6.6 Deletion order

Order matters: deleting `auth.users` first would orphan the app account with no way to
attribute or re-derive it.

```
1. DELETE FROM drafts        WHERE account_id = $X
2. DELETE FROM accounts      WHERE id = $X          -- ON DELETE CASCADE removes identities
3. DELETE FROM auth.users    WHERE id = $sub        -- same database on Supabase
```

Preconditions checked in the same transaction, re-read under lock:
`is_guest = true` **and** no `org_memberships` row **and** no `people.account_id`
reference **and** `last_seen_at < now() - 30 days`.

`people.account_id` is `ON DELETE SET NULL`
([`people.ts:38`](../packages/lib/src/schemas/tables/people.ts#L38)), so a swept guest who had claimed
a ticket loses the link but not the attendance record — correct, and worth a test.

Implementation: a single `pg_cron` job is simplest on Supabase (both schemas, one
transaction). If `pg_cron` is unavailable, an `nx run coreservice:sweep:guests` target
invoked by Cloud Scheduler, using the API's own `credopass_api`-adjacent maintenance
role — **not** the service-role key, and never from a browser.

### 6.7 Metrics and alerts

| Metric | Alert |
|---|---|
| `guest_accounts_created_total` (counter) | > 3× 7-day baseline in 1 h → page |
| `guest_accounts_live` (gauge) | > 10,000 → warn |
| `guest_sweep_deleted_total` / `guest_sweep_errors_total` | any error, or **zero deletions on a day when `guest_accounts_live > 0`** → warn. A silently-failing sweeper is the failure mode that matters. |
| `guest_sweep_last_success_timestamp` | > 48 h stale → page |
| `drafts_live`, `drafts_bytes_total` | > 1 GB → warn |
| `guest_upgrade_total{path=in_place|transfer|discarded}` | the conversion funnel; also the signal that US-5 works |
| `guest_forbidden_total{route}` | a spike on one route means either a UI bug or someone probing |

---

## 7. Proposed schema and RLS changes (conceptual)

### 7.1 New table — `drafts`

Self-scoped, beside `accounts` and `identities`. Deliberately **not** in `ORG_SCOPED`
([`scoped.ts:36`](../services/core/src/db/scoped.ts#L36)) — it has no `organization_id`,
so `scoped(db, ctx)` cannot reach it and no tenant route can accidentally read it.

| Column | Type | Note |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid NOT NULL → `accounts` ON DELETE CASCADE | the only owner |
| `kind` | text enum `('organization','event')` | |
| `payload` | jsonb NOT NULL | `CHECK (pg_column_size(payload) <= 32768)` |
| `title` | text | denormalised for list rendering without parsing JSONB |
| `expires_at` | timestamptz NOT NULL | index — the sweeper's driver |
| `created_at` / `updated_at` | timestamptz | |

Indexes: `(account_id)`, `(expires_at)`.
Validation: the payload is a **partial** shape, never the strict `events` insert schema —
a draft is by definition incomplete. Derive it as `EventInsertSchema.deepPartial()` from
the existing table-generated schema, so golden rule 1 holds.

### 7.2 New column — `accounts.deletion_requested_at`

`timestamptz NULL`. Set when a guest's drafts are transferred away or discarded, so the
sweeper can delete promptly rather than waiting 30 days for a known-dead account.

### 7.3 RLS additions to `0001_rls.sql`'s successor

```sql
-- Is the CURRENT account a guest? SECURITY DEFINER + STABLE, same shape as
-- app.current_org_ids(). Note: NOT auth.jwt()->>'is_anonymous' — the API
-- connects as credopass_api and auth.jwt() is empty there (§1.6).
CREATE FUNCTION app.current_account_is_guest() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((SELECT a.is_guest FROM accounts a
                    WHERE a.id = app.current_account_id()), false);
$$;

-- Self-scoped, like accounts_self / identities_self.
CREATE POLICY drafts_self ON public.drafts FOR ALL TO credopass_api
  USING      (account_id = app.current_account_id())
  WITH CHECK (account_id = app.current_account_id());

-- RESTRICTIVE, and that is the point: permissive policies OR together, so a
-- permissive guest check would be satisfied by org_memberships_tenant alone.
-- This is the same trap the Supabase docs warn about, expressed in our role model.
CREATE POLICY org_memberships_no_guests ON public.org_memberships
  AS RESTRICTIVE FOR INSERT TO credopass_api
  WITH CHECK (NOT app.current_account_is_guest());

CREATE POLICY organizations_no_guest_create ON public.organizations
  AS RESTRICTIVE FOR INSERT TO credopass_api
  WITH CHECK (NOT app.current_account_is_guest());
```

> ⚠️ These policies do nothing until `DATABASE_URL` moves off `postgres` to
> `credopass_api` with `SET LOCAL app.account_id` per transaction (§1.6). Until then,
> layer 1 (`requirePermanent` middleware) is the only enforcement. Ship the middleware
> first and treat the policies as the second layer they are meant to be — never the
> reverse.

### 7.4 New middleware — `requirePermanent`

```ts
// services/core/src/middleware/caller.ts
export const requirePermanent = createMiddleware(async (c, next) => {
  const caller = c.get('caller');
  if (!caller) throw problem.unauthenticated();
  if (caller.isGuest) {
    throw problem.forbidden(
      ProblemCode.GUEST_NOT_PERMITTED,
      'Create a free account to do this.'
    );
  }
  await next();
});
```

Applied to: `POST /organizations`, `POST /invitations/{token}/accept`, `POST /me/claim`,
and — belt and braces — inside `requireTenant` before the membership lookup.

Consider extending `defineRoute` with `allowGuest?: boolean` (default `false` for
`scope: 'account'`), so a new account-scoped route is guest-hostile unless it opts in.
That converts this from a rule someone must remember into the same kind of structural
gate as rules 1 and 4 — and a boot-time assertion can prove every route declared one.

### 7.5 New routes

| Method | Path | Scope | Guest? | Purpose |
|---|---|---|:--:|---|
| GET | `/me/drafts` | account | ✅ | list own drafts |
| POST | `/me/drafts` | account | ✅ | create (409 `draft_limit` past the cap) |
| PATCH | `/me/drafts/{id}` | account | ✅ | update, slides `expires_at` |
| DELETE | `/me/drafts/{id}` | account | ✅ | |
| POST | `/me/drafts/{id}/materialize` | account | ❌ | draft → real org and/or event |
| POST | `/me/drafts/transfer-token` | account | ✅ | mint the single-use transfer token |
| POST | `/me/drafts/claim` | account | ✅ | redeem it |
| POST | `/me/upgrade` | account | ✅ | server half of conversion (already in the plan, §5.1 of the rebuild doc) |
| POST | `/me/claim` | account | ❌ | existing `claimByVerifiedEmail`, currently routeless |

---

## 8. Migration and rollout

### 8.1 Feature flags

| Flag | Where | Controls |
|---|---|---|
| `GUEST_MODE_ENABLED` | API env | **The authoritative one.** When false, `POST /me/drafts*` returns 404 and `signInAnonymously` tokens are accepted but can write nothing. |
| `VITE_GUEST_MODE` | web build | Shows "Save draft" and the guest affordances. Cosmetic only. |
| Supabase "Allow anonymous sign-ins" | project auth settings | The real kill switch — off by default until Stage 3. |

The server flag must gate the write surface independently, so turning the client flag off
never leaves an open endpoint behind it.

### 8.2 Stages

| Stage | Ships | Verified by |
|---|---|---|
| **0 — close the hole** | `requirePermanent` on `POST /organizations` and `POST /invitations/{token}/accept`; `ProblemCode.GUEST_NOT_PERMITTED`. **Independent of everything else; ship it regardless of what product decides.** | New adversarial tests: guest → 403 on both. Existing 47 stay green. |
| **1 — local drafts (Tier 1)** | Composer autosaves to localStorage; draft list; "unsaved, this browser only" copy. No server, no auth change. | `auth.users` count unchanged in an E2E run. |
| **2 — drafts table + routes** | `drafts` table, migration, 5 routes, RLS policies, caps, TTL column. Reachable by **permanent** accounts only. Anonymous sign-in still off. | `nx run coreservice:verify`; new integration tests. |
| **3 — anonymous sign-in, internal** | Turnstile on; anonymous enabled; `GUEST_MODE_ENABLED` true in staging only; `is_guest` flip-on-conversion in `resolveCaller`; `/upgrade` rewired. | Manual walk of US-2/US-4/US-5; assert `sub` unchanged across conversion. |
| **4 — sweeper first** | Cleanup job + metrics + alerts, deployed and **observed working for a week** before public exposure. | Sweeper deletes seeded expired guests; runs twice → no-op. |
| **5 — public** | `GUEST_MODE_ENABLED` in production, ramped 10% → 50% → 100%. | Dashboards from §6.7. |
| **6 — cross-device (optional)** | Emailed claim link. **Blocked on D18 (mail).** | End-to-end: save on phone, open on laptop. |

Stage 4 before stage 5 is the point. Turning guests on before the sweeper is proven is
how `auth.users` grows to a number nobody wants to delete from.

### 8.3 Rollback

| Stage | Rollback |
|---|---|
| 5 | Flip `GUEST_MODE_ENABLED=false`. Existing guests keep their sessions but cannot write; drafts remain readable until TTL. |
| 3-4 | Disable anonymous sign-ins in Supabase. No new guests. Sweep the existing ones. |
| 2 | Drop `drafts`. No other table references it. |
| 0-1 | Ordinary revert. |

No stage requires a data migration to undo, by design — `drafts` is referenced by
nothing, and no existing row's meaning changes.

---

## 9. Security threats and mitigations

| # | Threat | Mitigation |
|---|---|---|
| T-G1 | **Guest creates an organisation** (live today, §1.3 #1) | `requirePermanent` on `POST /organizations` + restrictive RLS. Adversarial test. **Stage 0.** |
| T-G2 | **Guest accepts a staff invitation** and gains a real tenant role (live today) | `requirePermanent` on the accept route. **Stage 0.** |
| T-G3 | Guest reaches an org-scoped route | Already 403 via zero memberships ([`caller.ts:199`](../services/core/src/middleware/caller.ts#L199)); `requirePermanent` inside `requireTenant` makes it structural rather than incidental. |
| T-G4 | **Bot mints millions of `auth.users` rows** | Turnstile + Supabase 30/hr/IP + creation only on explicit action + API per-IP limit + sweeper + the §6.7 alert. |
| T-G5 | **Drafts used as free anonymous storage / illegal-content hosting** | 3 drafts × 32 KB per guest = 96 KB ceiling. No uploads. Drafts are never publicly readable — no URL renders another account's draft. |
| T-G6 | **Transfer-token replay** — attacker replays a claim token to steal a draft | HMAC-signed, single-use (consumed row), 15 min, bound to specific draft ids **and** the issuing guest account. Grants reassignment only; cannot read. |
| T-G7 | **Pre-account-takeover via linking** — attacker anonymously links a victim's email before the victim signs up | Supabase's automatic linking removes unconfirmed identities for exactly this reason ([identity-linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). On our side: `identities.email_verified` gates every claim ([`identity.ts:265`](../services/core/src/services/identity.ts#L265)), and an unverified guest email must never populate `accounts.email`. |
| T-G8 | **Permissive-policy bypass** — a guest check ORs away against another passing policy | All guest-denial policies are `AS RESTRICTIVE`. This is the specific trap the Supabase security note calls out. |
| T-G9 | **Service-role key in the browser** | Never. The sweeper runs server-side only; the browser holds the anon key and `auth.*` calls exclusively — the invariant [`sql/001`](../services/core/sql/001_revoke_public_data_access.sql) established, unchanged. |
| T-G10 | **`AUTH_DISABLED=true` reaching `/api/v1`** | It is wired only into the legacy `/api/core` middleware ([`auth.ts:34`](../services/core/src/middleware/auth.ts#L34)). Add a boot assertion that refuses to start if `AUTH_DISABLED` and `GUEST_MODE_ENABLED` are both true. |
| T-G11 | **Plan-cap evasion** by minting guest accounts | Guests cannot own organisations at all, so the cap is unreachable from guest scope. |
| T-G12 | **Sweeper deletes a converted user's data** | Precondition re-read under lock inside the deleting transaction; `is_guest` must still be true at delete time. A user who converts mid-sweep is skipped. Test this race explicitly. |
| T-G13 | **Orphaned `auth.users`** — app account deleted, Supabase user survives | Fixed deletion order (§6.6) and a reconciliation query in the sweeper: Supabase anonymous users with no matching `identities.subject` older than 24 h are deleted. |
| T-G14 | **Turnstile breaks existing sign-in** | Supabase CAPTCHA is project-wide, not per-endpoint. Every existing `signInWithPassword` / `signUp` / OAuth call must pass a `captchaToken`. Verify on staging before enabling in production — this is the most likely stage-3 regression. |

---

## 10. Unresolved decisions — product owner input needed

1. **Is guest onboarding wanted at all, given D17 already exists?** The attendee journey
   (link → register → pass, no account) is the *high-volume* one and is already designed.
   Guest console onboarding serves organisers who want to try before signing up — a
   smaller, lower-frequency funnel. If the goal is conversion rate on the *organiser*
   funnel, an A/B against a plain "sign up with GitHub" (one click, already built) may
   win outright and cost nothing. **Recommend measuring before building stages 3-5.**
2. **Draft kinds.** Organisation drafts, event drafts, or both? Event-only is materially
   simpler: an org draft is three fields and is arguably better served by "sign up, we'll
   name your org for you", which
   [`defaultOrganizationName`](../services/core/src/services/membership.ts#L159) already
   does.
3. **The transfer choice (US-5).** Recommended: explicit Keep/Discard, default Keep. An
   alternative — always transfer, silently — is fewer clicks but surprises anyone who
   drafted something they did not want attached to their real account.
4. **Draft TTL of 30 days** — matches Supabase's own cleanup example and D16's stated
   mitigation. Should an *upgraded* account's drafts become permanent (no TTL)? Recommend
   yes, capped at 25.
5. **Cross-device recovery.** It is worth real money to users and is blocked on D18
   (mail). Ship stages 1-5 without it, or wait for mail? **Recommend not waiting.**
6. **Rate-limit adjustability.** The two Supabase docs disagree (§2). Someone must check
   the dashboard; if 30/hr/IP is fixed, shared-NAT venues (a church hall on one WAN IP)
   could hit it during a busy sign-up window. Consider whether that is acceptable.
7. **Retire or amend D16.** D16 currently says a guest account is created "on first write
   (i.e. when they create an organisation)". That clause is now wrong. Recommend
   recording **D16a** (§4.2). This needs an explicit decision because D16 is cited in
   four files' comments.
8. **The `/upgrade` screen exists but is unreachable.** If guest mode is declined,
   [`routes/upgrade.tsx`](../apps/web/src/routes/upgrade.tsx) and
   [`Pages/Upgrade/`](../apps/web/src/Pages/Upgrade/) should be deleted rather than left
   as a dead route promising "guest mode".

---

## 11. Follow-up implementation plan

Small, individually testable, individually revertible commits. Stage 0 is independent of
the product decision in §10.1 and should ship regardless.

### Stage 0 — close the existing hole (ship regardless)

| # | Commit | Test |
|---|---|---|
| 0.1 | `feat(authz): add ProblemCode.GUEST_NOT_PERMITTED` | unit |
| 0.2 | `feat(middleware): add requirePermanent` | unit on `isGuest` true/false |
| 0.3 | `fix(api): guests may not create organizations` | adversarial: guest JWT → `POST /organizations` → 403 |
| 0.4 | `fix(api): guests may not accept invitations` | adversarial: guest JWT → accept → 403, no `org_memberships` row written |
| 0.5 | `docs: record D16a; correct the stale useGuestAutoLogin comment in auth-guard.ts` | — |

### Stage 1 — local drafts

| # | Commit | Test |
|---|---|---|
| 1.1 | `feat(web): local draft store (localStorage, 3 × 32 KB, debounced)` | unit on the store |
| 1.2 | `feat(web): composer autosaves and restores a local draft` | E2E: type, reload, draft present |
| 1.3 | `feat(web): draft list on /events with "this browser only" copy` | E2E |
| 1.4 | `test(web): opening the composer issues no auth request` | E2E network assertion |

### Stage 2 — server drafts, permanent accounts only

| # | Commit | Test |
|---|---|---|
| 2.1 | `feat(lib): drafts table + partial draft schemas (derived, not hand-written)` | typecheck |
| 2.2 | `feat(db): migration — drafts, accounts.deletion_requested_at, RLS policies, app.current_account_is_guest()` | `nx run coreservice:db status` |
| 2.3 | `feat(services): DraftService (CRUD, caps, TTL sliding) — no framework imports` | integration, real Postgres |
| 2.4 | `feat(api): /me/drafts CRUD, scope account` | integration + OpenAPI regen |
| 2.5 | `feat(api): POST /me/drafts/{id}/materialize (requirePermanent)` | integration: draft → org + event; guest → 403 |
| 2.6 | `feat(web): sync local drafts to the server when signed in` | E2E |
| 2.7 | `feat(api): POST /me/claim — route for the existing claimByVerifiedEmail` | flips T33/T34 from `it.todo` to green |

### Stage 3 — anonymous sign-in

| # | Commit | Test |
|---|---|---|
| 3.1 | `feat(auth): Turnstile captchaToken on every sign-in call` | staging manual — **T-G14** |
| 3.2 | `feat(auth): reintroduce signInAnonymously behind VITE_GUEST_MODE, explicit action only` | E2E: only "Save draft" triggers it |
| 3.3 | `feat(identity): clear accounts.is_guest when a token arrives with is_anonymous:false` | integration: same `sub`, guest → permanent, drafts unmoved |
| 3.4 | `feat(web): /upgrade calls updateUser/linkIdentity; handles the conflict error` | E2E US-4 and the conflict branch of US-5 |
| 3.5 | `feat(api): POST /me/drafts/transfer-token + /claim (HMAC, single-use, 15 min)` | integration incl. replay → 409, wrong account → 404 |
| 3.6 | `feat(web): Keep / Discard prompt after signing into an existing account` | E2E US-5 |
| 3.7 | `feat(api): GUEST_MODE_ENABLED server flag; boot assertion vs AUTH_DISABLED` | boot test |

### Stage 4 — cleanup and observability (before any public exposure)

| # | Commit | Test |
|---|---|---|
| 4.1 | `feat(ops): guest sweeper — drafts → accounts → auth.users, order enforced` | integration: seeded expired guest deleted; converted-mid-sweep guest skipped (**T-G12**) |
| 4.2 | `feat(ops): reconcile orphaned anonymous auth.users` (**T-G13**) | integration |
| 4.3 | `feat(ops): nx run coreservice:sweep:guests + schedule` | manual |
| 4.4 | `feat(ops): metrics + alerts per §6.7` | dashboard review |
| 4.5 | `test(adversarial): the full guest matrix — every ❌ in §5.1 asserted` | new adversarial file |

### Stage 5 — ramp

| # | Commit |
|---|---|
| 5.1 | `chore: enable GUEST_MODE_ENABLED in production at 10%` |
| 5.2 | ramp to 100% after a week of clean sweeper runs |

### Stage 6 — cross-device (blocked on D18)

| # | Commit |
|---|---|
| 6.1 | `feat(api): emailed draft-claim link (7 day, single-use)` |
| 6.2 | `feat(web): "Email me a link" on the save affordance` |

---

## Sources

- [Anonymous Sign-Ins — Supabase Docs](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Rate Limits — Supabase Docs](https://supabase.com/docs/guides/auth/rate-limits)
- [Identity Linking — Supabase Docs](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [JWT Claims Reference — Supabase Docs](https://supabase.com/docs/guides/auth/jwt-fields)
- [Security of Anonymous Sign-ins — Supabase Troubleshooting](https://supabase.com/docs/guides/troubleshooting/security-of-anonymous-sign-ins-iOrGCL)
- [Supabase Auth now supports Anonymous Sign-ins — Supabase Blog](https://supabase.com/blog/anonymous-sign-ins)
