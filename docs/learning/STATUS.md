# Status

See [`../LEARNING-WORKFLOW.md`](../LEARNING-WORKFLOW.md) for what this file is and how it's used.

**Resume here:** Week 0 is closed — the "why additive" done-when is ticked. Week 1 is underway:
the service runs (`nx run corev2:start`, :8090, a `GET /` route) and Pydantic is being exercised in
[`services/core-v2/scratch/main.py`](../../services/core-v2/scratch/main.py) — a `User` model with
`@property`, `@classmethod` and a `from_string` parser, which is the type-hints objective landing.
Left in week 1: the health + readiness routes ported from
`services/core/src/api/v1/core/index.ts`, and a pytest test against them with `httpx.AsyncClient`.
One sub-decision inside that: readiness does a real DB check, but SQLAlchemy isn't installed until
week 2 — either `uv add sqlalchemy asyncpg` early, or stub the check and have the test assert the
stub. Pick deliberately.

**Settled — routes stay unprefixed while learning.** Your call, 2026-09-01: build on plain
`/health`, `/docs`, etc., and defer `/api/v2/core/*` until the API is closer to release. The
prefixed `FastAPI()` constructor in `src/app/main.py` is kept, commented out inside a `"""` block,
as the note-to-self for that day. Applying it later is an `APIRouter(prefix=...)` plus one
`include_router` line — no handler body moves. **Do not "fix" routes back to the prefix**; week
files that still name `/api/v2/core/health` are stale on this point, not authoritative.

**Last session:** 2026-09-01 — closed week 0, retro included. Added `services/core-v2/project.json`,
so the service has nx targets (`corev2:start` / `test` / `lint` / `typecheck` / `verify`) — note the
nx project is named **`corev2`**, not `core-v2`. Confirmed the dependency set is still just
`fastapi[standard]`; SQLAlchemy/asyncpg are week 2's `uv add`, per `pyproject.toml`'s schedule
comment. Corrected one thing that had been recorded as an open question: **there is no Alembic
decision to make** — plan §1 already settles it (Drizzle writes every migration, Python maps onto
the result). Also covered Python comment syntax (`#` per line; `"""` is a string expression, not a
comment).

**Carried from week 0's retro:** the fundamentals gap was syntax recall, not concepts — `for … in`
and decorators specifically. Both are load-bearing in week 1 (every route is `@app.get(...)`; every
Pydantic field is a type hint), so they should re-seat themselves through use rather than needing
separate study. The framing that worked was mapping onto TS: uv≈bun, Pydantic≈Zod, type hints≈TS
types. Worth keeping, with one caveat to watch in week 2 — `Depends` has no TS analogue, so the
mapping runs out exactly where FastAPI gets genuinely unfamiliar.

| Week | File | Status | Notes |
|---|---|---|---|
| 0 — crash course + scaffold | [week-00-crash-course.md](week-00-crash-course.md) | ✅ done | `uv` 0.12.5 · Python 3.13 · ruff + pytest green from a wiped venv. `credopass_v2_dev` created + migrated: 11 tables / 130 columns / 4 migrations, byte-identical to `credopass_db`; `db.ts status` says schema matches. "Why additive" answered; retro filled in. |
| 1 — FastAPI basics, health routes | [week-01-fastapi-basics.md](week-01-fastapi-basics.md) | 🟡 in progress | App boots on :8090 with `GET /`; nx targets wired. Pydantic models being practised in `scratch/`. Left: health + readiness routes, an `httpx.AsyncClient` test, and the `/api/v2/core` prefix decision. |
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
