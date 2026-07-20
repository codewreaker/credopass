# Part 4 — Performance & Cost-Saving Architecture

## If you do only 3 things

1. **Fix the broken production build** (§1) — `bun nx build web`, the exact command Vercel's `vercel build` step runs (per `apps/web/vercel.json`'s `"framework": "vite"`), fails today with an unresolvable `sonner` import. This isn't a performance finding, it's a "can this even ship" finding, and it belongs at the top of any prioritization.
2. **Enable real CI caching** (§3) — every CI run today does a full `bun install` and full rebuild from zero with no restore step; Nx's local task cache (`nx.json`) never survives past the ephemeral runner it ran on.
3. **Split or dedupe the `recharts` version fork** (§1) — `apps/web`/`packages/ui` are on recharts 3.x while `apps/website` is on 2.x; this is real, measurable duplicate-dependency weight the bundle analysis directly shows.

## 1. Frontend performance

### The production build currently fails

Running `bun nx build web` — the same underlying command CI's `vercel build` step invokes (`ci-web.yml`, `apps/web/vercel.json`) — fails:

```
error: [vite]: Rolldown failed to resolve import "sonner" from
".../apps/web/src/containers/EventForm/index.tsx"
```

`apps/web/src/containers/EventForm/index.tsx:3` does `import { toast } from 'sonner'` directly, but **`sonner` is not a declared dependency of `apps/web/package.json`** — it's only declared in `apps/website/package.json` and `packages/ui/package.json`. In development (`bun start`, i.e. `vite` dev server) this resolves silently because Bun's workspace install makes it reachable somewhere in the dependency tree even though it isn't hoisted to the root `node_modules` (confirmed: `ls node_modules/sonner` at repo root comes up empty). It only breaks under the stricter static resolution a production build performs. `git log` shows the importing line was last touched by commit `3cfc481` — this is a **live, reproducible, currently-broken production build**, not a hypothetical risk. Whether the last successful Vercel deployment predates this regression, or whether Vercel's own build environment happens to resolve `sonner` differently than this local run, could not be determined from static analysis alone — **this needs to be checked directly against the Vercel dashboard's deployment history**, but the underlying bug (an undeclared dependency relied on only by hoisting) is real and will resurface regardless.

### Bundle analysis (from the partial build output before it failed)

The build got far enough to emit chunk sizes before erroring, giving a real (if incomplete — the failed chunk and anything after it in the pipeline may be missing) picture:

| Chunk | Raw size | Gzipped |
|---|---|---|
| `vendor` (catch-all) | **2,143.62 kB** | 582.58 kB |
| `recharts-vendor` | 477.98 kB | 135.40 kB |
| `tanstack-vendor` | 404.28 kB | 113.34 kB |
| `react-vendor` | 272.04 kB | 84.70 kB |
| `index` (app shell) | 183.52 kB | 50.02 kB |
| `ui-vendor` | 28.42 kB | 9.57 kB |
| `analytics` (route) | 25.98 kB | 8.76 kB |
| `members` (route) | 18.21 kB | 6.44 kB |
| `events` (route) | 13.30 kB | 5.67 kB |
| `login` (route) | 11.90 kB | 4.22 kB |
| `organizations` (route) | 8.81 kB | 3.59 kB |
| `checkin` (route) | 6.64 kB | 2.69 kB |
| `upgrade` (route) | 5.33 kB | 1.87 kB |
| *(smaller route/asset chunks)* | — | — |

Vite's own build output flagged this: *"Some chunks are larger than 1000 kB after minification."* The `vendor` chunk alone, at 2.1MB raw / 583KB gzipped, is almost certainly loaded on every first visit regardless of which route the user lands on — for a product whose own UI (`02-ui-forensic.md`) is used at physical event check-in, plausibly over event-venue WiFi or mobile data, a >500KB-gzipped mandatory payload before the app is interactive is a real UX and cost concern, not just a lint warning.

- **Route-level code-splitting is real and working** — contrary to what might be assumed from the absence of any `React.lazy()`/dynamic `import()` calls in `apps/web/src/routes/**` (confirmed: zero matches), the per-route chunks above (`analytics`, `members`, `events`, `login`, `organizations`, `checkin`, `upgrade`) show TanStack Router's own Vite plugin (`@tanstack/router-plugin`, `apps/web/vite.config.ts:6`) is auto-splitting each route file into its own chunk. **Good, this capability is genuinely in use, not just installed.**
- **`recharts` exists in two incompatible major versions across the monorepo**: `apps/website/package.json:20` pins `^2.15.2`, while `apps/web/package.json:33` and `packages/ui/package.json:30` pin `3.8.1`/`^3.8.1`. Because these are different major versions, Bun/npm workspace resolution cannot dedupe them into one shared copy — each app ships its own full copy. The 478KB `recharts-vendor` chunk seen above is `apps/web`'s copy alone; `apps/website` (not captured in this build since it's a separate Vite project) carries a second, separate ~2.x copy. This is exactly the kind of "multiple versions of the same package bundled separately" the audit brief asked to check for, and it's real.
- **`react`/`react-dom` are version-aligned** (`^19.2.1`/`^19.2.7` across root, `apps/web`, `apps/website` — compatible caret ranges resolving to the same major/minor in practice) — not a duplication risk, included here for contrast with the `recharts` split.
- **Render-cost hotspots:** not fully assessed via static analysis — measuring actual unnecessary re-renders requires a running profiler session (React DevTools Profiler) against real interaction, which is out of scope for a static/build-output pass. What *is* visible statically: `packages/ui/src/components/map.tsx` (1,482 lines, `01-architecture.md` §5,§7) and the data-dense `Analytics`/`Members` pages (list- and chart-heavy, `01-architecture.md` §7) are the highest-risk candidates for missing memoization simply by size and data density — flagged for a follow-up profiling pass rather than asserted as confirmed hotspots.

## 2. Backend cost drivers

