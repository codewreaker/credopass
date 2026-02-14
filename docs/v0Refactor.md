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
