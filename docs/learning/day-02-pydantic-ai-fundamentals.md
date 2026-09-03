# Day 2 — pydantic-ai fundamentals

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §3

First day of genuinely new material, and the longest read of the fortnight — two topics, because
the Python half is short and you need it before the pydantic-ai half makes sense.

No CredoPass code today. A toy agent in `scratch/`, because learning `RunContext` and debugging a
tenancy header at the same time is how you end up unable to tell which half is broken.

## Objectives

By the end of today you can:
- Say what `deps_type` / `RunContext` actually inject into a tool call, and why that wiring is
  type-checked rather than a dict of strings.
- Say what the difference is between `@agent.tool` and `@agent.tool_plain` — one line, and it's
  about `RunContext`.
- **Explain that a tool's docstring is prompt surface, not documentation.** This is the single
  most load-bearing idea of the day: the function signature and docstring *become the schema the
  model sees*. When the agent calls the wrong tool on day 8, this is why.

---

# Learn

## Part 1 — the Python you need

Scoped hard: only the Python this project uses. No metaclasses, no generators. You've written
Python before — this is about where TypeScript instincts are subtly wrong.

### The map

| TypeScript | Python | Notes |
|---|---|---|
| `bun` / `npm` | `uv` | Manages the venv *and* the Python version. No `activate`. |
| `package.json` | `pyproject.toml` | One file: deps, lint, test, typecheck config. |
| `bun.lock` | `uv.lock` | Committed, reviewed. |
| Zod | Pydantic | Both validate at runtime from a declared shape. |
| `type` / `interface` | type hints | **Not enforced at runtime** — see below. |
| ESLint + Prettier | `ruff` | One tool, both jobs. `ruff check` / `ruff format`. |
| `tsc --noEmit` | `pyright` | `nx run corev2:typecheck`. |
| Vitest | `pytest` | |
| `async`/`await` | `async`/`await` | Genuinely the same idea. One trap — below. |

### Type hints are not TypeScript types

> **This is the biggest instinct to correct.** In TypeScript, types vanish at build time but the
> compiler *refuses to build* if they're wrong. In Python, hints also do nothing at runtime, and
> nothing refuses anything — `pyright` is a separate, optional check you have to run.

```python
def greet(name: str) -> str:
    return f"Hello, {name}"

greet(42)          # runs fine. returns "Hello, 42". pyright complains; Python does not.
```

So a hint is documentation plus a linting opportunity — **except** where a library reads it at
runtime and gives it teeth. That exception is the whole reason this project is in Python:

- **Pydantic** reads hints and *does* validate. `age: int` on a `BaseModel` rejects `"abc"`.
- **FastAPI** reads hints to parse requests and generate OpenAPI.
- **pydantic-ai** reads your tool's hints to build the JSON schema the model sees.

In all three, the type hint is the contract, enforced. Everywhere else, it's a comment `pyright`
happens to read. Knowing which situation you're in is most of writing good Python here.

Modern syntax (3.10+, and this repo pins 3.13) — `ruff`'s `UP` rules enforce it:

```python
str | None          # not Optional[str]
list[str]           # not List[str]
dict[str, int]      # not Dict[str, int]
Literal["ok"]       # a literal type, like TS's "ok"
```

### Decorators

You know these from Hono middleware and TanStack Router — a function wrapping a function. Python
just gives it syntax. **`@agent.tool` is the entire pydantic-ai API, so this is load-bearing.**

```python
@app.get("/health")
async def health() -> Health: ...
```

is exactly:

```python
async def health() -> Health: ...
health = app.get("/health")(health)
```

That's all `@` means: call this thing with my function, rebind the name to the result.

Two consequences that matter:

1. **The decorator runs at import time**, not call time. `@agent.tool` registers your function with
   the agent the moment the module is imported. If a tool never registers, check the module is
   actually imported — this is a real failure mode on day 3.
2. **A decorator can inspect your function** — its name, signature, docstring, and hints. That's
   how `@agent.tool` builds a JSON schema without you writing one, and how FastAPI builds OpenAPI.
   The function *is* the declaration.

### `async` — one real trap

`async def` / `await` work the way you expect. The trap is Python-specific:

> **A blocking call inside `async def` freezes the entire event loop.** Not just that request —
> every concurrent request in the process. In Node this is hard to do by accident (almost
> everything is already async). In Python, most of the standard library is synchronous and calling
> it is trivially easy.

```python
import time, requests

async def bad():
    time.sleep(1)                     # blocks EVERYTHING for a second
    requests.get("https://…")         # same — `requests` is sync

async def good():
    await asyncio.sleep(1)
    await client.get("https://…")     # httpx.AsyncClient
```

This is why the project uses `httpx`, not `requests`. `ruff`'s `ASYNC` rules are enabled in
`pyproject.toml` and catch the common cases — but they can't catch a sync call hiding inside a
library you called.

### Dataclasses vs Pydantic — when to use which

Both give you "a struct with named fields." They are not interchangeable, and this project uses
both, deliberately:

```python
@dataclass
class CopilotDeps:              # dataclass: internal plumbing
    http: httpx.AsyncClient     # holds a live object. no validation. no serialization.
    token: str

class CopilotState(BaseModel):  # Pydantic: crosses a boundary
    active_event_id: str | None = None   # validated from JSON. serialized back.
```

**The rule:** Pydantic when the data crosses a boundary (HTTP, the model, the browser) and must be
validated or serialized. A dataclass when it's plumbing you construct yourself and hand around.

Using Pydantic for deps means it tries to validate an `httpx.AsyncClient`, which is not what you
want. Using a dataclass for state means AG-UI can't parse it from JSON.

### Small things worth ten seconds each

```python
# f-strings — template literals

f"{count} events"

# Truthiness: empty list/dict/str are all falsy. `if not events:` is idiomatic.

# `None` is not `null`-ish — use `is None`, never `== None`.

# Mutable default arguments are a real bug. This is shared across ALL calls:

def bad(items: list[str] = []): ...      # ruff's B006 catches it
def good(items: list[str] | None = None):
    items = items or []

# _ means "deliberately unused"

for _ in range(3): ...

# Docstrings are the first statement in a function, and are readable at runtime

# via __doc__. That last part is why it matters in Part 2 below.

```

## Part 2 — pydantic-ai

Official docs: [Agents](https://pydantic.dev/docs/ai/core-concepts/agent/) ·
[Dependencies](https://pydantic.dev/docs/ai/core-concepts/dependencies/) ·
[Tools](https://pydantic.dev/docs/ai/tools-toolsets/tools/)

*(Search results also surface `ai.pydantic.dev` — same docs, older host that redirects. Prefer
`pydantic.dev/docs/ai/`.)*

### The idea

A language model can't call your code. It can only emit text. "Tool calling" is a protocol on top
of that: you describe your functions as JSON schemas, the model emits a structured request naming
one, your runtime executes it and feeds the result back, and the model continues.

**pydantic-ai's contribution is that you never write the schema.** You write a typed Python
function; it derives the schema from the signature and docstring.

```
your function ──(signature + docstring)──> JSON schema ──> the model
the model ──(picks one, emits args)──> pydantic-ai validates them ──> your function runs
your function's return ──> back into the conversation ──> the model writes prose
```

Every piece of that loop is worth being able to describe. It's the substance of "do you actually
understand tool calling, or did you use a framework."

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

`instructions` is the system prompt. **Be specific about tool use** — "never guess" earns its
place, because a model with a vague prompt will happily invent an event list rather than call
something.

The agent is created once, at module import, not per request. Per-request data arrives through
deps.

### Tools, and the docstring thing

> **The single most important idea in the fortnight.** Your tool's docstring is not documentation
> for other developers. It is *prompt text*, sent to the model, and it is the main thing
> determining whether your tool gets called at the right moment.

```python
@agent.tool
async def list_events(ctx: RunContext[CopilotDeps], when: Literal['upcoming', 'past']) -> list[Event]:
    """List the organizer's events.

    Use this whenever the user asks what is coming up, what happened recently,
    or anything about their schedule. Prefer 'upcoming' unless they clearly
    mean the past.
    """
```

What the model receives from that:

- the **name** `list_events`
- the **docstring**, verbatim
- a schema for `when`, restricted to two literal values — so the model *cannot* pass `"future"`
- a note that it returns a list of `Event`

You wrote none of that schema. Change the docstring and you have changed the prompt.

**The corollary, which will save you on day 8:** when the model doesn't call a tool you expected,
your first suspicion should be the docstring, not the model. Day 2's exercise 3 makes you feel this
deliberately rather than discovering it under pressure.

### `@agent.tool` vs `@agent.tool_plain`

One difference: whether the function takes `RunContext` as its first parameter.

```python
@agent.tool                                    # needs request-scoped data
async def list_events(ctx: RunContext[CopilotDeps], when: str) -> list[Event]:
    return await ctx.deps.http.get(...)

@agent.tool_plain                              # pure; needs nothing
def roll_dice() -> int:
    return random.randint(1, 6)
```

`ctx` is not shown to the model. It sees only `when`. Almost every tool in this project is
`@agent.tool`, because they all need the caller's token.

### `deps_type` and `RunContext` — the DI system

An agent is defined at import time; a request happens later, with a different user and a different
token each time. `deps_type` is how per-request data reaches your tools without globals.

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
    ...

await agent.run('what is coming up?', deps=CopilotDeps(http=..., token=..., organization_id=...))
```

`deps_type` is declared once and every `RunContext[CopilotDeps]` is checked against it — pass the
wrong shape and `pyright` says so. That's what "type-checked rather than stringly-typed" means, and
it's the answer to "why this library rather than raw API calls."

**The comparison that lands:** it's `c.get('tenant')` in a Hono handler — request-scoped data the
handler didn't fetch itself — except typed end to end instead of by a string key.

### Output types

By default `result.output` is a string. Declare `output_type` and you get validated structure:

```python
class DraftMessage(BaseModel):
    subject: str
    body: str

agent = Agent('openai:gpt-5.2', output_type=DraftMessage)
result = await agent.run('draft a reminder')
result.output.subject      # typed, validated
```

You need this on **day 9**, where `output_type=[str, DeferredToolRequests]` means "either prose or
a pause for approval." A list means "any of these."

### The run loop

Worth holding in your head, because it explains the latency and the token cost:

1. You call `agent.run(prompt, deps=...)`.
2. Prompt + tool schemas go to the model.
3. Model either answers, or requests one or more tool calls.
4. pydantic-ai validates the args against your signature, runs the tool, appends the result.
5. **Back to 2.** Loop until the model answers or hits the retry limit.

So "how many are checked in for tomorrow's event?" can be three round trips: find the event, get
its state, write prose. That's why day 3 asks whether it chained two tools unprompted — chaining is
the loop working.

---

# Build

```bash
cd services/core-v2
uv add pydantic-ai
```

Set your provider key in `services/core-v2/.env`. One provider, chosen today, not revisited.

## Warm-ups — Python

Throwaway, in `scratch/`. Fast; don't dwell.

1. **Prove hints do nothing.** Write a function hinted `-> int` that returns a string. Run it. Then
   run `uv run --with pyright pyright` and watch it complain about code that ran fine.
2. **Write a decorator.** ~10 lines: `@log_calls` that prints the function's name and args before
   calling it. Apply it to two functions. Then print `some_func.__doc__` and `__name__` from inside
   the decorator — you've just done by hand what `@agent.tool` does.
3. **Feel the blocking trap.** Two `async def`s that `await asyncio.sleep(1)`, run concurrently
   with `asyncio.gather` — ~1 second total. Swap one to `time.sleep(1)` — ~2 seconds. That
   difference is the whole lesson.
4. **Dataclass vs Pydantic.** A `BaseModel` with `age: int` given `"30"` (coerces) then `"abc"`
   (raises). Same with a `@dataclass` — accepts both silently.

## The main task

**Mode A — worked example (I write this, throwaway).** A ~25-line agent in `scratch/dice.py`: one
`@agent.tool` needing `RunContext` (a seeded RNG from deps), one `@agent.tool_plain` that doesn't,
plus a `TestModel` test. Heavily commented. I explain it; you don't copy it.

**Mode B — you write, in `scratch/`:** the analogous thing, not the same thing.

1. A `@dataclass` deps type holding something request-scoped (a user name, a base URL — anything).
2. One `@agent.tool` that reads `ctx.deps`.
3. One `@agent.tool_plain` that doesn't.
4. A run against a real model that visibly calls both.
5. **Pass the wrong type to `deps=`** and read what `pyright` says. That error message is the
   "type-checked, not stringly-typed" claim made concrete.
6. **Constrain an argument**: change a `str` parameter to `Literal['a','b']`, then try to get the
   model to pass something else.
7. **Break the docstring.** Change a working tool's docstring to `"""Does a thing."""` and ask the
   same question. Watch the model stop choosing it, or choose it wrongly.
   **Do this one** — it is the single highest-value five minutes in the fortnight, and it is what
   you will reach for on day 8 when a tool isn't being called.

---

# Done when

- Your `scratch/` agent runs and calls both tools.
- You've seen a bad docstring change the model's tool choice, and can say why.
- You can answer, without the docs open: what does `RunContext` carry, and when do you need it?

---

# If it breaks

### Python-side

| Looks like | Actually is |
|---|---|
| Code runs but `pyright` fails | Normal. Hints aren't runtime checks. Fix them anyway — day 8's tool contracts depend on them being honest. |
| A tool never gets registered | Its module was never imported, so the decorator never ran. |
| One slow request makes everything slow | A blocking call in an `async def`. |
| Pydantic rejects something a dataclass accepted | Working as intended. That's why it's there. |
| `ModuleNotFoundError: app` | Run through `uv run` (or nx), not bare `python`. `pythonpath = ["src"]` lives in `pyproject.toml`. |

### pydantic-ai-side

| Looks like | Actually is |
|---|---|
| Model answers from thin air instead of calling a tool | Docstring too vague, or `instructions` didn't say to prefer tools. |
| Tool never appears to exist | Module never imported, so the decorator never ran (see Decorators, above). |
| `ValidationError` on tool args | The model passed something your hints reject. Usually means the parameter needs a `Literal` or a clearer docstring. |
| Tool called with plausible but wrong args | It's guessing from the name. Say the constraint in the docstring. |
| Agent loops, then gives up | Tool raising on every call, or returning something unusable. Log the return value. |
| `ctx.deps` is `None` | `deps=` not passed to `run()`. |

---

# Say it out loud

> "Python type hints aren't enforced at runtime — but Pydantic, FastAPI and pydantic-ai all read
> them and give them teeth. In pydantic-ai the function signature *and its docstring* become the
> JSON schema the model sees, so the type hint is the contract, not a comment."

---

> "You write a typed function; pydantic-ai derives the JSON schema the model sees from its
> signature and docstring, so there's no second place to declare it. `deps_type` and `RunContext`
> inject request-scoped data — the HTTP client, the caller's token — into tools without globals,
> and it's type-checked end to end rather than a dict of strings. The docstring is prompt surface:
> changing it changes when the model reaches for the tool."

---

---

## Retro

- Provider chosen, and why:
- What was harder than expected:
- Fundamentals gap surfaced (Python-side — decorators, dataclasses, generics):
- Carry into day 3:
