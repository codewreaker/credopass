# Part 2 — UI Forensic Analysis (Mobile + Tablet)

## Capture protocol actually used

Per `00-discovery.md`, no browser-automation tool existed in the repo. With sign-off, [`@playwright/test`](../package.json) was added as a devDependency and Chromium was installed (`bunx playwright install chromium`). The app stack was run locally: `bun start` (root script, runs `apps/web` on `:5001` + `services/core` on `:8080`, connected to the live hosted Supabase Postgres per `00-discovery.md` §4) and `bun nx serve website` (`:4200`). All screenshots are saved under [`/audit/screenshots/<app>/<route-slug>/<viewport>.png`](screenshots/), full-page, using the capture script at `/private/tmp/.../scratchpad/capture2.mjs` (not committed — ephemeral tooling for this session).

**Coverage delivered vs. the original protocol, and why:**

| App | Coverage | Why |
|---|---|---|
| `apps/web` | 9 screens × 4 viewports (36 shots) + 2 substates | Full coverage of every route in `apps/web/src/routes/` (`00-discovery.md` §3) reachable as an authenticated guest, including the command palette overlay. |
| `apps/website` | 1 screen (`Home`) × 4 viewports | Confirmed in `00-discovery.md`/`01-architecture.md` — `apps/website` currently has exactly one page; there is nothing else to capture. |
| `apps/mobile` | **Not captured live.** | No iOS/Android simulator or Expo-web export was available in this session. `01-architecture.md` §5 already establishes what exists in `packages/ui-mobile`/`apps/mobile/src/screens`; critique below for mobile is source-derived only (component structure, theme token values), not pixel-verified. Flagged per the ground rules rather than guessed at. |

**A real bug in the app's own auth flow had to be worked around to reach authenticated screens**, and it's a finding in its own right: `apps/web/src/routes/login.tsx:9` defaults the `manual` search param to `true`, but `useGuestAutoLogin` (`apps/web/src/hooks/index.tsx:91-130`) only attempts anonymous sign-in when `manual` is `false`. Since the root route always redirects to `/login` without setting `manual` (`apps/web/src/routes/index.tsx`), **the documented "silent guest sign-in for first-time visitors" behavior never fires today** — every real visitor lands on the full login form, not an auto-redirect into `/events`. This was confirmed by driving the browser directly (`GET /login` → stays on `/login?manual=true&view=social`, full form rendered, no session created). Forcing `manual=false` did trigger a real `POST https://zzymqzurubgparvpgfvy.supabase.co/auth/v1/signup` (200) and created a session — but even then, the in-app `navigate({ to: '/events' })` call in `useGuestAutoLogin` didn't fire within the same page load, consistent with React 18 `<StrictMode>` (`apps/web/src/main.tsx`) double-invoking the effect in development and the `cancelled` flag in its closure suppressing the post-await navigation on the first (real) invocation. Session persistence itself works fine — navigating to `/events` directly after sign-in loads the authenticated app correctly, which is how the rest of this capture pass was done. **Net effect: the guest-first UX described in the code comments is currently non-functional in this build; every real user today sees the login form.** This is a materially different current-state fact than what `00-discovery.md` assumed from reading the comment alone, and it belongs in `05-user-management-upgrade.md`'s lifecycle analysis, not just here.

## Screens captured

| Slug | Route | Auth state | Screenshots |
|---|---|---|---|
| `website/home` | `apps/website` `/` | Unauthenticated | [mobile-375](screenshots/website/home/mobile-375x812.png) · [mobile-390](screenshots/website/home/mobile-390x844.png) · [tablet-768](screenshots/website/home/tablet-768x1024.png) · [tablet-1024](screenshots/website/home/tablet-1024x768.png) |
| `web/login-manual` | `/login?manual=true` | Unauthenticated (form) | [mobile-375](screenshots/web/login-manual/mobile-375x812.png) · [mobile-390](screenshots/web/login-manual/mobile-390x844.png) · [tablet-768](screenshots/web/login-manual/tablet-768x1024.png) · [tablet-1024](screenshots/web/login-manual/tablet-1024x768.png) + [email-form substate](screenshots/web/login-manual/mobile-390x844-email-form.png) |
| `web/events` | `/events` | Guest (authenticated) | [mobile-375](screenshots/web/events/mobile-375x812.png) · [mobile-390](screenshots/web/events/mobile-390x844.png) · [tablet-768](screenshots/web/events/tablet-768x1024.png) · [tablet-1024](screenshots/web/events/tablet-1024x768.png) + [command palette substate](screenshots/web/events/tablet-1024x768-command-palette.png) |
| `web/event-detail` | `/events/$eventId` (attempted) | Guest | Captured, but see caveat below |
| `web/checkin` | `/checkin` | Guest | [mobile-375](screenshots/web/checkin/mobile-375x812.png) · [tablet-768](screenshots/web/checkin/tablet-768x1024.png) · [tablet-1024](screenshots/web/checkin/tablet-1024x768.png) |
| `web/members` | `/members` | Guest | [mobile-375](screenshots/web/members/mobile-375x812.png) · [tablet-1024](screenshots/web/members/tablet-1024x768.png) |
| `web/organizations` | `/organizations` | Guest | [mobile-375](screenshots/web/organizations/mobile-375x812.png) |
| `web/analytics` | `/analytics` | Guest | [mobile-375](screenshots/web/analytics/mobile-375x812.png) · [tablet-768](screenshots/web/analytics/tablet-768x1024.png) |
| `web/upgrade` | `/upgrade` | Guest | [mobile-375](screenshots/web/upgrade/mobile-375x812.png) |

**Caveat on `event-detail`:** the capture script clicked the first element matching an event-link selector, which turned out to be a status-filter chip ("Ongoing") rather than real navigation into an event detail view — the resulting screenshot is just `/events` with a filter toggled (0 results, since the one seeded event is `scheduled` not `ongoing`). A true event-detail screen was not verified pixel-for-pixel in this pass; flagged rather than guessed at, per the ground rules. `apps/web/src/Pages/Events/EventTicket.tsx` (297 lines, per `01-architecture.md` §7) is presumably the relevant component and should be captured in a follow-up pass with a corrected selector.

## Per-screen forensic breakdown

### `website/home` — **critical finding: severe mobile/tablet vertical layout blowout**

Actual rendered full-page pixel heights (not estimates — measured via `sips` on the captured PNGs):

| Viewport | Width | Rendered height |
|---|---|---|
| Mobile 375×812 | 375px | **12,659px** |
| Mobile 390×844 | 390px | **12,575px** |
| Tablet 768×1024 | 768px | **9,581px** |
| Tablet 1024×768 | 1024px | **8,713px** |

For comparison, a typical single-page marketing site of this content density (hero, feature grid, 2-3 showcase sections, footer — confirmed as the actual content by reading `apps/website/src/pages/Home.tsx`, 745 lines) should render on the order of 4,000-6,000px tall on mobile. At 12,659px, the page is roughly **2-3× taller than its content justifies**, visible directly in the screenshots as long stretches of empty black viewport between sections (e.g. between the hero and the next section in [mobile-375x812.png](screenshots/website/home/mobile-375x812.png)). Source inspection found several `absolute`-positioned decorative blur elements sized with large fixed dimensions (e.g. `apps/website/src/pages/Home.tsx:151-152`: `w-200 h-150`/`w-100 h-100` blur blobs) plus multiple `grid lg:grid-cols-2` sections (lines 387, 419, 448) that may not be collapsing their row height correctly below `lg`. **The exact CSS cause was not isolated in this session** — this needs a focused follow-up (likely a missing `overflow-hidden`/`relative` containment on one of the absolutely-positioned decorative layers, or a `min-h` that doesn't get reset per breakpoint) — but the defect itself is fully verified from real rendered pixels, not speculation.
- **Layout & grid:** desktop-first — sections built with `lg:grid-cols-2`/`grid-cols-3` collapse to a single column on mobile (correct direction), but the collapse leaves large dead vertical gaps rather than tightening spacing (see above).
- **Typography:** hero headline (`Track who actually shows up, not just who signed up`) scales down reasonably at mobile width based on the visible crop, but can't be fully assessed until the height bug is fixed and normal scroll-reading is possible.
- **Component consistency / brand polish:** the visible chrome (nav bar, CTA buttons, badge pill "In Progress 24h for demo purposes only") uses the same lime-on-black theme as the redesigned `apps/web` screens (see token-drift section below) — visually this is the most "funded, professional product" looking surface in the app when content is actually on-screen, undercut entirely by the layout bug.
- **States coverage:** no loading/error/empty state applicable — static marketing content.
- **Component decomposition:** ties to `01-architecture.md` §7 — the entire page is one 745-line file with no `Hero`/`Features`/`Footer` component split, which is very likely part of why the bug is hard to isolate (large single-file layout logic).

### `web/login-manual` (redesigned, kept per git history)

- **Layout & grid:** clean two-column split at wide viewports (illustration + brand copy on the left, form on the right — visible in [tablet-1024x768](screenshots/web/login-manual/tablet-1024x768.png)), collapsing to a single centered column on mobile ([mobile-390x844](screenshots/web/login-manual/mobile-390x844.png)) with the illustration dropped entirely rather than shrunk — a deliberate, sensible mobile simplification, not a "shrunk desktop" pattern.
- **Typography:** clear hierarchy — "Welcome back" headline, muted subtext, button labels all one consistent weight/size scale.
- **Touch ergonomics:** the three stacked actions (GitHub, email, guest) are full-width pill buttons with generous vertical padding — comfortably above a 44pt target based on visual proportion to the 390px-wide viewport.
- **Component consistency:** buttons, spacing, and radius are consistent with the `events`/command-palette surfaces — this and `events` are visually the two most cohesive screens captured.
- **Email-form substate** ([mobile-390x844-email-form.png](screenshots/web/login-manual/mobile-390x844-email-form.png)) correctly swaps to labeled `Email`/`Password` inputs with a "Create account" CTA and "Continue as guest instead" fallback — good state coverage for this screen specifically.
- **Brand & polish:** reads as genuinely "Linear/Stripe-quality," consistent with this being one of the screens the reverted redesign commit (`00-discovery.md` §7) deliberately kept.

### `web/events` (reverted to pre-redesign, but visually close to the kept screens)

- **Layout & grid:** mobile ([375x812](screenshots/web/events/mobile-375x812.png)) stacks a 2×2 quick-action grid, a filter chip row, and a scrollable event list above a fixed bottom tab bar — solid mobile-native pattern. At tablet widths ([768x1024](screenshots/web/events/tablet-768x1024.png)) the layout gains a left icon rail and a right-hand calendar/agenda panel, correctly using the extra width rather than just stretching the mobile column — this is the one screen in the set that reads as genuinely tablet-designed rather than desktop-shrunk-or-mobile-stretched (contrast with `checkin`/`members` below).
- **Visual hierarchy:** "Good morning, Israel" + summary line, then quick actions, then the event list — primary action ("Create Event") is visually obvious within the first screenful at every captured width.
- **Component consistency:** filter chips (`All`/`Scheduled`/`Ongoing`/`Completed`/`Cancelled`) use consistent pill styling with the login screen's buttons.
- **States coverage:** only the populated state was captured (one seeded event). Empty-state ("0 events") and error-state (API unreachable) were not exercised in this pass — flagged as untested, consistent with `01-architecture.md` §6's testing-posture finding.
- **Command palette substate** ([tablet-1024x768-command-palette.png](screenshots/web/events/tablet-1024x768-command-palette.png)): a well-executed `cmdk`-style overlay — grouped "Quick Actions"/"Navigation" sections, keyboard shortcut hints (`⌘E`, `⌘N`, `⌘M`...) matching the shortcuts wired in `apps/web/src/hooks/index.tsx:33-69`, dimmed backdrop. This is the single most polished interaction captured in the whole audit.

### `web/checkin` and `web/members` — **finding: tablet layout is mobile-narrow content stretched into a wider frame, not a tablet-specific design**

- Both screens render an identical narrow single-column layout at 375px, 768px, *and* 1024px — compare [checkin mobile-375x812](screenshots/web/checkin/mobile-375x812.png) to [checkin tablet-1024x768](screenshots/web/checkin/tablet-1024x768.png): the only difference is the icon rail appearing on the left; the content column itself doesn't widen, use a grid, or add a secondary panel, leaving roughly 60% of a 1024px-wide viewport as empty black space to the right of the single event card. This is the inverse of the usual "desktop-shrunk" problem named in the audit brief — here it's **mobile content left un-adapted for the extra tablet width**, and it reads as unfinished rather than intentional (contrast directly with `events`, which does add a calendar panel at the same widths).
- `members` mobile ([mobile-375x812.png](screenshots/web/members/mobile-375x812.png)) has a concrete **responsive breakage**: the stat-card row ("Total Members" / "Total Points" / a third card) is a horizontally overflowing row where the third card is cut off mid-width at the right edge of the viewport with no scroll affordance (no partial-card peek styling, no gradient fade, no dot indicator) — a user has no visual cue this row scrolls. The tablet version ([tablet-1024x768.png](screenshots/web/members/tablet-1024x768.png)) fixes this by laying out all four stat cards in a single row with room to spare, confirming the mobile version is the outlier, not the tablet one.
- **Touch ergonomics:** member list rows (avatar + name + email) have generous vertical padding, comfortably tap-sized; the small checkbox next to each row is the one element on this screen worth a closer look for tap-target size in a live device test — can't be conclusively measured from a screenshot alone.

### `web/organizations` (redesigned, kept)

- Card-based list with a clear "Active" state (green-outlined card, checkmark, "Active" CTA button) vs. "Select" for inactive orgs — good visual hierarchy for the org-switching use case. Plan badges (`Pro`/`Free`/`Starter`) are shown per-org, directly visualizing the `organizations.plan` schema field from `00-discovery.md` §5 — this is the **only screen in the entire captured set that surfaces billing-tier information at all**, which matters directly for `05-user-management-upgrade.md`.
- Member/event counts show as `--` placeholders rather than real numbers or a loading skeleton — an unfinished-looking empty/loading state, not a deliberate design.

### `web/analytics` (reverted to pre-redesign)

- Highest information density of any screen captured: 4 stat tiles with trend deltas, a weekly-activity area chart, and (at tablet width, [tablet-768x1024.png](screenshots/web/analytics/tablet-768x1024.png)) a second donut chart plus two more panel placeholders ("Monthly Overview", "Member Tiers") visible below the fold. Tablet layout correctly reflows to a 2-up card grid and 2-up chart grid — another screen that adapts reasonably well to the wider frame, unlike `checkin`/`members`.
- This is also the screen with the most hardcoded color usage found in source (18 distinct hex/rgba values in `apps/web/src/Pages/Analytics/`, see token-drift table below) — chart color-coding (the red "-3%" delta, green uptrends) is very likely why, and third-party chart libraries (`recharts`) commonly force this — but it's still a measurable drift point.

### `web/upgrade` — **finding: this is not a plan/billing screen**

The `/upgrade` route renders "Create your account — Free forever. No credit card required." with `Email`/`Password` fields, a "Create account" CTA, and "Continue as guest instead" ([mobile-375x812.png](screenshots/web/upgrade/mobile-375x812.png)). **There is no plan comparison, no pricing, no Stripe checkout, and no reference to the `free`/`starter`/`pro`/`enterprise` tiers that already exist in the `organizations.plan` schema column** (`00-discovery.md` §5). Despite its route name and its inclusion in the "kept" redesign screens, this is functionally a guest→registered-account conversion form, not an upgrade-to-paid-plan flow — the naming conflates two different lifecycle events (anonymous→registered, and free→paid). This is the single most important finding for `05-user-management-upgrade.md` and is developed further there.

## Design-token drift report

Quantified via a grep for hardcoded `#hex`/`rgba(...)` literals inside each `Pages/<Domain>` directory (`apps/web/src/Pages/`):

| Page directory | Hardcoded color literals | In "kept redesign" set (per git history, `00-discovery.md` §7)? |
|---|---|---|
| `Login` | 0 | Yes |
| `Upgrade` | 0 | Yes |
| `Organizations` | 0 | Yes |
| `Members` | 0 | No |
| `CheckIn` | 4 | Partially (check-in *selector* only) |
| `Events` | 7 | No |
| `Analytics` | 18 | No |

This correlates cleanly with the git history in `00-discovery.md` §7: the screens the redesign commit explicitly kept (`Login`, `Upgrade`, `Organizations`) have zero hardcoded colors — they're built entirely on theme tokens/Tailwind utility classes. The reverted screens (`Events`, `Analytics`, and `CheckIn` partially) carry hardcoded color literals, concentrated in chart/status-badge code. **This is the drift the audit brief asked to quantify, and it's real and measurable** — 29 total hardcoded color values across three reverted screens, zero across the three kept ones.

Cross-platform token duplication (already established in `01-architecture.md` §5) compounds this: `packages/lib/src/theme/index.tsx` (web/website) and `packages/ui-mobile/src/theme/colors.ts` (mobile) are two independently hand-authored token sources with no shared generation step — not re-verified visually here since mobile wasn't captured live, but the source-level duplication stands regardless of rendering.

## Highest-leverage screens for redesign investment

Ranked by product centrality (per `00-discovery.md`, the core loop is: create an event → members check in → org sees attendance/loyalty analytics) and by how far each screen currently sits from the "kept redesign" quality bar:

1. **`apps/website` Home** — first-touch marketing surface, currently has a severe, easily-demoable layout bug (12,000+px mobile height) undermining an otherwise on-brand design. Highest urgency: this is a correctness fix before it's a design fix.
2. **`/checkin`** — the core transactional screen of the product (per `00-discovery.md`, event check-in is the product's reason for existing) but currently the least tablet-adapted screen captured (§ above). Given check-in is plausibly used on tablets at physical event entrances, this is a real-world mismatch between the product's likely usage context and its current responsive design.
3. **`/upgrade`** — needs to be split into what it actually is (account creation) and what its name promises (plan upgrade); see `05-user-management-upgrade.md` for the product-model implications.
4. **`/analytics`** — highest information density and highest hardcoded-color count; a token cleanup pass here would both fix the drift and be the natural place to introduce a real chart color system (see below).
5. **`/members`** — the mobile stat-card overflow is a quick, high-visibility fix (contained to one row of one screen).

**State-of-the-art reference direction**, mapped to specific screens rather than a generic "make it nicer":
- **Skeleton loading over spinners**, applied to `/organizations`'s `--` member/event-count placeholders and `/events`'s list — the app already has the visual language (dark cards, rounded corners) to make skeletons feel native rather than bolted on.
- **A defined chart color/motion system**, applied to `/analytics` and any future `/upgrade` plan-comparison UI — would directly absorb the 18 hardcoded literals found there into reusable tokens.
- **Tablet-specific layout variants** (not just breakpoint reflow) for `/checkin` and `/members`, following the pattern `/events` and `/analytics` already demonstrate (add a secondary panel / multi-column grid at `md`/`lg` rather than leaving mobile-width content centered in extra space).
- **Bento-grid treatment for `/analytics`** at tablet/desktop width — the four stat tiles + two chart panels are already conceptually bento-shaped; formalizing that (varied tile sizes, consistent gap rhythm) would be a low-effort, high-visual-impact change given the layout primitives are already in place.

---
*Next: `03-tanstack-db-migration.md`.*
