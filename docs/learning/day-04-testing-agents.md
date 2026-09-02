# Day 4 — testing an agent without an LLM

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §3

Yesterday's agent works. You have no idea whether it *keeps* working, because every check so far
was you reading output. Today it gets a suite that runs in a second, costs nothing, and passes
with the API key unset.

This day exists at position 4 rather than 12 for a reason: retrofitting agent tests after the AG-UI
and React layers exist means debugging three things at once. It's also the day that makes days 8
and 10 debuggable — when the model won't call your tool, `FunctionModel` is how you find out
whether it's the tool or the prompt.

## Objectives

By the end of today you can:
- Say what `TestModel` and `FunctionModel` each replace, and when you'd reach for which.
- Say why `ALLOW_MODEL_REQUESTS = False` matters — it turns "no live calls in CI" from a convention
  someone eventually violates into something the library refuses.

## New today

- [Unit testing](https://pydantic.dev/docs/ai/guides/testing/) — the whole page, it's short.
- [`pydantic_ai.models.test`](https://pydantic.dev/docs/ai/api/models/test/) — `TestModel` calls
  every tool once with generated args. Good for "is the wiring right."
- [`pydantic_ai.models.function`](https://pydantic.dev/docs/ai/api/models/function/) —
  `FunctionModel` lets *you* decide what the model does. Good for "given this message, does it call
  *that* tool with *those* args."
- [pytest — monkeypatch](https://docs.pytest.org/en/stable/how-to/monkeypatch.html), if you're rusty
  on fixtures.

**The mapping:** `TestModel` ≈ a smoke test. `FunctionModel` ≈ a table-driven unit test where you
control the input side. Neither is a mock of your *tools* — the tools still run, so you also need
the v1 HTTP calls stubbed. That's the bit people miss on the first attempt.

## Hands-on task

**Mode A — worked example (I write this):** one `TestModel` test and one `FunctionModel` test
against yesterday's agent, with the httpx layer stubbed via `httpx.MockTransport`. ~30 lines. This
is a new-concept day, so you get the pattern before applying it.

**Mode B — you write:**
1. A conftest fixture giving every test a stubbed `httpx.AsyncClient` (a `MockTransport` returning
   canned `/events` and `/events/{id}` payloads) plus a deps object built on it. Copy the payload
   shapes from a real response you captured yesterday — invented shapes make green tests that
   prove nothing.
2. `TestModel` test: running the agent calls both tools, and neither raises.
3. `FunctionModel` test: "what's coming up?" calls `list_events` with `when='upcoming'`,
   specifically — not just "some tool was called."
4. `FunctionModel` test: a tool that gets a 404 from v1 produces a graceful agent message.
5. `ALLOW_MODEL_REQUESTS = False` set globally in conftest.

## Done when

- `uv run pytest` is green.
- **`env -u OPENAI_API_KEY uv run pytest`** (or your provider's variable) is *also* green. If it
  isn't, something is making a live call and you've just found it. This is the real check today.
- The suite finishes in under ~2 seconds. If it's slower, something's hitting the network.

## Retro

- Anything that turned out to be making a live call:
- `TestModel` vs `FunctionModel` — in your own words:
- Carry into day 5:
