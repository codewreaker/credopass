# Day 3 — the real agent, in a terminal

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2, §3

**Milestone day.** By tonight the agent answers a real question about your real events. Everything
after this is transport and UI — the intelligence is done on day 3 of 14, deliberately, because
it's the part that can't be rushed at the end.

No AG-UI, no React, no FastAPI route yet. Just `uv run python scripts/ask_copilot.py "…"`.

## Objectives

By the end of today you can:
- Explain why one long-lived `httpx.AsyncClient` beats one per call.
- Explain the safety property in one sentence: **the agent forwards the caller's own token, so it
  inherits the caller's permissions and gains no new ones.** This is interview answer #2 in
  plan §8 — you're building the thing you'll be describing.

## New today

- [httpx — async](https://www.python-httpx.org/async/) — `AsyncClient`, connection pooling, and
  why a client per call throws away the pool.
- **Read the endpoints you're calling**, don't guess their shapes:
  - `services/core/src/api/v1/core/events.ts:67` — `GET /events`, query `group: 'upcoming'|'past'`.
    That enum maps straight onto your tool's argument; don't invent a different vocabulary.
  - `services/core/src/api/v1/core/events.ts:188` — `GET /events/{id}`.
  - `services/core/src/services/event-status.ts` — status is **derived from timestamps, not a
    stored column**. Worth knowing before you write a tool that talks about status.

## Hands-on task

**Mode B — you write. Spec below; I'll write `TestModel` tests tomorrow, so build it testable:
tools as module-level functions the agent registers, not closures buried in a factory.**

1. **`src/app/agent/deps.py`** — a dataclass holding what every tool needs: an `httpx.AsyncClient`,
   the caller's bearer token, and the active organization id. One client, created once, passed in.

2. **`src/app/agent/client.py`** — a thin v1 caller. One place that knows to attach
   `Authorization: Bearer …` and `X-Organization-Id`, and one place that turns a non-2xx into
   something the agent can report. Every tool goes through it; no tool builds headers itself.

3. **`src/app/agent/copilot.py`** — `organizer_copilot`, with instructions that say what CredoPass
   is and that it should use tools rather than guess. Two tools today:
   - `list_events(when: Literal['upcoming', 'past', 'all'])` → `GET /events`
   - `get_event_summary(event_id: str | None)` → `GET /events/{id}`

   Both `@agent.tool` (they need `ctx.deps`). **Write the docstrings as instructions to a
   colleague** — yesterday's experiment was about exactly this.

4. **`scripts/ask_copilot.py`** — takes a question on argv, mints deps from env
   (`COPILOT_DEV_TOKEN`, `COPILOT_DEV_ORG_ID`), runs the agent, prints the answer.

**Getting a real token:** sign in to the web app at `:5000`, open devtools → Application → Local
Storage → the Supabase session, copy the `access_token`. It expires in an hour; you'll re-copy it
several times over the next few days. That friction disappears on day 7 when the browser supplies
it. Put it in `.env`, not on the command line — shell history is the wrong place for a bearer token.

`event_id: str | None` is deliberate: today `None` should just error helpfully. Day 6 makes it
resolve from `active_event_id`, and the signature won't have to change.

```bash
cd services/core-v2
uv add httpx
# and in another terminal, v1 must be running:
nx run coreservice:start
```

## Done when

- `uv run python scripts/ask_copilot.py "what events do I have coming up?"` prints a real answer
  naming your real events.
- `uv run python scripts/ask_copilot.py "tell me about <a real event name>"` makes the agent call
  `list_events` *then* `get_event_summary` — two hops, chained, from one question. Watch for it.
- With a deliberately-corrupted token, the agent says something sensible rather than dumping a 401
  traceback.

## Retro

- Did it chain the two tools unprompted, or did you have to ask twice:
- What was harder than expected:
- Carry into day 4:
