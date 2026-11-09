# CredoPass — forensic reference

**Written 2026-11-08.** What this system actually is, endpoint by endpoint, so the next
reader does not re-derive it. Companion to [`CLAUDE.md`](CLAUDE.md) (conventions) and
[`docs/REBUILD-LOG.md`](docs/REBUILD-LOG.md) (what happened). This file is **facts about the
current code**, with line references. When it disagrees with a plan, the plan is stale.

---

## 1. The model in three concepts

The words *permissions*, *accounts*, *organisation* and *access* get mixed up. There are only
**three** concepts, because permissions and access are not separate from membership — they
**are** membership.

| Concept | Its one job | Rule |
|---|---|---|
| **Account** | **Who you are.** A Google login, identified as `(issuer, subject)`. | Exactly one per human. `accounts` carries no org, no role, no plan — `packages/lib/src/schemas/tables/accounts.ts:21`. It owns nothing and belongs to nothing by existing. |
| **Organisation** | **Who the event is from**, and the container holding its events, attendees and bill. | A hard boundary. A row in another organisation returns **404, not 403**. |
| **Membership** | **Which organisations you may touch, and how much.** The link, carrying a role. | The *only* permission system. There is no other. |

**You do not "have permissions". You have a membership, and it carries a role.**

### What creating an organisation actually does

`services/core/src/services/membership.ts:103-130` — exactly two rows, in one transaction:

1. `organizations` — `name`, `slug`, `plan: 'free'`.
2. `org_memberships` — that account, `role: 'owner'`, `status: 'active'`.

So it is a **completely independent tenant**, not a filtering layer. Its own admins, billing,
people directory and events. It shares **nothing** with the creator's other organisations.
Two rows, but a wall.

### Vocabulary, for the UI

The word "organisation" never reaches an attendee — the invite says "Hosted by **Tom Mensah**".
So:

- On an event or invite, the user-facing word is **"Host"**.
- On admin screens (members, billing, settings), the word is **"Organisation"**.
- A solo user needs neither. They see "Hosted by: <their name>".

### A fourth concept, when it arrives

**Group** — an overseer's view across several organisations. Soft, read-only, holds no data.
**The organisation is the wall; the group is the lens.** Not built. See §7.

---

## 2. The API contract — all 51 endpoints

The API *is* the contract. 51 route declarations across 10 files; the emitted
`services/core/openapi.json` contains exactly 51 operations, so registry and document agree.

Scope totals: **organization 33 · account 9 · public 7 · bearer 2.**

