# Learning workflow — how the plan in `PYTHON-LEARNING-PLAN.md` actually gets run

This is the companion to [`PYTHON-LEARNING-PLAN.md`](PYTHON-LEARNING-PLAN.md). That document is
*what* gets built and learned, in what order, and why. This document is *how* each session runs —
what file to open, what mode the tutoring is in, and how we both know where we are. Read the plan
first; this doc assumes it.

**Status: in use.** All nine week files exist and week 0's scaffold is built. This document itself
is process only — it answers the four questions asked about structure, and doesn't change as work
progresses. Where things actually stand is [`learning/STATUS.md`](learning/STATUS.md).

---

## 1. Three documents, three lifespans

One file trying to be the plan, the tracker, and the day-to-day task list at once would churn
constantly and none of the three jobs would be done well. Splitting them by how often they change:

| Document | Job | Written | Edited |
|---|---|---|---|
| `docs/PYTHON-LEARNING-PLAN.md` | The stable target — architecture, route map, schedule | Once, already done | Only on a genuine plan change (a scope cut we decide together), not routine progress |
| `docs/learning/week-NN-*.md` | The detailed brief for **one** week — objectives, reading, the actual hands-on task | All nine written upfront (weeks 0–8) — see note below | Rewritten if reality diverges enough to matter; retro filled in at the end of each |
| `docs/learning/STATUS.md` | The live "where are we" pointer | Now (empty/not-started state) | Every session |

### On writing all nine upfront instead of just-in-time

The original proposal here was rolling-wave planning — write each week's file right before it
starts, since a `week-08.md` written before week 1 begins rests on assumptions (how long JWKS
verification actually takes, whether a fundamentals gap surfaces) that are likely to be wrong by
the time week 8 arrives. That tradeoff is real and unchanged. The decision, made explicitly: write
all nine now anyway, preferring to see the whole path upfront over discovering it piecemeal, and
accept that later week files — most likely weeks 5–8 — will probably need a rewrite once earlier
weeks reveal how the pacing actually holds up. When that happens, the fix is to edit the affected
week file directly (and note the change in that week's retro, or in `STATUS.md` if it affects the
plan generally) rather than pretend the original version was accurate.

---

## 2. What a week file looks like concretely

Generated at the start of each week (or the end of the prior one), following this shape. Using
week 2 as a live example, since it's substantial enough to show every section doing real work:

```markdown
# Week 2 — FastAPI depth, ProblemError, /me

Status: in progress · started 2026-09-08

## Objectives
By the end of this week you can:
- Explain what a FastAPI `Depends` actually does at request time, not just copy the syntax.
- Write a pytest test against a FastAPI app using `httpx.AsyncClient`, no browser involved.
- Say why `ProblemError`'s "generic detail unless dev mode" rule exists, from `problem.ts`.

## New this week (read before starting)
- FastAPI dependencies: https://fastapi.tiangolo.com/tutorial/dependencies/
- Async SQLAlchemy engine/session basics: (link)
- Re-read `services/core/src/http/problem.ts` and `middleware/caller.ts:53-95` — you're porting
  this, not summarizing it from memory.

## Hands-on task
1. **Worked example first** (I write this, ~20 lines, throwaway): a minimal `Depends` chain
   unrelated to CredoPass, showing request → dependency → handler.
2. **Your task**: port `ProblemError` (`problem.ts:105-136`) and its FastAPI exception handler.
   Spec: [link to failing pytest tests I'll have written — see §3 below].
3. **Your task**: `get_current_account` dependency — verify a Supabase JWT via JWKS, resolve to
   an account. Spec: same, tests provided.
4. **Your task**: `GET /api/v2/core/me`, `GET /api/v2/core/me/context` using the above.

## Done when
- `uv run pytest` green on this week's test file, no network calls.
- `GET /api/v2/core/me` with your real browser session token returns your real account.

## Retro (fill in at the end)
- What was harder than expected:
- Fundamentals gap surfaced, if any:
- Carry into week 3:
```

Naming: `docs/learning/week-00-crash-course.md`, `week-01-fastapi-basics.md`, ... `week-08-prep.md`
— zero-padded, one short slug so they sort correctly and are guessable from the plan's table.

---

## 3. The tutoring model

You were explicit: you want to learn this, not receive a finished service. "I scaffold everything
with TODOs" sounds like it protects that, but it doesn't hold up for a *new* concept — filling in a
TODO for an API shape you've never seen means guessing, which is unproductive struggle, not
learning. And "you write, I review" only works well when there's an unambiguous target to review
against — vague prose specs produce disagreements about what was even being asked. So this uses
three modes, chosen by what kind of task it is, not one blanket rule:

### Mode A — worked example, then you build the analogous thing
**When:** the first time a genuinely new concept shows up (first `Depends`, first async SQLAlchemy
session, first pydantic-ai `Agent`, first AG-UI wiring).
**How:** I write a small, throwaway, heavily-commented example — 15–30 lines, not connected to the
real service — demonstrating the shape of the new thing in isolation. I explain it. Then you build
the *actual* week's task using the same pattern, from a spec, not from my example copy-pasted.

### Mode B — tests-as-spec, you implement, I review (the default, most of the 8 weeks)
**When:** applying an already-demonstrated pattern to a new route/module — most of §2's Tier-1 port
work once week 2 has established the shape.
**How:**
1. I write the spec (a paragraph, referencing the exact TS source line) **and** a failing pytest
   test or two encoding the expected behavior, including the edge cases that matter (e.g. a
   cross-tenant request must 404, not 403 — see `PYTHON-LEARNING-PLAN.md` §1).
2. You implement until the test goes green.
3. You show me the diff. I review for what the test *can't* catch — idiom, whether an `async def`
   is doing a blocking call, whether the tenancy filter is actually there or just happens to pass
   the test's one fixture.
4. One, maybe two, revision rounds. If you're genuinely stuck after a real attempt, I explain the
   specific sticking point — not the whole solution, and not until you've tried.

Tests-as-spec beats a prose spec alone because it's unambiguous and checkable without me having to
manually verify every subtlety, and it mirrors how you'd actually work on a real team.

### Mode C — I just scaffold it
**When:** pure infrastructure with no learning content — `uv init`, the Docker Compose entry,
`ruff`/`pyright` config, project layout. Typing this by hand teaches nothing about FastAPI or
Python; hand-writing it would be the TS-repo equivalent of hand-rolling `bun src/index.ts` instead
of using the Nx target.

**Default rule:** if you ask me to just implement a route directly, I'll ask once whether you want
to try it first under Mode B before I do. That's the only guardrail — if you say you're short on
time and want it done, I'll do it, but the default is always "you write it."

---

## 4. Progress tracking

**`docs/learning/STATUS.md`** — one compact file, updated at the end of every session (not just
end of week, since a week can span several sessions). Format:

```markdown
# Status

**Resume here:** Week 2, task 3 (`get_current_account` dependency) — tests written, not yet green.

| Week | Status | Notes |
|---|---|---|
| 0 | ✅ done | Skipped most of the crash course, fundamentals were solid. Async took longer than expected. |
| 1 | ✅ done | |
| 2 | 🟡 in progress | JWKS verification took a full extra session — flagged in critique as an easy-to-underestimate yak, it was. |
| 3 | ⬜ not started | |
| ... | | |
```

This is the single source of truth for "where are we," and the reason the *next* session — possibly
in a fresh conversation with no memory of this one — can pick up correctly: it opens
`docs/learning/STATUS.md`, reads "Resume here," and opens the matching week file. Without this, a
new session has to reconstruct state from git log and guesswork.

**Git**: one branch, `learn/api-v2-python`, for the whole effort — not one branch per week. Weekly
branches would need constant merging for something that's inherently a linear, building-on-itself
sequence; a single branch with granular commits is simpler and matches §1 of the plan (additive,
never wired into prod by default, so there's no urgency to merge to `main`). Commit messages tagged
by week so `git log --oneline` doubles as a progress narrative:
`[week2] port ProblemError + get_current_account dependency`. Merge to `main` only if/when you
decide a milestone is worth landing there — not on any fixed schedule.

---

## 5. Handling rustiness — mostly just-in-time, a little upfront, some reactive

Three layers, not one:

1. **Upfront, week 0 only, and narrow**: type-hint syntax and async/await basics from
   `PYTHON-LEARNING-PLAN.md` §6 — nothing else. These two are pervasive from week 1's first FastAPI
   route onward, so deferring them would make every early code snippet confusing. Everything else
   in §5/§6 (Protocol, PEP 695 generics, dataclasses, pattern matching) stays as reference links,
   *not* required week-0 reading.
2. **Just-in-time, surfaced in the week file that first needs it**: each week file's "New this
   week" section pulls in exactly the §6 links that week's task actually touches — e.g.
   `dataclasses` gets surfaced in week 4 right when `deps_type` needs one, `Protocol` only if/when
   an agent tool signature actually calls for structural typing. Reading it in the context of the
   task that needs it is what makes it stick; reading it in the abstract in week 0 mostly doesn't.
3. **Reactive, during Mode B review**: if I spot a fundamentals gap mid-review that isn't already
   covered by a linked resource — a mutable-default-argument bug, confusion about what `await`
   actually suspends — I flag it immediately as a short inline explanation, not a scheduled detour,
   and add a line to that week's retro so it's on record rather than silently patched over.

The plan already time-boxed week 0 hard (3–5 days, skip early if it's trivial) — this just makes
explicit that the *rest* of the rustiness-handling isn't a separate curriculum, it's woven into
each week's own material as it comes up.
