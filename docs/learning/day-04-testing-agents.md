# Day 4 — testing an agent without an LLM

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §3

Yesterday's agent works. You have no idea whether it *keeps* working, because every check so far
was you reading output. Today it gets a suite that runs in a second, costs nothing, and passes
with the API key unset.

This day sits at position 4 rather than 12 on purpose: from day 5 onward you're debugging a React
layer, an SSE stream and an agent at once, and you want the agent half already pinned down. It's
also what makes days 8 and 10 debuggable — when the model won't call your tool, `FunctionModel` is
how you find out whether it's the tool or the prompt.

## Objectives

By the end of today you can:
- Say what `TestModel` and `FunctionModel` each replace, and when you'd reach for which.
- Say why `ALLOW_MODEL_REQUESTS = False` matters — it turns "no live calls in CI" from a convention
  someone eventually violates into something the library refuses.

---

# Learn

Docs: [Unit testing](https://pydantic.dev/docs/ai/guides/testing/) ·
[`TestModel`](https://pydantic.dev/docs/ai/api/models/test/) ·
[`FunctionModel`](https://pydantic.dev/docs/ai/api/models/function/)

## What you're actually testing

Not "is the model smart." You're testing **your** code:

- Do the tools do the right thing when called with given args?
- Does the agent reach for the right tool for a given message?
- Does a failing upstream call produce a sensible outcome rather than a crash?

The model is the part you don't own. Replace it.

## Two replacements

### `TestModel` — the smoke test

Calls every registered tool once with generated arguments. Answers "is this wired up at all?"

```python
from pydantic_ai.models.test import TestModel

async def test_tools_are_wired(deps):
    with agent.override(model=TestModel()):
        result = await agent.run('anything', deps=deps)
    # every tool ran without raising
```

Cheap and broad. It does **not** tell you the agent would pick the right tool in reality —
`TestModel` calls everything.

### `FunctionModel` — the real unit test

You supply a function that plays the model. You decide what it does, so you can assert precisely.

```python
from pydantic_ai.models.function import FunctionModel

def always_list_upcoming(messages, info):
    # first call: request the tool. second: return prose.
    ...

async def test_upcoming_question_lists_upcoming(deps):
    with agent.override(model=FunctionModel(always_list_upcoming)):
        result = await agent.run('what is coming up?', deps=deps)
    assert ...   # list_events was called with when='upcoming', specifically
```

**The distinction to hold:** `TestModel` proves the wiring exists. `FunctionModel` proves a
specific behaviour. Day 4 wants both.

## The half everyone forgets

> Replacing the model does **not** stub your tools. They still run — and this project's tools all
> make HTTP calls to v1. A test that only swaps the model will hit a real API, or fail because
> nothing is listening on `:8080`.

Stub the transport, with `httpx.MockTransport`:

```python
def handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == '/api/v1/core/events':
        return httpx.Response(200, json={'data': [...], 'page': {...}})
    return httpx.Response(404)

client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url='http://test')
```

Now nothing leaves the process: model replaced, HTTP replaced, tools genuinely executed.

**Copy your canned payloads from a real captured response.** Invented shapes produce green tests
that prove nothing — the classic version of this is a test passing for a year against a response
shape the API stopped returning.

## Making "no live calls" enforced

A convention that live calls don't happen in tests is a convention someone eventually breaks.
pydantic-ai makes it mechanical:

```python
# tests/conftest.py

from pydantic_ai import models
models.ALLOW_MODEL_REQUESTS = False
```

Any real model request now raises. This is the difference between "we don't do that" and "that
can't happen."

The independent check, which is the one that actually catches things:

```bash
env -u LLM_API_KEY uv run pytest      # must still be green
```

If it isn't, something is making a live call and you've just found it.

---

# Build

Day 4's task, in order — build the fixture first, because both test styles need it.

1. **The stub fixture.** A pytest fixture returning deps built on a `MockTransport` client, with
   payloads copied from real captured responses.
2. **`TestModel` smoke test.** All tools run, nothing raises.
3. **`FunctionModel` behaviour test.** "What's coming up?" calls `list_events` with
   `when='upcoming'` — assert the argument, not just that something was called.
4. **A failure path.** Make the transport return 404 and assert the agent reports it rather than
   crashing.
5. **Prove the enforcement.** Temporarily remove `ALLOW_MODEL_REQUESTS = False` and point a test at
   a real model to see it hit the network. Put it back.

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

---

# Done when

- `uv run pytest` is green.
- **`env -u OPENAI_API_KEY uv run pytest`** (or your provider's variable) is *also* green. If it
  isn't, something is making a live call and you've just found it. This is the real check today.
- The suite finishes in under ~2 seconds. If it's slower, something's hitting the network.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| Tests slow, or flaky | Real network calls. That's what the `env -u` check is for. |
| Passes locally, fails in CI | Depends on a real key or a running `:8080`. |
| `TestModel` test passes, real usage broken | Expected — `TestModel` calls everything regardless of the prompt. That's what `FunctionModel` is for. |
| Green tests, wrong shapes in production | Canned payloads were invented rather than captured. |
| `ALLOW_MODEL_REQUESTS` seems ignored | conftest not imported — check it's at `tests/conftest.py`. |

---

# Say it out loud

> "`TestModel` calls every tool once — a smoke test that the wiring exists. `FunctionModel` lets me
> drive the model's decisions, so I can assert that a given message calls a specific tool with
> specific arguments. Replacing the model isn't enough on its own, though: the tools still run, so
> I stub the HTTP transport too. `ALLOW_MODEL_REQUESTS = False` makes 'no live calls in CI'
> enforced rather than a convention."

---

---

## Retro

- Anything that turned out to be making a live call:
- `TestModel` vs `FunctionModel` — in your own words:
- Carry into day 5:
