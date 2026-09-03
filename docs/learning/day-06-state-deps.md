# Day 6 — shared state (`StateDeps`)

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2, §5

Short day, one idea. This is why the rail can answer "how many are checked in?" while you're
looking at an event, without you naming the event.

It's also the last day before React, so it ends with a deliberate dress rehearsal: prove the
headers work by `curl` today, and day 7 is only React.

## Objectives

By the end of today you can:
- Say what `StateDeps` synchronizes and in which direction.
- Say why `replace(deps)` per request matters — without it, one caller's state is visible to the
  next, which in a multi-tenant app is the bug you least want.

---

# Learn

Docs: [pydantic-ai AG-UI — shared state](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/) ·
[AG-UI state management](https://docs.ag-ui.com/concepts/state) — snapshots vs. deltas.

## `StateDeps` — shared state

The rail knows which event you're looking at. Retyping "for Touching Gods Heart" every message
would be absurd. `state` in `RunAgentInput` carries it, and `StateDeps` validates it into a model:

```python
class CopilotState(BaseModel):
    active_organization_id: str | None = None
    active_event_id: str | None = None

agent = Agent('openai:gpt-5.2', deps_type=StateDeps[CopilotState])
```

Now `get_event_summary(event_id=None)` can fall back to `ctx.deps.state.active_event_id`, and
"how many are checked in?" works with no event named.

### `replace(deps)` — not pedantry

```python
from dataclasses import replace

@app.post('/…')
async def run_agent(request: Request) -> Response:
    return await AGUIAdapter.dispatch_request(request, agent=agent, deps=replace(deps))
```

> Without a fresh copy per request, state from one caller's run is visible to the next. In a
> multi-tenant app that is a cross-tenant leak — the exact bug
> `packages/api-client/src/active-organization.ts` documents in its header comment, one boundary
> further out. Read that comment; it's the same lesson.

Today's done-when asks you to prove two different state payloads don't bleed. Test it explicitly.

---

# Build

**Mode B — you write:**

1. **`CopilotState`** — a `BaseModel` with `active_organization_id: str | None` and
   `active_event_id: str | None`.
2. Switch the agent to `deps_type=StateDeps[CopilotState]`. Your existing deps (the httpx client,
   the token) still need to reach the tools — work out how those coexist with `StateDeps`; that
   puzzle is today's real content, and the docs' example is thinner than your case.
3. **Make `event_id=None` resolve from state.** `get_event_summary(event_id=None)` uses
   `ctx.deps.state.active_event_id`, and errors helpfully if both are absent.
4. **`replace(deps)` per request** in the route handler, per plan §5. Write the one-line comment
   saying why.
5. `curl` the endpoint twice: once with `state: {"active_event_id": "<real id>"}` and a question
   with no event named, once without the state. First answers, second asks which event.

**Also today, the dress rehearsal for day 7:** with `curl`, send exactly what the browser will send
— a real `Authorization` header from a fresh browser session and a real `X-Organization-Id`. If
anything about that combination is broken, find it now, not tomorrow.

---

# Done when

- `curl` with `state` gets an answer about the right event, unnamed in the question.
- `curl` without it gets a sensible "which event?" rather than a crash or a guess.
- Two different `state` payloads in a row don't leak into each other. Test it explicitly.
- `uv run pytest` still green.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| State ignored | Sent at the wrong nesting level in the request body, or `deps_type` isn't `StateDeps[...]`. |
| Second request inherits the first's state | Missing `replace(deps)`. This is the one that matters. |
| Agent asks "which event?" when state was sent | The tool isn't falling back to `ctx.deps.state`. |
| `httpx` client missing from `ctx.deps` | Your own deps and `StateDeps` aren't composed — today's real puzzle. |

---

# Say it out loud

> "`StateDeps` validates the `state` the client sends in `RunAgentInput` into a typed Pydantic
> model, so the agent knows which organization and event the UI is showing without the user
> repeating it. Deps are copied per request with `replace()` — without that, one caller's state
> is visible to the next, which in a multi-tenant app is a cross-tenant leak."

---

## Retro

- How the httpx/token deps and `StateDeps` ended up coexisting:
- What was harder than expected:
- Carry into day 7:
