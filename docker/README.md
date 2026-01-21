# Docker Setup for credopass

This folder contains Docker orchestration files for local development and production testing.

## Structure

```
docker/
├── docker-compose.dev.yml    # Development environment
├── docker-compose.prod.yml   # Production-like testing
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## Daily Workflow

```bash
# Start coding
bun docker:dev      # Start Postgres
bun start           # Run API + Web natively

# Done for the day
bun docker:down     # Stop Postgres
```

## Test Production Build

```bash
bun docker:prod     # Build & run containerized
# Test at http://localhost:8080
bun docker:down     # Clean up
```

## Available Commands

| Command | Description |
|---------|-------------|
| `bun docker:dev` | Start Postgres for local dev |
| `bun docker:dev:build` | Build & run all services in Docker |
| `bun docker:prod` | Build & run production test |
| `bun docker:down` | Stop everything |

## Services

### PostgreSQL (postgres)

- **Image**: `postgres:16-alpine3.23`
- **Port**: `5432`
- **Container**: `credopasspostgres`
- **Database**: `credopass_db`
- **User**: `postgres`
- **Password**: `Ax!rtrysoph123` (dev only!)

**Connection string (local)**:
```
postgresql://postgres:Ax!rtrysoph123@localhost:5432/credopass_db
```

### Core API (core)

- **Dockerfile**: `services/core/Dockerfile`
- **Port**: `8080`
- **Container**: `credopasscore`
- **Profile**: `services` (doesn't start by default)

## Data Persistence

- **Postgres data** is stored in a named volume: `credopass_postgres_data`
- Data survives `docker compose down`
- Data is deleted with `docker compose down -v` or `bun postgres:reset`

## Production Testing

Before deploying to Cloud Run, test your production build locally:

```bash
# 1. Create production environment file
cp docker/.env.example docker/.env.prod

# 2. Edit with production-like values
vim docker/.env.prod

# 3. Run production build
bun docker:prod

# 4. Test at http://localhost:8080

# 5. Clean up
bun docker:prod:down
```

## Adding New Services

When adding a new service (e.g., `services/auth`):

1. Create Dockerfile at `services/auth/Dockerfile`
2. Add service to both compose files:

```yaml
# In docker-compose.dev.yml
auth:
  build:
    context: ..
    dockerfile: services/auth/Dockerfile
  container_name: credopassauth
  ports:
    - "8081:8081"
  environment:
    DATABASE_URL: postgresql://postgres:Ax!rtrysoph123@postgres:5432/credopass_db
  depends_on:
    postgres:
      condition: service_healthy
  networks:
    - credopass-network
  profiles:
    - services
```

3. Add commands to `package.json` if needed

## Troubleshooting

### Port already in use

```bash
# Check what's using port 5432
lsof -i :5432

# Kill the process or stop conflicting containers
docker ps
docker stop <container_id>
```

### Database connection refused

```bash
# Check if Postgres is healthy
docker ps
docker logs credopasspostgres

# Wait for health check
bun postgres:logs
```

### Build cache issues

```bash
# Force rebuild without cache
docker compose -f docker/docker-compose.dev.yml build --no-cache core
```

### Volume issues

```bash
# List volumes
docker volume ls | grep credopass

# Remove specific volume
docker volume rm credopass_postgres_data

# Prune unused volumes (careful!)
docker volume prune
```

## Network

Services communicate via the `credopass-network` bridge network:

- **Postgres**: `postgres:5432`
- **Core API**: `core:8080`

From inside a container, use service names (not `localhost`).