| Method | Path (under `/api/v1/core`) | Scope | Permission | Declared at |
|---|---|---|---|---|
| GET | `/events` | organization | `event:read` | `events.ts:76` |
| GET | `/events/summary` | organization | `event:read` | `events.ts:126` |
| GET | `/events/calendar` | organization | `event:read` | `events.ts:163` |
| GET | `/events/{id}` | organization | `event:read` | `events.ts:201` |
| POST | `/events` | organization | `event:create` | `events.ts:288` |
| PATCH | `/events/{id}` | organization | `event:update` | `events.ts:312` |
| POST | `/events/{id}/cancel` | organization | `event:cancel` | `events.ts:348` |
| DELETE | `/events/{id}` | organization | `event:delete` | `events.ts:389` |
| POST | `/organizations` | account | — | `organizations.ts:106` |
| GET | `/organizations` | account | — | `organizations.ts:142` |
| POST | `/invitations/{token}/accept` | account | — | `organizations.ts:164` |
| GET | `/organizations/{id}` | organization | `org:read` | `organizations.ts:205` ⚠️ |
| PATCH | `/organizations/{id}` | organization | `org:update` | `organizations.ts:226` |
| DELETE | `/organizations/{id}` | organization | `org:delete` | `organizations.ts:267` |
| GET | `/organizations/{id}/members` | organization | `member:read` | `organizations.ts:293` |
| PATCH | `/organizations/{id}/members/{accountId}` | organization | `member:update_role` | `organizations.ts:317` |
| DELETE | `/organizations/{id}/members/{accountId}` | organization | `member:remove` | `organizations.ts:352` |
| GET | `/organizations/{id}/invitations` | organization | `member:invite` | `organizations.ts:383` |
| POST | `/organizations/{id}/invitations` | organization | `member:invite` | `organizations.ts:410` |
| DELETE | `/organizations/{id}/invitations/{invitationId}` | organization | `member:invite` | `organizations.ts:462` |
| GET | `/people` | organization | `person:read` | `people.ts:40` |
| GET | `/people/summary` | organization | `person:read` | `people.ts:83` |
| GET | `/people/{id}` | organization | `person:read` | `people.ts:118` |
| POST | `/people` | organization | `person:create` | `people.ts:186` |
| PATCH | `/people/{id}` | organization | `person:update` | `people.ts:211` |
| DELETE | `/people/{id}` | organization | `person:delete` | `people.ts:264` |
| POST | `/events/{id}/register` | organization | `attendance:record` | `attendance.ts:69` |
| POST | `/events/{id}/check-in` | organization | `attendance:record` | `attendance.ts:116` |
| POST | `/events/{id}/check-out` | organization | `attendance:record` | `attendance.ts:166` |
| GET | `/events/{id}/checkin-state` | organization | `attendance:read` | `attendance.ts:197` |
| POST | `/events/{id}/close` | organization | `event:update` † | `attendance.ts:237` |
| GET | `/analytics/overview` | organization | `analytics:read` | `analytics.ts:101` |
| GET | `/plans` | public | — | `billing.ts:66` |
| PUT | `/organizations/{id}/plan` | organization | `org:billing` | `billing.ts:83` |
| GET | `/me` | account | — | `me.ts:70` |
| GET | `/me/context` | account | — | `me.ts:109` |
| PATCH | `/me` | account | — | `me.ts:177` |
| GET | `/me/tickets` | account | — | `me.ts:259` |
| POST | `/me/tickets/{eventId}/pass` | account | — | `me.ts:313` |
| POST | `/me/claim` | account | — | `me.ts:375` |
| POST | `/media/uploads` | organization | `media:upload` | `media.ts:68` |
| POST | `/media/uploads/{id}/done` | organization | `media:upload` | `media.ts:113` |
| GET | `/media/recent` | organization | `media:read` | `media.ts:147` ⚠️ |
| GET | `/public/events/{id}` | public | — | `public.ts:60` |
| POST | `/public/events/{id}/register` | public | — | `public.ts:82` |
| POST | `/public/events/{id}/check-in` | public | — | `public.ts:138` |
| POST | `/public/events/{id}/resend-pass` | public | — | `public.ts:192` |
| GET | `/p/{token}` | bearer | — | `public.ts:247` |
| POST | `/p/{token}/check-in` | bearer | — | `public.ts:300` |
| GET | `/health` | public | — | `index.ts:76` |
| GET | `/health/ready` | public | — | `index.ts:104` |

Paths are relative to `services/core/src/api/v1/core/`.

⚠️ = declares a permission but carries **no `requirePermission` middleware** (see §4).
† = lives in `attendance.ts` but declares `event:update`, not an attendance permission.

### Two scopes read events, and they must not be confused

- `/events` is **organisation-scoped** — what you host.
- `/me/tickets` is **account-scoped** — what you attend, across every organisation, filtering
  on `people.account_id` alone (`services/core/src/services/tickets.ts:121`).

`tickets.ts:9-18` states the invariant: org-scoped reads filter on `organization_id` and never
look at `account_id`; this file filters on `account_id` and never takes an organisation.
Neither query can be made to produce the other's rows, because neither accepts the other's
parameter. **Attending is not belonging** — nothing on that path reads or writes
`org_memberships`.

### How a route is declared and enforced

1. `services/core/src/http/define-route.ts:40-74` — `defineRoute` registers OpenAPI *and*
   authz in one call. The union at `:40-42` makes `scope: 'organization'` without a
   permission a **compile error**, and a permission on any other scope a compile error.
2. `services/core/src/http/route-registry.ts:80-112` — the boot assertion. A bad declaration
   crashes the service at startup.
3. `services/core/src/middleware/caller.ts:186-194` — `requirePermission`, backed by `can()`
   at `services/core/src/tenancy/context.ts:77`.

### How the tenant is chosen

`services/core/src/middleware/caller.ts:128-180`. Precedence at `:133-134`:
path param, then the `X-Organization-Id` header. **Never body or query.**

| Situation | Result |
|---|---|
| Requested id matches a membership | that org |
| Mismatch, from a path param | **404** `Organization not found.` (`:149`) |
| Mismatch, from the header | **403** `NOT_A_MEMBER` (`:151-154`) |
| No id, exactly one membership | that one (`:156`) |
| No id, zero memberships | **403** `NOT_A_MEMBER` (`:158-162`) |
| No id, several memberships | **400** `ORGANIZATION_REQUIRED` (`:163-167`) |

`TenantContext` is branded by a module-local `unique symbol` (`tenancy/context.ts:18`) so it
cannot be forged; `createTenantContext` (`:55-62`) is the only constructor, and lint blocks
routes from importing it.

### What the published document does and does not say

- **Route `scope` and `permission` are NOT published.** They are destructured off at
  `define-route.ts:63` and never reach `createRoute`. The document has no `x-` extensions and
  no `permission` key. The only authorization signal is the presence of
  `security: [{bearerAuth: []}]` — true on 42 operations, false on 9.
- **The role enum IS published** — from `z.enum(ORG_ROLES)` (`organizations.ts:38`) into the
  `Organization`, `Member` and `Invitation` schemas and three request/response bodies.
- **The 25-value permission enum IS published**, once, in `MeContext.membership.permissions`
  (`me.ts:63`). That one field is how the vocabulary reaches the generated client's
  `Permission` union.
- Inconsistency: `OrgSummary.role` is an open `z.string()` (`me.ts:47`) while `Member.role` is
  the closed enum, so `/me/context` publishes the role as a free string.

`services/core/openapi.json` is a **snapshot**, generated by
`services/core/scripts/export-openapi.ts` (`nx run coreservice:openapi:export`). Never
hand-edit it.

---

## 3. Roles and permissions

### Before (5 roles, 25 permissions)

| Role | Rank | Holds |
|---|---|---|
| `owner` | 4 | everything |
| `admin` | 3 | organizer + `org:update`, `member:invite/update_role/remove`, `person:delete` |
| `organizer` | 2 | checkin + `member:read`, event CRUD, `series:manage`, `person:create/update`, `attendance:amend`, analytics, `media:upload` |
| `checkin` | 1 | `org:read`, `event:read`, `person:read`, `attendance:read`, **`attendance:record`**, `media:read` |
| `viewer` | 1 | `org:read`, `member:read`, `event:read`, `person:read`, `attendance:read`, **`analytics:read`**, `media:read` |

### The cross-over, located exactly

**`viewer` and `checkin` were the cross-over.** Both rank 1, and **neither contained the
other** — viewer had `member:read` + `analytics:read` that checkin lacked; checkin had
`attendance:record` that viewer lacked. Two near-duplicates differing on one axis each.

That non-containment was the *sole* reason `ROLE_PERMISSIONS` was hand-written rather than
derived. The old comment said so: "`viewer` is a separate read-only branch, which is why this
is written out rather than derived by inheritance." Removing `viewer` makes the roles a strict
total order, so the matrix is **derived** and the hand-maintained duplication is gone. That,
not the role count, was the real simplification.

### After (4 assignable roles)

| Role | Does | Kept because |
|---|---|---|
| `owner` | Everything, incl. billing and deleting the org | `MembershipService` depends on a top role for "an admin may not change an owner" and "never remove the last owner" |
| `admin` | Runs the org and its staff, but **cannot** delete it or change billing | A head office appointing a branch head who must not delete the branch or touch the card head office pays for |
| `organizer` | Runs events, manages people, reads analytics. No settings, staff or billing | The everyday operator |
| `checkin` | The door: find a person, record arrival/departure, read the event | A door tablet is a person with this role — there are no device tokens |

`viewer` is **no longer assignable**, but its permission set survives as the internal
read-only projection that legacy rows resolve to, and that a future `group_viewer` will map
onto.

### Permissions with no route behind them

Three of 25 are declared by **no** route, yet are granted to organizer-and-above and shipped
to clients in `/me/context`:

- `series:manage` — recurring events are paused; `events.series_id` is always null.
- `attendance:amend`
- `analytics:export`

`docs/archive/API-THIRD-REBUILD.md:295` already noted they "survive in the matrix with no
endpoint behind them". **No test asserts that every permission has a route**, which is why
they persist.

### Permissions that distinguish nothing

Six are held by *every* remaining role, so they effectively mean "any active member":
`org:read`, `event:read`, `person:read`, `attendance:read`, `media:read`, `attendance:record`.
Collapsing them would touch every route declaration, so this is recorded as a finding, not
done.

### The role vocabulary is hand-synced in three places

And `packages/lib/src/schemas/enums.ts:11-16` records that they have drifted once already:

1. `services/core/src/authz/permissions.ts` — `ORG_ROLES`, the reference copy.
2. `packages/lib/src/schemas/tables/enums.ts` — the `org_role` pgEnum (the Postgres type).
3. `packages/lib/src/schemas/enums.ts` — the Zod mirror.

### Row-level rules a permission check cannot express

`permissions.ts` notes these are "row-dependent and cannot be decided from a role alone".
Enforced in `services/core/src/services/membership.ts`:

- You cannot grant a role above your own — `changeRole`, and `inviteMember` on the invite path.
- An admin may not change or remove an **owner**.
- The **last owner** cannot be demoted or removed (`countOwners`).

A permission check is necessary but not sufficient; the service still decides.

---

## 4. Defects found during this audit

### ⚠️ Declared ≠ enforced

`GET /organizations/{id}` (`organizations.ts:205`) and `GET /media/recent` (`media.ts:147`)
declare a permission but carry **no `requirePermission` middleware**. Every other org-scoped
route does. The boot assertion validates the *declaration*, not that the middleware is wired,
so on these two the declaration is decorative.

**Impact today is nil** — both permissions are held by every role, so any member could call
them anyway. **The defect is latent**: tighten either permission later and it still will not
be enforced. The gap exists because nothing tested the link between declaring a permission and
enforcing one. A structural test now does.

### Client-supplied primary keys

`POST /organizations` accepted `id: z.string().uuid().optional()` and passed it to the insert.
A client must not choose server-side identifiers, and a PK collision surfaced as a 500 rather
than a declared response. `POST /events` honours a client UUID too — left in place for now and
recorded here.

---

## 5. What is already built

Most of it. Specifically:

- An account can **already own many organisations**, with a switcher
  (`apps/web/src/containers/OrgSelector/`) and create/rename/delete UI
  (`apps/web/src/Pages/Account/index.tsx`).
- `app.current_org_ids()` (`services/core/drizzle/0001_rls.sql:65-72`) already returns a
  **set**, and every RLS policy compares `organization_id = ANY (…)`. The RLS design is
  therefore already prepared for a caller spanning several organisations — a group membership
  would widen **one function**, not every policy.
- 404-not-403 discipline, with an adversarial suite of **52 declared tests — but only 42
  execute**; the other 10 are `it.todo` stubs (`services/core/src/test/adversarial/`). The
  file headers say stubs name routes that "do not exist yet", which has gone stale: T15
  (analytics scoping), T16 (presigned upload key prefix) and T26 (cross-tenant media asset)
  all name routes that shipped since. Quoting "52 tests" overstates the cover.
- `people.account_id` exists, giving cross-organisation person identity a join key.
- One merged events list (hosted + attending) on `/events`.

### The solo and single-site cases work today

A person hosting a weekly singalong, and a single church running Sunday services with an
invited admin team and door stewards on `checkin`, are both **fully supported**.

The one defect — the auto-provisioned organisation name — was fixed on 2026-11-09.
`defaultOrganizationName(account)` now returns the person's display name verbatim, so a solo
host's events go out as "Israel Agyeman-Prempeh" and the slug follows
(`israel-agyeman-prempeh`). It falls back to `My organization` only when no display name was
asserted, which is what keeps `isGeneratedOrganizationName` and the console's rename prompt
doing a real job rather than being dead code.

---

## 6. Known gaps

| Gap | Where |
|---|---|
| **RLS is inert on the API path** — the API connects as `postgres`, which is `BYPASSRLS`, so the policies never fire. Tenancy rests on the explicit `ctx.organizationId` predicate alone. | `docs/DATABASE-MIGRATION.md` §6 |
| No data migration from the pre-rewrite `users` table | `docs/DATABASE-MIGRATION.md` §5.4 |
| `/analytics` draws a full dashboard from **fabricated** numbers | `services/core/src/services/analytics/` |
| A check-in does not reach other screens — 5s polling shipped, SSE has not | `docs/LIVE-UPDATES.md` |
| **No email exists.** Pass and invitation links must be shown on screen | D18 |
| Account linking — two provider identities for one address get two accounts | decision first |
| Recurring events: built, then **paused** the same day | `docs/RECURRING-EVENTS.md` |
| QR scan check-in reported broken, never reproduced | — |

---

## 7. Staged, not built

Each stage ships on its own and none requires changing the previous stage's data. The rule
that makes this possible:

> **Never add a second scoping dimension to an existing query.** Every new capability arrives
> as new rows in new tables, or as a new read path — never as a new column that every existing
> query must now account for.

| Stage | What | Matters when |
|---|---|---|
| **1** | "Hosted by ▾ / + New…" in the event composer, so a second identity costs one field instead of a trip to Account → Organizations | someone wants a second public identity |
| **2** | Account-scoped `GET /me/events` beside org-scoped `GET /events`, so one list spans every identity. The switcher demotes from a **mode** to a **context** — needed only for members, billing, settings and people | someone has two identities |
| **3** | **The group layer.** `org_groups` + `org_group_memberships`; one migration widening `app.current_org_ids()`; a separate `GroupContext` carrying a *list* while `TenantContext.organizationId` stays singular forever; group roles grant **read** across member orgs, with branch *write* requiring explicit branch membership | a multi-site customer needs rollup reporting and one invoice |
| **4** | **Co-hosting.** `event_organizations` join table — one owning organisation, visible on several. Distinct from the group layer: rollup reporting is *looking*, co-hosting is *doing*. Not blocked by stage 3 | two organisations run an event together |

Stage 2 is the delicate one: it breaks the invariant that every read filters on one
`ctx.organizationId`, which is where tenancy bugs come from. It is test-first, and the
adversarial suite must **grow** with it.

---

## 8. ⚠️ Open investigation — cross-account event visibility

**Reported 2026-11-08. Not reproduced, not explained, not closed.**

Events created on a second person's account (separate phone) became visible on the
maintainer's account after he created a new organisation.

**Audited and found correctly scoped:** `membership.ts` (`createOrganization` 409s on a slug
clash rather than returning the existing row; `listMyOrganizations` joins through
`org_memberships` on the account id), `tickets.ts` (authorises solely on `people.account_id`,
takes no organisation parameter), `me.ts` (`/me/context` maps the caller's memberships only;
`/me/claim` matches on `identities.email_verified`, an issuer-asserted address), and
`requireTenant`. **No org-scoped read path was found that returns another account's
organisation.**

**Hypotheses, ranked, none yet discriminated:**

1. **The same Google account on both phones** — then it is one `accounts` row, one set of
   organisations, and the behaviour is correct. Cheapest to rule out; most likely.
2. **Claim-by-verified-email working as designed.** If the other person put the maintainer's
   email on an attendee row, `POST /me/claim` links that `people` row to his account at
   sign-in, and `/me/tickets` returns the event **across every organisation, by design**.
   Since hosted and attending were merged into one list, those rows now sit beside his own,
   which reads exactly like a leak. Not a tenancy breach — he would see events he is an
   *attendee* of, never her attendee lists, people or analytics.
3. **A genuine scoping leak.** Unsupported by the audit, but not excluded.

### Narrowed 2026-11-09, by implementing two stale stubs

T31 and T33 were `it.todo` stubs even though `/me/tickets` and `/me/claim` had long shipped —
so the two assertions that bear directly on this report were not being made. Both are now
written and **both pass**:

- **T33** — an account holding an **unverified** address matching a `people` row claims
  **nothing** (`claimed: 0`), and its ticket list stays empty. So claiming cannot be used to
  harvest another person's tickets by registering under their address.
- **T31** — `/me/tickets` returns the caller's rows across **every** organisation and nobody
  else's, including a second person registered in an organisation the caller also appears in.

**What this rules out:** the unverified-email variant of hypothesis 2, and a broad
`/me/tickets` leak.

**What it does NOT rule out:** hypothesis 2 proper. The maintainer's Google address *is*
verified, so if his wife entered it on an attendee row, the claim is legitimate, the ticket is
genuinely his, and the product is behaving exactly as designed. That is still the most likely
explanation and it is still not a tenancy breach — it is the product question below.

**The discriminator is still one observation.** On those rows, did the poster pill read
**"Host"**, or **"Going" / "Registered" / "Went"**? `packages/ui/src/components/event-row/index.tsx`
renders it from `relationship`, and `use-merged-events.ts` sets `host` *only* for rows from
the org-scoped `/events`. A Going-type pill means hypothesis 2 and no breach. A **Host** pill
means hypothesis 3 — stop everything and find it.

**If hypothesis 2 is confirmed, a product decision follows:** anyone who types your email into
their attendee list causes their event to appear in your list the moment you sign in. Worth
deciding whether a claimed ticket should be confirmed by the account holder rather than linked
silently at bootstrap.
