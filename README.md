# CredoPass

**Event Attendance Management System**

CredoPass is a comprehensive attendance tracking platform designed for organizations that meet regularly and need to track who actually shows up. Unlike ticketing systems like EventBrite that manage payments and ticket scanning, CredoPass focuses on detailed attendance tracking—capturing check-in times, check-out times, and actual attendance data that ticketing platforms don't provide.

Perfect for churches, book clubs, jazz clubs, recurring meetups, and any organization that needs to:
- Track attendance without requiring tickets
- Work alongside existing event systems (EventBrite, Meetup, etc.)
- Integrate with existing member databases
- Capture detailed check-in/check-out times
- Generate attendance analytics and insights

---

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Development](#-development)
- [Key Files & Directories](#-key-files--directories)
- [Documentation](#-documentation)
- [Project Status](#-project-status)

---

## 🚀 Features

- **Attendance Tracking** - Detailed check-in/check-out times and attendance records
- **Member Management** - Import and manage your existing member database
- **Event Management** - Create and schedule recurring or one-time events
- **Integration Ready** - Works alongside EventBrite, Meetup, and other event platforms
- **No Tickets Required** - Perfect for free events or paid events managed elsewhere
- **Loyalty Program** - Reward frequent attendees with points and tiers
- **Analytics Dashboard** - Attendance trends, no-show rates, and engagement metrics
- **Offline-First** - Local data sync for check-ins even without internet
- **Responsive Design** - Mobile-friendly for on-site check-in tablets or phones

---

## 🛠 Technology Stack

### Frontend
- **Framework**: React 19.2.1 (with React Compiler optimization)
- **Build Tool**: Vite 7.3.0 (Rolldown variant)
- **Routing**: TanStack Router v1.140.5 (file-based routing)
- **State Management**: 
  - Zustand v5.0.9 (global state)
  - TanStack Query v5.90.12 (server state)
  - TanStack DB v0.1.60 (offline-first local collections)
- **UI Components**: shadcn/ui with Base UI React v1.0.0
- **Styling**: TailwindCSS v4.1.18
- **Data Visualization**:
  - AG Grid Community v35.0.0 (data tables)
  - FullCalendar v6.1.19 (calendar views)
  - Recharts 3.6.0 (charts & analytics)
- **Icons**: Lucide React v0.562.0
- **Layout**: React Grid Layout v2.0.0

### Backend
- **Runtime**: Bun >= 1.3.0
- **Framework**: Hono v4.10.7 (lightweight web framework)
- **Database**: PostgreSQL 16 (production) / PGlite (development fallback)
- **ORM**: Drizzle ORM v0.45.1 with Drizzle Kit v0.31.0
- **Validation**: Zod v4.3.5 with @hono/zod-validator
- **Environment**: t3-env v3.10.0

### Monorepo & Tooling
- **Monorepo Manager**: Nx v22.3.3
- **Package Manager**: Bun (with workspaces)
- **Linting**: ESLint v9.39.2 with TypeScript ESLint
- **TypeScript**: v5.9.3

### Deployment
- **Frontend**: Vercel (with API proxy rewrites)
- **Backend**: Google Cloud Run (Docker containers)
- **Database**: PostgreSQL 16 (Docker Compose for local development)

---

## 📁 Project Structure

```
credopass-monorepo/
├── apps/
│   └── web/                          # React web application (Vercel)
│       ├── src/
│       │   ├── main.tsx              # App entry point (TanStack Router)
│       │   ├── routes.tsx            # Route tree configuration
│       │   ├── config.ts             # App configuration
│       │   ├── components/           # Reusable React components
│       │   ├── containers/           # Feature containers (EventForm, TopNavBar, etc.)
│       │   ├── Pages/                # Page components (Home, Members, Events, Analytics)
│       │   ├── routes/               # Route definitions
│       │   ├── stores/               # Zustand stores (useAppStore, useLauncherStore)
│       │   ├── lib/
│       │   │   ├── grid-layout.tsx   # React Grid Layout wrapper
│       │   │   ├── utils.ts          # Utility functions
│       │   │   └── tanstack-db/      # TanStack DB collections (users, events, etc.)
│       │   └── hooks/                # Custom React hooks
│       ├── public/                   # Static assets
│       ├── index.html                # HTML template
│       ├── vite.config.ts            # Vite configuration (proxy, build)
│       ├── vercel.json               # Vercel deployment config
│       ├── tsconfig.json             # TypeScript config
│       └── project.json              # Nx project configuration
│
├── services/
│   └── core/                         # Hono API server (Google Cloud Run)
│       ├── src/
│       │   ├── index.ts              # Server entry (Hono + middleware)
│       │   ├── routes/               # API route handlers
│       │   │   ├── users.ts          # User CRUD endpoints
│       │   │   ├── events.ts         # Event management endpoints
│       │   │   ├── attendance.ts     # Attendance tracking endpoints
│       │   │   └── loyalty.ts        # Loyalty program endpoints
│       │   ├── api/                  # API client (type-safe fetch wrapper)
│       │   │   ├── client.ts         # Base API client
│       │   │   └── endpoints/        # Endpoint definitions
│       │   └── db/                   # Database layer
│       │       ├── client.ts         # DB client (PostgreSQL/PGlite auto-detect)
│       │       └── schema/           # Drizzle ORM schemas
│       │           ├── user.schema.ts
│       │           ├── event.schema.ts
│       │           ├── attendance.schema.ts
│       │           └── loyalty.schema.ts
│       ├── drizzle/                  # Database migrations
│       ├── Dockerfile                # Multi-stage Docker build
│       ├── drizzle.config.ts         # Drizzle Kit configuration
│       ├── tsconfig.json             # TypeScript config
│       └── project.json              # Nx project configuration
│
├── packages/
│   ├── lib/                          # Shared utilities & validation (@credopass/lib)
│   │   ├── src/
│   │   │   ├── schemas/              # Zod validation schemas
│   │   │   │   ├── user.schema.ts    # User validation (Create, Update, Insert)
│   │   │   │   ├── event.schema.ts   # Event validation
│   │   │   │   ├── attendance.schema.ts
│   │   │   │   ├── loyalty.schema.ts
│   │   │   │   └── enums.ts          # Shared enums
│   │   │   ├── hooks/                # Shared React hooks
│   │   │   │   └── use-cookies.ts
│   │   │   ├── util/                 # Utility functions
│   │   │   ├── constants.ts          # App constants
│   │   │   └── index.ts              # Package exports
│   │   ├── tsconfig.json
│   │   └── project.json
│   │
│   └── ui/                           # Shared UI components (@credopass/ui)
│       ├── src/
│       │   ├── components/           # shadcn/ui components
│       │   │   ├── button.tsx
│       │   │   ├── card.tsx
│       │   │   ├── dialog.tsx
│       │   │   ├── input.tsx
│       │   │   ├── select.tsx
│       │   │   ├── chart.tsx         # Recharts integration
│       │   │   ├── sidebar.tsx
│       │   │   └── index.ts          # Component exports
│       │   ├── hooks/                # UI-specific hooks
│       │   │   └── use-mobile.ts
│       │   ├── lib/
│       │   │   └── utils.ts          # cn() helper, etc.
│       │   └── styles/
│       │       └── globals.css       # Global styles
│       ├── components.json           # shadcn/ui config
│       ├── tailwind.config.ts        # Tailwind configuration
│       ├── tsconfig.json
│       └── project.json
│
├── docker/
│   └── docker-compose.yml            # PostgreSQL 16 container setup
│
├── tools/                            # DevOps scripts
│   ├── nm-reset.sh                   # Node modules cleanup
│   ├── setup-gcp.sh                  # Google Cloud Platform setup
│   └── setup-vercel.sh               # Vercel setup
│
├── nx.json                           # Nx workspace configuration
├── package.json                      # Root dependencies & scripts
├── tsconfig.base.json               # Base TypeScript configuration
├── eslint.config.js                  # ESLint configuration
├── ARCHITECTURE.md                   # Legacy architecture docs
├── REFACTORING_SUMMARY.md            # Consolidation notes
└── README.md                         # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **Bun** >= 1.3.0 ([Install Bun](https://bun.sh))
- **Docker** (for PostgreSQL)
- **Google Cloud SDK** (for deployment)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd dwellpass

# Install dependencies
bun install

# Start PostgreSQL database
bun run postgres:up

# Run database migrations
nx run coreservice:migrate

# Start development servers (in separate terminals)
# Terminal 1: Frontend (http://localhost:5173)
nx run web:serve

# Terminal 2: Backend (http://localhost:3000)
nx run coreservice:start
```

### Environment Variables

Create a `.env` file in the root:

```env
# Database
DATABASE_URL=postgresql://postgres:Ax!rtrysoph123@localhost:5432/dwellpass_db

# API Configuration
API_BASE_URL=http://localhost:3000
NODE_ENV=development

# Optional: Enable throttle middleware for testing
THROTTLE=false
```

> **See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions**

---

## 💻 Development

### Essential Commands

```bash
# Frontend Development
nx run web:serve              # Start dev server (localhost:5173)
nx run web:build              # Production build
nx run web:preview            # Preview production build

# Backend Development
nx run coreservice:start      # Start API server (localhost:3000)
nx run coreservice:build      # Bundle with Bun
nx run coreservice:docker:build  # Build Docker image

# Database
bun run postgres:up           # Start PostgreSQL container
bun run postgres:down         # Stop and remove PostgreSQL
nx run coreservice:generate   # Generate migration from schema changes
nx run coreservice:migrate    # Run pending migrations
nx run coreservice:studio     # Open Drizzle Studio (DB UI)

# Monorepo
nx graph                      # View dependency graph
nx affected:test              # Test affected projects
nx format:write               # Format code
```

### Development Workflow

1. **Frontend Changes**: Edit files in `apps/web/src/` → Hot reload on save
2. **Backend Changes**: Edit files in `services/core/src/` → Auto-restart with `--watch`
3. **Schema Changes**: Edit `services/core/src/db/schema/` → Run `nx run coreservice:generate` → Run `nx run coreservice:migrate`
4. **UI Components**: Edit `packages/ui/src/components/` → Changes reflect in web app
5. **Validation Schemas**: Edit `packages/lib/src/schemas/` → Available in both frontend & backend

### Frontend-Backend Communication

**Development Mode**:
```
Frontend (localhost:5173) → Vite Proxy → Backend (localhost:3000)
```
- Configured in `apps/web/vite.config.ts`
- All `/api/*` requests proxied to `http://localhost:3000`

**Production Mode**:
```
Frontend (vercel.app) → Vercel Rewrite → https://api.credopass.com/api/*
```
- Configured in `apps/web/vercel.json`
- API domain set via environment variables

---

## 📚 Key Files & Directories

| File/Directory | Purpose |
|----------------|---------|
| **Frontend** | |
| `apps/web/src/main.tsx` | React app entry point with TanStack Router setup |
| `apps/web/src/routes.tsx` | Explicit route tree configuration |
| `apps/web/src/stores/store.ts` | Zustand stores (useAppStore, useLauncherStore) |
| `apps/web/src/lib/tanstack-db/` | TanStack DB collections for offline-first data |
| `apps/web/src/Pages/` | Page components (Home, Members, Events, Analytics, Tables) |
| `apps/web/src/containers/` | Feature containers (EventForm, TopNavBar, SignInModal, etc.) |
| `apps/web/vite.config.ts` | Vite build config with proxy and code-splitting |
| `apps/web/vercel.json` | Vercel deployment with API rewrites & security headers |
| **Backend** | |
| `services/core/src/index.ts` | Hono server with CORS, logger, throttle middleware |
| `services/core/src/routes/` | API route handlers (users, events, attendance, loyalty) |
| `services/core/src/db/schema/` | Drizzle ORM table schemas |
| `services/core/src/db/client.ts` | Database client factory (PostgreSQL/PGlite auto-detect) |
| `services/core/src/api/client.ts` | Type-safe fetch wrapper for API calls |
| `services/core/Dockerfile` | Multi-stage Docker build for Cloud Run |
| `services/core/drizzle.config.ts` | Drizzle migration configuration |
| **Shared Packages** | |
| `packages/lib/src/schemas/` | Zod validation schemas (shared between frontend/backend) |
| `packages/lib/src/constants.ts` | Application constants |
| `packages/ui/src/components/` | shadcn/ui component library |
| `packages/ui/components.json` | shadcn/ui configuration |
| **Infrastructure** | |
| `docker/docker-compose.yml` | PostgreSQL 16 container definition |
| `nx.json` | Nx workspace configuration & task pipelines |
| `tsconfig.base.json` | Base TypeScript config with path mappings |
| `package.json` | Root workspace dependencies & scripts |

---

## 📖 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Architecture Guide](docs/ARCHITECTURE.md)** - Detailed architectural patterns, routing, state management, API patterns, validation layer
- **[Setup Guide](docs/SETUP.md)** - Complete setup instructions, environment variables, database configuration, troubleshooting
- **[Database Guide](docs/DATABASE.md)** - Schema definitions, relationships, migrations, seeding data
- **[API Reference](docs/API.md)** - Endpoint documentation, request/response examples
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Build processes, Vercel deployment, Docker & Cloud Run, production migrations

---

## 📊 Project Status

**Current Phase**: Post-Refactoring Development

### What Problem Does CredoPass Solve?

**The Gap**: EventBrite and similar platforms handle ticket sales and scanning, but don't provide:
- Detailed attendance data (who actually showed up vs. who bought tickets)
- Check-in and check-out timestamps
- Attendance tracking for free/non-ticketed events
- Integration with your existing member database

**The Solution**: CredoPass fills this gap by focusing exclusively on attendance tracking. Use EventBrite for ticketing, use CredoPass for knowing who attended and when.

### Recent Changes (Refactoring Consolidation)

The project recently underwent a significant consolidation to simplify the monorepo structure:

✅ **Completed**:
- Reduced from 6+ packages to 2 packages (67% reduction)
- Consolidated database code into `services/core`
- Moved TanStack DB collections to `apps/web/src/lib/tanstack-db/`
- Merged API client into `services/core/src/api/`
- Renamed `@credopass/validation` to `@credopass/lib`
- Updated all import paths and dependencies

### Architecture Benefits

- **Simpler Structure**: Fewer packages = easier navigation
- **Type Safety**: End-to-end TypeScript with Zod validation
- **Modern Stack**: React 19, Hono, Drizzle, Bun, TanStack ecosystem
- **Developer Experience**: Fast builds (Bun), hot reload (Vite), excellent tooling (Nx, Drizzle Studio)
- **Offline-First**: TanStack DB collections for local data persistence
- **Clean Separation**: Clear boundaries between apps, services, and packages

---

## 🏗 Architecture Overview

### State Management Strategy

1. **Global UI State** (Zustand):
   - `useAppStore`: Sidebar state, action events
   - `useLauncherStore`: Modal launcher state

2. **Server State** (TanStack Query):
   - Automatic caching and invalidation
   - Used implicitly by TanStack DB collections

3. **Local-First Data** (TanStack DB):
   - Collections: users, events, attendance, loyalty
   - Syncs with backend API via collections
   - Enables offline functionality

### Request Flow

```
User Interaction
    ↓
React Component
    ↓
TanStack Query/DB → API Client → Hono Server
                                     ↓
                                 Zod Validation
                                     ↓
                                 Drizzle ORM
                                     ↓
                                 PostgreSQL
```

### Validation Layer Separation

- **Zod Schemas** (`packages/lib/src/schemas/`): For API request/response validation
- **Drizzle Schemas** (`services/core/src/db/schema/`): For database table definitions
- Both must stay in sync manually (no automatic codegen)

### Database Client Auto-Detection

The backend automatically detects the environment:
- **Production**: Uses PostgreSQL via `DATABASE_URL`
- **Development Fallback**: Uses PGlite if PostgreSQL unavailable

---

## 🚢 Deployment

### Frontend (Vercel)

```bash
# Automatic deployment on push to main branch
# Or manual deployment:
vercel deploy
```

Configuration: `apps/web/vercel.json`

### Backend (Google Cloud Run)

```bash
# Deploy to Cloud Run
nx run coreservice:deploy

# Or manually:
cd services/core
gcloud run deploy credopass-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

> **See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment instructions**

---

## 📝 License

See [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

**Built with ❤️ for organizations that value attendance insights**
