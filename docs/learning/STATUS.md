# Status

The live "where are we" pointer. Plan: [`../AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md).
Process: [`../LEARNING-WORKFLOW.md`](../LEARNING-WORKFLOW.md) (the three tutoring modes still
apply; its 8-week schedule does not).

**Resume here:** Day 2 — pydantic-ai fundamentals.
[`day-02-pydantic-ai-fundamentals.md`](day-02-pydantic-ai-fundamentals.md). **Day 1 is done and
verified** — it was Mode C scaffolding, so it was implemented for you rather than left as an
exercise; day 2 is where you start writing.

Before day 2: `cd services/core-v2 && uv add pydantic-ai`, and put your provider key in
`services/core-v2/.env` (gitignored). One provider, chosen once.

---

## ⚠️ Scope changed 2026-09-02 — read this before anything else

The Citadel interview moved to **~2026-09-16**. The 8-week plan
([`PYTHON-LEARNING-PLAN.md`](../PYTHON-LEARNING-PLAN.md)) is **superseded**, and the FastAPI port of
`services/core` is **cancelled** — not deferred.

What's being built instead, in 14 days: **the right-hand rail of the dashboard becomes an AI chat.**
A FastAPI service whose only job is one AG-UI endpoint, backed by a pydantic-ai agent whose tools
call the *existing* v1 TypeScript API over HTTP. It answers in prose **plus rendered UI** (asking
"what's coming up?" draws the real `EventCalendar` component), and pauses for human approval before
cancelling an event.

Three consequences for anyone picking this up cold:

- **No database access from Python, ever.** No SQLAlchemy, no `asyncpg`, no `DATABASE_URL` in
  `core-v2`. `credopass_v2_dev` was created and migrated in week 0 and is now unused — leave it.
- **No REST port.** `core-v2` serves `/api/v2/agent/organizer-copilot` and `/health`. There is no
  `/api/v2/core/*` and there will not be. Week 1's "routes stay unprefixed while learning" decision
  is moot; the agent endpoint has its own explicit path.
- **Week files 02–08 are archived** in [`archive-week-plan/`](archive-week-plan/) and describe
  cancelled work. Weeks 0 and 1 stayed here because that work was actually done.

---

## Where the code actually is

`services/core-v2` on uv 0.12.5 / Python 3.13. nx targets wired — **the nx project is `corev2`,
not `core-v2`** (`corev2:start` / `test` / `lint` / `typecheck` / `verify`).

**After day 1 (2026-09-02, verified):**
- `src/app/main.py` — `GET /health` only. `GET /` gone; the commented-out `/api/v2/core` block
  gone. Its docstring now states the service's actual job: one AG-UI endpoint, no database.
- `src/app/settings.py` — new. `Settings(BaseSettings)` with `v1_api_url`, `llm_api_key`,
  `git_commit`, cached behind `get_settings()`. `Health.commit` reads from it.
- `tests/test_health.py` — new, 3 tests. `tests/test_scaffold.py` deleted.
- `scratch/` gitignored (day 2 puts a toy agent there; it's meant to be disposable).
- `nx run corev2:verify` green: 0 lint errors, 0 pyright errors, 3 tests in 0.20s.
- Booted and curled: `{"status":"ok","version":"0.1.0","commit":"fda5e82","timestamp":"…Z"}`.
  `/openapi.json` lists `/health` and nothing else.

**Nothing in this service opens a database connection, and nothing should.**

**Both week-1 findings are now closed:**
- **`httpx2` deprecation warning — settled: pinned and ignored.** It's Starlette's own import, not
  our code, and chasing it costs a day. Suppressed via `filterwarnings` in `pyproject.toml`, with
  the reasoning in a comment there.
- **`GIT_COMMIT` — settled: wired into the nx target.** `corev2:start` now sets it from
  `git rev-parse --short HEAD`, so `/health` reports a real hash in dev. Verified: `fda5e82`.

**Carried from week 0's retro:** the fundamentals gap was syntax recall, not concepts — `for … in`
and decorators. Decorators are load-bearing from day 2 onward (`@agent.tool` is the whole API), so
they'll re-seat through use. The TS mapping that worked — uv≈bun, Pydantic≈Zod, type hints≈TS types
— still holds for pydantic-ai (`Agent`≈a client with a tool registry, `deps_type`≈a DI container).
**Where it runs out:** there's no TS analogue for "the docstring is part of the contract." Day 2's
deliberate experiment is aimed at exactly that.

---

## The 14 days

| Day | File | Status | Notes |
|---|---|---|---|
| 1 — reshape the service | [day-01-reshape-service.md](day-01-reshape-service.md) | ✅ done | 2026-09-02. Mode C, so implemented for you. `verify` green; `/health` serves a real commit hash. Both week-1 open findings closed. |
| 2 — pydantic-ai fundamentals | [day-02-pydantic-ai-fundamentals.md](day-02-pydantic-ai-fundamentals.md) | ⬜ not started | Toy agent in `scratch/`. Docstrings-are-prompt-surface is the key idea. |
| 3 — the real agent, offline | [day-03-real-agent-offline.md](day-03-real-agent-offline.md) | ⬜ not started | **Milestone:** real answer about real events, in a terminal. |
| 4 — testing agents | [day-04-testing-agents.md](day-04-testing-agents.md) | ⬜ not started | `TestModel`/`FunctionModel`, suite green with the key unset. |
| 5 — AG-UI protocol | [day-05-ag-ui-protocol.md](day-05-ag-ui-protocol.md) | ⬜ not started | Hardest conceptual day. Protocol before SDK. Ends at `curl -N`. |
| 6 — `StateDeps` | [day-06-state-deps.md](day-06-state-deps.md) | ⬜ not started | Short. Also the header dress-rehearsal for day 7. |
| 7 — the rail becomes a chat | [day-07-rail-chat.md](day-07-rail-chat.md) | ⬜ not started | **Milestone + riskiest day.** First React/CopilotKit. Fallback demo from here. |
| 8 — generative UI | [day-08-generative-ui.md](day-08-generative-ui.md) | ⬜ not started | **The demo.** `useRenderTool` → the real `EventCalendar`. |
| 9 — HITL backend | [day-09-hitl-backend.md](day-09-hitl-backend.md) | ⬜ not started | `curl` only, no React. Approval-vs-authz is the interview answer. |
| 10 — HITL frontend | [day-10-hitl-frontend.md](day-10-hitl-frontend.md) | ⬜ not started | **The better demo.** Confirm/deny card that really blocks. |
| 11–14 — hardening, write-up, rehearsal | [day-11-14-hardening-and-prep.md](day-11-14-hardening-and-prep.md) | ⬜ not started | 11–12 are the cut zone. 13–14 are not. |

**Milestones:** day 3 the agent works · day 7 it's in the app (fallback demo) · day 8 generative UI
(the demo) · day 10 HITL (the better demo). **If you slip, cut days 11–12, never days 1–8.**

Branch: `learn/api-v2-python` (kept, despite the name now being wrong — renaming it mid-effort buys
nothing). Commit messages tagged `[day3]` etc. so `git log --oneline` reads as progress. Not merged
to `main`, by design.

Legend: ⬜ not started · 🟡 in progress · ✅ done · ⏭️ skipped (say why in Notes)
