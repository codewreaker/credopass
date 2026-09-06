# Day 1 — Mon 8 Sep — pydantic-ai, from zero to a working tool call

Plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §3 · ~7h · Reading budget: 50 min

The service scaffold already exists and `/health` works (that was done 2026-09-02 — see
[`STATUS.md`](STATUS.md)). Today is the first day of genuinely new material.

**No CredoPass code today.** A toy agent in `scratch/`, because learning `RunContext` and debugging
a tenancy header at the same time is how you end up unable to tell which half is broken. Tomorrow
is the real thing, and it goes fast *because* today was fake.

## Objectives

By tonight you can:
- Say what `deps_type` / `RunContext` inject into a tool call, and why that wiring is type-checked
  rather than a dict of strings.
- Say the difference between `@agent.tool` and `@agent.tool_plain` in one line — it's about
  `RunContext`.
- **Explain that a tool's docstring is prompt surface, not documentation.** The single most
  load-bearing idea of the week. When the agent doesn't call your tool on Thursday, this is why.

---

# Learn

## Part 1 — the Python primer (20 minutes, no longer)

You've written Python. This is only the places TypeScript instincts are wrong.

### The map

| TypeScript | Python |
|---|---|
| `bun` / `npm` | `uv` — manages the venv *and* the Python version. No `activate`. |
| `package.json` | `pyproject.toml` — deps, lint, test, typecheck, one file |
| Zod | Pydantic |
| `type` / `interface` | type hints — **not enforced at runtime** |
| ESLint + Prettier | `ruff` |
| `tsc --noEmit` | `pyright` |
| Vitest | `pytest` |

### The three things that actually bite

**1. Type hints do nothing at runtime.** In TypeScript the compiler refuses to build. In Python
nothing refuses anything; `pyright` is a separate optional check.

```python
def greet(name: str) -> str:
    return f"Hello, {name}"

greet(42)          # runs fine. pyright complains; Python does not.
```

**The exception is the whole reason this project is in Python:** Pydantic, FastAPI and pydantic-ai
all *read* the hints and give them teeth. Pydantic validates from them. FastAPI parses requests and
generates OpenAPI from them. pydantic-ai builds the JSON schema the model sees from them. In those
three, the hint is the contract. Everywhere else it's a comment.

Modern syntax only — `ruff`'s `UP` rules enforce it: `str | None`, `list[str]`, `dict[str, int]`,
`Literal["ok"]`.

**2. Decorators are just function wrapping.** `@agent.tool` is the entire pydantic-ai API, so this
is load-bearing.

```python
@app.get("/health")
async def health() -> Health: ...
```

is exactly:

```python
async def health() -> Health: ...
health = app.get("/health")(health)
```

Two consequences that will cost you time if you don't hold them:

- **The decorator runs at import time.** `@agent.tool` registers your function the moment the
  module is imported. A tool that "doesn't exist" is almost always a module that was never
  imported.
- **A decorator can inspect your function** — name, signature, docstring, hints. That's how
  `@agent.tool` builds a JSON schema you never wrote. **The function *is* the declaration.**

**3. A blocking call inside `async def` freezes the entire event loop** — not just that request,
every concurrent request in the process. In Node this is hard to do by accident. In Python most of
the standard library is synchronous.

```python
async def bad():
    time.sleep(1)                     # blocks EVERYTHING
    requests.get("https://…")         # same — `requests` is sync

async def good():
    await asyncio.sleep(1)
    await client.get("https://…")     # httpx.AsyncClient
```

This is why the project uses `httpx`, not `requests`. `ruff`'s `ASYNC` rules catch the common cases.

### Dataclass vs Pydantic — the rule

```python
@dataclass
class CopilotDeps:              # dataclass: internal plumbing
    http: httpx.AsyncClient     # holds a live object. no validation, no serialization.
    token: str

class CopilotState(BaseModel):  # Pydantic: crosses a boundary
    active_event_id: str | None = None   # validated from JSON, serialized back
```

**Pydantic when the data crosses a boundary** (HTTP, the model, the browser) and must be validated
or serialized. **A dataclass when it's plumbing you construct yourself.** Pydantic for deps would
try to validate an `httpx.AsyncClient`; a dataclass for state means AG-UI can't parse it from JSON.
You will use both, tomorrow and Wednesday, for exactly these reasons.

### Ten seconds each

```python
f"{count} events"                      # template literals
if not events:                         # empty list/dict/str are falsy
if x is None:                          # never == None
def bad(items: list[str] = []): ...    # shared across ALL calls. ruff B006 catches it.
for _ in range(3): ...                 # _ means deliberately unused
```

