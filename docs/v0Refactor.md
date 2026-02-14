# CredoPass v0 Refactor - Analysis & Strategy

## Table of Contents
1. [Code Analysis Against Vercel React Best Practices (AGENTS.md)](#code-analysis)
2. [NX Monorepo Vercel Setup Strategy](#monorepo-setup)
3. [UI/UX Redesign Strategy](#redesign-strategy)
4. [Implementation Roadmap](#roadmap)

---

## 1. Code Analysis Against Vercel React Best Practices (AGENTS.md) {#code-analysis}

Reference: https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md

### CRITICAL Findings

#### 1.1 Barrel File Imports (AGENTS.md Rule 2.1)
**Severity:** CRITICAL | **Impact:** Bundle size, initial load time

**Problem:** `lucide-react` icons are imported from the barrel (`import { Icon } from 'lucide-react'`) across all pages and containers. Lucide has 1,500+ icon modules, and barrel imports can cause bundlers to pull in the full icon set.

**Files affected:**
- `apps/web/src/Pages/Home/index.tsx`
- `apps/web/src/Pages/CheckIn/index.tsx`
- `apps/web/src/Pages/Members/index.tsx`
- `apps/web/src/Pages/Analytics/index.tsx`
- `apps/web/src/Pages/Events/index.tsx`
- `apps/web/src/containers/LeftSidebar/index.tsx`
- `apps/web/src/containers/TopNavBar/index.tsx`
- `apps/web/src/containers/RightSidebar/index.tsx`
- `apps/web/src/components/grid-table/index.tsx`

**Fix:** Configure Vite `optimizeDeps.include` for `lucide-react` or switch to direct path imports (`import { Search } from 'lucide-react/icons/search'`). Vite with tree-shaking handles this better than Webpack, but explicit imports are safer.

#### 1.2 No Dynamic Imports for Heavy Libraries (AGENTS.md Rule 2.4)
**Severity:** CRITICAL | **Impact:** Initial bundle, Time to Interactive

**Problem:** Heavy third-party libraries are statically imported at the top of page components:
- `ag-grid-react` + `ag-grid-community` (~400KB) - Members page, Grid Table
- `@fullcalendar/*` (~250KB) - Events/Calendar page
- `recharts` (~180KB) - Analytics page
- `react-grid-layout` (~100KB) - Analytics page
- `html5-qrcode` (~80KB) - CheckIn page

All are loaded upfront even if the user only visits the Home page.

**Fix:** Wrap each in `React.lazy()` + `<Suspense>`:
```tsx
const AgGridReact = React.lazy(() => import('ag-grid-react').then(m => ({ default: m.AgGridReact })))
const FullCalendar = React.lazy(() => import('@fullcalendar/react'))
```

#### 1.3 No Route-Level Code Splitting (AGENTS.md Rule 2.5)
**Severity:** CRITICAL | **Impact:** Initial load, bundle size

**Problem:** `routes.tsx` eagerly imports every page component:
```tsx
import HomePage from './Pages/Home'
import CheckInPage from './Pages/CheckIn'
import MembersPage from './Pages/Members'
// ...all loaded upfront
```

TanStack Router supports `.lazy()` for route definitions, which enables automatic code-splitting.

**Fix:** Convert to lazy route loading:
```tsx
const homeRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
}).lazy(() => import('./Pages/Home').then(d => d.Route))
```

---

### HIGH Findings

#### 1.4 Re-render Optimization Issues (AGENTS.md Rules 5.1-5.12)
**Severity:** HIGH | **Impact:** Runtime performance

**Problems found:**
- **CheckIn page:** `timeRemaining` calculated from `eventStartTime` using `useState` + `setInterval` in `useEffect`. Should derive from a `useMemo` or `useRef` timer pattern instead of triggering state updates every second.
- **Members page `MembershipBadge`:** Creates a new `colorMap` object on every render. Should be a module-level constant.
- **Analytics page:** `layouts` object for react-grid-layout recreated on every render. Should be `useMemo` with stable reference or hoisted to module level.
- **Grid table `getRowId`:** Arrow function created inline - should be stable callback.

#### 1.5 Missing Lazy State Initialization (AGENTS.md Rule 5.10)
**Severity:** HIGH | **Impact:** Unnecessary computation per render

**Problem:** `useEventSessionStore` (Zustand store) creates a default event object in the initial state. If that object creation is expensive or triggers side effects, it runs on every import.

**Fix:** Use lazy initialization: `create(() => ({ ...computeInitialState() }))`

#### 1.6 Members Page Uses `Math.random()` in Renderers (AGENTS.md Rule 6.1)
**Severity:** HIGH | **Impact:** Unstable renders, potential AG Grid re-render loops

**Problem:** Several AG Grid cell renderers use `Math.random()` to generate mock data (attendance rates, contribution amounts). This produces different values on every render, causing AG Grid to think cells changed.

**Files:** `apps/web/src/Pages/Members/index.tsx` - `AttendanceBar`, `StatusBadge` inline renderers

**Fix:** Replace with deterministic hash function based on row data (e.g., `hashCode(member.id) % 100`).

---

### MEDIUM Findings

#### 1.7 Event Listener Re-registration (AGENTS.md Rules 4.1-4.2)
**Severity:** MEDIUM | **Impact:** Minor memory/perf overhead

**Problem:** `TopNavBar` creates a new keyboard event handler function on every render for the search shortcut (Cmd+K). Not wrapped in `useCallback` or using `useRef`.

**Fix:** Use `useCallback` with stable deps, or `useRef` pattern for the handler.

#### 1.8 Static JSX Not Hoisted (AGENTS.md Rule 6.3)
**Severity:** MEDIUM | **Impact:** Unnecessary object allocation

**Problem:** Analytics stat card configuration arrays, chart color configs, and layout breakpoints are defined inside component bodies. These are static and should be module-level constants.

**Files:**
- `apps/web/src/Pages/Analytics/index.tsx` - stat cards, layouts, chart configs
- `apps/web/src/Pages/Home/index.tsx` - feature card data
- `apps/web/src/containers/LeftSidebar/index.tsx` - navigation items

#### 1.9 `"use client"` Directives in Vite SPA (AGENTS.md Context)
**Severity:** LOW | **Impact:** No functional impact, code cleanliness

**Problem:** Several files have `"use client"` at the top. This is a React Server Components directive that has no effect in a Vite SPA (no RSC). It's dead code.

**Files:** Various components in `packages/ui/src/components/`

**Fix:** Remove `"use client"` from all Vite SPA files. Keep only in shared packages if they might be used in an RSC context later.

---

## 2. NX Monorepo Vercel Setup Strategy {#monorepo-setup}

### Current Architecture
```
credopass/
  apps/
    web/          <- Dashboard SPA (Vite + React + TanStack Router) -> Vercel
    website/      <- Marketing site (Vite + React) -> Vercel
  packages/
    lib/          <- Shared schemas, types, theme, utilities
    ui/           <- Shared UI components (shadcn/ui) + Tailwind theme
  services/
    core/         <- Express API server -> Google Cloud Run
```

### Problems Found

| # | Problem | File | Impact |
|---|---------|------|--------|
| 1 | `apps/website/vercel.json` uses fragile `cd ../..` hacks | `apps/website/vercel.json` | Build reliability |
| 2 | `apps/web` missing `nxViteTsPaths()` plugin | `apps/web/vite.config.ts` | Package resolution |
| 3 | Output path mismatch: web -> `dist`, website -> `../../dist/apps/website` | Both vite configs | Vercel can't find output |
| 4 | `apps/web/project.json` uses `{workspaceRoot}/dist` instead of `{projectRoot}/dist` | `apps/web/project.json` | NX caching broken |
| 5 | `apps/website/project.json` has `preview` target outside `targets` object | `apps/website/project.json` | NX config invalid |
| 6 | No `.vercelignore` - Vercel processes `services/`, `docker/`, `tools/` | Root | Slower builds |

### Solution: Independent Deployment from Single Repo

**Principle:** Each app is its own Vercel project. Shared code flows only through `packages/*`. Changing `apps/web` code NEVER triggers `apps/website` rebuild and vice versa.

**Vercel Dashboard Config (per project):**
- Project "credopass-web": Root Directory = `apps/web`, enable "Include source files outside Root Directory"
- Project "credopass-website": Root Directory = `apps/website`, enable "Include source files outside Root Directory"

**Build Pipeline:**
```
Vercel detects change in apps/web/**
  -> cd ../.. (to workspace root)
  -> bun install (installs all workspace deps)
  -> npx nx build web (builds only web + its package deps)
  -> Serves apps/web/dist/
```

### CSS & Tailwind Architecture (Already Well-Structured)

The CSS architecture is clean and does NOT have conflicts:
- **Single source of truth:** `packages/ui/src/styles/globals.css` contains `@import "tailwindcss"`, `@theme inline` block, and all CSS custom properties
- **Both apps import it:** via `@import "@credopass/ui/styles/globals.css"` in their respective `index.css`
- **Tailwind v4 CSS-first:** No `tailwind.config.ts` files needed; config is in the CSS `@theme` block
- **`@source` directive** correctly scans all app files for class detection
- **Vanilla CSS files** in `apps/web` reference CSS custom properties (e.g., `var(--background)`) from the shared theme - this is the correct pattern
- **PostCSS** only configured in `packages/ui`; apps use `@tailwindcss/vite` plugin directly

**Minor CSS improvements:**
- New design tokens added in Phase 3 will go into the shared `globals.css`
- Both apps automatically inherit them

---

## 3. UI/UX Redesign Strategy {#redesign-strategy}

### Design Principles
1. **Premium dark aesthetic** - Rich depth with layered surfaces, not flat black
2. **Lime #d4ff00 as accent hero** - Used sparingly for maximum impact (active states, CTAs, data highlights)
3. **Glass-morphism touches** - Subtle backdrop-blur panels, translucent card surfaces
4. **Micro-interactions** - Smooth state transitions, hover animations, loading skeletons
5. **Information density** - More data visible, less wasted space, better visual hierarchy
6. **Typography excellence** - Inter Variable with refined scale, generous line-height

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(14.7% 0 0)` | App background |
| `--surface-1` | `oklch(17.5% 0.005 250)` | Cards, panels |
| `--surface-2` | `oklch(21% 0.005 250)` | Elevated surfaces |
| `--surface-3` | `oklch(25% 0.005 250)` | Hover states |
| `--border` | `oklch(28% 0.005 250)` | Subtle borders |
| `--border-strong` | `oklch(35% 0.01 250)` | Emphasis borders |
| `--text-primary` | `oklch(96% 0 0)` | Primary text |
| `--text-secondary` | `oklch(65% 0 0)` | Secondary text |
| `--text-tertiary` | `oklch(45% 0 0)` | Muted text |
| `--accent` | `oklch(93.604% 0.22511 121.257)` | Lime #d4ff00 |
| `--accent-muted` | `oklch(93.604% 0.22511 121.257 / 15%)` | Subtle accent bg |
| `--accent-glow` | `0 0 20px oklch(93.604% 0.22511 121.257 / 30%)` | Glow effects |

### Component Upgrade Summary

**Dashboard Shell:**
- Sidebar: Smooth collapse animation, active route indicator with lime bar, org selector
- TopNav: Glassmorphism bar, refined command palette, subtle search animation
- Content area: Subtle gradient mesh background, smooth page transitions

**Data Visualization:**
- Stat cards: Glass-morphism surface, gradient borders, animated number counters
- Charts: Lime-accent data series, refined tooltips, better axis styling
- AG Grid: Custom dark theme, row hover glow, refined header, cell transitions

**Key Flows:**
- Check-in: Premium QR container with animated glow border, success pulse animation
- Member profiles: Better badges, attendance bars with gradient fills
- Calendar: FullCalendar dark theme with lime event indicators

**Marketing Website:**
- Hero: Animated gradient mesh background (CSS-only), floating UI mockup
- Features: Cards with hover-lift and icon transitions
- Pricing: Glass cards with clear tier hierarchy
- Scroll animations: IntersectionObserver-driven reveal

---

## 4. Implementation Roadmap {#roadmap}

### Execution Order
1. **v0Refactor.md** (this document) - Analysis complete
2. **NX/Vercel config fixes** - Build infrastructure (vercel.json, vite configs, project.json, .vercelignore)
3. **Design system globals.css** - Foundation for all visual changes
4. **Dashboard Layout + Sidebar** - Structural shell
5. **Dashboard pages** - Analytics, Members, CheckIn, Events
6. **Marketing website** - Independent app redesign
7. **Code quality** - Lazy routes, dynamic imports, AGENTS.md fixes

### Risk Mitigation
- All changes are visual/structural - no business logic changes
- Existing functionality preserved throughout
- Each phase is independently deployable
- Shared changes go through `packages/*` only

---

## 5. Luma-Inspired UX Overhaul (Phase 2) {#luma-ux}

Reference: https://lu.ma - Analyzed Luma's design patterns for clean, delightful event management UX.

### Changes Implemented

#### 5.1 Command Palette - Complete Rewrite
**Problem:** The command palette was rendered inside a `Dialog` (Base UI), which applied `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` via Tailwind utility classes. CSS `!important` overrides couldn't reliably cancel Tailwind v4's `translate` property (which generates a separate CSS `translate`, not `transform`), causing the palette to stick to the top-left corner.

**Solution:** Bypassed the Dialog entirely for command palette mode. The `ModalPortal` now detects when the content is a `CommandPalette` and renders a standalone overlay with:
- A backdrop (`cmd-overlay-backdrop`) with blur and fade-in animation
- A flex container (`cmd-overlay-container`) using `justify-content: center` and `padding-top: 15vh` for perfect centering
- The palette box (`cmd-overlay-content`) with slide-in animation and proper border/shadow

Regular modals (event forms, sign-in, etc.) still use the Dialog component.

**Files changed:**
- `apps/web/src/components/launcher/index.tsx` - Split rendering: standalone overlay for command palette, Dialog for others
- `apps/web/src/components/launcher/launcher.css` - New `.cmd-overlay-*` classes with animations

#### 5.2 TopNavBar - Plus Button & Declutter
**Problem:** The "New Event" button was a full-width CTA that cluttered the top bar. Luma uses a simple "+" button in their mobile apps.

**Solution:**
- Replaced the "New Event" `<Button>` with a compact lime-accented `+` button that opens the command palette
- The command palette now serves as the central action hub (like Luma's create flow)
- Removed the `Calendar` icon import since it's no longer in the top bar
- Tighter `gap: 0.25rem` between action buttons for a cleaner row

**Files changed:**
- `apps/web/src/containers/TopNavBar/index.tsx` - Plus button replaces New Event
- `apps/web/src/containers/TopNavBar/style.css` - `.topbar-plus-btn` styles with hover glow

#### 5.3 Command Palette Item Spacing
**Problem:** Items appeared to overlap due to `py-2` from the base `CommandItem` stacking with custom `padding: 0.5rem`.

**Solution:**
- Increased item padding to `0.625rem 0.75rem` with `min-height: 2.5rem`
- Added `gap: 0.625rem` between icon and text
- Group headings now uppercase with `0.05em` letter-spacing
- Removed stale `ArrowRight` icon that referenced non-functional `group-data-selected` pattern

**Files changed:**
- `apps/web/src/containers/TopNavBar/Command.tsx` - Removed ArrowRight import and usage
- `apps/web/src/containers/TopNavBar/style.css` - Refined `.command-palette-item` spacing

#### 5.4 Dashboard Home - Personalized Greeting
**Problem:** Generic "Dashboard" heading felt impersonal. Luma greets users warmly.

**Solution:**
- Time-of-day greeting ("Good morning/afternoon/evening, {firstName}")
- Pulls first name from `useEventSessionStore`
- Subtitle changed to "Here's what's happening with your events today."

**Files changed:**
- `apps/web/src/Pages/Home/index.tsx` - Greeting logic with `getGreeting()` helper

#### 5.5 Event Selection - Luma-Quality Cards
**Problem:** Event cards were functional but visually flat. Luma's event cards have clear hierarchy, hover states, and visual polish.

**Solution:**
- Added top accent bar (gradient) on hover
- Event dates formatted with weekday for scannability
- Arrow icon appears on hover as a visual affordance
- Capacity shown as "X spots" instead of "Capacity: X"
- Tighter badge sizing, subtler text hierarchy
- Section heading uses muted style instead of bold

**Files changed:**
- `apps/web/src/Pages/CheckIn/components/EventSelectionView.tsx` - Complete rewrite

#### 5.6 Layout & Spacing Refinements
**Problem:** Page content padding was tight. Luma uses generous whitespace.

**Solution:**
- Increased `page-content` padding from `1.25rem` to `1.5rem 1.75rem`
- Added `.page-transition` animation (fade + subtle translateY)
- Stat cards and chart cards: removed the `::before` gradient bar (was too busy), softened hover shadows
- Reduced border-radius to `0.625rem` for a subtler look

**Files changed:**
- `apps/web/src/Pages/layout.css` - Padding, page-enter animation
- `apps/web/src/Pages/Analytics/style.css` - Cleaner stat/chart card hover states

### Luma UX Principles Applied
| Principle | Implementation |
|-----------|---------------|
| **Warm personalization** | Time-of-day greeting with first name |
| **Central action hub** | "+" button opens command palette instead of scattered CTAs |
| **Clean visual hierarchy** | Muted section headings, clear card structure |
| **Delightful micro-interactions** | Hover accent bars, arrow affordances, slide-in animations |
| **Generous whitespace** | Increased page padding, card spacing, item gaps |
| **Minimal chrome** | Removed busy gradient bars from stat cards, softer shadows |

---

## 6. Luma Deep-Dive UX Overhaul (Phase 3) {#luma-deep-dive}

Reference: 8 Luma screenshots analyzed covering: login, event creation, event detail, event management dashboard, check-in scanner, guest info sheet, event ticket/pass, cancel event modal, and max capacity modal.

### Luma Pattern Analysis

| Screenshot | Key Patterns Extracted |
|-----------|----------------------|
| **Mobile Login** | Floating event card collage, gradient "start here" CTA text, rounded pill auth buttons |
| **Create Event** | Cover image with edit overlay, section-based form (Ticketing, Options), clean date picker |
| **Event Detail (Mobile)** | Large hero image, sparkle "Private Event" badge, action button row (Invite/Blast/Manage/More), "Check In Guests" bar |
| **Check-In Scanner** | Camera viewfinder, "Scan to Check In" header, bottom sheet guest card with avatar/name/email/status/time, large "Check In" CTA |
| **Event Ticket/Pass** | Apple Wallet-style dark card: brand logo + time + date, LOCATION/GUEST/HOST uppercase labels, QR code |
| **Event Management (Desktop)** | Tab navigation (Overview/Guests/Registration/Blasts/Insights/More), 3 action cards (Invite/Blast/Share), event preview card inline, "When & Where" with calendar date icon, social share row |
| **Cancel Event Modal** | Icon + title + description + red warning + toggle + destructive CTA |
| **Max Capacity Modal** | Bottom sheet: icon + title + description + centered input + Save/Remove |

### Changes Implemented

#### 6.1 Events Page -- List/Calendar Toggle with Luma Event Rows
**Pattern source:** Luma Desktop Event Management (Screenshot 7)

**Before:** Events page was calendar-only (FullCalendar).
**After:**
- Added List/Calendar toggle in the header (segmented control)
- Default view is now List mode with Luma-style grouped event rows
- Events grouped by date with day headings
- Each event row has: date icon (month/day like Luma's FEB/2), event name, status badge, time/location/capacity metadata, hover "more" button
- Calendar view preserved as toggle option
- "Create Event" button in header (lime accent)

**New files:**
- `apps/web/src/Pages/Events/EventListView.tsx` -- EventRow, DateIcon, groupEventsByDate
- `apps/web/src/Pages/Events/events.css` -- Full CSS for events page, list view, toggle, rows

**Modified:**
- `apps/web/src/Pages/Events/index.tsx` -- Added viewMode state, header with toggle, conditional rendering

#### 6.2 Check-In QR Display -- "Scan to Check In" Pattern
**Pattern source:** Luma Check-In Scanner (Screenshot 4)

**Before:** QR code in a generic Card with header/footer/actions.
**After:**
- Clean panel layout: "Scan to Check In" header bar with timer
- QR code centered in dedicated body area with white container + shadow
- Helper text below QR: "Attendees scan this code with their phone to check in"
- Action bar at bottom: Refresh (ghost) + Manual Check-In (primary, flex-1)

**Modified:**
- `apps/web/src/Pages/CheckIn/components/QRCodeDisplay.tsx` -- Complete rewrite using custom `.qr-display-*` classes
- `apps/web/src/Pages/CheckIn/style.css` -- Added `.qr-display`, `.qr-code-container`, `.qr-code-inner` styles

#### 6.3 Success Check-In Screen -- Luma Guest Info Sheet
**Pattern source:** Luma Guest Check-In Sheet (Screenshot 4)

**Before:** Full-screen emerald gradient with large icon, decorative blur circles, complex card.
**After:**
- Clean dark overlay with centered card (no distracting gradients)
- Check icon in green ring at top
- Avatar circle with initials
- Guest name prominently displayed
- Data grid: Email / Status ("Going" in green) / Check-In Time
- Event name as subtle label
- Pulse dot with "Returning to scanner..." indicator
- Counter badge in top-right corner

**Modified:**
- `apps/web/src/Pages/CheckIn/SuccessCheckInScreen.tsx` -- Complete rewrite
- `apps/web/src/Pages/CheckIn/style.css` -- `.success-overlay`, `.success-card`, `.success-details` styles

#### 6.4 Check-In Header -- Cleaner Layout
**Before:** Large centered event name with icon/font size mismatch.
**After:**
- Left-aligned: back button + event name/status/location in a compact row
- Live counter in a bordered card on the right (number + icon)
- Added "scheduled" and "ongoing" to status color map

**Modified:**
- `apps/web/src/Pages/CheckIn/components/CheckInHeader.tsx` -- Simplified layout

#### 6.5 Dashboard Home -- Luma Action Cards + Upcoming Events
**Pattern source:** Luma Desktop Overview (Screenshot 7 -- Invite Guests / Send a Blast / Share Event cards)

**Before:** Greeting + Analytics + Tables.
**After:**
- 3-column Luma-style action cards: Create Event, Check-In, Members
  - Each has icon in lime square, label + description
  - Hover: lime border glow
- Upcoming Events section with Luma date-icon cards (month/day icon + event name + time/location)
- Events pulled from TanStack DB, filtered to future non-cancelled, sorted by start time
- Arrow affordance on hover

**New files:**
- `apps/web/src/Pages/Home/home.css` -- Action cards grid, upcoming event cards, date icons

**Modified:**
- `apps/web/src/Pages/Home/index.tsx` -- Action cards, UpcomingEventCard component, event data integration

### Luma Competitive Parity Checklist
| Feature | Luma | CredoPass (After) |
|---------|------|-------------------|
| Event list with date icons | Yes | Yes (EventListView) |
| Calendar view | Yes | Yes (FullCalendar) |
| List/Calendar toggle | Implicit (routes) | Segmented control |
| Action card CTAs | 3 cards on overview | 3 cards on dashboard |
| "Scan to Check In" header | Yes | Yes |
| Guest info on scan | Bottom sheet | Success overlay card |
| Date grouping | By day | By day |
| Status badges | Colored | Colored with status styles |
| Live check-in counter | Yes | Yes (top-right badge) |
| Event creation from dashboard | "Create Event" button | Plus button + command palette + header CTA |
