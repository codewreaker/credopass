# Day 5 — AG-UI, the protocol

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §5

The hardest conceptual day of the fortnight, and the one whose payoff is an interview answer rather
than a screenshot.

**Read the protocol before touching the SDK.** If you learn `AGUIAdapter` first, AG-UI becomes "the
thing pydantic-ai does," and you'll be unable to answer "what is AG-UI?" except by naming a Python
class.

No React today. Today ends with `curl`.

## Objectives

By the end of today you can:
- Say what AG-UI is without naming a library: a typed SSE event stream, ~16 event types, between an
  agent and a UI — not request/response.
- Name three event types and what each carries, from having watched them go past.
- Say what `RunAgentInput` carries into a run.
- Explain how one answer can be both streamed prose and a rendered component — because the tool
  call is an event on the same stream, and the frontend binds a component to the tool's name.
  (That's the mechanism behind day 8; understanding it today is what makes day 8 an hour, not a day.)

---

# Learn

Docs — protocol first, in this order:

- [AG-UI introduction](https://docs.ag-ui.com/introduction) ·
  [architecture](https://docs.ag-ui.com/concepts/architecture)
- [**AG-UI events**](https://docs.ag-ui.com/concepts/events) ← **the page that matters most this
  fortnight.** Have it open beside your `curl -N` output; don't read it in the abstract.
- [pydantic-ai AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/) —
  **verified current 2026-09-02.** Anything showing `agent.to_ag_ui()` predates this API.

## The idea

A chat UI needs more from an agent than a final string. It needs, live: tokens as they're
generated, which tool is running, what a tool returned, updated shared state, and a way to stop and
ask the user something.

That's not request/response. **AG-UI is an open protocol for that traffic: a typed stream of ~16
standard event types between an agent and a UI**, over SSE.

The important consequence, and the mechanism behind day 8:

> Because a tool call is an *event on the stream* rather than an internal detail, the frontend can
> see it happening and render its own component for it. That's how one answer is both streamed
> prose and a rendered calendar.

**You already know the transport.** [`docs/LIVE-UPDATES.md`](../LIVE-UPDATES.md) plans SSE for
check-in fanout. AG-UI is SSE plus an agreed vocabulary for what the events *mean*. The novelty is
the schema, not the pipe.

## The mechanism

```
browser                                       your FastAPI service
   │  POST /api/v2/agent/organizer-copilot
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

Event names vary slightly by version — **read them off your own `curl -N` output on day 5**, which
is why the day ends there rather than in React. The shape is what matters: a run is bracketed by
start/finish, text arrives in deltas, and tool activity is announced on the same stream.

### `RunAgentInput`

What the client sends up:

- **`messages`** — the conversation so far. The client owns history; the server is stateless
  between requests.
- **`state`** — shared state, synced between the UI and the agent. That's day 6's whole topic;
  today it's just a field you can see going past.
- **`tools`** — *frontend* tools the client can execute. You mostly don't use these; day 10
  notes where they matter.

## Mounting it

`AGUIAdapter.dispatch_request` does parse + run + encode in one call. Verified current 2026-09-02:

```python
from pydantic_ai.ui.ag_ui import AGUIAdapter

@app.post('/api/v2/agent/organizer-copilot')
async def run_agent(request: Request) -> Response:
    return await AGUIAdapter.dispatch_request(request, agent=agent)
```

*(Older write-ups show `agent.to_ag_ui()`. That predates this API.)*

Your real handler also reads `Authorization` and `X-Organization-Id` off the request to build deps —
that's day 5, task 2, and it's where the "no new permissions" property becomes concrete.

---

# Build

**Mode A — worked example (I write this):** the minimal mount — a toy agent behind
`AGUIAdapter.dispatch_request` as one FastAPI route, ~10 lines, plus the exact `curl -N` invocation
with a valid `RunAgentInput` body. The body shape is the fiddly part and typing it wrong looks like
a code bug; you get it working first.

**Mode B — you write:**
1. Mount `organizer_copilot` at `POST /api/v2/agent/organizer-copilot` in `main.py`, via
   `AGUIAdapter.dispatch_request`.
2. Deps: the caller's token and org id come from the **request headers** now, not env vars — read
   `Authorization` and `X-Organization-Id` off the `Request` and build the deps per request. This
   is the day the dev-token hack starts dying.
3. **Enable CORS for `:5000` and `:5001`.** Do it today even though React is on day 7 — copy the
   dev branch of `services/core/src/index.ts`. Discovering CORS on day 7, mixed in with three other
   new things, is a bad afternoon. (Note `:5001`: AirPlay usually holds `:5000`.)
4. `curl -N` the endpoint with a real question and **watch the stream go past.** Then map what you
   saw onto the events page. Write down three event names in the retro — from your terminal, not
   from the docs.

```bash
cd services/core-v2
uv add "pydantic-ai[ag-ui]"
```

---

# Done when

- `curl -N -X POST localhost:8090/api/v2/agent/organizer-copilot` with a valid `RunAgentInput`,
  a real bearer token and org header streams a real answer as SSE events.
- A tool-call event is visible in that stream — not just text deltas.
- You can name three event types from what you watched.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| 422 from the endpoint | `RunAgentInput` body is malformed. Get the shape from the worked example first. |
| Stream opens, nothing arrives | Agent raised on the first tool call. Check the server log, not the client. |
| Works in `curl`, browser blocked | CORS. `:5000` **and** `:5001` (AirPlay). Do this on day 5, not day 7. |
| State ignored | Sent at the wrong nesting level in the request body, or `deps_type` isn't `StateDeps[...]`. |
| Second request inherits first's state | Missing `replace(deps)`. |
| Response arrives all at once | Something buffering — a proxy, or `curl` without `-N`. |

---

# Say it out loud

> "AG-UI is an open protocol between an agent and a UI: a typed SSE stream of about sixteen event
> types, not request/response. Text arrives as deltas, and tool calls are announced on the same
> stream — which is what lets one answer be both streamed prose and a rendered React component,
> because the frontend can bind a component to a tool name and draw it from the tool's result.
> `RunAgentInput` carries the message history, shared state and any frontend tools; the server is
> stateless between requests."

---

---

## Retro

- Three event types you saw, and what each carried:
- What `RunAgentInput` actually contains:
- What was harder than expected:
- Carry into day 6:
