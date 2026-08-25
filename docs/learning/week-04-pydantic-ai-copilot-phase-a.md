# Week 4 — pydantic-ai fundamentals, Organizer Copilot Phase A, people.ts + events.ts

Status: not started

## Objectives

By the end of this week you can:
- Explain what `deps_type`/`RunContext` actually inject into a tool call, and why the wiring is
  type-checked rather than stringly-typed.
- Explain the difference between a plain tool return value and a structured `output_type`.
- Have a terminal script that asks the Organizer Copilot a real question about real CredoPass event
  data and gets back a real, tool-derived answer — no AG-UI, no UI yet, just the agent working.
- Have `people.ts` and `events.ts` ported alongside it.

## New this week (read before starting)

**pydantic-ai** — read in this order; the first three are the whole week's conceptual load:

- [Pydantic AI overview](https://pydantic.dev/docs/ai/overview/) and
  [installation](https://pydantic.dev/docs/ai/overview/install/) (plan Key Sources).
- [Agents](https://pydantic.dev/docs/ai/core-concepts/agent/) — the `Agent` object, run methods,
  system prompts. The core abstraction; everything else hangs off it.
- [Dependencies](https://pydantic.dev/docs/ai/core-concepts/dependencies/) — `deps_type` and
  `RunContext`, i.e. this week's first objective. This is the page that shows why the wiring is
  type-checked rather than stringly-typed, which is the thing worth being able to say out loud.
- [Tools](https://pydantic.dev/docs/ai/tools-toolsets/tools/) — `@agent.tool` vs
  `@agent.tool_plain` (the difference is whether the tool needs `RunContext`), and how the
  function's *signature and docstring* become the schema the model sees. That last part is the
  same "types are the contract" idea as FastAPI's OpenAPI generation, one layer up.
- [Output types](https://pydantic.dev/docs/ai/core-concepts/output/) — needed for
  `draft_reminder_message`'s structured `DraftMessage(subject, body)` return in plan §3, and it's
  this week's second objective.
- [`pydantic_ai.models.test`](https://pydantic.dev/docs/ai/api/models/test/) (`TestModel`) and the
  [unit testing guide](https://pydantic.dev/docs/ai/guides/testing/) — how to test agent logic
  without a live LLM call, starting now rather than retrofitting it in week 7. Note
  `ALLOW_MODEL_REQUESTS = False`: it turns "no live calls in the suite" from a convention into
  something the library enforces, which is what week 4's done-when check is really asking for.
- URL note: search results will also surface `ai.pydantic.dev/...` — the same docs on an older
  host. Prefer the `pydantic.dev/docs/ai/` links above.

**httpx**, since the Phase A tools are HTTP clients:

- [httpx — async](https://www.python-httpx.org/async/) — `AsyncClient`, and why you want one
  long-lived client rather than one per call.

**Read again before starting:**

- Plan §3 in full — the Organizer Copilot design, the exact tool list, and why Phase A
  deliberately calls the *existing* v1 API over HTTP instead of waiting for the native port.
- `services/core/src/api/v1/core/events.ts` and `services/core/src/services/event-status.ts`
  (the pure function deriving status from timestamps — there's no stored `status` column).

## Hands-on task

**Mode A — worked example (I write this, throwaway):** a tiny standalone pydantic-ai agent with
one toy tool (unrelated to CredoPass — e.g. a dice-roll tool) showing `@agent.tool`/`RunContext`
end to end, plus a `TestModel`-based test for it, so you see a complete, working, tested agent
before building the real one.

**Mode B — you write, tests + spec provided:**
1. **Organizer Copilot, Phase A.** Spec: the three read tools from plan §3 —
   `get_event_summary`, `get_checkin_state`, `search_people` — each calling v1's existing
   TypeScript API over `httpx`, forwarding the caller's real bearer token and
   `X-Organization-Id` header (the safety property from plan §3: no new permission surface). I
   write `TestModel`-based tests asserting the agent calls the correct tool for a given prompt,
   and a `FunctionModel`-based test asserting a specific tool argument for at least one case. You
   wire the `Agent`, the `deps_type`, and the three tools until green.
2. **`people.ts`** (6 routes) and **`events.ts`** (8 routes), same tests-as-spec pattern as
   week 3 — by now this should feel like a repeatable pattern, not a new thing each time.

## Done when

- `uv run python scripts/ask_copilot.py "how many people are registered for <real event>?"`
  prints a correct, live-data answer.
- `uv run pytest` covers the three Phase-A tools with `TestModel`/`FunctionModel` and passes with
  **no live LLM API calls** in the suite (verify this explicitly — check no real API key is being
  read, or run once with the key unset to confirm nothing breaks).
- `people.ts` and `events.ts` tests green, including at least one derived-status case for events
  (scheduled/ongoing/completed/cancelled) that doesn't rely on a stored column.

## Retro (fill in at the end)

- What was harder than expected:
- Fundamentals gap surfaced, if any:
- Carry into week 5:
