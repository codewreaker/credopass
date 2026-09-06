# Status

The live "where are we" pointer — **start every session here.**

Plan: [`../AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) · Day files: `day-N-*.md` in this directory.

**Each day is one self-contained file, read top to bottom:**

| Section | What it's for |
|---|---|
| **Learn** | The concepts, before you write anything. Doc links live here, with a time budget. |
| **Build** | The task, split morning / afternoon, with a checkpoint between them. |
| **Done when** | The checks that decide whether the day is finished. |
| **If it breaks** | Symptom → actual cause. Come back here at 11pm; this is the part that saves time. |
| **Say it out loud** | The interview answer the day earns. If you can't say it without notes, re-read Learn. |
| **Retro** | Fill in at the end. Becomes the record of what actually happened. |

**Resume here:** Day 1 — pydantic-ai. [`day-1-pydantic-ai.md`](day-1-pydantic-ai.md).

Before Monday: `cd services/ai-chat && uv add pydantic-ai`, and put your provider key in
`services/ai-chat/.env` (gitignored). One provider, chosen once, not revisited.

---

## ⚠️ Recompressed 2026-09-06 — 14 days became 5

The available prep time dropped from ~14 working days to **5: Mon 8 – Fri 12 September**, ~6–8h/day.
Interview ~2026-09-16, so Sat 13 – Mon 15 are slack, not plan.

**The scope did not change.** Same deliverable, same three technologies, same five interview
answers. What changed:

- **I write every test, and the pure boilerplate.** CORS, the CopilotKit provider wiring,
  `ConfirmCard` styling, three throwaway worked examples. You read the tests — they're the
  executable spec — but you don't write them.
- **You write everything the interview touches**: the agent, the tools, the deps and their
  composition with `StateDeps`, the v1 client, **the AG-UI mount and the per-request deps**, the
  approval tool, and the React hook bindings. The goal that "I implemented an AG-UI integration"
  is literally true is what set this line.
- **Learning is folded into the build.** No standalone Python-fundamentals day, no
  read-the-protocol-cold day. The Python primer is 20 minutes inside day 1; AG-UI's event
  vocabulary is learned from your own `curl -N` output on day 3, docs open beside it.
- **`get_checkin_state` starts cut.** Three tools, not four. It was already named as the first cut
  in the 14-day plan; at 5 days it never gets built unless Friday runs clean.

The eleven old day files are deleted. If you find a reference to `day-01-…` through `day-11-14-…`,
it's a stale link, not a missing file.

**Still true, from 2026-09-02:** the FastAPI port of `services/core` is **cancelled**, not deferred.
**No database access from Python, ever** — no SQLAlchemy, no `asyncpg`, no `DATABASE_URL` in
`ai-chat`. `credopass_v2_dev` was dropped. `ai-chat` serves `/api/v1/ai-chat/agent/organizer-copilot`
and `/health`, and no other REST surface.

---

## Where the code actually is

`services/ai-chat` on uv 0.12.5 / Python 3.13. nx targets wired as `ai-chat:start` / `test` /
`lint` / `typecheck` / `verify`.

**Scaffold complete (2026-09-02, verified) — this was the old day 1, and it is done:**
- `src/app/main.py` — `GET /health` only. Its docstring states the service's actual job: one AG-UI
  endpoint, no database.
- `src/app/settings.py` — `Settings(BaseSettings)` with `v1_api_url`, `llm_api_key`, `git_commit`,
  cached behind `get_settings()`.
- `tests/test_health.py` — 3 tests.
- `scratch/` gitignored (day 1 puts a toy agent there; it's meant to be disposable).
- `nx run ai-chat:verify` green: 0 lint errors, 0 pyright errors, 3 tests in 0.20s.
- Booted and curled: `{"status":"ok","version":"0.1.0","commit":"fda5e82",…}`.

**Both earlier findings closed:** the `httpx2` deprecation warning is pinned and ignored (it's
Starlette's own import, reasoning in `pyproject.toml`); `GIT_COMMIT` is wired into the nx start
target from `git rev-parse --short HEAD`.

**Nothing in this service opens a database connection, and nothing should.**

**Carried from the crash course:** the fundamentals gap was syntax recall, not concepts — `for … in`
and decorators. Decorators are load-bearing from day 1 onward (`@agent.tool` is the whole API), so
they re-seat through use. The TS mapping that worked — uv≈bun, Pydantic≈Zod, type hints≈TS types —
still holds (`Agent`≈a client with a tool registry, `deps_type`≈a DI container). **Where it runs
out:** there's no TS analogue for "the docstring is part of the contract." Day 1's Learn covers
both — Part 1 the syntax, Part 2 the docstring point.

---

## The 5 days

| Day | File | Status | Milestone |
|---|---|---|---|
| **1 — Mon 8** | [day-1-pydantic-ai.md](day-1-pydantic-ai.md) | ⬜ not started | Toy agent in `scratch/`. Docstrings-are-prompt-surface is the idea that pays for the week. |
| **2 — Tue 9** | [day-2-real-agent.md](day-2-real-agent.md) | ⬜ not started | **The agent works in a terminal.** Real answer, real events. Everything after is transport and UI. |
| **3 — Wed 10** | [day-3-ag-ui.md](day-3-ag-ui.md) | ⬜ not started | **The protocol works.** `curl -N` streams SSE; `StateDeps` composed. Most compressed day — has a 1pm escape hatch. |
| **4 — Thu 11** | [day-4-rail-and-generative-ui.md](day-4-rail-and-generative-ui.md) | ⬜ not started | **The demo.** Chat in the real app before lunch, rendered `EventCalendar` after it. Biggest day. |
| **5 — Fri 12** | [day-5-hitl-and-rehearsal.md](day-5-hitl-and-rehearsal.md) | ⬜ not started | **The better demo** + write-up + two cold runs + a recording. The afternoon is not optional. |

**If you slip**, sacrifice in this order: ① `get_checkin_state` (already cut) · ② Friday's polish and
the second renderer · ③ Friday's React HITL half, keeping the backend and demoing the pause via
`curl` · ④ Thursday afternoon's generative UI, leaving plain chat as the demo.

**Never cut:** day 2, day 3, or Friday afternoon's rehearsal.

Branch: `learn/api-v2-python` (kept, despite the name now being wrong — renaming it mid-effort buys
nothing). Commit messages tagged `[day3]` etc. so `git log --oneline` reads as progress. Not merged
to `main`, by design.

Legend: ⬜ not started · 🟡 in progress · ✅ done · ⏭️ skipped (say why)
