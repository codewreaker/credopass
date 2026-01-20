# AI PROMPT: Multi-Service Docker Setup for dwellpass Monorepo

## Context

I have a monorepo called `dwellpass` (also known as CredoPass) with the following structure:

- **Frontend**: `apps/web` - React SPA deployed to Vercel
- **Backend**: `services/core` - Hono API deployed to Google Cloud Run
- **Database**: PostgreSQL 16
- **Monorepo Tool**: Nx with Bun package manager

## Objective

Set up a hybrid Docker approach with:

1. **Dockerfiles** located with their services (`services/core/Dockerfile`)
2. **docker-compose files** in a central `docker/` folder that reference those Dockerfiles
3. **Two compose files**:
   - `docker-compose.dev.yml` - Local development
   - `docker-compose.prod.yml` - Production-like testing
4. **Scripts** in root `package.json` for easy commands

---

## Requirements

### 1. Docker Compose Dev (`docker/docker-compose.dev.yml`)

**PostgreSQL service**:

- Use `postgres:16-alpine3.23` image
- Container name: `dwellpasspostgres`
- Port: `5432:5432`
- Database: `dwellpass_db`
- User: `postgres`
- Password: `Ax!rtrysoph123`
- Volume: `postgres_data` (persists data - if exists, reuse; if not, create)
- Health check: `pg_isready -U postgres`
- Should start automatically with `restart: unless-stopped`

**Core API service** (optional, use profiles):

- Build from `services/core/Dockerfile`
- Context: repo root (`..`)
- Container name: `dwellpasscore`
- Port: `8080:8080`
- Environment: `NODE_ENV=development`, `DATABASE_URL` pointing to postgres service
- Depends on postgres health check
- Hot reload: mount `services/core/src` as volume
- Use profile `services` so it only runs when explicitly requested

**Shared network**: `dwellpass-network`

### 2. Docker Compose Prod (`docker/docker-compose.prod.yml`)

Same services as dev but:

- No volume mounts for code (no hot reload)
- `NODE_ENV=production`
- Production-grade settings (resource limits, restart policies)
- Use `.env.prod` file for secrets
- Postgres should use production password from environment variable

### 3. Dockerfile Updates (`services/core/Dockerfile`)

Fix the existing Dockerfile:

- Change `packages/validation` → `packages/lib`
- Change `services/api` → `services/core`
- Change `bun run build:api` → `bun nx build coreservice`
- Change `dist/services/api` → `dist/services/core`
- Fix `bun.lock` → `bun.lockb` (Bun's lockfile format)
- Add `.dockerignore` file in `services/core/` to exclude unnecessary files

### 4. Package.json Scripts (root)

Add these commands to the existing scripts:

```json
{
  "scripts": {
    "start": "NODE_ENV=development nx run-many -t serve start -p web coreservice",
    "reinstall": "./tools/nm-reset.sh && bun install",

    // Postgres only
    "postgres:up": "docker compose -f docker/docker-compose.dev.yml up -d postgres",
    "postgres:down": "docker compose -f docker/docker-compose.dev.yml down -v",
    "postgres:logs": "docker compose -f docker/docker-compose.dev.yml logs -f postgres",

    // Development (Postgres + Core service in Docker)
    "docker:dev": "docker compose -f docker/docker-compose.dev.yml --profile services up",
    "docker:dev:build": "docker compose -f docker/docker-compose.dev.yml --profile services up --build",
    "docker:dev:down": "docker compose -f docker/docker-compose.dev.yml --profile services down",

    // Production-like testing
    "docker:prod": "docker compose -f docker/docker-compose.prod.yml up --build",
    "docker:prod:down": "docker compose -f docker/docker-compose.prod.yml down -v",

    // Individual service builds
    "docker:build:core": "docker build -t dwellpass-core -f services/core/Dockerfile .",
    "docker:core": "docker compose -f docker/docker-compose.dev.yml up postgres core"
  }
}
```

### 5. Directory Structure

```
dwellpass/
├── docker/
│   ├── docker-compose.dev.yml       # Create this
│   ├── docker-compose.prod.yml      # Create this
│   └── .env.example                 # Create this (template)
├── services/
│   └── core/
│       ├── Dockerfile               # Fix this
│       ├── .dockerignore            # Create this
│       └── src/
├── packages/
│   └── lib/                         # Existing shared code
├── apps/
│   └── web/                         # Frontend (not dockerized)
└── package.json                     # Update scripts
```

### 6. Additional Files Needed

- **`docker/.env.example`**: Template for environment variables
- **`services/core/.dockerignore`**: Exclude node_modules, dist, etc.
- **`docker/README.md`**: Documentation for Docker usage

---

## Expected Behavior

**Development workflow:**

```bash
# Start just Postgres (current workflow, most common)
bun postgres:up

# Run core API natively with Bun (recommended)
bun start

# OR run everything in Docker (alternative)
bun docker:dev
```

**Production testing:**

```bash
# Test production build locally
bun docker:prod
```

**Volume persistence:**

- Postgres data should persist between `docker compose down` and `up`
- Only `docker compose down -v` should delete volumes
- If postgres volume exists, reuse it; otherwise create new

---

## Best Practices to Follow

1. Use multi-stage builds in Dockerfile for smaller images
2. Use health checks for dependent services
3. Use profiles in docker-compose for optional services
4. Use service names (not localhost) for inter-service communication
5. Use environment variable substitution for secrets
6. Add comments in docker-compose files explaining each section
7. Non-root user in production Dockerfile
8. Proper .dockerignore to speed up builds

---

## Deployment Strategy

| Environment | Component        | Platform                            |
| ----------- | ---------------- | ----------------------------------- |
| Local dev   | Database         | Docker Compose (postgres)           |
| Local dev   | Core API         | Native Bun OR Docker                |
| Production  | `services/core`  | Google Cloud Run (uses Dockerfile)  |
| Production  | `apps/web`       | Vercel (no Docker)                  |
| Production  | Database         | Google Cloud SQL (managed)          |

---

## Tasks

Please create/update the following files:

1. `docker/docker-compose.dev.yml` (new)
2. `docker/docker-compose.prod.yml` (new)
3. `services/core/Dockerfile` (fix existing)
4. `services/core/.dockerignore` (new)
5. `docker/.env.example` (new)
6. `package.json` (update scripts section)
7. `docker/README.md` (new, with usage instructions)

Provide the complete file contents with comments explaining key configurations.
