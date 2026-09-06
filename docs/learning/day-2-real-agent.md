# Day 2 — Tue 9 Sep — the real agent, in a terminal

Plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2, §3 · ~7h · Reading budget: 15 min

**Milestone day.** By tonight the agent answers a real question about your real events. Everything
after this is transport and UI — the intelligence is done on day 2 of 5, deliberately, because it's
the part that can't be rushed at the end.

No AG-UI, no React, no FastAPI route yet. Just `uv run python scripts/ask_copilot.py "…"`.

This day merges the old plan's days 3 and 4. **You build the agent; I write the test suite
alongside you** and hand it over when your tools exist. That's the compression: you get the same
safety net without spending an afternoon on `MockTransport`.

## Objectives

By tonight you can:
- Explain why one long-lived `httpx.AsyncClient` beats one per call.
- Explain the safety property in one sentence: **the agent forwards the caller's own token, so it
  inherits the caller's permissions and gains no new ones.** That's interview answer #2 — today
  you're building the thing you'll be describing.
- Read my test suite and say what `TestModel` and `FunctionModel` each replace.

---

# Learn

## httpx, async (~15 min)

[httpx — async](https://www.python-httpx.org/async/) — `AsyncClient` and connection pooling.

One long-lived `AsyncClient` beats one per call because the client owns a connection pool: TCP
handshakes and TLS negotiation are reused. Creating one per tool call throws that away and adds
latency to every call — in an agent that chains three tool calls per question, that's three
handshakes the user waits through.

It also has a lifecycle: a client must be closed. **One client, created at startup, closed at
shutdown, passed to tools through deps** is both faster and simpler than one per call.

## What you're calling — read the endpoints, don't guess

- `services/core/src/api/v1/core/events.ts:67` — `GET /events`, query `group: 'upcoming'|'past'`.
  **That enum maps straight onto your tool's argument.** If v1 says `upcoming`, your `Literal` says
  `upcoming`. Don't invent a different vocabulary.
- `services/core/src/api/v1/core/events.ts:188` — `GET /events/{id}`.
- `services/core/src/services/event-status.ts` — status is **derived from timestamps, not a stored
  column.** Worth knowing before you write a tool that talks about status.

## The safety property you're building

Every tool forwards the caller's own bearer token and `X-Organization-Id`. The agent therefore
inherits exactly the permissions the signed-in organizer already had, and gains none of its own.
There is no new authorization surface to audit.

This is why today's spec insists all header-building lives in **one** place. A tool that builds its
own headers is a tool that can quietly forget one.

## Testing — read only, ~15 min, so you can talk about it

I'm writing the suite. You need to be able to explain it, not write it.

**`TestModel`** — calls every registered tool once with generated arguments. A smoke test: "is this
wired up at all?" It does **not** prove the agent would pick the right tool in reality; it calls
everything regardless of the prompt.

**`FunctionModel`** — you supply a function that plays the model, so you decide what it does and
can assert precisely: "this message calls `list_events` with `when='upcoming'`, specifically."

**The half everyone forgets:** replacing the model does **not** stub your tools. They still run,
and this project's tools make HTTP calls. So the suite also stubs the transport with
`httpx.MockTransport`. Model replaced, HTTP replaced, tools genuinely executed.

**`ALLOW_MODEL_REQUESTS = False`** in `tests/conftest.py` makes any real model request raise. That's
the difference between "we don't make live calls in CI" as a convention someone eventually breaks
and as something the library refuses.

*(If you have spare time at the end of the week and want the wrote-it-myself version of this answer,
writing one `FunctionModel` test is the best 30 minutes available. Not today.)*

---

# Build

**Mode B — you write all of it. Build it testable: tools as module-level functions the agent
registers, not closures buried in a factory.** My suite depends on that shape.

```bash
cd services/ai-chat
uv add httpx
# and in another terminal, v1 must be running:
nx run coreservice:start
```

## Morning (~3.5h) — the agent

1. **`src/app/agent/deps.py`** — a dataclass holding what every tool needs: an
   `httpx.AsyncClient`, the caller's bearer token, and the active organization id. One client,
   created once, passed in.

2. **`src/app/agent/client.py`** — a thin v1 caller. **One place** that knows to attach
   `Authorization: Bearer …` and `X-Organization-Id`, and one place that turns a non-2xx into
   something the agent can report. Every tool goes through it; no tool builds headers itself.

3. **`src/app/agent/copilot.py`** — `organizer_copilot`, with instructions saying what CredoPass is
   and that it should use tools rather than guess. Two tools:
   - `list_events(when: Literal['upcoming', 'past', 'all'])` → `GET /events`
   - `get_event_summary(event_id: str | None)` → `GET /events/{id}`

   Both `@agent.tool` — they need `ctx.deps`. **Write the docstrings as instructions to a
   colleague.** Yesterday's exercise 7 was about exactly this.

`event_id: str | None` is deliberate: today `None` errors helpfully. Tomorrow it resolves from
`active_event_id`, and the signature won't change.

## Afternoon (~3.5h) — make it answer

4. **`scripts/ask_copilot.py`** — takes a question on argv, mints deps from env
   (`COPILOT_DEV_TOKEN`, `COPILOT_DEV_ORG_ID`), runs the agent, prints the answer. Keep this — it
   survives to Friday as a demo fallback when the browser misbehaves.

5. **Iterate on the docstrings until the chaining works.** This is the real afternoon task, and
   it's the one that makes Thursday easy. Ask questions three different ways. Watch which ones
   pick the wrong tool, and fix the docstring, not the model.

6. **Capture a real response payload** — `/events` and `/events/{id}` — into a scratch file and
   send it to me. My canned test fixtures come from your captured shapes, not invented ones.
   Invented shapes make green tests that prove nothing.

**Getting a real token:** sign in to the web app at `:5000`, devtools → Application → Local Storage
→ the Supabase session → copy `access_token`. **It expires in about an hour** — expect to re-copy
it three or four times today. That friction disappears tomorrow when the browser supplies it. Put it
in `.env`, not on the command line; shell history is the wrong place for a bearer token.

---

# Done when

- `uv run python scripts/ask_copilot.py "what events do I have coming up?"` prints a real answer
  naming your real events.
- `uv run python scripts/ask_copilot.py "tell me about <a real event name>"` makes the agent call
  `list_events` **then** `get_event_summary` — two hops, chained, from one question. Watch for it.
- With a deliberately-corrupted token, the agent says something sensible rather than dumping a 401
  traceback.
- **`uv run pytest` green, and `env -u OPENAI_API_KEY uv run pytest` also green** (my suite; your
  code). If the second one fails, something is making a live call and you've just found it.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| 401 from every tool | Token expired. They last about an hour. Re-copy it. |
| Agent answers without calling anything | Docstring too vague, or `instructions` didn't say to prefer tools. |
| Second question slower than the first | A new `AsyncClient` per call — you're re-handshaking. |
| `ctx.deps` is `None` | `deps=` not passed to `run()`. |
| 404 on an event you can see in the UI | Missing `X-Organization-Id`, so v1 resolved a different tenant. |
| Tests slow or flaky | Real network calls. That's what the `env -u` check is for. |
| Green tests, wrong shapes at runtime | Canned payloads were invented rather than captured. Send me real ones (task 6). |

---

# Say it out loud

> "Each tool forwards the signed-in organizer's own bearer token and organization header to the
> existing API, so the agent inherits the caller's permissions and gains no new ones — there's no
> separate authorization surface to audit. One long-lived `httpx.AsyncClient` is shared through
> deps so the connection pool is reused rather than re-handshaking on every tool call."

And, for the testing question:

> "`TestModel` calls every tool once — a smoke test that the wiring exists. `FunctionModel` lets you
> drive the model's decisions, so you can assert a given message calls a specific tool with specific
> arguments. Replacing the model isn't enough on its own: the tools still run, so the HTTP transport
> is stubbed too, and `ALLOW_MODEL_REQUESTS = False` makes 'no live calls' enforced rather than a
> convention."

---

## Retro

- Did it chain the two tools unprompted, or did you have to ask twice:
- Which docstring wording finally made tool choice reliable:
- What was harder than expected:
- Carry into day 3:
