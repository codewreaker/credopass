# services/ai-chat — the Organizer Copilot

A Python/FastAPI service with exactly one job: serve the CredoPass Organizer Copilot over the
**AG-UI** protocol, so the dashboard's right-hand rail can be a chat that answers in prose *and*
rendered UI.

Plan: [`docs/AI-SIDEBAR-PLAN.md`](../../docs/AI-SIDEBAR-PLAN.md) · Progress:
[`docs/learning/STATUS.md`](../../docs/learning/STATUS.md)

## What this is not

- **Not a port of `services/core`.** There was a plan to rewrite the TypeScript API in Python; it
  was cancelled on 2026-09-02. There is no `/api/v1/core`-competing REST surface and there will not be.
- **Not a database client.** This service opens **no** database connection — no SQLAlchemy, no
  `asyncpg`, no `DATABASE_URL`. Every agent tool calls the existing v1 API over HTTP, forwarding
  the caller's own bearer token, so the agent inherits the caller's permissions and gains none of
  its own. That is the security property the design rests on; don't erode it.
- **Not wired into production.** `apps/web` reaches this only behind `VITE_COPILOT_ENABLED`.

## Routes

```
GET  /health                                  liveness (no readiness — there's nothing to be ready)
POST /api/v1/ai-chat/agent/organizer-copilot  the agent, over AG-UI      (day 5)
```

## Layout

```
pyproject.toml      deps, ruff, pytest, pyright — one file
uv.lock             committed, reviewed like bun.lock
src/app/main.py     the FastAPI app
src/app/settings.py typed config (pydantic-settings), cached behind get_settings()
tests/              pytest; must pass with no model API key set
```

## Running it

Requires [`uv`](https://docs.astral.sh/uv/) (`brew install uv`). It manages the virtualenv *and*
the Python version — `.python-version` pins 3.13. No `pip install`, no `activate`.

```bash
nx run ai-chat:start      # → :8090   (sets GIT_COMMIT for /health)
nx run ai-chat:test
nx run ai-chat:lint
nx run ai-chat:typecheck
nx run ai-chat:verify     # all three — run before saying "done"
```

The agent's tools call v1, so `nx run coreservice:start` (:8080) must also be running for anything
beyond `/health` to work.

## Configuration

`services/ai-chat/.env`, gitignored:

```
V1_API_URL=http://localhost:8080
LLM_API_KEY=...            # your model provider's key
```

**The test suite must pass with the key unset.** That's the check that no test is quietly making a
live model call:

```bash
env -u LLM_API_KEY uv run pytest
```