- **No N+1 query pattern in the CRUD layer itself** — `services/core/src/util/crud-factory.ts` (read in full during Part 3's research) issues one `select` per list/get request with no nested per-row queries; the generic CRUD factory doesn't join across tables. The N+1-shaped cost problem in this app is client-side instead: per `03-tanstack-db-migration.md` §1, every TanStack DB collection fetches its *entire* table with no filtering, so a client rendering (say) `/events` plus `/members` plus `/analytics` in one session issues multiple full-table GETs rather than one scoped, joined query — this is a real over-fetching pattern, just not the classic per-row N+1 shape.
- **Indexes exist and look reasonably matched to actual query patterns** — e.g. `events` has indexes on `organizationId`, `status`, `startTime`, `deletedAt` (`packages/lib/src/schemas/tables/events.ts:39-42`) and `attendance` has indexes on `organizationId`, `eventId`, `patronId`, `attended`, `checkInTime` (`packages/lib/src/schemas/tables/attendance.ts:36-40`) — these line up with the `sortField`/`allowedFilters` actually used in the corresponding route files. **This is undermined by §Part 1/3's finding that the app doesn't currently filter by `organizationId` at all on the client side** — the indexes are ready for scoped queries that aren't being issued yet; fixing the authorization gap (`01-architecture.md` §1.5) will also be what makes these indexes start earning their keep.
- **Over-fetching, quantified by the `00-discovery.md`/`03-tanstack-db-migration.md` finding:** every collection returns full tables unconditionally. At current (apparently low, single-digit-events) data volume this is invisible; it becomes a real, scaling cost driver (both Postgres compute and client payload size) the moment any organization has more than a trivial number of events/attendance records — flagged as a "revisit at scale" item, not urgent today given the actual data volume observed in this session (1 seeded event, per `02-ui-forensic.md`).
- **No image/asset pipeline exists.** No `sharp`, `imagemin`, or equivalent in any `package.json`; images in `apps/web/public/` (`inspo1.png` 56KB, `inspo3.png` 149KB) are served at their native committed size with no responsive-size variants. At current sizes this is a non-issue, but there is currently **no upload/storage capability in `services/core` at all** (grep for `multipart`/`upload`/`storage`: zero matches) — meaning if/when the product adds user avatars or org logos (a natural next feature given `organizations`/`users` already exist), there's no resizing pipeline to build on top of; worth designing in from the start rather than retrofitting.
- **Realtime/subscription cost:** N/A today — confirmed in `03-tanstack-db-migration.md` §1 that zero Supabase Realtime channels are used anywhere in the client code. This becomes a cost dimension only if/when Part 3's Supabase-adapter migration proceeds.

## 3. Infra cost audit

- **CI does a full, uncached install and build on every run.** Both `ci-web.yml` and `ci-api.yml` run `bun install --frozen-lockfile` on a fresh `ubuntu-latest` runner with no `actions/cache` step for Bun's package cache (grep for `actions/cache` across `.github/workflows/*.yml`: zero matches) and no restore of any prior Nx task-cache artifact. Nx's own local caching (`nx.json` targetDefaults, `01-architecture.md` §4) genuinely works *within* a single run, but since each GitHub Actions run starts from a brand-new filesystem, that cache is empty at the start of every run and provides **zero cross-run benefit** as currently configured.
- **`NX_CLOUD_ACCESS_TOKEN` is referenced but Nx Cloud is not actually wired up.** Both workflows set `env: NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}`, which only does anything if `nx.json` also declares an `nxCloudId` (or equivalent) — it doesn't (`grep -n "nxCloudId" nx.json`: zero matches). This reads as an incomplete Nx Cloud setup: the secret plumbing exists, the actual connection to a cloud cache doesn't. **This is the single highest-leverage, lowest-effort infra fix available** — either finish wiring Nx Cloud (their free tier covers small teams) or add a plain `actions/cache` step keyed on `bun.lock` for `~/.bun/install/cache` and Nx's local `.nx/cache` directory; either would turn every CI run from "rebuild everything" into "rebuild what changed."
- **`ci-api.yml`'s quality-checks job is entirely commented out** (`01-architecture.md` §6) — not a cost driver per se, but relevant here because it means the CI minutes currently spent are 100% on build+deploy with zero verification, i.e. the CI minutes being spent aren't buying safety, only shipping speed.
- **Docker image:** `services/core/Dockerfile` is a single-stage (`FROM oven/bun:1.2-alpine`) runtime-only image that copies a pre-built `dist/services/core` from the CI build step rather than building inside Docker (`00-discovery.md` §6) — this is already a reasonably lean, deliberate pattern (small final image, no build toolchain baked in) and doesn't need multi-stage-build changes; the comment/env-var drift noted in `00-discovery.md` §6 (leftover Cloud Run references) is a clarity issue, not a cost one.
- **Scheduled jobs:** the only cron in the repo is `supabase-cron.yml`, a keep-alive hitting `GET /rest/v1/organizations?limit=1` every 6 hours (`00-discovery.md` §6) — negligible cost, correctly scoped (`limit=1`), not a finding.

## Prioritization

| Finding | Impact | Effort | Priority |
|---|---|---|---|
| Broken production build (`sonner` unresolved import) | High — blocks/risks every future deploy | Low — add `sonner` to `apps/web/package.json` dependencies (or route the `EventForm` toast through `@credopass/ui`'s already-exported `Toaster`/toast helper instead of importing `sonner` directly) | **Fix now** |
| No CI cross-run caching (Nx Cloud half-wired or missing `actions/cache`) | Medium-high — every CI run pays full install+build cost | Low-medium | **Fix now** |
| `recharts` version fork across `apps/web`/`packages/ui` (3.x) vs `apps/website` (2.x) | Medium — real duplicated bundle weight | Low-medium (align on one major version; website's chart usage would need a compatibility check) | **Fix now** |
| 2.1MB raw / 583KB gzip `vendor` chunk with no further split | Medium — affects real-world load time at event venues | Medium (needs `manualChunks` tuning beyond what's already configured, or auditing what's landing in the catch-all) | Revisit soon |
| Client-side full-table over-fetching (no `organizationId` scoping) | Low today, high at scale | Tied to the Part 1/3 authorization fix — do it as part of that work, not separately | Revisit at scale (threshold: once any single organization has more than roughly a few hundred events/attendance rows, or once more than a handful of organizations exist total) |
| No image pipeline / no upload capability | Low today (no uploads exist yet) | Design in when upload features are built | Revisit when avatars/logos are scoped |
| `ci-api.yml` quality gate commented out | Not a cost item directly, but compounds risk of shipping a broken build (see `01-architecture.md` #1) | Low | Fix now (bundled with the Part 1 fix) |

---
*Next: `05-user-management-upgrade.md`.*
