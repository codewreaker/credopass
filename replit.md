# CredoPass

Event attendance management and credentialing platform for organizations that meet regularly (churches, clubs, meetups, etc.).

## Stack

- **Frontend**: React 19 + Vite 7 (Rolldown), TanStack Router, shadcn/ui, TailwindCSS v4 — `apps/web`
- **Marketing site**: React + Vite — `apps/website`
- **Backend API**: Bun + Hono, Drizzle ORM, PostgreSQL — `services/core`
- **Mobile**: Expo / React Native — `apps/mobile`
- **Monorepo**: Nx + Bun workspaces
- **Auth**: Supabase Auth (including anonymous sessions)

## Running on Replit

The web app runs on port 5000 via the **Start application** workflow.

```
cd apps/web && bun vite --mode development
```

Vite is configured with polling-based file watching (`usePolling: true`) to work around Replit's inotify watcher limit on large monorepos.

## Environment Variables

Set as Replit secrets / env vars (shared environment):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable anon key |
| `VITE_API_URL` | Core Services API base URL |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox token for map features |

The backend (Core Services) runs externally at `https://api.credopass.com` — it is not run locally on Replit.

## Key Directories

```
apps/web/          React web app (main product UI)
apps/website/      Marketing / landing site
apps/mobile/       Expo mobile app
services/core/     Hono API server (Bun runtime)
packages/ui/       Shared shadcn/ui component library (@credopass/ui)
packages/lib/      Shared utilities (@credopass/lib)
packages/api-client/ Typed API client (@credopass/api-client)
docs/              Architecture, API, and deployment docs
```

## User Preferences

- UI redesign should target Linear/Vercel/Stripe polish level
- Extend existing shadcn/ui primitives in `@credopass/ui` — do not replace them
- TailwindCSS: static class names only (no dynamic string interpolation)
- TanStack Router for all routing (search-param-driven view state)
- Dark mode support required via the same token system
- Mobile-first attention for check-in/scanning flows (used at live events)
