# DwellPass

A modern church management system built with React, Hono, and Drizzle ORM in an Nx monorepo.

## 🏗️ Project Structure

This monorepo contains two main applications and shared packages:

### Applications

- **`apps/api`** - Hono backend API server
  - RESTful API endpoints for users, events, attendance, and loyalty
  - PostgreSQL database with Drizzle ORM
  - Default port: 3000 (configurable via `PORT` env var)

- **`apps/web`** - React frontend application
  - Built with Vite, React 19, and TanStack Router
  - Includes TanStack DB collections for local state management
  - Default port: 5173 (Vite dev server)

### Packages

- **`@dwellpass/server`** - Backend utilities and database access
  - Database client, schema, and migrations
  - API client for frontend consumption
  - Combines database and API client logic

- **`@dwellpass/ui`** - Shared React UI components
  - Built with shadcn/ui and Tailwind CSS
  - Reusable components across the application

- **`@dwellpass/validation`** - Shared validation schemas
  - Zod schemas for type-safe validation
  - Used by both frontend and backend

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- PostgreSQL (or use PGlite for development)

### Installation

```sh
# Install dependencies
bun install

# Run database migrations
bun db:migrate

# Seed the database (optional)
bun db:seed
```

### Development

```sh
# Start both API and web in parallel
bun dev

# Or start them separately
bun dev:api   # API server only
bun dev:web   # Web app only
```

### Build & Production

```sh
# Build all projects
bun build

# Or build individually
bun build:api
bun build:web

# Start production servers
bun start
```

## 📦 Scripts

- **`bun dev`** - Start development servers for API and web
- **`bun build`** - Build all projects for production
- **`bun start`** - Start production servers
- **`bun lint`** - Lint all projects
- **`bun typecheck`** - Type check all projects
- **`bun test`** - Run tests across all projects
- **`bun db:migrate`** - Run database migrations
- **`bun db:seed`** - Seed database with sample data
- **`bun db:studio`** - Open Drizzle Studio

## 🗄️ Database

The project uses Drizzle ORM with PostgreSQL. Database configuration is in `packages/server/drizzle.config.ts`.

### Migrations

Migrations are stored in `packages/server/src/db/migrations/`.

```sh
# Generate new migration
cd packages/server && bun db:generate

# Run migrations
bun db:migrate
```

## 🌐 Environment Variables

Copy `.env.example` to `.env` and configure:

```env
NODE_ENV=development
PORT=3000                    # API server port
FRONTEND_URL=http://localhost:5173
API_PORT=3000               # For Vite proxy
DATABASE_URL=postgresql://localhost:5432/dwellpass
```

## 🏛️ Architecture

### Frontend Architecture
- **TanStack Router** for file-based routing
- **TanStack Query** for server state management
- **TanStack DB** for local collections (in `apps/web/src/lib/tanstack-db`)
- **shadcn/ui** for UI components
- **Zustand** for global state management

### Backend Architecture
- **Hono** - Fast web framework
- **Drizzle ORM** - Type-safe database access
- **PGlite/PostgreSQL** - Database layer
- Clean REST API structure

## 📱 Key Features

- 👥 **Member Management** - Track church members and their information
- 📅 **Event Management** - Create and manage church events
- ✅ **Attendance Tracking** - Record event attendance
- 🎁 **Loyalty Program** - Reward system for member engagement
- 📊 **Analytics Dashboard** - Insights and reporting

## 🛠️ Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query, Vite
- **Backend**: Hono, Bun runtime
- **Database**: PostgreSQL, Drizzle ORM
- **UI**: Tailwind CSS, shadcn/ui, Lucide icons
- **Monorepo**: Nx
- **Language**: TypeScript

## 📝 Learn More

- [Nx Documentation](https://nx.dev)
- [Hono Documentation](https://hono.dev)
- [Drizzle ORM](https://orm.drizzle.team)
- [TanStack](https://tanstack.com)
- [Bun](https://bun.sh)

## 🤝 Contributing

This is a private project. For development guidelines, see [MIGRATION_STATUS.md](MIGRATION_STATUS.md).

## 📄 License

MIT

---

Built with ❤️ using Nx, Bun, and modern web technologies.
