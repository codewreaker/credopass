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

---

# Learn

## httpx, async

- [httpx — async](https://www.python-httpx.org/async/) — `AsyncClient`, connection pooling, and
  why a client per call throws away the pool.

One long-lived `AsyncClient` beats one per call because the client owns a connection pool: TCP
handshakes and TLS negotiation are reused across requests. Creating one per tool call throws that
away and adds latency to every single call — which, in an agent that chains three tool calls per
question, is three handshakes the user waits through.

It also has a lifecycle: a client must be closed. One client, created at startup, closed at
shutdown, passed to tools through deps, is both faster and simpler than one per call.

## What you're calling — read the endpoints, don't guess

- `services/core/src/api/v1/core/events.ts:67` — `GET /events`, query `group: 'upcoming'|'past'`.
  **That enum maps straight onto your tool's argument**; don't invent a different vocabulary. If
  v1 says `upcoming`, your `Literal` says `upcoming`.
- `services/core/src/api/v1/core/events.ts:188` — `GET /events/{id}`.
- `services/core/src/services/event-status.ts` — status is **derived from timestamps, not a stored
  column**. Worth knowing before you write a tool that talks about status.

## The safety property you're building

Every tool forwards the caller's own bearer token and `X-Organization-Id`. The agent therefore
inherits exactly the permissions the signed-in organizer already had, and gains none of its own.
There is no new authorization surface to audit.

This is interview answer #2 in the plan — and today you're building the thing you'll be describing,
which is why the day's spec insists all header-building lives in *one* place. A tool that builds
its own headers is a tool that can quietly forget one.

---

# Build

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

---

# Done when

- `uv run python scripts/ask_copilot.py "what events do I have coming up?"` prints a real answer
  naming your real events.
- `uv run python scripts/ask_copilot.py "tell me about <a real event name>"` makes the agent call
  `list_events` *then* `get_event_summary` — two hops, chained, from one question. Watch for it.
- With a deliberately-corrupted token, the agent says something sensible rather than dumping a 401
  traceback.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| 401 from every tool | Token expired (they last about an hour) — re-copy it. |
| Agent answers without calling anything | Docstring too vague, or `instructions` didn't say to prefer tools. |
| Second question is slower than the first | A new `AsyncClient` per call — you're re-handshaking. |
| `ctx.deps` is `None` | `deps=` not passed to `run()`. |
| 404 on an event you can see in the UI | Missing `X-Organization-Id`, so v1 resolved a different tenant. |

---

# Say it out loud

> "Each tool forwards the signed-in organizer's own bearer token and organization header to the
> existing API, so the agent inherits the caller's permissions and gains no new ones — there's no
> separate authorization surface to audit. One long-lived `httpx.AsyncClient` is shared through
> deps so the connection pool is reused rather than re-handshaking on every tool call."

---

## Retro

- Did it chain the two tools unprompted, or did you have to ask twice:
- What was harder than expected:
- Carry into day 4:
