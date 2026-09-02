# Day 6 — shared state (`StateDeps`)

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2, §5

Short day, one idea. Today is why the rail can answer "how many are checked in?" while you're
looking at an event, without you naming the event.

It's also the last day before React, so it ends with a deliberate dress rehearsal: prove the
headers work by `curl` today, and day 7 is only React.

## Objectives

By the end of today you can:
- Say what `StateDeps` synchronizes and in which direction.
- Say why `replace(deps)` per request matters — without it, one caller's state is visible to the
  next, which in a multi-tenant app is the bug you least want.

## New today

- [pydantic-ai — AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/), the
  **shared state** section specifically. Re-read, having now watched the stream.
- [AG-UI — state management](https://docs.ag-ui.com/concepts/state) — the protocol side:
  snapshots vs. deltas.

**The repo parallel worth drawing:** `packages/api-client/src/active-organization.ts` keeps the
active org *outside* React, in a module store, because the fetch middleware needs it synchronously
before any component renders. `CopilotState.active_organization_id` is the same value crossing one
more boundary. Read that file's header comment — it explains a tenancy bug that came from getting
this wrong, and it's the reason `replace(deps)` isn't pedantry.

## Hands-on task

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

## Done when

- `curl` with `state` gets an answer about the right event, unnamed in the question.
- `curl` without it gets a sensible "which event?" rather than a crash or a guess.
- Two different `state` payloads in a row don't leak into each other. Test it explicitly.
- `uv run pytest` still green.

## Retro

- How the httpx/token deps and `StateDeps` ended up coexisting:
- What was harder than expected:
- Carry into day 7:
