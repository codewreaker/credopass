# Day 1 — reshape `core-v2` into an agent service

Status: ✅ done 2026-09-02 · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §3

The service currently believes it's going to become a REST API. It isn't. Today it stops
pretending, gets a settings module, and finally gets the test week 1 never wrote.

Low-drama day on purpose — day 2 starts the actual new material, and starting it on a service
that still has `/api/v2/core` scaffolding in it would mean carrying dead weight for two weeks.

## Objectives

By the end of today you can:
- Explain what `pydantic-settings` does that `os.getenv` doesn't — validation and typing at
  startup rather than a `None` surfacing three layers deep at request time.
- Write a pytest test against a FastAPI app with no browser and no running server.

## New today

- [FastAPI — testing](https://fastapi.tiangolo.com/tutorial/testing/) — `TestClient`, which is
  synchronous and enough for `/health`. You do **not** need `httpx.AsyncClient` today; skip it.
- [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) — just the
  `BaseSettings` + `.env` section.

**Carried from week 1's status note:** `starlette.testclient` warns that `httpx` is deprecated in
favour of `httpx2`. It is a warning, not a failure. Decide today: pin and ignore it (recommended —
it's noise, not risk, and chasing it costs a day you don't have), or move. Write the decision into
this file's retro either way so it doesn't get re-litigated on day 4.

## Hands-on task

**Mode C — I scaffold:** nothing this time. It's small enough that you doing it is faster than me
explaining it.

**Mode B — you write:**

1. **Strip `main.py`.** Delete the commented-out `/api/v2/core` `FastAPI()` block in the `"""`
   string — that decision is settled (routes stay unprefixed; the agent endpoint gets its own
   explicit path on day 5, and it is *not* under `/api/v2/core`). Delete `GET /`. Keep
   `GET /health` and the `Health` model.
2. **`src/app/settings.py`** — a `Settings(BaseSettings)` with the fields you'll actually need:
   - `v1_api_url: str = "http://localhost:8080"` — where the tools will call on day 3.
   - `llm_api_key: str | None = None` — unset in tests, on purpose.
   - `git_commit: str = "unknown"`.
   Read from `services/core-v2/.env`. Wire `Health.commit` to read from settings rather than
   `os.getenv` directly.
3. **`tests/test_health.py`** — assert 200, `status == "ok"`, and that `timestamp` parses as a
   datetime. Delete `tests/test_scaffold.py` once this passes.
4. **Decide on `scratch/`.** It's untracked and week 0 flagged it. Either commit it or add it to
   `.gitignore` — day 2 is going to put a toy agent in there, so make the call now. Recommended:
   gitignore it. Throwaway code that gets committed becomes code someone maintains.

```bash
cd services/core-v2
uv add pydantic-settings
```

## Done when

- `nx run corev2:verify` is green (lint + typecheck + test).
- `nx run corev2:start` boots and `curl localhost:8090/health` returns 200 with a real commit
  hash if you set `GIT_COMMIT`, `"unknown"` if you didn't.
- `main.py` contains no reference to `/api/v2/core`.

## Retro

Implemented rather than assigned — this was Mode C (pure scaffolding: settings plumbing, a
docstring rewrite, a shallow test). Nothing here teaches pydantic-ai, AG-UI or FastAPI depth, and
day 2 is where the actual learning starts.

- **`httpx2` decision: pinned and ignored.** The warning comes from Starlette's own import of
  `TestClient`, not from our code, so migrating would mean chasing an upstream deprecation for no
  behavioural gain. Suppressed via `filterwarnings` in `pyproject.toml`, reasoning in a comment
  beside it. Revisit only if `TestClient` actually breaks.
- **`scratch/` decision: gitignored.** Day 2 puts a toy agent there and it's meant to be
  disposable; committed throwaway code becomes code someone maintains.
- **What was harder than expected:** nothing, but one thing was briefly misleading — `/health`
  reported `commit: "unknown"` even with `GIT_COMMIT` set, which looked like a settings bug. It
  wasn't: a stale `uvicorn` from an earlier run was still holding `:8090` and answering. Worth
  remembering for days 5–10, when you'll be restarting this service constantly and `--reload`
  doesn't always take. **`pkill -f "fastapi dev"` before trusting a surprising response.**
- **Carry into day 2:** `uv add pydantic-ai`; pick one model provider and put the key in
  `services/core-v2/.env`; don't revisit the choice.
