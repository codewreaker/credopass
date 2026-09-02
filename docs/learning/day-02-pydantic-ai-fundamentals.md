# Day 2 — pydantic-ai fundamentals

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §3

First day of genuinely new material. No CredoPass code today — a toy agent in `scratch/`, because
learning `RunContext` and debugging a tenancy header at the same time is how you end up unable to
tell which half is broken.

## Objectives

By the end of today you can:
- Say what `deps_type` / `RunContext` actually inject into a tool call, and why that wiring is
  type-checked rather than a dict of strings.
- Say what the difference is between `@agent.tool` and `@agent.tool_plain` — one line, and it's
  about `RunContext`.
- **Explain that a tool's docstring is prompt surface, not documentation.** This is the single
  most load-bearing idea of the day: the function signature and docstring *become the schema the
  model sees*. When the agent calls the wrong tool on day 8, this is why.

## New today

Read in this order. The first three are the whole conceptual load:

- [Agents](https://pydantic.dev/docs/ai/core-concepts/agent/) — the `Agent` object, run methods,
  instructions. Everything hangs off this.
- [Dependencies](https://pydantic.dev/docs/ai/core-concepts/dependencies/) — `deps_type` and
  `RunContext`. This is objective 1.
- [Tools](https://pydantic.dev/docs/ai/tools-toolsets/tools/) — `@agent.tool` vs
  `@agent.tool_plain`, and how the signature becomes the schema. Objectives 2 and 3.
- [Output types](https://pydantic.dev/docs/ai/core-concepts/output/) — skim only. You need to know
  structured output exists; day 9 is when it matters (`DeferredToolRequests` goes in `output_type`).

URL note: search results also surface `ai.pydantic.dev/...` — the same docs on an older host that
301s. Prefer `pydantic.dev/docs/ai/`.

**TS mapping that holds:** an `Agent` is roughly a configured client with a tool registry;
`deps_type` is the DI container; `RunContext` is what a Hono handler's `c.var` is — request-scoped
things the handler didn't have to fetch itself. **Where it stops holding:** there's no TypeScript
analogue for "the docstring is part of the contract." Sit with that one.

## Hands-on task

**Mode A — worked example (I write this, throwaway).** A ~25-line agent in `scratch/dice.py` with
one `@agent.tool` that needs `RunContext` (a seeded RNG from deps) and one `@agent.tool_plain`
that doesn't, plus a `TestModel` test. Heavily commented. I explain it; you don't copy it.

**Mode B — you write, in `scratch/`:** the analogous thing, not the same thing. A tiny agent with:
1. A `@dataclass` deps type holding something request-scoped (a user name, a base URL — anything).
2. One `@agent.tool` that reads `ctx.deps`.
3. One `@agent.tool_plain` that doesn't.
4. A run against a real model that visibly calls both.

Then, deliberately: **break the docstring on one tool** — make it vague or wrong — and watch the
model stop choosing it. That five-minute experiment is worth more than the rest of the day.

```bash
cd services/core-v2
uv add pydantic-ai
```

Set your key in `services/core-v2/.env`. One provider, chosen today, not revisited.

## Done when

- Your `scratch/` agent runs and calls both tools.
- You've seen a bad docstring change the model's tool choice, and can say why.
- You can answer, without the docs open: what does `RunContext` carry, and when do you need it?

## Retro

- Provider chosen, and why:
- What was harder than expected:
- Fundamentals gap surfaced (Python-side — decorators, dataclasses, generics):
- Carry into day 3:
