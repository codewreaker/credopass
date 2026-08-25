# Week 7 — testing, adversarial cases, polish

Status: not started

## Objectives

By the end of this week you can:
- Explain why `TestModel` and `FunctionModel` let you test agent logic without a live LLM call,
  and when you'd reach for one over the other.
- Point at meaningful pytest coverage across `core-v2`'s services, routes, and the Copilot's tools
  — no network calls, no live API keys required to run the suite.
- Hand someone `services/core-v2/README.md` and have them understand what's ported, what's
  deliberately skipped and why, without asking you anything.
- Have the OpenAPI-parity comparison from plan §1 written up as an actual finished note, not just
  something that was checked once in week 1 and left in your head.

## New this week (read before starting)

- [Pydantic AI — unit testing guide](https://pydantic.dev/docs/ai/guides/testing/) (plan Key
  Sources) — the full `TestModel`/`FunctionModel`/`Agent.override`/`ALLOW_MODEL_REQUESTS=False`
  pattern, not just the pieces used so far. The
  [`TestModel` API reference](https://pydantic.dev/docs/ai/api/models/test/) is the companion for
  exact arguments.
- [pytest — fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html) — by now you've been
  copying fixture patterns for five weeks; this is the week to actually read how scope, teardown
  and `conftest.py` resolution work, because the adversarial ports need per-test DB isolation.
- [FastAPI — async tests](https://fastapi.tiangolo.com/advanced/async-tests/) and
  [dependency overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/) — overriding
  the auth/tenancy dependencies is how the adversarial cases construct a caller from another
  tenant without minting real JWTs.
- [ruff](https://docs.astral.sh/ruff/linter/) rule selection and
  [pyright](https://microsoft.github.io/pyright/) configuration — the polish half of this week;
  decide what's actually enforced rather than leaving week 0's defaults unexamined.
- Pick 3–5 of the strongest cases from `services/core/src/test/adversarial/` — read the real files,
  don't guess at what they cover.

## Hands-on task

**Mode B — mostly this, by now the default rhythm:**
1. I select 3–5 adversarial cases from the TS suite (real file, real line numbers) and hand you
   the originals plus a spec. You port them to pytest against `core-v2`. These should be the
   *strongest* security-relevant cases — cross-tenant access attempts, permission-boundary checks
   — not arbitrary ones, since this is the security story for the whole project.
2. Convert any Phase A/B agent test that's currently relying on `TestModel`'s default behavior to
   `FunctionModel` where you actually need to assert a specific tool argument or a specific
   sequence of tool calls, not just "some tool was called."

**Mode C — infrastructure, I scaffold, you fill in the content:**
- Structured logging config (the shape, not the specific log lines — those come from what you
  actually built).
- `services/core-v2/README.md` skeleton. You write the actual content: what's ported (plan §2
  Tier 1), what's stretch (Tier 2), what's explicitly skipped and why (Tier 3), how to run it.
- The OpenAPI comparison write-up: spot-check a handful of v1's `createRoute` calls for how they
  declare non-2xx responses (plan §1's open question from the OpenAPI-parity note), and decide —
  and document — whether `core-v2` matches what v1 actually declares today or closes a gap v1
  itself has.

## Done when

- `uv run pytest` is green with zero network calls — verify this explicitly, don't assume it.
- `services/core-v2/README.md` exists and a stranger could follow it.
- The OpenAPI comparison note is a finished paragraph or two, not an open question anymore.

## Retro (fill in at the end)

- What was harder than expected:
- Fundamentals gap surfaced, if any:
- Carry into week 8:
