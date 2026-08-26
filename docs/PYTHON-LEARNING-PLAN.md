# Python / FastAPI / pydantic-ai / AG-UI learning plan — `api/v2/core`

**Status: week 0 underway.** The `services/core-v2` scaffold exists on branch
`learn/api-v2-python`; no app code yet. Live progress:
[`learning/STATUS.md`](learning/STATUS.md). Written 2026-08-24, ahead of a
Citadel Securities interview, to turn CredoPass into the vehicle for learning FastAPI +
pydantic-ai + the AG-UI protocol rather than building a disconnected side project.

This document covers, in order: what "done" means and what it deliberately doesn't include (§0),
the architecture decision everything else hangs off (§1), which of v1's routes get ported and
which don't (§2), the agentic feature design (§3), the integrated 8-week learning + build schedule
— this is asks #1 and #4 together, see the note in §4 for why (§4), a rusty-Python crash course
(§5), a "what changed since Python 2 / old Python 3" guide (§6), environment/tooling setup (§7),
a concrete demo script (§8), and a critique of the plan itself (§9).

**This is the *what*.** For the *how* — per-week task files, the tutoring model, progress
tracking, and how rustiness gets handled session to session — see
[`LEARNING-WORKFLOW.md`](LEARNING-WORKFLOW.md). Current progress lives in
[`learning/STATUS.md`](learning/STATUS.md).

---

## 0. What this is and isn't

**Is:** a learning project that reuses a real, non-trivial, already-running app instead of a toy.
The payoff of doing it this way is that the finished thing is a genuine portfolio artifact — "I
ported a multi-tenant API's authz model and shipped an agentic feature on top of it" is a much
better interview answer than "I did the FastAPI tutorial."

**Isn't:**
- A replacement for `services/core` (the TypeScript/Hono API). It keeps running unchanged.
- A production cutover. Nothing in `apps/web`'s default config points at the new service.
- A promise of full route-for-route parity with v1 in 8 weeks — see §2 for what's explicitly cut,
  and §9 for why cutting scope now beats discovering the cut in week 7.

**Assumptions this plan makes** (adjust the pacing in §4 if these are wrong):
- ~10–12 hours/week for 8 weeks (~80–95 hours total). This is tight — see §9.
- "Rusty but not a beginner": you can read/write Python, but haven't touched decorators, type
  hints, `async`/`await`, or the packaging ecosystem in ~5 years.
- No fixed interview date is given. The schedule reserves week 8 for interview prep, not new code.
  If your actual interview lands earlier, cut from the back of §4, not the front — the ordering in
  §4 is deliberately front-loaded so something demoable exists as early as week 5.

---

## 1. Architecture decision

Everything below follows from one call: **this is a new, additive service, not a rewrite-in-place.**

| Decision | What it means |
|---|---|
| **New service** | `services/core-v2/` — Python/FastAPI, sits beside `services/core` (TS/Hono). Doesn't touch it. |
| **Base paths** | `/api/v2/core/*` for the REST port, `/api/v2/agent/organizer-copilot` for the AG-UI endpoint. Same service, two route groups. |
| **Precedent, not novelty** | This repo already did "two API surfaces exist at once, deliberate" once — `/api/core` → `/api/v1/core`. `/api/v2/core` is the same move, one more time, in a different language. |
| **Never wired into prod** | `apps/web`'s default config never points here. If the Copilot panel ships into the real app at all, it's behind a dev-only env toggle. Zero blast radius to the actual product. |
| **Schema authority stays put** | Drizzle remains the only thing that writes migrations — golden rule 1 doesn't get suspended for a side project. The Python service gets its **own local-only Postgres database** (a second DB in the dev docker-compose, e.g. `credopass_v2_dev`), migrated by running the *same* Drizzle migrations against it. Python maps onto the result with hand-written SQLAlchemy 2.0 models. It never points at the shared/remote instance — that instance is [documented as un-migrated for the rewrite already](DATABASE-MIGRATION.md); a second, Python-shaped consumer of it is not a risk worth taking. |
| **Auth: reuse, don't reinvent** | Same Supabase-issued JWTs the browser already holds. A FastAPI dependency verifies them against Supabase's JWKS (RS256) — a Python port of `requireCaller`. |
| **Tenancy: port it faithfully** | `require_tenant` reproduces the header → path-param → sole-membership resolution order and, critically, the **403 vs. 404 split** (header naming a foreign org → 403 `not_a_member`; path naming a foreign org → 404, because confirming existence would leak that another tenant owns the row). This is the single highest-value thing to port carefully — it's real security reasoning, not CRUD, and it's a strong interview story on its own. |
| **Errors** | A `ProblemError` port (RFC 9457, same closed code enum, same "generic detail unless dev mode" leak-avoidance) via a FastAPI exception handler. |
| **Tenancy filtering** | Explicit `WHERE organization_id = :org_id` per query, no RLS dependency. This matches what v1 *actually* does today — RLS is inert there too (the API connects as `postgres`) — so it's not a regression, it's parity with reality. |
| **The one genuine framework difference worth naming** | FastAPI derives its OpenAPI doc from Pydantic models + type hints automatically. v1 hand-writes a parallel Zod schema next to each Drizzle table and passes it into `createRoute` explicitly — there's no `drizzle-zod` generation happening, per `CLAUDE.md` and confirmed by grep. Decide deliberately in §2/§4 whether `core-v2` closes that gap (generate Pydantic schemas from SQLAlchemy models) or keeps the same hand-written-parallel-schema discipline. Either choice, made on purpose, is a good interview answer; drifting into one by accident isn't. |

### OpenAPI parity, confirmed against both sides

You asked directly: does FastAPI give you the OpenAPI equivalent of what v1 does today, or does
something extra need wiring up? Checked both sides rather than assuming — the TS side via a direct
read of `services/core/src/api/v1/core/index.ts` and `http/define-route.ts`, the FastAPI side via
its current official docs (fetched fresh, not from training data, since specifics change between
versions).

**How v1 does it today**: `@hono/zod-openapi`'s `OpenAPIHono` in place of vanilla `Hono`. Each
route's Zod `request`/`responses` schemas, passed into `createRoute` (wrapped by `defineRoute`),
are simultaneously the runtime validator *and* the OpenAPI schema source — one schema, two jobs,
but it has to be passed in explicitly, per route, by hand. The doc is served live at
`v1.doc31('/openapi.json', ...)` — OpenAPI **3.1**. A `bearerAuth` security scheme is registered
once, explicitly, in `index.ts`. Scalar at `/docs` reads that JSON.

**What FastAPI gives you automatically, confirmed**:
- `/openapi.json` and interactive docs (`/docs` Swagger UI, plus `/redoc`) are generated with
  **zero configuration**, straight from your route decorators and Pydantic type hints — no
  `createRoute`-equivalent call, no separate schema-passing step. The Pydantic model that types
  your function signature *is* the schema; there's no second place to declare it.
- FastAPI's default output is **OpenAPI 3.1.0** — the same version v1 already emits. No format
  mismatch to reconcile.
- **Bearer/JWT auth documentation is effectively free too**, not extra config: any dependency class
  that inherits from `fastapi.security.SecurityBase` (e.g. `HTTPBearer`) automatically gets a
  `securitySchemes` entry and marks every route using it as protected, purely because you used that
  class as your `Depends()` — which week 2's `get_current_account` dependency needs to be anyway.
  Build it as an `HTTPBearer` subclass rather than an ad-hoc header-parsing function and the OpenAPI
  registration v1 does explicitly in `index.ts` happens as a side effect, for less code than v1
  needed, not more.
