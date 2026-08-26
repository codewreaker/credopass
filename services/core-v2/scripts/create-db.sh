#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Create credopass_v2_dev — services/core-v2's own local database.
# ---------------------------------------------------------------------------
# Idempotent: safe to run any number of times. Creates an EMPTY database only —
# migrating it is a separate, deliberate step, because schema authority stays
# with Drizzle (docs/PYTHON-LEARNING-PLAN.md §1):
#
#   cd services/core
#   DATABASE_URL=postgresql://postgres:<password>@localhost:5432/credopass_v2_dev \
#     bun run scripts/db.ts migrate
#
# Only ever talks to the local Docker container, by design — same reasoning as
# services/core/scripts/db.ts's hostname allow-list: a flag can be passed by
# accident, a container name cannot.
# ---------------------------------------------------------------------------
set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-credopass-postgres}"
DB_NAME="${V2_DB_NAME:-credopass_v2_dev}"
DB_USER="${POSTGRES_USER:-postgres}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop, then:"
  echo "  nx run coreservice:dev:up"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container '$CONTAINER' is not running. Start it with:"
  echo "  nx run coreservice:dev:up"
  exit 1
fi

exists=$(docker exec "$CONTAINER" psql -U "$DB_USER" -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'")

if [ "$exists" = "1" ]; then
  echo "Database '${DB_NAME}' already exists — nothing to do."
else
  docker exec "$CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME}"
  echo "Created database '${DB_NAME}'."
fi

echo
echo "It is EMPTY until you migrate it. Next:"
echo "  cd services/core"
echo "  DATABASE_URL=postgresql://${DB_USER}:<password>@localhost:5432/${DB_NAME} bun run scripts/db.ts migrate"
echo
echo "(<password> is POSTGRES_PASSWORD from docker/docker-compose.dev.yml, or"
echo " whatever your services/core/.env already uses for credopass_db.)"
