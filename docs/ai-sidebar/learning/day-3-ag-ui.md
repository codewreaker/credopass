# Day 3 — Wed 10 Sep — AG-UI: the protocol, then shared state

Plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §5 · ~7h · Reading budget: 60 min

**The most compressed day of the week, and the one that earns interview answer #3.** The 14-day
plan took two days over this. You have one, and the afternoon has an explicit escape hatch because
of it.

**Read the protocol before touching the SDK.** If you learn `AGUIAdapter` first, AG-UI becomes "the
thing pydantic-ai does," and you'll be unable to answer "what is AG-UI?" except by naming a Python
class. That answer is worth more than the code today.

No React. Today ends with `curl`.

## Objectives

By tonight you can:
- Say what AG-UI is **without naming a library**: a typed SSE event stream, ~16 event types,
  between an agent and a UI — not request/response.
- Name three event types and what each carries, **from your own terminal**, not from the docs page.
- Say what `RunAgentInput` carries into a run.
- Explain how one answer can be both streamed prose and a rendered component — because the tool
  call is an event on the same stream, and the frontend binds a component to the tool's name.
  *(Understanding this today is what makes Thursday afternoon an hour instead of a day.)*
- Say what `StateDeps` synchronizes, in which direction, and why `replace(deps)` per request
  matters.

---

# Learn

## Morning read (~60 min) — protocol first, in this order

