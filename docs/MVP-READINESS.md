# CredoPass — MVP readiness

> **Forensic snapshot — 25 July 2026.** What actually works, what is a shell, and what stands between
> here and a product a stranger could sign up for and use. Every claim below is anchored to a file so it
> can be re-checked rather than trusted.

**Verdict in one line:** the *product* is close — the attendance loop works end to end — but the
*platform* is not, because there is no tenant isolation. One deployment currently behaves as one shared
workspace. That is the single thing between this and an MVP.

---

## Scorecard

| Domain | State | Notes |
|---|---|---|
| Data model | 🟢 **Solid** | 7 tables, schema-first, types + validators generated. `attendance` is a real record, unique on `(eventId, patronId)`. |
| Event CRUD | 🟢 **Works** | Create/edit/delete verified against the live API this session. |
| Check-in (organiser) | 🟢 **Works** | Kiosk QR display, pass scanning, manual entry, door-tablet maximise mode. |
| Check-in (attendee) | 🟢 **Works** | Public register → pass → optional self check-in, no account required. |
| Public event page | 🟢 **Works** | Token-optional `/api/core/public/*`, correctly isolated to one event id. |
| Design system | 🟢 **Strong** | Two deliberate systems (web/native), consistent visual language. |
| Authentication | 🟡 **Partial** | Supabase JWT verified via JWKS — but identity is never *used* for authorization. |
| **Authorization / tenancy** | 🔴 **Absent** | **No route filters by caller. Every user sees every org's data.** See [MULTI-TENANCY.md](MULTI-TENANCY.md). |
| Row-level security | 🔴 **Disabled in effect** | RLS is on, but policies are `USING (true)` for `anon`. |
| Analytics | 🔴 **Fabricated** | Deterministic fake numbers behind a real contract. |
| Event images | 🔴 **Not built** | Picker is preview-only; no column, no storage. |
| Testing | 🔴 **Nominal** | One 133-line API test file. No web tests. |
| Mobile app | 🟡 **Unknown//stale** | Present and building; not exercised in this review. |

Legend: 🟢 ship-ready · 🟡 works with caveats · 🔴 blocks MVP or is absent

---

## What genuinely works

The core thesis of the product is implemented and verified:

```
organiser creates event → shares link/QR → guest registers (attended=false)
   → guest gets a pass → arrives → checked in (attended=true) → durable attendance row
```

Verified live this session: event create returns 201; `allowSelfCheckIn` round-trips through the public
endpoint; `register` writes `attended=false` and a subsequent `checkin` flips the *same* attendance row to
`attended=true`. That last detail matters — it means the row is an arrival record, not a signup counter,
which is the whole premise.

---

## 🔴 P0 — blocks an MVP

### 1. No tenant isolation
The defining gap. Any authenticated caller receives every row in the database, and a brand-new visitor is
dropped into whichever organisation happens to sort first — which is why every user currently sees the
maintainer's name.

- [`crud-factory.ts`](../services/core/src/util/crud-factory.ts) never reads the caller's identity.
  `organizationId` is an *optional, client-supplied* query filter, not an enforced boundary.
- `jwtPayload` is consumed in exactly **one** place across all routes
  ([`org-memberships.ts:97`](../services/core/src/routes/org-memberships.ts#L97)).
- [`OrgSelector`](../apps/web/src/containers/OrgSelector/index.tsx#L64) auto-selects `organizations[0]`
  from the unfiltered global list.
- `users.id` is `defaultRandom()` with **no link to Supabase `auth.uid()`**, so RLS cannot even be
  expressed today.

**→ Full remediation plan: [MULTI-TENANCY.md](MULTI-TENANCY.md).** Nothing else on this list matters as much.

### 2. RLS is permissive by policy
[`rls_dev_permissive.sql`](../services/core/drizzle/rls_dev_permissive.sql) grants full read/write to
`anon` on all seven tables. The file's own header says "development/demo ONLY" — and the anon key ships in
the client bundle. Anyone with the key can read and write everything.

### 3. Migrations are gitignored and point at production
`**/drizzle/` is ignored (`.gitignore:48`), so migration SQL exists only on the machine that generated it,
while `nx run coreservice:migrate` writes straight to the remote Supabase instance. There is no local
database and no reproducible schema history — a new contributor cannot arrive at the current schema.

### 4. Secrets are committed
`apps/web/.env` and `services/core/.env` are in the working tree with a live database password, Mapbox
token and Vercel tokens. Rotate them and move to untracked local env files before anyone else clones this.

---

## 🟡 P1 — needed before real users, not before a demo

| # | Gap | Where |
|---|---|---|
| 5 | **Analytics are fake.** Real aggregates behind the existing `AnalyticsResponse` contract. | `services/core/src/analytics/` |
| 6 | **Event images unbuilt.** Needs `imageUrl` column, bucket + signed upload, payload plumbing. | `TODO(event-image)` in `event-composer.tsx` |
| 7 | **No test coverage worth the name.** One API file; zero tests on the check-in flow — the thing most expensive to get wrong. | `services/core/src/test/` |
| 8 | **Error surfacing was silently lossy.** Fixed this session, but the pattern (assuming one error shape) may exist elsewhere. | `packages/api-client/src/client.ts` |
| 9 | **Onboarding doesn't exist.** No "create your organisation" first-run path, so a new signup has nowhere of their own to land. | — |
| 10 | **`README.md` overstates the truth**: "CRUD routes gate on `organizationId`". They do not. | `README.md:125` |

---

## Distance to MVP

Defining MVP as *"a stranger signs up, creates their own event, runs a door, and sees only their own
data"*:

| Milestone | Work |
|---|---|
| **M1 — Identity** | Link `users` to `auth.uid()`; derive the caller server-side. |
| **M2 — Scoping** | Enforce org scope in the CRUD factory + real RLS policies. |
| **M3 — Onboarding** | First-run org creation; drop the `organizations[0]` fallback. |
| **M4 — Hygiene** | Rotate secrets, commit migrations, tests around check-in. |

M1–M3 are the MVP. M4 is what makes it safe to invite anyone. The honest summary: **one focused
work-stream — tenancy — separates a working demo from a product**, and the feature surface is already
past MVP. Resist adding features until M1–M3 land; every new screen written against the unscoped model is
a screen that has to be revisited.

---

## Appendix — how to re-verify

```bash
bun start                            # the only supported way to run the stack
nx run web:typecheck                 # currently passes
nx run web:build && nx run website:build && nx run coreservice:build
nx run web:lint                      # 1 pre-existing error (use-public-event.ts:49)
```

One caveat on this document: the mobile app was not exercised, and the analytics and loyalty surfaces were
read rather than run. Everything marked 🟢 above was either executed against the live API this session or
read end to end.
