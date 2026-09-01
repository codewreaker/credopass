# Status

See [`../LEARNING-WORKFLOW.md`](../LEARNING-WORKFLOW.md) for what this file is and how it's used.

**Resume here:** Week 1, `/health` is done and verified — `GET /health` returns 200 with
`{status, version, commit, timestamp}`. Next is `/health/ready`, which is the substantive one: it
does a real DB check against `credopass_v2_dev` and returns 503 (not 200) when the database is
unreachable *or* reachable-but-unmigrated. Then the pytest tests for both (Mode B — I write the
tests, you implement against them). **Blocking sub-decision:** readiness needs SQLAlchemy, which
`pyproject.toml` schedules for week 2. Either `uv add sqlalchemy asyncpg` early — recommended, since
a stubbed probe teaches nothing the `/` route didn't — or stub it and have the test assert the stub.

**Settled — routes stay unprefixed while learning.** Your call, 2026-09-01: build on plain
`/health`, `/docs`, etc., and defer `/api/v2/core/*` until the API is closer to release. The
prefixed `FastAPI()` constructor in `src/app/main.py` is kept, commented out inside a `"""` block,
as the note-to-self for that day. Applying it later is an `APIRouter(prefix=...)` plus one
`include_router` line — no handler body moves. **Do not "fix" routes back to the prefix**; week
files that still name `/api/v2/core/health` are stale on this point, not authoritative.

**Last session:** 2026-09-01 — closed week 0 (retro included) and wrote the first real route.
`GET /health` verified returning `200 {"status":"ok","version":"0.1.0","commit":"unknown",
"timestamp":"…Z"}`. Added `services/core-v2/project.json`, so the service has nx targets
(`corev2:start` / `test` / `lint` / `typecheck` / `verify`) — note the nx project is named
**`corev2`**, not `core-v2`. Corrected something previously logged as an open question: **there is
no Alembic decision to make** — plan §1 settles it (Drizzle writes every migration, Python maps onto
the result). Python-vs-TS ground covered: comment syntax, `Literal`, `datetime` the module vs. the
class, `default_factory` vs. passing a value at the call site, and `os` not having been replaced.

**Two findings worth carrying:**
- **`starlette.testclient` now warns that `httpx` is deprecated in favour of `httpx2`.** Week 1's
  test task is written around `httpx.AsyncClient`, so decide before writing tests whether to move to
  `httpx2` or pin and ignore the warning. It is a warning, not a failure.
- **`commit` reads `GIT_COMMIT`, which nothing sets locally**, so it is `"unknown"` in dev — matching
  v1, where the deploy pipeline injects it at build time. To see a real hash, add
  `GIT_COMMIT=$(git rev-parse --short HEAD)` to the `corev2:start` command in `project.json`.

**Carried from week 0's retro:** the fundamentals gap was syntax recall, not concepts — `for … in`
and decorators specifically. Both are load-bearing in week 1 (every route is `@app.get(...)`; every
Pydantic field is a type hint), so they should re-seat themselves through use rather than needing
separate study. The framing that worked was mapping onto TS: uv≈bun, Pydantic≈Zod, type hints≈TS
types. Worth keeping, with one caveat to watch in week 2 — `Depends` has no TS analogue, so the
mapping runs out exactly where FastAPI gets genuinely unfamiliar.

| Week | File | Status | Notes |
|---|---|---|---|
| 0 — crash course + scaffold | [week-00-crash-course.md](week-00-crash-course.md) | ✅ done | `uv` 0.12.5 · Python 3.13 · ruff + pytest green from a wiped venv. `credopass_v2_dev` created + migrated: 11 tables / 130 columns / 4 migrations, byte-identical to `credopass_db`; `db.ts status` says schema matches. "Why additive" answered; retro filled in. |
| 1 — FastAPI basics, health routes | [week-01-fastapi-basics.md](week-01-fastapi-basics.md) | 🟡 in progress | `GET /` and `GET /health` live and verified on :8090; nx targets wired; `Health` is a Pydantic model with `Literal["ok"]` and a required `timestamp`. Left: `/health/ready` with a real DB check, and pytest tests for both. |
| 2 — Depends, ProblemError, `/me` | [week-02-depends-problem-me.md](week-02-depends-problem-me.md) | ⬜ not started | Opens with `uv add sqlalchemy asyncpg pyjwt cryptography httpx`. |
| 3 — SQLAlchemy async, tenancy, `organizations.ts` | [week-03-tenancy-organizations.md](week-03-tenancy-organizations.md) | ⬜ not started | No Alembic: plan §1 settles this — Drizzle stays the only thing that writes migrations, `credopass_v2_dev` is migrated by the same Drizzle migrations, and Python maps onto the result with hand-written SQLAlchemy 2.0 models. |
| 4 — pydantic-ai, Copilot Phase A, `people`/`events` | [week-04-pydantic-ai-copilot-phase-a.md](week-04-pydantic-ai-copilot-phase-a.md) | ⬜ not started | |
| 5 — AG-UI, CopilotKit, Copilot in the web app | [week-05-ag-ui-copilot-live.md](week-05-ag-ui-copilot-live.md) | ⬜ not started | |
| 6 — `attendance.ts`, approval-gated tool, Copilot Phase B | [week-06-attendance-approval-gate.md](week-06-attendance-approval-gate.md) | ⬜ not started | |
| 7 — testing, adversarial cases, polish | [week-07-testing-polish.md](week-07-testing-polish.md) | ⬜ not started | |
| 8 — interview prep, no new code | [week-08-interview-prep.md](week-08-interview-prep.md) | ⬜ not started | |

Branch: `learn/api-v2-python` (one branch for the whole effort, per
[`LEARNING-WORKFLOW.md`](../LEARNING-WORKFLOW.md) §4) — checked out and in use. Two commits so far:
`bc09c18` (week 6–8 docs + initial core-v2 setup) and `0560871`. Uncommitted: this file, week 0's
ticked checkbox, and `main.py`. Untracked and worth a decision before the next commit —
`services/core-v2/project.json` (should be committed) and `services/core-v2/scratch/` (throwaway
practice code; either commit it deliberately or add it to `.gitignore`). Not merged to `main`, by
design.

Note: these were all drafted upfront rather than just-in-time (a deliberate deviation from
`LEARNING-WORKFLOW.md`'s original proposal — see that doc's note on why). Weeks 5–8 in particular
are likely to need revision once weeks 1–4 reveal actual pacing; that's expected, not a problem.

Legend: ⬜ not started · 🟡 in progress · ✅ done · ⏭️ skipped (say why in Notes)