- [AG-UI introduction](https://docs.ag-ui.com/introduction) ·
  [architecture](https://docs.ag-ui.com/concepts/architecture)
- [**AG-UI events**](https://docs.ag-ui.com/concepts/events) ← **the page that matters most this
  week.** Skim it now; **read it properly beside your own `curl -N` output** after the mount works.
  Read in the abstract it's a list of names; read beside a live stream it's a vocabulary.
- [pydantic-ai AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/) —
  **verified current 2026-09-02.** Anything showing `agent.to_ag_ui()` predates this API.

## The idea

A chat UI needs more from an agent than a final string. It needs, live: tokens as they're
generated, which tool is running, what a tool returned, updated shared state, and a way to stop and
ask the user something.

That's not request/response. **AG-UI is an open protocol for that traffic: a typed stream of ~16
standard event types between an agent and a UI**, over SSE.

The consequence, and the mechanism behind tomorrow afternoon:

> Because a tool call is an *event on the stream* rather than an internal detail, the frontend can
> see it happening and render its own component for it. That's how one answer is both streamed
> prose and a rendered calendar.

**You already know the transport.** [`docs/web/LIVE-UPDATES.md`](../LIVE-UPDATES.md) plans SSE for
check-in fanout. AG-UI is SSE plus an agreed vocabulary for what the events *mean*. The novelty is
the schema, not the pipe.

## The mechanism

```
browser                                       your FastAPI service
   │  POST /api/v1/ai-chat/agent/organizer-copilot
   │  { messages, state, tools }   ← RunAgentInput
   ├─────────────────────────────────────────────>
   │                                          agent.run(...)
   │  <── RUN_STARTED
   │  <── TEXT_MESSAGE_CONTENT  "Let me check"   (token by token)
   │  <── TOOL_CALL_START       list_events      ← frontend can render from here
   │  <── TOOL_CALL_ARGS        {"when":"upcoming"}
   │  <── TOOL_CALL_END
   │  <── TOOL_CALL_RESULT      [ …events… ]     ← and draw a calendar from this
   │  <── TEXT_MESSAGE_CONTENT  "You have three…"
   │  <── RUN_FINISHED
```

Event names vary slightly by version — **read them off your own `curl -N` output**, which is why
the day ends there rather than in React. The shape is what matters: a run is bracketed by
start/finish, text arrives in deltas, tool activity is announced on the same stream.

### `RunAgentInput` — what the client sends up

- **`messages`** — the conversation so far. **The client owns history; the server is stateless
  between requests.** Say that in the interview; it's the detail that shows you read the protocol.
- **`state`** — shared state, synced between UI and agent. That's this afternoon.
- **`tools`** — *frontend* tools the client can execute. You mostly don't use these.

## Afternoon: `StateDeps` — shared state

Docs: the shared-state section of the pydantic-ai AG-UI page ·
[AG-UI state management](https://docs.ag-ui.com/concepts/state) — snapshots vs. deltas.

The rail knows which event you're looking at. Retyping "for Touching Gods Heart" every message would
be absurd. `state` in `RunAgentInput` carries it, and `StateDeps` validates it into a model:

```python
class CopilotState(BaseModel):
    active_organization_id: str | None = None
    active_event_id: str | None = None

agent = Agent('openai:gpt-5.2', deps_type=StateDeps[CopilotState])
```

Now `get_event_summary(event_id=None)` falls back to `ctx.deps.state.active_event_id`, and "how many
are checked in?" works with no event named.

### `replace(deps)` — not pedantry

```python
from dataclasses import replace

@app.post('/…')
async def run_agent(request: Request) -> Response:
    return await AGUIAdapter.dispatch_request(request, agent=agent, deps=replace(deps))
```

> Without a fresh copy per request, state from one caller's run is visible to the next. **In a
> multi-tenant app that is a cross-tenant leak** — the exact bug
> `packages/api-client/src/active-organization.ts` documents in its header comment, one boundary
> further out. Read that comment; it's the same lesson at a different layer.

---

# Build

```bash
cd services/ai-chat
uv add "pydantic-ai[ag-ui]"
```

## Morning (~3.5h) — mount it and watch the wire

**Mode A — I write this:** the minimal mount — a toy agent behind `AGUIAdapter.dispatch_request` as
one FastAPI route, ~10 lines, **plus the exact `curl -N` invocation with a valid `RunAgentInput`
body.** The body shape is the fiddly part and typing it wrong looks like a code bug. You get it
working first, then build yours.

**Mode C — I do this, unprompted:** CORS for `:5000` and `:5001`, copied from the dev branch of
`services/core/src/index.ts`. No learning in it, and discovering CORS tomorrow mixed in with three
other new things is a bad afternoon. (Note `:5001` — AirPlay usually holds `:5000`.)

**Mode B — you write:**

1. **Mount `organizer_copilot`** at `POST /api/v1/ai-chat/agent/organizer-copilot` in `main.py`,
   via `AGUIAdapter.dispatch_request`.
2. **Build deps from the request headers**, not env vars — read `Authorization` and
   `X-Organization-Id` off the `Request` per request. **This is the day the dev-token hack dies**,
   and it's the concrete form of the "no new permissions" property.
3. **`curl -N` the endpoint with a real question and watch the stream go past.** Then map what you
   saw onto the events page. **Write down three event names in the retro — from your terminal.**

### The 1pm checkpoint

**If the mount isn't streaming by 1pm, stop.** Take the mount from my worked example verbatim and
move to the afternoon. The state composition is the part with an interview answer in it; a mount
you copied and understand beats a mount you wrote and ran out of day on.

## Afternoon (~3.5h) — state

**Mode B — you write:**

4. **`CopilotState`** — a `BaseModel` with `active_organization_id` and `active_event_id`, both
   `str | None`.
5. **Switch to `deps_type=StateDeps[CopilotState]`.** Your existing deps (the httpx client, the
   token) still need to reach the tools — **working out how those coexist with `StateDeps` is
   today's real content**, and the docs' example is thinner than your case.
6. **Make `event_id=None` resolve from state.** `get_event_summary(event_id=None)` uses
   `ctx.deps.state.active_event_id`, and errors helpfully if both are absent.
7. **`replace(deps)` per request** in the route handler. Write the one-line comment saying why.
8. **`curl` twice:** once with `state: {"active_event_id": "<real id>"}` and a question naming no
   event; once without the state. First answers, second asks which event.

## The dress rehearsal for tomorrow (~20 min, don't skip)

With `curl`, send **exactly what the browser will send**: a real `Authorization` header from a
fresh browser session and a real `X-Organization-Id`, against the mounted endpoint. If anything
about that combination is broken, find it now. Tomorrow is React-only *because* of this.

---

# Done when

- `curl -N -X POST localhost:8090/api/v1/ai-chat/agent/organizer-copilot` with a valid
  `RunAgentInput`, a real bearer token and org header streams a real answer as SSE events.
- A **tool-call event** is visible in that stream — not just text deltas.
- You can name three event types from what you watched.
- `curl` with `state` gets an answer about the right event, unnamed in the question; without it,
  a sensible "which event?" rather than a crash or a guess.
- **Two different `state` payloads in a row don't leak into each other.** Test it explicitly — this
  is the `replace(deps)` claim, and it's the one worth proving rather than assuming.
- `uv run pytest` still green.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| 422 from the endpoint | `RunAgentInput` body is malformed. Get the shape from the worked example first. |
| Stream opens, nothing arrives | Agent raised on the first tool call. Check the **server** log, not the client. |
| Works in `curl`, browser blocked | CORS. `:5000` **and** `:5001` (AirPlay). Should be done this morning. |
| State ignored | Sent at the wrong nesting level in the body, or `deps_type` isn't `StateDeps[...]`. |
| Second request inherits the first's state | Missing `replace(deps)`. **This is the one that matters.** |
| Agent asks "which event?" when state was sent | The tool isn't falling back to `ctx.deps.state`. |
| `httpx` client missing from `ctx.deps` | Your own deps and `StateDeps` aren't composed — today's real puzzle. |
| Response arrives all at once | Something buffering — a proxy, or `curl` without `-N`. |

---

# Say it out loud

> "AG-UI is an open protocol between an agent and a UI: a typed SSE stream of about sixteen event
> types, not request/response. Text arrives as deltas, and tool calls are announced on the same
> stream — which is what lets one answer be both streamed prose and a rendered React component,
> because the frontend binds a component to a tool name and draws it from the tool's result.
> `RunAgentInput` carries the message history, shared state and any frontend tools; the server is
> stateless between requests."

> "`StateDeps` validates the `state` the client sends into a typed Pydantic model, so the agent
> knows which organization and event the UI is showing without the user repeating it. Deps are
> copied per request with `replace()` — without that, one caller's state is visible to the next,
> which in a multi-tenant app is a cross-tenant leak."

---

## Retro

- **Three event types you saw, and what each carried** (fill this in — it's an interview answer):
- What `RunAgentInput` actually contains:
- How the httpx/token deps and `StateDeps` ended up coexisting:
- Did you hit the 1pm checkpoint, and did you use the escape hatch:
- Carry into day 4:
