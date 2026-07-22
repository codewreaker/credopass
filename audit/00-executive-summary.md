# Executive Summary — Credopass Forensic Audit

Full detail in [`00-discovery.md`](00-discovery.md), [`01-architecture.md`](01-architecture.md), [`02-ui-forensic.md`](02-ui-forensic.md), [`03-tanstack-db-migration.md`](03-tanstack-db-migration.md), [`04-performance-cost.md`](04-performance-cost.md), [`05-user-management-upgrade.md`](05-user-management-upgrade.md). This page answers one question: **with one quarter of engineering capacity, what's the sequenced plan?**

## Leading with the UI rewrite

The UI is what customers, investors, and every future hire see first, and per `02-ui-forensic.md` it's also where the highest-visibility, fastest-payoff fixes are: a marketing-site layout bug that's currently the first thing any mobile visitor encounters, a core transactional screen (`/checkin`) that hasn't been adapted for the tablet form factor it's most likely used on at real events, and a redesign that's already proven itself on three screens (`login`, `upgrade`, `organizations` — zero hardcoded colors, genuinely "Linear/Stripe-quality") but was reverted everywhere else. This is the fastest way to make the product look and feel like what it's meant to be, and it's sequenced first below.

**One caveat that doesn't change the ordering but does change what "week 1" contains:** `01-architecture.md` §1.5 and `05-user-management-upgrade.md` found that `services/core` has no authentication or organization-scoping at all, and the org-creation form lets anyone set their org to "Enterprise" plan with no payment step. These fixes are cheap (the scaffolding for the auth fix already exists, unused) and are bundled into week 1 alongside the UI work rather than blocking it — see below.

## Sequenced quarter plan

### Weeks 1-3: UI rewrite, plus the cheap fixes that ride along with it

1. **Fix the marketing site's mobile/tablet layout bug** (`apps/website` Home renders 12,000+px tall on mobile, should be ~4-6k) — the single highest-visibility, lowest-effort fix in the whole audit; it's a rendering bug, not a design decision. (`02-ui-forensic.md`)
2. **Redesign the three highest-leverage lagging screens**, per `02-ui-forensic.md`'s ranking: `/checkin` (the core transactional screen — currently the least tablet-adapted of anything captured, despite plausibly being used on tablets at event entrances), `/analytics` (highest hardcoded-color drift — 18 literals — and the natural place to introduce a real chart-color/token system), `/members` (mobile stat-card row overflow with no scroll affordance — small, contained fix). Match the bar already set by `login`/`upgrade`/`organizations`, don't reinvent it.
3. **Fix the broken production build** (`sonner` unresolved import in `apps/web`) — five-minute fix, but it blocks shipping any of the above until it's done, so it's first in the queue mechanically even if not first in importance. (`04-performance-cost.md` §1)
4. **Fix the `manual` default-value bug** in `apps/web/src/routes/login.tsx:9` — the guest-auth UX the login redesign was presumably built around doesn't currently fire at all; this is a one-line fix that makes the redesigned login screen's own intended flow actually work. (`02-ui-forensic.md`, `05-user-management-upgrade.md`)
5. **Add JWT verification + `organizationId` scoping to `services/core`**, and remove the self-service plan dropdown from `OrganizationForm`. Both are wiring against scaffolding that already exists (`requireOrganizationId` in `crud-factory.ts` is built and unused) — cheap enough to absorb into this phase rather than needing its own dedicated weeks, and it closes a live data-exposure gap before the redesigned screens above get more real traffic pointed at them. (`01-architecture.md` §1.5, `05-user-management-upgrade.md`)
6. **Delete the dead `services/core/src/db/schema/` directory**, fix the one existing test (`hostId` → `event_members`), un-comment `ci-api.yml`'s quality gate. (`01-architecture.md` §4, §6)

### Weeks 4-6: Close the two loops that reinforce each other

7. **Write real RLS policies for `organizations` and `org_memberships`**, and add test coverage for the scoping fix shipped in week 1-3 (`01-architecture.md` §6 — zero tests exist anywhere for auth today). Sequenced together deliberately: policies need tests proving they don't leak, and tests need policies to test against. (`03-tanstack-db-migration.md` phase 0)
8. **Turn on real CI caching** (finish the half-wired Nx Cloud setup, or add `actions/cache`) — independent of everything else, pure waste until it's done. (`04-performance-cost.md` §3)
9. **Align the `recharts` version split** (`apps/web`/`packages/ui` on 3.x, `apps/website` on 2.x) — cheap, and pairs naturally with the `/analytics` redesign in week 1-3 touching the same chart code anyway. (`04-performance-cost.md` §1)

### Weeks 7-10: The two things this audit was originally asked about

10. **TanStack DB → Supabase pilot, `organizations` collection only** (`03-tanstack-db-migration.md` phase 1) — now safe to attempt because weeks 4-6 shipped real RLS policies. Keep it small and reversible (feature-flagged per-collection) exactly as scoped in `03`.
11. **Decide and build the real `/upgrade` flow** — split "guest → registered account" (already exists, just needed the week 1-3 auth fix) from "free → paid plan" (doesn't exist at all: no Stripe integration, no pricing UI). This is a product decision as much as an engineering one — flagged in `05-user-management-upgrade.md` for explicit resolution, not assumed.

### Deliberately deferred — not this quarter

- **Full Supabase-adapter migration beyond the `organizations` pilot** (`03` phases 2-3) — the pilot needs a real soak period first, and `attendance` (the highest-value, highest-risk entity) explicitly needs test coverage before it's touched at all.
- **Bundle-size deep optimization** (the 2.1MB `vendor` chunk, `04-performance-cost.md` §1) — real, but lower payoff per unit of effort than the recharts alignment already scheduled; revisit once the build is reliably green.
- **Image/upload pipeline** — no upload feature exists yet to optimize; build it in when avatars/logos are actually scoped, not speculatively now.
- **Full mobile-app (Expo) UI audit** — not captured live this pass (no simulator available, `02-ui-forensic.md`); worth a dedicated follow-up session with proper device/simulator tooling rather than folding into this quarter's web-focused work.
- **Admin/support tooling** (`05-user-management-upgrade.md`) — a real gap, but not urgent until there are real customers generating real support load; worth scoping once the week 1-3 auth fix exists to build it on top of.

## What "done" looks like at the end of this quarter

A product that looks and feels like what it's meant to be on every screen a customer actually sees, on the devices they actually use it on — built on an API that enforces who can see and change what, and a billing model that's either real (Stripe wired up) or honestly absent from the UI rather than half-implied by an editable dropdown. The data-layer migration this audit was originally commissioned to plan gets its first real, low-risk step in weeks 7-10 — sequenced after the visible work, not instead of it.