## Part 2 — pydantic-ai (the read: ~50 min)

Docs: [Agents](https://pydantic.dev/docs/ai/core-concepts/agent/) ·
[Dependencies](https://pydantic.dev/docs/ai/core-concepts/dependencies/) ·
[Tools](https://pydantic.dev/docs/ai/tools-toolsets/tools/)

*(Search results also surface `ai.pydantic.dev` — same docs, older host. Prefer
`pydantic.dev/docs/ai/`.)*

### The idea

A language model can't call your code. It can only emit text. Tool calling is a protocol on top of
that: you describe your functions as JSON schemas, the model emits a structured request naming one,
your runtime executes it and feeds the result back, and the model continues.

**pydantic-ai's contribution is that you never write the schema.**

```
your function ──(signature + docstring)──> JSON schema ──> the model
the model ──(picks one, emits args)──> pydantic-ai validates them ──> your function runs
your function's return ──> back into the conversation ──> the model writes prose
```

Be able to describe every arrow. It's the substance of "do you understand tool calling, or did you
use a framework."

### `Agent`

```python
from pydantic_ai import Agent

agent = Agent(
    'openai:gpt-5.2',
    instructions='You help event organizers. Use tools; never guess at data.',
)

result = await agent.run('what events do I have?')
print(result.output)
```

`instructions` is the system prompt. **Be specific about tool use** — "never guess" earns its place,
because a model with a vague prompt will happily invent an event list.

The agent is created once at module import, not per request. Per-request data arrives through deps.

### Tools, and the docstring thing

> **The single most important idea of the week.** Your tool's docstring is not documentation for
> other developers. It is *prompt text*, sent to the model, and it is the main thing determining
> whether your tool gets called at the right moment.

```python
@agent.tool
async def list_events(ctx: RunContext[CopilotDeps], when: Literal['upcoming', 'past']) -> list[Event]:
    """List the organizer's events.

    Use this whenever the user asks what is coming up, what happened recently,
    or anything about their schedule. Prefer 'upcoming' unless they clearly
    mean the past.
    """
```

What the model receives: the **name** `list_events`, the **docstring verbatim**, a schema for
`when` restricted to two literals (so the model *cannot* pass `"future"`), and the return type.
You wrote none of that schema. **Change the docstring and you have changed the prompt.**

### `@agent.tool` vs `@agent.tool_plain`

One difference: whether the function takes `RunContext` first.

```python
@agent.tool                                    # needs request-scoped data
async def list_events(ctx: RunContext[CopilotDeps], when: str) -> list[Event]:
    return await ctx.deps.http.get(...)

@agent.tool_plain                              # pure; needs nothing
def roll_dice() -> int:
    return random.randint(1, 6)
```

`ctx` is **not shown to the model** — it sees only `when`. Almost every tool in this project is
`@agent.tool`, because they all need the caller's token.

### `deps_type` and `RunContext` — the DI system

The agent is defined at import time; a request happens later, with a different user and token each
time. `deps_type` is how per-request data reaches your tools without globals.

```python
@dataclass
class CopilotDeps:
    http: httpx.AsyncClient
    token: str
    organization_id: str

agent = Agent('openai:gpt-5.2', deps_type=CopilotDeps)

@agent.tool
async def list_events(ctx: RunContext[CopilotDeps], when: str) -> list[Event]:
    response = await ctx.deps.http.get(              # ← typed. pyright checks it.
        '/api/v1/core/events',
        headers={'Authorization': f'Bearer {ctx.deps.token}'},
    )

await agent.run('what is coming up?', deps=CopilotDeps(http=..., token=..., organization_id=...))
```

`deps_type` is declared once and every `RunContext[CopilotDeps]` is checked against it. That's what
"type-checked rather than stringly-typed" means, and it's the answer to "why this library rather
than raw API calls."

**The comparison that lands:** it's `c.get('tenant')` in a Hono handler — request-scoped data the
handler didn't fetch itself — except typed end to end instead of by a string key.

### Output types

By default `result.output` is a string. Declare `output_type` and you get validated structure:

```python
class DraftMessage(BaseModel):
    subject: str
    body: str

agent = Agent('openai:gpt-5.2', output_type=DraftMessage)
result.output.subject      # typed, validated
```

You need this on **Friday**, where `output_type=[str, DeferredToolRequests]` means "either prose or
a pause for approval." A list means "any of these."

### The run loop

Worth holding, because it explains the latency and the token cost:

1. You call `agent.run(prompt, deps=...)`.
2. Prompt + tool schemas go to the model.
3. Model either answers, or requests one or more tool calls.
4. pydantic-ai validates the args against your signature, runs the tool, appends the result.
5. **Back to 2.** Until the model answers or hits the retry limit.

So "how many are checked in for tomorrow's event?" can be three round trips. That's why tomorrow
asks whether it chained two tools unprompted — chaining is the loop working.

---

# Build

```bash
cd services/ai-chat
uv add pydantic-ai
```

**Pick your provider now, in the first hour, and don't revisit it.** `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` in `services/ai-chat/.env` (gitignored).

## Morning warm-ups (~45 min, throwaway, in `scratch/`)

Fast. Don't dwell. These exist so the afternoon's errors are legible.

1. **Prove hints do nothing.** A function hinted `-> int` that returns a string. Run it. Then
   `uv run --with pyright pyright` and watch it complain about code that ran fine.
2. **Write a decorator.** ~10 lines: `@log_calls` printing the function's name and args before
   calling it. Then print `func.__doc__` and `func.__name__` from inside it — **you've just done by
   hand what `@agent.tool` does.**
3. **Feel the blocking trap.** Two `async def`s that `await asyncio.sleep(1)`, run with
   `asyncio.gather` — ~1s total. Swap one to `time.sleep(1)` — ~2s. That difference is the lesson.

*(The 14-day plan had a fourth warm-up on dataclass-vs-Pydantic coercion. Cut — you get it for real
on Wednesday when `StateDeps` forces the distinction.)*

## The main task

**Mode A — I write this, throwaway.** `scratch/dice.py`: a ~25-line agent with one `@agent.tool`
needing `RunContext` (a seeded RNG from deps) and one `@agent.tool_plain` that doesn't. Heavily
commented. **You read it; you don't edit it into your own.**

**Mode B — you write, in `scratch/`, the analogous thing (not the same thing):**

1. A `@dataclass` deps type holding something request-scoped — a user name, a base URL, anything.
2. One `@agent.tool` that reads `ctx.deps`.
3. One `@agent.tool_plain` that doesn't.
4. A run against a real model that visibly calls both.
5. **Pass the wrong type to `deps=`** and read what `pyright` says. That error message is the
   "type-checked, not stringly-typed" claim made concrete.
6. **Constrain an argument:** change a `str` parameter to `Literal['a','b']`, then try to get the
   model to pass something else.
7. **Break the docstring.** Change a working tool's docstring to `"""Does a thing."""` and ask the
   same question. Watch the model stop choosing it, or choose it wrongly.

**Do number 7.** It is the single highest-value five minutes of the week, and it's what you'll
reach for on Thursday when a tool isn't being called.

---

# Done when

- Your `scratch/` agent runs and calls both tools.
- You've watched a bad docstring change the model's tool choice, and can say why.
- You can answer without the docs open: what does `RunContext` carry, and when do you need it?

**Tonight's stop condition:** don't start tomorrow's real agent, however tempting. Tomorrow is a
full day and starting it tired at 10pm produces code you debug on Wednesday.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| Code runs but `pyright` fails | Normal. Hints aren't runtime checks. Fix them anyway — Thursday's tool contracts depend on them being honest. |
| A tool never gets registered | Its module was never imported, so the decorator never ran. |
| Model answers from thin air instead of calling a tool | Docstring too vague, or `instructions` didn't say to prefer tools. |
| `ValidationError` on tool args | The model passed something your hints reject. Usually the parameter needs a `Literal` or a clearer docstring. |
| Tool called with plausible but wrong args | It's guessing from the name. Say the constraint in the docstring. |
| Agent loops, then gives up | Tool raising on every call, or returning something unusable. Log the return value. |
| `ctx.deps` is `None` | `deps=` not passed to `run()`. |
| `ModuleNotFoundError: app` | Run through `uv run` (or nx), not bare `python`. `pythonpath = ["src"]` is in `pyproject.toml`. |

---

# Say it out loud

> "You write a typed function; pydantic-ai derives the JSON schema the model sees from its
> signature and docstring, so there's no second place to declare it. `deps_type` and `RunContext`
> inject request-scoped data — the HTTP client, the caller's token — into tools without globals,
> and it's type-checked end to end rather than a dict of strings. The docstring is prompt surface:
> changing it changes when the model reaches for the tool."

---

## Retro

- Provider chosen, and why:
- What the broken docstring actually did to tool choice:
- What was harder than expected:
- Carry into day 2:
