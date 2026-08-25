# Status

See [`../LEARNING-WORKFLOW.md`](../LEARNING-WORKFLOW.md) for what this file is and how it's used.

**Resume here:** Week 0 is mechanically complete — scaffold built, `credopass_v2_dev` created and
migrated, everything verified. Two things left, both yours and neither blocking:
skim plan §5 and note what's actually rusty, and be able to say why `core-v2` is additive rather
than a fork (week 0's last done-when). Then start
[`week-01-fastapi-basics.md`](week-01-fastapi-basics.md) — it opens with `uv add fastapi
"uvicorn[standard]"` and a Mode A worked example from me before you write the health routes.

**Last session:** 2026-08-24 — added verified resource links across the plan (§5/§6/§7/Key sources)
and all week files; built and then ran the whole week-0 scaffold end to end. Five plan-vs-reality
findings are recorded in week 0's "Reality check" section.

| Week | File | Status | Notes |
|---|---|---|---|
| 0 — crash course + scaffold | [week-00-crash-course.md](week-00-crash-course.md) | 🟡 all but the reading | `uv` 0.12.5 · Python 3.13 · ruff + pytest green from a wiped venv. `credopass_v2_dev` created + migrated: 11 tables / 130 columns / 4 migrations, byte-identical to `credopass_db`; `db.ts status` says schema matches. Left: plan §5 skim + the "why additive" answer. |
| 1 — FastAPI basics, health routes | [week-01-fastapi-basics.md](week-01-fastapi-basics.md) | ⬜ not started | |
| 2 — Depends, ProblemError, `/me` | [week-02-depends-problem-me.md](week-02-depends-problem-me.md) | ⬜ not started | |
| 3 — SQLAlchemy async, tenancy, `organizations.ts` | [week-03-tenancy-organizations.md](week-03-tenancy-organizations.md) | ⬜ not started | |
| 4 — pydantic-ai, Copilot Phase A, `people`/`events` | [week-04-pydantic-ai-copilot-phase-a.md](week-04-pydantic-ai-copilot-phase-a.md) | ⬜ not started | |
| 5 — AG-UI, CopilotKit, Copilot in the web app | [week-05-ag-ui-copilot-live.md](week-05-ag-ui-copilot-live.md) | ⬜ not started | |
| 6 — `attendance.ts`, approval-gated tool, Copilot Phase B | [week-06-attendance-approval-gate.md](week-06-attendance-approval-gate.md) | ⬜ not started | |
| 7 — testing, adversarial cases, polish | [week-07-testing-polish.md](week-07-testing-polish.md) | ⬜ not started | |
| 8 — interview prep, no new code | [week-08-interview-prep.md](week-08-interview-prep.md) | ⬜ not started | |

Branch: `learn/api-v2-python` (one branch for the whole effort, per
[`LEARNING-WORKFLOW.md`](../LEARNING-WORKFLOW.md) §4). Nothing committed yet.

Note: these were all drafted upfront rather than just-in-time (a deliberate deviation from
`LEARNING-WORKFLOW.md`'s original proposal — see that doc's note on why). Weeks 5–8 in particular
are likely to need revision once weeks 1–4 reveal actual pacing; that's expected, not a problem.

Legend: ⬜ not started · 🟡 in progress · ✅ done · ⏭️ skipped (say why in Notes)
