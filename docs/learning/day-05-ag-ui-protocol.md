# Day 5 — AG-UI, the protocol

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §5

The hardest conceptual day of the fortnight, and the one whose payoff is an interview answer rather
than a screenshot. **Read the protocol before touching the SDK.** If you learn `AGUIAdapter` first,
AG-UI becomes "the thing that pydantic-ai does," and you'll be unable to answer "what is AG-UI"
except by naming a Python class.

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

## New today

Protocol first, in this order:

- [AG-UI — introduction](https://docs.ag-ui.com/introduction).
- [AG-UI — architecture](https://docs.ag-ui.com/concepts/architecture) — where agent, transport and
  client sit relative to each other.
- [**AG-UI — events**](https://docs.ag-ui.com/concepts/events) — **the page that matters most this
  fortnight.** The event types are the vocabulary. Have this open beside your `curl -N` output;
  don't read it in the abstract and move on.

Then the SDK:

- [pydantic-ai — AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/) —
  `AGUIAdapter.dispatch_request`. **Verified current 2026-09-02.** Anything you find showing
  `agent.to_ag_ui()` is an older API; prefer the plan's §5 snippets, which were checked against
  live docs.

**The mapping that helps:** you already know SSE — `docs/LIVE-UPDATES.md` in this repo plans it for
check-in fanout. AG-UI is SSE with an agreed schema for what the events *mean*. The novelty is the
schema, not the transport.

## Hands-on task

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

## Done when

- `curl -N -X POST localhost:8090/api/v2/agent/organizer-copilot` with a valid `RunAgentInput`,
  a real bearer token and org header streams a real answer as SSE events.
- A tool-call event is visible in that stream — not just text deltas.
- You can name three event types from what you watched.

## Retro

- Three event types you saw, and what each carried:
- What `RunAgentInput` actually contains:
- What was harder than expected:
- Carry into day 6:
