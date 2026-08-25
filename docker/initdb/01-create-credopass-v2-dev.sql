-- ---------------------------------------------------------------------------
-- credopass_v2_dev — services/core-v2's own local database
-- ---------------------------------------------------------------------------
-- services/core-v2 (/api/v2/core) is additive: it never shares a database with
-- services/core, and it never points at the remote instance. See
-- docs/PYTHON-LEARNING-PLAN.md §1.
--
-- Schema authority does NOT move. This database is migrated by running the
-- SAME Drizzle migrations that manage credopass_db, with DATABASE_URL aimed
-- here. There is no Alembic, and there is no second set of migrations.
--
-- IMPORTANT: Postgres only runs /docker-entrypoint-initdb.d scripts when the
-- data directory is EMPTY. On a volume that already exists — i.e. any machine
-- where the dev database has been started before — this file never executes.
-- Use services/core-v2/scripts/create-db.sh instead; it is idempotent and works
-- either way.
-- ---------------------------------------------------------------------------

CREATE DATABASE credopass_v2_dev;
