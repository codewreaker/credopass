# CredoPass Monorepo Structure

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CredoPass Monorepo                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          Applications                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐         ┌─────────────────────────┐  │
│  │   apps/api           │         │   apps/web              │  │
│  │   (Hono Server)      │◄────────┤   (React + Vite)        │  │
│  │                      │  HTTP   │                         │  │
│  │  • REST API          │         │  • React 19             │  │
│  │  • Port: 3000        │         │  • TanStack Router      │  │
│  │  • Drizzle ORM       │         │  • TanStack Query       │  │
│  └──────────────────────┘         │  • Port: 5173           │  │
│           │                        │                         │  │
│           │                        │  ┌──────────────────┐   │  │
│           │                        │  │ lib/tanstack-db  │   │  │
│           │                        │  │ • Collections    │   │  │
│           │                        │  │ • Local State    │   │  │
│           │                        │  └──────────────────┘   │  │
│           │                        └─────────────────────────┘  │
│           │                                     │                │
└───────────┼─────────────────────────────────────┼────────────────┘
            │                                     │
            │                                     │
┌───────────┴─────────────────────────────────────┴────────────────┐
│                        Shared Packages                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  packages/server (@credopass/server)                     │   │
│  │  ┌────────────────────┐  ┌────────────────────────────┐ │   │
│  │  │  db/               │  │  api/                      │ │   │
│  │  │  • client.ts       │  │  • client.ts               │ │   │
│  │  │  • schema/         │  │  • endpoints/              │ │   │
│  │  │  • migrations/     │  │    - users.ts              │ │   │
│  │  │  • seed.ts         │  │    - events.ts             │ │   │
│  │  │  • migrate.ts      │  │    - attendance.ts         │ │   │
│  │  └────────────────────┘  │    - loyalty.ts            │ │   │
│  │                          └────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│            │                                     │                │
│            └─────────────────┬───────────────────┘                │
│                              │                                    │
│  ┌──────────────────┐  ┌────┴──────────────┐  ┌──────────────┐  │
│  │ packages/        │  │ packages/         │  │ packages/    │  │
│  │ validation       │  │ ui                │  │ config       │  │
│  │                  │  │                   │  │              │  │
│  │ • Zod schemas    │  │ • shadcn/ui       │  │ • eslint/    │  │
│  │ • Type safety    │  │ • Components      │  │ • tailwind/  │  │
│  │ • Shared types   │  │ • Tailwind CSS    │  │ • typescript/│  │
│  └──────────────────┘  └───────────────────┘  └──────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                          Infrastructure                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ PostgreSQL   │  │ Nx Monorepo  │  │ Bun Runtime  │           │
│  │ + PGlite     │  │ Orchestration│  │ Package Mgr  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

## Data Flow

1. User interacts with apps/web (React UI)
2. Web app makes API calls through local TanStack DB collections
3. API requests go to apps/api (Hono server)
4. API uses @credopass/server for database access
5. Data validated using @credopass/validation schemas
6. UI components rendered using @credopass/ui components

## Package Dependencies

```
apps/api
  └── @credopass/server
      └── @credopass/validation

apps/web
  ├── @credopass/ui
  └── @credopass/validation

packages/server
  └── @credopass/validation

packages/ui
  └── @credopass/validation
```

## Key Benefits

✅ **Simplified Structure**: From 6 packages to 4 (-33%)
✅ **Logical Grouping**: Backend code consolidated in one place
✅ **Co-location**: UI-specific code lives with UI
✅ **Type Safety**: Shared validation across all layers
✅ **Maintainability**: Clearer boundaries and dependencies
✅ **Developer Experience**: Easier to navigate and understand

## Command Reference

```bash
# Development
bun dev              # Start both API and web
bun dev:api          # API server only
bun dev:web          # Web app only

# Build
bun build            # Build all projects
bun build:api        # Build API
bun build:web        # Build web app

# Database
bun db:migrate       # Run migrations
bun db:seed          # Seed data
bun db:studio        # Open Drizzle Studio

# Quality
bun lint             # Lint all projects
bun typecheck        # Type check all
bun test             # Run tests
```
