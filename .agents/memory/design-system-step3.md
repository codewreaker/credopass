---
name: Design System Step 3 — Route Redesign Status
description: Records what was built, what changed, and what remains after the Step 3 redesign pass.
---

## What was done

### Foundation (globals, primitives, routing)
- `packages/ui/src/styles/globals.css`: new tokens `--elevated`, `--primary-subtle`, `--border-interactive`, `--surface-inset` added; dark `--background` deepened to `oklch(0.115 0.008 263)`, `--card` to `oklch(0.165 0.007 262)`, `--muted-foreground` to `oklch(0.62 0.006 263)`, `--radius` changed from `0.625rem` to `0.5rem`.
- `packages/ui/src/components/button.tsx`: `rounded-4xl` → `rounded-lg`, added `duration-150 ease-out` to transition.
- `packages/ui/src/components/input.tsx`: `rounded-4xl` → `rounded-md`, text size `text-sm` (was mixed base/sm).
- `packages/ui/src/components/badge.tsx`: `rounded-3xl` → `rounded-md`, size `text-[11px]`.
- `apps/web/src/routes/__root.tsx`: TanStack Router devtools removed. Conditional auth-route rendering — routes starting with `/login` or `/upgrade` render WITHOUT sidebar/topbar shell.
- `apps/web/src/routes/upgrade.tsx`: New route file.

### Login
- `apps/web/src/Pages/Login/index.tsx`: Full redesign — split layout (brand left panel on desktop, auth form right). No sidebar/shell visible. Standalone full-screen.
- `packages/ui/src/components/login/auth-page.tsx`: Cleaned up — removed duplicate headings, better hierarchy.

### New page
- `apps/web/src/Pages/Upgrade/index.tsx`: New anonymous→registered upgrade screen. Standalone (outside shell), same split layout as login.
- `apps/web/src/routes/upgrade.tsx`: Route registered.

### Layout/shell
- `apps/web/src/Pages/layout.css`: Compact spacing — `page-content` padding `1.25rem 1.5rem` (was `1.5rem 2rem`), header height `3.25rem` (was `3.75rem`), max-width increased to `1200px`.

### Page CSS migrations (CSS → Tailwind)
- `apps/web/src/Pages/Events/index.tsx`: Removed `events.css` import, replaced all `.events-page`, `.events-header*`, `.events-content` CSS classes with Tailwind.
- `apps/web/src/Pages/Events/EventListView.tsx`: Replaced `.event-list*` CSS classes with Tailwind. Removed random SVG empty state.
- `apps/web/src/Pages/Events/EventDetailPage.tsx`: Removed `event-detail.css` import, replaced loading/error CSS classes with Tailwind.
- `apps/web/src/Pages/CheckIn/index.tsx`: Removed `style.css` import, replaced `.checkin-page*`, `.main-grid`, `.right-column` with Tailwind.
- `apps/web/src/Pages/CheckIn/SuccessCheckInScreen.tsx`: Full Tailwind rebuild.
- `apps/web/src/Pages/CheckIn/CheckInSelectorPage.tsx`: NEW page — event card grid for selecting which event to check in for.
- `apps/web/src/routes/checkin/index.tsx`: Fixed to use `CheckInSelectorPage` (was incorrectly using `CheckInPage` which requires `$eventId` param — caused crash).
- `apps/web/src/Pages/Members/index.tsx`: Compact stat cards (`text-xl font-semibold`, smaller icons, `grid grid-cols-2 md:grid-cols-4 gap-3`). Heading `text-xl font-semibold tracking-tight`.
- `apps/web/src/Pages/Analytics/index.tsx`: Removed `style.css` import, replaced `.page-header`, `.page-subtitle` with Tailwind.
- `apps/web/src/Pages/Organizations/index.tsx`: Removed `style.css` import, replaced all `.org-*`, `.stat-item`, `.header-icon-wrapper` with Tailwind.

## Remaining CSS files (not yet deleted, can be deleted after verification)
- `apps/web/src/Pages/Events/events.css` — no longer imported
- `apps/web/src/Pages/Events/event-detail.css` — no longer imported
- `apps/web/src/Pages/CheckIn/style.css` — no longer imported
- `apps/web/src/Pages/Analytics/style.css` — no longer imported
- `apps/web/src/Pages/Organizations/style.css` — no longer imported

## Still uses CSS imports (low priority, not blocking)
- `apps/web/src/Pages/Events/EventTicket.tsx` — uses `EventTicket.css`
- `apps/web/src/containers/TopNavBar/style.css` — still imported by TopNavBar

## Key decisions
- Login renders standalone (outside __root.tsx shell) via `STANDALONE_ROUTES` check on `pathname`.
- Upgrade screen follows the same pattern.
- `/checkin` (index) uses `CheckInSelectorPage`; `/checkin/$eventId` uses `CheckInPage`.
- All page headings: `text-xl font-semibold tracking-tight` — never `font-bold`.
- Stat card numbers: `text-xl font-semibold tabular-nums`.
- Button radius: `rounded-lg` (8px). Input: `rounded-md` (6px). Badge: `rounded-md` (6px). Cards stay `rounded-2xl`.

**Why:** User requested information-dense layout, professional "operator tool" aesthetic (not consumer lifestyle app). Pill shapes removed from buttons/inputs/badges.