- **The one place that genuinely needs explicit, per-route work**: non-2xx response shapes — the
  `ProblemError`/RFC 9457 envelope. Raising an exception and catching it in a global handler (the
  FastAPI-side equivalent of v1's `v1.onError()`) does *not* get inferred into the OpenAPI schema
  automatically; each route needs `responses={404: {"model": ProblemModel}, ...}` for those shapes
  to show up in `/openapi.json`. This isn't a FastAPI shortfall specifically — it's not yet
  confirmed how exhaustively v1's own per-route `responses` blocks document every `ProblemError`
  variant either, since those are thrown generically from services rather than declared per route.
  Spot-check a couple of v1 routes' `createRoute` calls in week 1, then decide in week 7 whether
  `core-v2` matches whatever v1 actually documents today, or closes a gap v1 itself has. Either way
  it's a named task (week 7, alongside the "OpenAPI comparison write-up"), not a silent gap.

---

## 2. What gets ported — the v1 → v2 route map

v1 (`services/core/src/api/v1/core/`) has ~44 routes across 8 domain modules plus health checks.
Porting all of them while also learning three new-to-you technologies is the first thing to cut —
see §9. Here's the tiering, grounded in an actual read of every route file, not the route names.

### Tier 1 — port (the vertical slice, weeks 1–6)

| Module | Routes | Why it's in scope |
|---|---|---|
| `index.ts` (health) | 2 (`/health`, `/health/ready`) | Trivial, but forces the whole `uv` → Docker → DB → FastAPI chain to work end to end in week 1. |
| `me.ts` | 2 | Smallest real route pair with auth. First thing to hit with a real JWT. |
| `organizations.ts` | 12 | The most tenancy-logic-dense module — orgs, members, roles, invitations. The best test of whether `require_tenant` was ported faithfully, because it isn't just CRUD. |
| `people.ts` | 6 | Straightforward CRUD once tenancy exists — reinforces the pattern without new concepts. |
| `events.ts` | 8 | CRUD plus derived state (`event-status.ts`'s pure function, not a stored column) — a clean small "port business logic, not just a table" exercise. |
| `attendance.ts` | 5 | The actual product differentiator: idempotent check-in, the unique-index-per-`(event,person)` invariant, capacity enforcement. Saved for week 6, after async SQLAlchemy is solid. |

**33 routes total.** This is most of the domain surface, not a token slice — what's missing is the
two modules that are mocked in v1 itself, plus the anonymous-visitor surface.

### Tier 2 — stretch, only if a week has slack

| Module | Routes | Why it's optional |
|---|---|---|
| `public.ts` | 4 | Unauthenticated — different code paths than everything else. Real learning value (anti-enumeration on resend-pass, self-check-in gating) but not on the critical path to a demo. |
| `/p/{token}` (bearer-pass) | 2 | Interesting — `PassService`'s signed-token verification is a nice crypto-adjacent tangent — but it's a second, distinct auth model (bearer-token-as-credential vs. account JWT) that would need its own FastAPI dependency. Only worth it if weeks 1–6 finish early. |

### Tier 3 — explicitly skip, and say so in the write-up

| Module | Routes | Why |
|---|---|---|
| `analytics.ts` | 1 | v1's own analytics are **fabricated** — a deterministic placeholder generator, not real aggregation (`services/analytics/`, flagged `fabricated: true`). Porting it teaches "return canned JSON in a new language." Skip it; note why in the README. |
| `billing.ts` | 2 | Also mocked — `PUT /organizations/{id}/plan` just writes a column, no payment processor exists. Same reasoning. |
| `/openapi.json`, `/docs` | — | Not a porting task at all — FastAPI generates these automatically from the Pydantic models you already wrote for the routes above. This is one of the concrete payoffs of switching frameworks; call it out as such rather than building it. |

---

## 3. The agentic feature — "Organizer Copilot"

CredoPass is an attendance platform; the organizer's actual daily friction is "how many people
are here right now," "who registered but hasn't shown," and "I need to tell people something."
An AI assistant that answers those from real data — with a human-in-the-loop gate on anything
destructive — is genuinely useful *and* happens to exercise exactly the parts of pydantic-ai and
AG-UI that are most worth having a story about in an interview: typed tool calling, shared state,
and the approval/interrupt flow.

### Design

- **One agent**, `organizer_copilot`, `deps_type=StateDeps[CopilotState]` where `CopilotState`
  holds `active_organization_id` / `active_event_id` — mirrors the web app's own
  active-organization concept (`packages/api-client/src/active-organization.ts`) so the agent
  "knows" what event you're looking at without you repeating it every message.
- **Read tools** (no approval needed):
  - `get_event_summary(event_id_or_active)` — event details, counts.
  - `get_checkin_state(event_id)` — live checked-in/registered/capacity counts.
  - `search_people(query)` — org roll lookup.
  - `find_likely_no_shows(event_id)` — best-effort from registered-vs-checked-in; explicitly *not*
    presented as the authoritative no-show list, because v1 only finalizes no-shows when an event
    is closed (`POST /events/{id}/close`). This is a deliberate constraint the tool respects rather
    than papering over — a good thing to be able to explain in an interview: the tool's contract
    matches what the data actually supports.
  - `draft_reminder_message(event_id, audience, tone)` — a pure generation tool, `output_type` a
    structured `DraftMessage(subject, body)`. Never sent — CredoPass has no email service yet
    (`NEXT-UI-LIST.md`), so this is consistent with the rest of the app: the draft is shown on
    screen for the organizer to copy, same as pass and invite links are today.
- **One approval-gated tool**, to demonstrate AG-UI's human-in-the-loop interrupt specifically:
  - `cancel_event(event_id)` via `@agent.tool_plain(requires_approval=True)` →
    `DeferredToolRequests` → the AG-UI frontend renders an explicit confirm/deny card before the
    call executes. This is the single most demo-worthy moment in the whole feature.
- **Safety property worth stating explicitly**: in Phase A (below) every tool forwards the
  caller's *real* bearer token and `X-Organization-Id` to v1. The agent doesn't get a new,
  separate permission surface — it inherits whatever the signed-in organizer could already see and
  do through the existing API. No new authz to audit for the read tools.

### Phased build — deliberately decoupled from the rewrite's pace

- **Phase A (week 4)**: tools call the *existing, working* v1 TypeScript API over `httpx`, using
  the signed-in organizer's own token. A demoable agent exists by week 4 regardless of how far the
  FastAPI port has gotten — the flashiest part of the stack doesn't wait on the plumbing.
- **Phase B (week 6)**: once `attendance.ts`/`events.ts` are ported natively, swap the read tools
  to call `core-v2`'s own service layer in-process instead of hopping back out over HTTP to v1.
  This swap — same tool contracts, different implementation — is itself a good "here's how I
  decoupled a risky new feature from a risky rewrite" talking point.

### Where it lives in the app

A new container, `apps/web/src/containers/Copilot/` (sibling to the existing `UserMenu`,
`RightSidebar`, etc.), using CopilotKit's prebuilt `<CopilotChat>` or `<CopilotSidebar>` — not a
hand-built chat UI. The interview-relevant learning here is the backend; time saved on frontend
polish should go to §4's backend weeks. Gate it behind `useCan` the same way `/account?tab=members`
already gates member management, and behind the dev-only toggle from §1.

---

## 4. The 8-week schedule — learning path *and* rewrite map together

**Why these are one table, not two.** You asked for a learning path (#1) and separately for how
the rewrite maps onto it (#4) — but you also framed the whole project as "the real app is the
vehicle for learning, not a separate side project." Two lists that then have to be reconciled by
hand work against that framing. One table, where each week names what you're learning *and* what
it unlocks, is the more honest artifact. If you want them physically separate for some other
reason (e.g. a resume bullet vs. a study log), splitting this table into two columns worth of
content is a five-minute copy-paste, not a redesign.

| Week | Learning focus | Rewrite / feature milestone | End-of-week artifact |
|---|---|---|---|
| **0** (3–5 days, hard time-box) | Skim §5 (crash course) and §6 (modern Python). If it's all trivial, stop early — don't spend a week relearning `for` loops. | Scaffold `services/core-v2/`: `uv init`, `ruff`, `pytest`, Docker Compose entry for `credopass_v2_dev`. | `uv run pytest` passes on an empty test suite. Nothing app-level yet. |
| **1** | Type hints (§6), `async`/`await` fundamentals, FastAPI basics: path/query params, Pydantic models as request/response bodies, `Depends`, automatic `/docs`. | Port `GET /health`, `GET /health/ready` (real DB ping). | FastAPI boots, connects to `credopass_v2_dev`. Open its auto-generated `/docs` next to v1's Scalar page at `:8080/api/v1/core/docs` — first concrete "here's what FastAPI gives you for free" moment. |
| **2** | `Annotated[..., Depends(...)]` patterns, exception handlers, `pytest` + `httpx.AsyncClient` for route tests, SQLAlchemy 2.0 async engine/session basics. | `ProblemError` port + exception handler. `get_current_account` dependency (JWKS verification, ports `requireCaller`). Port `me.ts` (2 routes). | `GET /api/v2/core/me` with your real CredoPass browser session token returns your account. |
| **3** | SQLAlchemy 2.0 `Mapped`/`mapped_column`, relationships. Decide-and-document: reuse Drizzle's migrations against the second DB (no Alembic) — a deliberate choice, not a gap. | `require_tenant` dependency (header/path/sole-membership + the 403-vs-404 rule). Port `organizations.ts` (12 routes). | Cross-tenant access attempts return the right status code for the right reason — write the first 2–3 adversarial-style tests here, don't wait for week 7. |
| **4** | pydantic-ai fundamentals: `Agent`, `@agent.tool`, `RunContext`, `deps_type`, `output_type`, `TestModel` for deterministic tests. | **Phase A Copilot**: plain JSON chat endpoint, 2–3 read tools calling v1 over `httpx`. In parallel, continue the port: `people.ts` (6), `events.ts` (8). | A terminal script can ask "how many people are registered for [event]?" and get a real, tool-derived answer. No AG-UI/UI yet. |
| **5** | AG-UI protocol: event model, SSE transport, `RunAgentInput`, `StateDeps`; CopilotKit React: `useCoAgent`/`useAgent`, `<CopilotChat>`. | Wire the week-4 agent behind `AGUIAdapter` at `/api/v2/agent/organizer-copilot`. Add the `Copilot` container to `apps/web`, behind the dev toggle. | A real chat panel in the actual CredoPass web app, streaming a live answer about real event data. This is the headline demo artifact — it exists by week 5, deliberately, in case everything after this point slips. |
| **6** | Idempotency/capacity invariants, the unique-index-per-`(event,person)` pattern. AG-UI's interrupt/approval flow in depth. | Finish `attendance.ts` port (5 routes). Add `cancel_event` as an approval-gated tool. **Phase B**: swap the Copilot's read tools from HTTP-to-v1 to native `core-v2` service calls. | The interrupt card actually renders in the browser and blocks execution until confirmed. |
| **7** | `TestModel`/`FunctionModel` for agent tests (no live LLM calls in CI — mirrors the repo's own "tests never touch real state" rule). | Test coverage for `core-v2` services and routes; port 3–5 of the strongest adversarial-tenancy cases from `test/adversarial/`. Structured logging. `services/core-v2/README.md`. Write up the OpenAPI comparison from week 1 properly. | `uv run pytest` is green with no network calls; a README a stranger could follow. |
| **8** | — (no new material) | No new code. Write a one-page architecture note for `core-v2`. Rehearse explaining the 403-vs-404 rule and the AG-UI approval flow out loud, twice. Do one cold, end-to-end demo run. | You can explain every decision in §1 and §3 without looking at this document. |

---

## 5. Python crash course — rusty-fundamentals refresh (curated, not original)

Purpose: re-load syntax, idioms, and the standard library you haven't touched in 5 years. This is
**not** the typing/async/modern-FastAPI material — that's §6. If these all feel obvious in a
30-minute skim, skip to §6 immediately; don't burn week 0 here.

- [The Official Python Tutorial](https://docs.python.org/3/tutorial/) — the reference refresher; skim, don't read cover to cover.
- [Real Python — Python Basics learning path](https://realpython.com/learning-paths/python3-introduction/) — structured, exercise-driven.
- [Automate the Boring Stuff with Python](https://automatetheboringstuff.com/) — fast, practical, free online; good for muscle memory on comprehensions, file/string handling.
- [Corey Schafer — Python OOP series (YouTube)](https://www.youtube.com/playlist?list=PL-osiE80TeTsqhIuOqKhwlXsIBIdSeYtc) — classes, `@property`, dunder methods; still the clearest free treatment of this.
- [The Python Cheatsheet](https://www.pythoncheatsheet.org/) — quick-reference while coding, not a course.

**If the skim shows real gaps** (and only then — this is course-length material, and week 0 is
time-boxed to days):

- [CS50P — Harvard's *Introduction to Programming with Python*](https://cs50.harvard.edu/python/) —
  free, complete, well-paced. Starts from zero, so use it surgically: jump to the lectures covering
  whatever the skim flagged, don't start at week 1.
- [Exercism — Python track](https://exercism.org/tracks/python) — free, exercise-driven, with human
  mentoring. Better than a course for "I can read it but I don't write it fluently," which is the
  likely shape of five years' rust.

**Idiom-level, ongoing, not week-0 reading** — bookmark these for when a piece of code you wrote
works but doesn't look like the code you're reading:

- [mCoding (YouTube)](https://www.youtube.com/@mCoding) — short, precise videos on what modern
  Python actually does under the hood; unusually rigorous for the format.
- [ArjanCodes (YouTube)](https://www.youtube.com/@ArjanCodes) — design, typing and refactoring in
  Python; the closest free analogue to a senior reviewer explaining why they'd write it differently.

## 6. "Up to scratch" — what changed since Python 2 / old Python 3 (curated)

Purpose: the stuff that didn't exist or looked completely different last time you wrote Python.
This is where the actual unfamiliarity risk is, not §5 — spend real time here.

**Typing** (the part FastAPI and pydantic-ai are both built on top of):
- [`typing` module docs](https://docs.python.org/3/library/typing.html) — the reference.
- [mypy's type-hints cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html) — **start here**, not with the PEPs. One page, every annotation form you'll actually type, side by side. Fastest way to get from "I can read hints" to "I write them without stopping."
- [Static Typing with Python](https://typing.python.org/en/latest/) — the Python typing team's own guide (also at [`typing.readthedocs.io`](https://typing.readthedocs.io/en/latest/)). Deeper than the cheat sheet, more practical than the PEPs; the [Type System Guides](https://typing.python.org/en/latest/guides/index.html) section is the useful part.
- [PEP 484 — Type Hints](https://peps.python.org/pep-0484/) — where this started.
- [PEP 544 — Protocols](https://peps.python.org/pep-0544/) — structural typing; pydantic-ai and FastAPI both lean on this.
- [PEP 695 — Type Parameter Syntax](https://peps.python.org/pep-0695/) — modern generics (`class Box[T]`, `def first[T]`), replacing the old `TypeVar`-as-module-global pattern. Use this syntax, not the old one, in any Python 3.12+ code you write. It landed in [What's New in 3.12](https://docs.python.org/3/whatsnew/3.12.html), which is worth reading for that section alone.
- [Real Python — Python Type Checking Guide](https://realpython.com/python-type-checking/) — ties the above together practically.
- [FastAPI — "Python Types Intro"](https://fastapi.tiangolo.com/python-types/) — written specifically because FastAPI assumes you know this; do it right before starting FastAPI proper.

**Async/await:**
- [Real Python — `asyncio`: A Hands-On Walkthrough](https://realpython.com/async-io-python/) — the best single async primer; covers coroutines, `gather`, and the mental model of cooperative scheduling that Python 2 had no equivalent of at all.
- [`asyncio` — Coroutines and Tasks](https://docs.python.org/3/library/asyncio-task.html) — the official reference for the three things you'll actually use daily: `await`, `asyncio.gather`, `asyncio.TaskGroup`. Read after the Real Python piece, as reference rather than narrative.
- [FastAPI — Concurrency and `async`/`await`](https://fastapi.tiangolo.com/async/) — the single most useful page for week 1's objective: *when* `def` vs `async def` costs you something. FastAPI runs plain `def` handlers in a threadpool, which is why the wrong choice degrades quietly instead of failing loudly.
- [Developing with `asyncio`](https://docs.python.org/3/library/asyncio-dev.html) — debug mode, and how to catch a blocking call sitting inside an `async def`. Skim now, come back when something is mysteriously slow.
- [SuperFastPython — `asyncio` guide](https://superfastpython.com/python-asyncio/) — exhaustive and cookbook-shaped. Use it as a lookup for a specific "how do I…", not as a read-through.

**Pydantic itself** (new since you last wrote Python; it has no Python-2-era analogue):
- [Pydantic docs](https://docs.pydantic.dev/latest/) · [Models](https://docs.pydantic.dev/latest/concepts/models/) · [Fields](https://docs.pydantic.dev/latest/concepts/fields/) — the validation layer FastAPI request/response bodies *are*.
- [Pydantic v1 → v2 migration guide](https://docs.pydantic.dev/latest/migration/) — not because you have v1 code, but because a large fraction of the FastAPI tutorials and Stack Overflow answers you'll hit are v1-era. This is how you recognise a stale snippet (`@validator`, `.dict()`, `class Config`) instead of copying it.

**Other things that are new or changed shape:**
- [`dataclasses`](https://docs.python.org/3/library/dataclasses.html) — the boilerplate-free class pattern pydantic-ai's `deps_type` dataclasses lean on.
- [PEP 634 — Structural Pattern Matching](https://peps.python.org/pep-0634/) — `match`/`case`; you'll see it in modern codebases even if you don't reach for it yourself.
- [`pathlib`](https://docs.python.org/3/library/pathlib.html) — the modern replacement for `os.path` string-munging.
- f-strings (`f"{x}"`) and the walrus operator (`:=`, [PEP 572](https://peps.python.org/pep-0572/)) — small but everywhere in code you'll read.
- [What's New in Python](https://docs.python.org/3/whatsnew/) — the per-version changelogs; skim 3.9 through 3.13 in order, most entries are one paragraph.

**Two dating hazards, worth naming now** — most of the Python you'll find online was written for an
older version or an older Pydantic, and both are easy to copy without noticing:

| You see | It means | Write instead |
|---|---|---|
| `Optional[str]`, `Union[int, str]`, `List[int]`, `Dict[str, int]` | Pre-3.10 typing | `str \| None`, `int \| str`, `list[int]`, `dict[str, int]` |
| `TypeVar("T")` at module level | Pre-3.12 generics | PEP 695 — `def first[T](xs: list[T]) -> T` |
| `@validator`, `.dict()`, `.json()`, `class Config` | Pydantic **v1** | `@field_validator`, `.model_dump()`, `.model_dump_json()`, `model_config` |

**Version target:** Python 3.13. 3.14 is current-stable as of writing, but 3.13 has wider library
compatibility and there's no reason to fight dependency friction during a fast, tool-heavy sprint.

---

## 7. Environment & tooling

| Tool | Use | Why this one | Docs |
|---|---|---|---|
| `uv` | Package/venv manager | Fast, single tool replaces pip+venv+pip-tools; what the pydantic-ai docs themselves standardize on (`uv add pydantic-ai`). It also *installs Python itself*, so the 3.13 target below needs nothing from Homebrew. | [docs](https://docs.astral.sh/uv/) · [working on projects](https://docs.astral.sh/uv/guides/projects/) · [managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/) · [installing Python](https://docs.astral.sh/uv/guides/install-python/) |
| `ruff` | Lint + format | One fast tool instead of flake8+black+isort; closest Python analogue to what this repo already uses ESLint/Prettier for. | [docs](https://docs.astral.sh/ruff/) · [linter](https://docs.astral.sh/ruff/linter/) · [formatter](https://docs.astral.sh/ruff/formatter/) |
| `pytest` + `pytest-asyncio` + `httpx` | Testing | `httpx.AsyncClient` against the FastAPI app in-process, same shape as `test/*.test.ts` here today. | [pytest](https://docs.pytest.org/en/stable/) · [fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html) · [pytest-asyncio](https://pytest-asyncio.readthedocs.io/en/latest/) · [httpx async](https://www.python-httpx.org/async/) · [FastAPI async tests](https://fastapi.tiangolo.com/advanced/async-tests/) |
| `pyright` | Type checking | Same underlying heritage as the TS language server you already use daily; picks up FastAPI/pydantic-ai's type stubs well. `mypy` is a fine substitute if you prefer it — pick one, don't run both. | [pyright](https://microsoft.github.io/pyright/) |
| SQLAlchemy 2.0 (async) | ORM / DB access | Maps onto the Drizzle-managed schema by hand; 2.0's `Mapped[]` style is the one that type-checks. | [ORM quick start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html) · [asyncio extension](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) · [what's new in 2.0](https://docs.sqlalchemy.org/en/20/changelog/whatsnew_20.html) |
| Docker Compose | Local `credopass_v2_dev` Postgres | Add a second database (or service) to the existing `docker/docker-compose.dev.yml` rather than inventing new infra. | — |

**A trap in FastAPI's own docs, worth knowing before week 2.** FastAPI's
[SQL Databases tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/) uses **SQLModel**,
synchronously (`def` handlers, `Session`, `session.commit()`) — not the async SQLAlchemy 2.0 this
plan targets. Read it for the *dependency-per-request* shape, which does transfer, then get the
engine/session mechanics from
[SQLAlchemy's asyncio docs](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) instead.
Copying that page wholesale lands you with sync DB calls inside `async def` handlers — the exact
event-loop-blocking bug week 1's reading is meant to teach you to spot.

Run it standalone for now — `uv run uvicorn app.main:app --reload --port 8090` (8090 is free; see
the existing ports table in `CLAUDE.md`'s Gotchas section). Don't wire this into `bun start` or Nx
targets until it's stable — that's a stretch goal for week 8, not a week-1 task.

Two more worth bookmarking rather than reading now:
[FastAPI's Bigger Applications guide](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
(how `APIRouter` splits a service into modules — the shape `api/v2/core/` will grow into) and the
[full-stack FastAPI template](https://github.com/fastapi/full-stack-fastapi-template) (the
maintainers' own reference layout — a sanity check on project structure, not something to copy).

---

## 8. Definition of done — the demo script

1. Sign in to the real CredoPass web app with a real session.
2. Open the Copilot panel (dev toggle on). Ask 2–3 real questions about real event/attendance data
   — answers stream token-by-token, backed by live tool calls.
3. Ask it to cancel an event. The AG-UI approval card renders and blocks execution until confirmed
   — the human-in-the-loop moment.
4. Switch to `core-v2`'s `/docs`. Show it next to v1's Scalar docs at `:8080/api/v1/core/docs` and
   explain, out loud, the auto-generated-vs-hand-wired OpenAPI difference from §1.
5. Open `require_tenant` in the editor and explain the 403-vs-404 split from memory, with a
   concrete example of each.

If you can do all five without notes, the project has done its job regardless of how many of the
33 Tier-1 routes are actually finished.

---

## 9. Critique

You asked directly whether anything here is unrealistic for 2 months, and whether the ordering
should change. Both, in places:

- **The literal ask — full API parity plus a novel agentic feature, from rusty Python, in 8
  weeks — is not realistic**, and I've already baked the fix into §2 and §4 rather than just
  flagging it: ship a deliberate ~33-route vertical slice plus the agentic feature, not all ~44
  routes. "I made a scoping call and can defend it" is a stronger interview answer than "I
  attempted everything and half of it is broken." Say the cut out loud in the interview; don't let
  them discover it.
- **Skip `analytics.ts` and `billing.ts` entirely**, not just deprioritize them. Both are mocked in
  v1 itself — porting fabricated-data-passthrough or a plan-column-writer teaches you FastAPI
  routing you'll already have learned three times over by week 3, and nothing about pydantic-ai or
  AG-UI, which is the actual point of this exercise given the target job's stack.
- **Don't inherit the TS side's open infrastructure debt.** The real repo has unresolved RLS
  cutover and `users`→`accounts`/`people` migration work (`REBUILD-LOG.md`, `NEXT-UI-LIST.md`).
  None of that belongs in a learning side-branch — §1's explicit `WHERE organization_id = :org_id`
  filtering is not a shortcut, it's parity with what v1 actually does today.
- **Ordering change from a naive reading of your four asks**: build the agentic feature *starting*
  in week 4, not after the rewrite is "done." A naive plan reads your four numbered asks as
  sequential — learn, then rewrite, then (implicitly) bolt the AI feature on at the end. I've
  inverted that: Phase A of the Copilot (§3) ships against the *existing* v1 API in week 4,
  independent of how far the FastAPI port has gotten, specifically so the most interview-relevant
  and most impressive-to-demo part of the stack isn't the thing that's unfinished if time runs out.
  If you only get through week 5, you still have a working, demoable agentic feature — you just
  don't have `attendance.ts` ported natively yet. That's a much better failure mode than the
  reverse.
- **No interview date was given.** The schedule assumes a clean 8 weeks with week 8 reserved for
  prep, not code. If your actual date is sooner, cut from the back of §4 (week 6's Tier-2 stretch
  items, then week 7's adversarial-test porting) — never cut week 5, since that's where the
  headline demo artifact exists.
- **Two concrete, easy-to-underestimate yaks**: verifying Supabase's RS256 JWTs via JWKS in Python
  (well-trodden, but budget real time for it in week 2 — it's not free) and CopilotKit's React
  integration (use the prebuilt `<CopilotChat>` component, don't hand-roll UI — the backend depth
  is what's being evaluated, not frontend polish).
- **Test agent logic without live LLM calls from week 4 on**, using `TestModel`/`FunctionModel`.
  This isn't just cost/latency hygiene — it's the same principle already stated in this repo's own
  `CLAUDE.md` ("tests must never touch the real database"), applied to a new kind of external
  dependency.
- **One thing I did *not* change**: your instinct to do a Python refresher and a modern-Python
  catch-up *before* the frameworks (asks #2 and #3 ahead of #1) is correct, and I kept that order.
  The only adjustment is time-boxing week 0 hard — "rusty but not a beginner" should mean days, not
  weeks, and the risk in this plan is overspending time relearning fundamentals you already have,
  not underspending it.

---

## Key sources

- **Pydantic AI** — [overview](https://pydantic.dev/docs/ai/overview/) · [installation](https://pydantic.dev/docs/ai/overview/install/) · [agents](https://pydantic.dev/docs/ai/core-concepts/agent/) · [dependencies](https://pydantic.dev/docs/ai/core-concepts/dependencies/) · [tools](https://pydantic.dev/docs/ai/tools-toolsets/tools/) · [deferred tools & human-in-the-loop approval](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/) · [output types](https://pydantic.dev/docs/ai/core-concepts/output/) · [AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/) · [`ag_ui` API reference](https://pydantic.dev/docs/ai/api/pydantic-ai/ag_ui/) · [`TestModel` API](https://pydantic.dev/docs/ai/api/models/test/) · [unit testing guide](https://pydantic.dev/docs/ai/guides/testing/) · [GitHub](https://github.com/pydantic/pydantic-ai)
  - Note on URLs: the docs now live under `pydantic.dev/docs/ai/`. The older `ai.pydantic.dev` host still resolves, so search results will mix the two — prefer the `pydantic.dev/docs/ai/` form, and treat the [`docs/ui/ag-ui.md` source file](https://github.com/pydantic/pydantic-ai/blob/main/docs/ui/ag-ui.md) in the repo as the raw version of the same page.
- **AG-UI protocol** — [introduction](https://docs.ag-ui.com/introduction) · [architecture](https://docs.ag-ui.com/concepts/architecture) · [events reference](https://docs.ag-ui.com/concepts/events) · [quickstart](https://docs.ag-ui.com/quickstart) · [Python SDK](https://docs.ag-ui.com/sdk/python/core/overview) · [GitHub](https://github.com/ag-ui-protocol/ag-ui)
- **CopilotKit** — [connect AG-UI agents](https://docs.copilotkit.ai/backend/ag-ui) · [AG-UI protocol page](https://docs.copilotkit.ai/agentic-protocols/ag-ui) · [Pydantic AI integration](https://docs.copilotkit.ai/pydantic-ai) · [GitHub](https://github.com/CopilotKit/CopilotKit)
- **FastAPI** — [tutorial](https://fastapi.tiangolo.com/tutorial/) · [Python types intro](https://fastapi.tiangolo.com/python-types/) · [concurrency and async/await](https://fastapi.tiangolo.com/async/) · [dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) · [security](https://fastapi.tiangolo.com/tutorial/security/first-steps/) · [handling errors](https://fastapi.tiangolo.com/tutorial/handling-errors/) · [SQL databases](https://fastapi.tiangolo.com/tutorial/sql-databases/) (SQLModel + sync — see §7's warning) · [testing](https://fastapi.tiangolo.com/tutorial/testing/) · [async tests](https://fastapi.tiangolo.com/advanced/async-tests/)
- **SQLAlchemy 2.0** — [ORM quick start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html) · [asyncio extension](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) · [unified tutorial](https://docs.sqlalchemy.org/en/20/tutorial/index.html)
- **Pydantic** — [docs](https://docs.pydantic.dev/latest/) · [models](https://docs.pydantic.dev/latest/concepts/models/) · [v1→v2 migration](https://docs.pydantic.dev/latest/migration/)
- **Typing** — [mypy cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html) · [Static Typing with Python](https://typing.python.org/en/latest/) · [PEP 695 — Type Parameter Syntax](https://peps.python.org/pep-0695/) · [PEP 544 — Protocols](https://peps.python.org/pep-0544/) · [PEP 484 — Type Hints](https://peps.python.org/pep-0484/)
- **Async** — [Real Python — asyncio walkthrough](https://realpython.com/async-io-python/) · [Coroutines and Tasks](https://docs.python.org/3/library/asyncio-task.html) · [Real Python — type checking guide](https://realpython.com/python-type-checking/)
- **Auth** — [Supabase — JWTs](https://supabase.com/docs/guides/auth/jwts) · [Supabase — signing keys / JWKS](https://supabase.com/docs/guides/auth/signing-keys) · [PyJWT usage, incl. `PyJWKClient`](https://pyjwt.readthedocs.io/en/stable/usage.html)
- **Tooling** — [uv](https://docs.astral.sh/uv/) · [ruff](https://docs.astral.sh/ruff/) · [pytest](https://docs.pytest.org/en/stable/) · [pyright](https://microsoft.github.io/pyright/) · [httpx](https://www.python-httpx.org/async/)

Everything under §1–§2 is grounded in a direct read of `services/core/src/api/v1/core/*.ts`,
`http/define-route.ts`, `http/problem.ts`, `tenancy/context.ts`, `middleware/caller.ts`, and
`authz/permissions.ts` as they exist on `main` at commit `9819d35`, not from `CLAUDE.md` alone.
