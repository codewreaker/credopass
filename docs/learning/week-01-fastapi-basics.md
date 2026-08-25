# Week 1 — type hints, async basics, FastAPI fundamentals, health routes

Status: not started

## Objectives

By the end of this week you can:
- Explain what a type hint actually does at runtime by default (nothing — it's not enforced by
  the interpreter) versus what FastAPI does with it (validation + serialization + OpenAPI schema),
  since that gap is exactly what makes FastAPI feel like magic until you see through it.
- Explain the difference between a `def` and an `async def` route handler in FastAPI, and when
  using the wrong one actually costs you something (blocking the event loop).
- Point at a running FastAPI app with two real, tested routes, and its auto-generated `/docs`.

## New this week (read before starting)

**Typing** — read in this order; stop as soon as signatures read comfortably:

- [mypy's type-hints cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html) —
  one page, every annotation form you'll type this week. Start here, not with the PEPs.
- [FastAPI — "Python Types Intro"](https://fastapi.tiangolo.com/python-types/) (plan §6) — written
  specifically for this transition, do it right before touching FastAPI itself. Pay attention to
  the `Annotated` section; it's the backbone of every `Depends` you'll write in week 2.
- [`typing` module docs](https://docs.python.org/3/library/typing.html) and
  [PEP 484 — Type Hints](https://peps.python.org/pep-0484/) (plan §6) — reference, not reading.
  Look things up here; don't work through the module.

**Async** — this is the material with the real unfamiliarity risk, so give it the most time:

- [Real Python — `asyncio`: A Hands-On Walkthrough](https://realpython.com/async-io-python/)
  (plan §6) — the coroutine/`await`/`gather` mental model; Python 2 had nothing like this.
- [FastAPI — Concurrency and `async`/`await`](https://fastapi.tiangolo.com/async/) — **the page
  that answers this week's second objective directly.** It explains what FastAPI does with a plain
  `def` handler (runs it in a threadpool) versus an `async def` one, which is exactly why picking
  the wrong one degrades quietly rather than erroring.
- [`asyncio` — Coroutines and Tasks](https://docs.python.org/3/library/asyncio-task.html) —
  reference for `await` / `gather` / `TaskGroup` once the mental model is in place.

**FastAPI itself:**

- FastAPI's own tutorial: [First Steps](https://fastapi.tiangolo.com/tutorial/first-steps/),
  [Path Parameters](https://fastapi.tiangolo.com/tutorial/path-params/),
  [Query Parameters](https://fastapi.tiangolo.com/tutorial/query-params/),
  [Request Body](https://fastapi.tiangolo.com/tutorial/body/) — the first four pages only, stop
  before [Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) (that's week 2).
- [FastAPI — Response Model](https://fastapi.tiangolo.com/tutorial/response-model/) — worth adding
  to the four above, because it's the page where "the Pydantic model *is* the OpenAPI schema"
  stops being an abstract claim from plan §1 and becomes something you can see in `/docs`.
- Re-read `services/core/src/api/v1/core/index.ts` (health/readiness routes) — small enough to
  read end to end, and it's exactly what you're porting this week.

**Do not read yet:** [FastAPI's SQL Databases tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/).
It uses SQLModel synchronously, which is not what this project is doing — see plan §7's warning.
The readiness check's DB ping this week is a hand-written SQLAlchemy `text("select 1")`, not an ORM
query, so you don't need it.

## Hands-on task

**Mode A — worked example (I write this, ~15 lines, throwaway, not part of the real service):**
a `GET /add/{a}/{b}` route showing a path param, a query param, and a Pydantic response model, so
you see the shape once, in isolation, before touching the real thing.

**Mode B — you write, tests provided:**
1. I write `httpx`-based tests for `GET /api/v2/core/health` and `GET /api/v2/core/health/ready` —
   the readiness test asserts a real DB check: 200 when `credopass_v2_dev` is reachable, a
   meaningfully non-200 status when it isn't (mirroring v1's `health/ready`, which does a live
   connectivity + migration-applied check, not just a liveness ping).
2. You implement both routes until the tests pass.
3. You show me the diff; I review for whether the readiness check is actually checking the DB
   (not just returning 200 unconditionally) and whether the route signatures use type hints
   idiomatically rather than as decoration.

## Done when

- `uv run uvicorn app.main:app --reload --port 8090` boots without errors.
- `curl localhost:8090/api/v2/core/health/ready` returns 200 with the DB up; stopping the DB
  container and re-running the same curl shows a real failure response, not a false positive.
- `localhost:8090/docs` renders both routes. Open it next to v1's Scalar docs at
  `localhost:8080/api/v1/core/docs` — first concrete "here's what FastAPI gives you for free"
  moment from plan §1's OpenAPI-parity note.

## Retro (fill in at the end)

- What was harder than expected:
- Fundamentals gap surfaced, if any:
- Carry into week 2:
