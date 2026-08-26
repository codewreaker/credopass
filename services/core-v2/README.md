# services/core-v2 — `/api/v2/core`

**Stub. Week 0 of 8.** This README gets written properly in week 7
([`docs/learning/week-07-testing-polish.md`](../../docs/learning/week-07-testing-polish.md)); right
now it only covers what exists, which is a scaffold.

A Python/FastAPI port of `services/core`, built as a learning project. The plan is
[`docs/PYTHON-LEARNING-PLAN.md`](../../docs/PYTHON-LEARNING-PLAN.md); how it's run week to week is
[`docs/LEARNING-WORKFLOW.md`](../../docs/LEARNING-WORKFLOW.md); current progress is
[`docs/learning/STATUS.md`](../../docs/learning/STATUS.md).

## What this is not

- **Not a replacement for `services/core`.** That service keeps running, unchanged, and stays the
  only thing that writes migrations.
- **Not wired into anything.** `apps/web`'s default config never points here. No Nx target, not in
  `bun start` — deliberately, until it's stable (plan §7).
- **Not pointed at a shared database.** It gets its own local `credopass_v2_dev`, migrated with
  `services/core`'s existing Drizzle migrations. It never touches the remote instance.

## Layout

```
pyproject.toml       deps, ruff, pytest, pyright config — one file, no setup.py/setup.cfg era stuff
uv.lock              committed, reviewed like bun.lock
src/app/             the service (empty until week 1 adds main.py + health routes)
tests/               pytest suite
scripts/create-db.sh idempotent creation of the local credopass_v2_dev database
```

## Running it

Requires [`uv`](https://docs.astral.sh/uv/) (`brew install uv`). It manages the virtualenv *and*
the Python version — `.python-version` pins 3.13, and `uv` fetches it if the machine doesn't have
it. There is no `pip install`, no `source .venv/bin/activate`.

```bash
cd services/core-v2

uv sync                  # create/refresh .venv from uv.lock
uv run pytest            # tests
uv run ruff check .      # lint
uv run ruff format .     # format
```

Nothing serves yet. From week 1 on:

```bash
uv run uvicorn app.main:app --reload --port 8090
```

Port 8090 is free — see the ports table in the repo root [`CLAUDE.md`](../../CLAUDE.md).

## The database

One-time setup, with Docker running and the dev stack up (`nx run coreservice:dev:up`):

```bash
# 1. create the (empty) database
./scripts/create-db.sh

# 2. migrate it with services/core's Drizzle migrations — schema authority does
#    not move to this service. Run from services/core, with DATABASE_URL overridden:
cd ../core
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/credopass_v2_dev \
  bun run scripts/db.ts migrate
```

`<password>` is `POSTGRES_PASSWORD` from [`docker/docker-compose.dev.yml`](../../docker/docker-compose.dev.yml).

**Why the inline `DATABASE_URL=` is safe:** a shell-assigned variable takes precedence over
`services/core/.env` in Bun (verified, not assumed), so that command migrates `credopass_v2_dev`
and leaves `credopass_db` alone. Get it wrong and you migrate the main dev database instead —
which is harmless today (same migrations, already applied) but is not a habit worth forming.

There is no Alembic and there will not be one. Two migration tools against one schema would be two
sources of truth for no benefit (plan §1, revisited in week 3's retro).
