# The Copilot rail — 14-day plan (pydantic-ai · AG-UI · FastAPI)

**Status: active. This supersedes [`PYTHON-LEARNING-PLAN.md`](PYTHON-LEARNING-PLAN.md) as the
thing being built.** Written 2026-09-02, when the Citadel interview moved to ~2026-09-16 and the
scope was cut from "port the backend to Python" to "ship one AI feature in Python."

Live progress: [`learning/STATUS.md`](learning/STATUS.md). How sessions run:
[`LEARNING-WORKFLOW.md`](LEARNING-WORKFLOW.md) (the three tutoring modes still apply; the schedule
in it does not).

---

## 0. The cut, stated plainly

The old plan ported ~35 of v1's routes to FastAPI across 8 weeks, and treated the agent as a
feature riding on top of that port. **The port is cancelled.** Not deferred with a nice word on
it — cancelled. `me.ts`, `organizations.ts`, `people.ts`, `events.ts`, `attendance.ts` stay in
TypeScript, permanently, and `core-v2` never grows a REST surface.

What replaces it: **one FastAPI service whose entire job is one AG-UI endpoint.** Every tool it
exposes calls the existing v1 TypeScript API over HTTP, forwarding the caller's own bearer token.
Phase B — the "swap the tools to native in-process calls" step from the old §3 — is gone with the
port that would have made it possible.

**Why this is the right cut and not just the panicked one.** The three technologies you're being
assessed on are pydantic-ai, AG-UI and FastAPI. Porting `organizations.ts` teaches you SQLAlchemy
and a tenancy model you already understand in TypeScript. It teaches you *nothing* about any of the
three. The port was the majority of the hours and the minority of the learning. Cutting it costs
one interview answer ("I ported a multi-tenant authz model") and buys the depth to actually answer
the three that matter.

**What it costs, honestly.** You will not have written async SQLAlchemy. If Citadel asks "how do
you talk to a database from FastAPI," you will be answering from reading, not from having done it.
That is a real hole and §8 tells you to name it rather than bluff it. It is the correct trade at
14 days: a shallow port plus a shallow agent loses to no port plus an agent you built every layer
of.

### What "done" means

One artifact, demoed live from the real app:

> The right-hand rail of the CredoPass dashboard is a chat. You ask it "what's coming up?" and it
> streams back prose **plus a real rendered calendar of your actual events** — not a text list, the
> same `EventCalendar` component the rail used to hold, drawn from a tool call. You ask it to
> cancel one, and a confirm/deny card blocks the run until you answer. Deny it and nothing happens.

Three technologies, one screen, all three visible in it. That is the whole deliverable.

### Explicitly not in scope

- Any REST port. No `/api/v2/core/*`. `core-v2` serves one agent endpoint and a health check.
- Any database access from Python. **The FastAPI service never opens a DB connection.** It has no
  SQLAlchemy, no `asyncpg`, no `DATABASE_URL`. Everything comes through v1's HTTP API.
- `credopass_v2_dev`. Week 0 created and migrated it. It is now unused — leave it, don't wire it.
- Mobile. Web only.
- Production. The rail stays behind a dev-only flag; `apps/web`'s default config never points at
  `:8090`.

---

## 1. Architecture

```
  apps/web  (React 19, :5000)
  ┌──────────────────────────────────────────────┐
  │  RightSidebar                                │
  │   OverviewView   ← EventCalendar (today)     │
  │   CopilotView    ← NEW: <CopilotChat>        │
  │                    + useRenderTool(...)      │──── the calendar the agent
  │                    + useHumanInTheLoop(...)  │     renders is the SAME
  └───────────────────┬──────────────────────────┘     EventCalendar component
                      │  POST (AG-UI / SSE)
                      │  Authorization: Bearer <supabase jwt>
                      │  X-Organization-Id: <active org>
                      ▼
  services/core-v2  (FastAPI, :8090)
  ┌──────────────────────────────────────────────┐
  │  POST /api/v2/agent/organizer-copilot        │
  │    AGUIAdapter.dispatch_request(...)         │
  │                                              │
  │  organizer_copilot: Agent[StateDeps[...], …] │
  │    @agent.tool   list_events        ─┐       │
  │    @agent.tool   get_event_summary   │ httpx │
  │    @agent.tool   get_checkin_state   │       │
  │    @agent.tool_plain(requires_approval=True) │
  │                  cancel_event       ─┘       │
  └───────────────────┬──────────────────────────┘
                      │  httpx, forwarding the caller's OWN token
                      ▼
  services/core  (Hono, :8080)  — unchanged, untouched
      GET /api/v1/core/events, /events/{id}, /events/{id}/checkin-state
      POST /api/v1/core/events/{id}/cancel
```

### The decisions this rests on

| Decision | Call | Why |
|---|---|---|
| **Python owns the agent, nothing else** | `core-v2` = one AG-UI endpoint + `/health` | The three target technologies all live in that one endpoint. Anything else is hours spent away from them. |
| **No database in Python** | Tools call v1 over `httpx` | Deletes SQLAlchemy, `asyncpg`, models, sessions, and the whole "second migrated DB" apparatus from the critical path. The DB access happens — in TypeScript, where it already works and is already tested. |
| **The agent gets no new permissions** | Every tool forwards the caller's real bearer token + `X-Organization-Id` | The agent can see and do exactly what the signed-in organizer could already do through the browser. There is no new authz surface to audit. **This is the strongest security answer you have — §8.** |
| **Approval is a UX gate, not a security gate** | `requires_approval=True` on `cancel_event`; the real control is v1's org-scoped permission check | Approval stops the *model* acting unilaterally. It does not stop a malicious *client* — that client could call v1 directly. Knowing which one it is separates people who've read the docs from people who've shipped it. |
| **CopilotKit for the React half** | `@copilotkit/react-core/v2` + `@copilotkit/react-ui` | Hand-building a streaming chat UI is a week of React that teaches nothing about AG-UI. The prebuilt chat plus `useRenderTool` / `useHumanInTheLoop` is the shortest path to the generative-UI moment that *is* the demo. |
| **The rendered calendar is the existing component** | `useRenderTool` renders `<EventCalendar>` from `@credopass/ui` | This is what makes it generative UI rather than a chatbot printing markdown. It also means the AI rail and the old rail render identically — the tool call replaces the `useEventsCalendar` hook, not the component. |
| **Never wired into prod** | Rail is behind `VITE_COPILOT_ENABLED` | Same posture as the old plan. Zero blast radius. |

### Two things the old plan got right, kept

- **`core-v2` is additive.** `services/core` keeps running unchanged. Nothing in this plan edits a
  TypeScript route handler.
- **The tutoring modes** in `LEARNING-WORKFLOW.md` §3 — A (worked example first), B (tests-as-spec,
  you implement), C (I scaffold pure infra). Every day below is labelled with its mode.

---

## 2. The feature, concretely

### `CopilotState` — what the agent knows without being told

```python
class CopilotState(BaseModel):
    active_organization_id: str | None = None
    active_event_id: str | None = None
```

Synced from the browser via AG-UI's `state`. This is why "how many are checked in?" works while
you're looking at an event, with no event id in the sentence. `active_organization_id` mirrors
`packages/api-client/src/active-organization.ts`; `active_event_id` is whatever the rail is
currently next to.

### Tools

| Tool | Approval | Calls | Renders as |
|---|---|---|---|
| `list_events(when: Literal['upcoming','past','all'])` | no | `GET /api/v1/core/events` | **`<EventCalendar>`** — the generative-UI moment |
| `get_event_summary(event_id=None)` | no | `GET /api/v1/core/events/{id}` | a summary card |
| `get_checkin_state(event_id=None)` | no | `GET /api/v1/core/events/{id}/checkin-state` | a live counts card |
| `cancel_event(event_id)` | **yes** | `POST /api/v1/core/events/{id}/cancel` | **confirm/deny card** — the HITL moment |

`event_id=None` means "use `active_event_id` from state" — that's the state sync earning its keep.

Cut from the old plan's tool list: `search_people`, `find_likely_no_shows`, `draft_reminder_message`.
Four tools is enough to demonstrate read tools, structured output, state-derived arguments, and
approval. A fifth teaches nothing new. **If a day runs short, cut `get_checkin_state` before
cutting anything else** — it's the most redundant with `get_event_summary`.

### The two moments that are the demo

1. **Generative UI.** "What's coming up?" → the agent calls `list_events` → `useRenderTool` draws
   the real `EventCalendar` inline in the chat. Text and UI in one answer.
2. **Human-in-the-loop.** "Cancel Touching Gods Heart" → the run pauses on
   `DeferredToolRequests` → `useHumanInTheLoop` renders confirm/deny → deny, and the event is
   still there.

Rehearse both. Deny at least once in the live demo; confirming is the boring half.

---

## 3. The 14 days

Two weeks, ~10–12h/week, same assumption as before. Day numbers are working days, not calendar
days. **Days 1–8 are the spine; 9–12 are depth; 13–14 are prep.** If you slip, cut from 9–12,
never from 1–8.

| Day | Focus | Mode | Artifact at end of day |
|---|---|---|---|
| **1** | Cleanup + FastAPI refresher. Strip `core-v2` to the agent shape: kill the `/api/v2/core` ambitions from `main.py`'s docstring, keep `/health`, add settings via `pydantic-settings`. Write the pytest test for `/health` that week 1 never got to. | C + B | `nx run corev2:verify` green; `/health` has a test. |
| **2** | **pydantic-ai fundamentals.** `Agent`, `@agent.tool` vs `@agent.tool_plain`, `RunContext`, `deps_type`. Docstrings-become-schemas. | A → B | A toy agent with a dice tool, tested with `TestModel`, in `scratch/`. |
| **3** | **The real agent, offline.** `organizer_copilot` with `list_events` + `get_event_summary` calling v1 over `httpx`, with a real forwarded token. | B | `uv run python scripts/ask_copilot.py "what's coming up?"` prints a real, tool-derived answer from real data. |
| **4** | **`TestModel` / `FunctionModel`.** Agent tests with zero live LLM calls, `ALLOW_MODEL_REQUESTS = False`. | A → B | `uv run pytest` green with the API key unset. |
| **5** | **AG-UI, the protocol.** Read the event types first. Mount the agent with `AGUIAdapter.dispatch_request`. Inspect the raw stream. | A → B | `curl -N` shows a real SSE event stream; you can name what's on the wire. |
| **6** | **`StateDeps`.** Add `CopilotState`, make `event_id=None` resolve from `active_event_id`. | B | `curl` with a `state` payload proves the agent used it. |
| **7** | **The rail, plain chat.** `CopilotView` in `RightSidebar`, `<CopilotChat>`, `VITE_COPILOT_ENABLED`, token + org header wired. | A → B | Chat in the real app, streaming a real answer. **Spine complete.** |
| **8** | **Generative UI.** `useRenderTool('list_events')` → `<EventCalendar>`. | B | Ask "what's coming up?" in the app, get a rendered calendar. **Demo moment 1.** |
| **9** | **HITL, backend.** `cancel_event` with `requires_approval=True`, `output_type=[str, DeferredToolRequests]`. Watch the interrupt on the wire with `curl` before touching React. | A → B | The run pauses; the resume round-trip works from `curl`. |
| **10** | **HITL, frontend.** `useHumanInTheLoop('cancel_event')` → confirm/deny card. | B | Deny in the browser; the event survives. **Demo moment 2.** |
| **11** | **Errors + edges.** v1 returns 403/404/500 → what does the agent say? Tool errors as `ModelRetry` vs. hard failures. Expired token mid-stream. | B | Each failure produces a sensible chat message, not a stack trace. |
| **12** | **Polish + `README.md`.** Loading/streaming states in the rail. Structured logging on the endpoint. `services/core-v2/README.md` a stranger could follow. | B + C | `nx run corev2:verify` green; README written. |
| **13** | **Write-up.** The architecture note: the four decisions in §1, the approval-vs-authz distinction, what you'd do differently. | — | One page, in `services/core-v2/README.md`. |
| **14** | **Rehearsal.** No new code. Cold end-to-end demo run, twice. §8 out loud. | — | You can run the demo from a closed laptop and explain every layer. |

### Milestones, in one line each

- **End of day 3** — the agent works in a terminal. Everything after this is transport and UI.
- **End of day 7** — it's in the app. This is the fallback demo if days 8–10 collapse.
- **End of day 8** — generative UI works. This is the demo.
- **End of day 10** — HITL works. This is the demo you'd rather give.

---

## 4. What to read, and when

Ordered by the day that needs it. Don't read ahead — day 5's protocol pages are noise on day 2.

**Day 2 — pydantic-ai**
- [Agents](https://pydantic.dev/docs/ai/core-concepts/agent/) — the core abstraction.
- [Dependencies](https://pydantic.dev/docs/ai/core-concepts/dependencies/) — `deps_type` /
  `RunContext`, and why the wiring is type-checked rather than stringly-typed.
- [Tools](https://pydantic.dev/docs/ai/tools-toolsets/tools/) — `@agent.tool` vs `@agent.tool_plain`.
  The function's **signature and docstring become the schema the model sees** — the same
  "types are the contract" idea as FastAPI's OpenAPI generation, one layer up.

**Day 3 — httpx**
- [httpx async](https://www.python-httpx.org/async/) — `AsyncClient`, and why one long-lived client
  beats one per call.

**Day 4 — testing agents**
- [Unit testing](https://pydantic.dev/docs/ai/guides/testing/) and
  [`TestModel`](https://pydantic.dev/docs/ai/api/models/test/). Note `ALLOW_MODEL_REQUESTS = False`
  — it makes "no live calls in the suite" enforced rather than a convention.

**Day 5 — AG-UI, the protocol before the SDK**
- [AG-UI introduction](https://docs.ag-ui.com/introduction) and
  [architecture](https://docs.ag-ui.com/concepts/architecture).
- [**AG-UI events**](https://docs.ag-ui.com/concepts/events) — the page that matters most. The ~16
  standard event types are the vocabulary. Have it open beside your `curl -N` output.
- [pydantic-ai — AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/) —
  `AGUIAdapter.dispatch_request`, `StateDeps`, and the approval example. **Verified current
  2026-09-02**; older write-ups showing `agent.to_ag_ui()` predate this API.

**Day 7–8 — CopilotKit**
- [CopilotKit × Pydantic AI showcase](https://docs.showcase.copilotkit.ai/pydantic-ai) — this exact
  pairing, which is why it's the primary source over the generic CopilotKit docs.
- [`useRenderTool`](https://docs.showcase.copilotkit.ai/pydantic-ai/generative-ui/tool-rendering) —
  **the hook's `name` must exactly match the Python tool's name.** That one line is the whole
  contract between the two halves.
- [Generative UI overview](https://docs.copilotkit.ai/concepts/generative-ui-overview) — the
  distinction between rendering a *backend* tool call (`useRenderTool`, what you want) and
  registering a *frontend* tool the agent can invoke (`useComponent` / `useFrontendTool`).

**Day 9–10 — human-in-the-loop**
- [pydantic-ai deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/) —
  `requires_approval=True`, `DeferredToolRequests`, `DeferredToolResults`, and that the run is
  *paused and resumed*, not blocked.
- [CopilotKit HITL with Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai/human-in-the-loop)
  — `useHumanInTheLoop`, and the `render: ({ args, respond }) =>` signature. **`if (!respond)
  return <></>` is load-bearing** — it's how the card knows it's historical rather than awaiting an
  answer.

**Repo context, day 7**
- `apps/web/src/containers/RightSidebar/` — `index.tsx` and `OverviewView.tsx`. You're adding a
  third view beside `OverviewView` / `ProfileView`, matching the existing shape.
- `packages/api-client/src/active-organization.ts` — where the org id comes from.
- `apps/web/src/contexts/session.tsx` — `useSession` / `useCan`, for the token and the gate.

---

## 5. Verified API surface

Checked against live docs on 2026-09-02, not recalled. Current versions: `pydantic-ai` 2.37.0,
`fastapi` 0.141.1, `ag-ui-protocol` 0.1.22.

**Mounting the agent** — `AGUIAdapter.dispatch_request` is current:

```python
from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import Response
from pydantic_ai import Agent
from pydantic_ai.ui.ag_ui import AGUIAdapter

agent = Agent('openai:gpt-5.2', instructions='Be fun!')
app = FastAPI()

@app.post('/')
async def run_agent(request: Request) -> Response:
    return await AGUIAdapter.dispatch_request(request, agent=agent)
```

**Shared state** — note `replace(deps)` per request, so one caller's state can't leak into another's:

```python
from dataclasses import replace
from pydantic_ai.ui import StateDeps

agent = Agent('openai:gpt-5.2', deps_type=StateDeps[CopilotState])
deps = StateDeps(CopilotState())

@app.post('/')
async def run_agent(request: Request) -> Response:
    return await AGUIAdapter.dispatch_request(request, agent=agent, deps=replace(deps))
```

**Approval** — `DeferredToolRequests` must be in `output_type`, not just on the tool:

```python
from pydantic_ai.tools import DeferredToolRequests

agent = Agent('openai:gpt-5.2', output_type=[str, DeferredToolRequests])

@agent.tool_plain(requires_approval=True)
def cancel_event(event_id: str) -> str:
    """Cancel an event. Requires the organizer's confirmation."""
```

**React, rendering a backend tool call:**

```tsx
import { useRenderTool } from "@copilotkit/react-core/v2";

useRenderTool({
  name: "list_events",          // MUST match the Python tool name exactly
  render: ({ status, args, result }) => { /* → <EventCalendar events={…} /> */ },
});
```

**React, approval:**

```tsx
import { useHumanInTheLoop } from "@copilotkit/react-core/v2";

useHumanInTheLoop({
  name: "cancel_event",
  description: "Confirm cancelling an event.",
  parameters: z.object({ event_id: z.string() }),
  render: ({ args, respond }) => {
    if (!respond) return <></>;   // already answered — render the outcome, not the prompt
    return <ConfirmCard onConfirm={() => respond("approved")} onDeny={() => respond("denied")} />;
  },
});
```

---

## 6. Environment

Dependencies land day by day, with `uv add`, not all at once:

```bash
# day 1
uv add pydantic-settings
# day 3
uv add pydantic-ai httpx
# day 5
uv add "pydantic-ai[ag-ui]"
```

Frontend, day 7, in `apps/web`:

```bash
bun add @copilotkit/react-core @copilotkit/react-ui
```

**Removed from the old plan's list, deliberately:** `sqlalchemy`, `asyncpg`, `pyjwt`,
`cryptography`. No DB, and **no JWT verification in Python** — the service forwards the token to v1
and lets v1 verify it. If v1 rejects it, the tool call fails and the agent says so. That's one
fewer security-critical thing to get wrong in a fortnight, and it's the same trust boundary the
browser already relies on.

**Model choice.** Pick one provider on day 2 and don't revisit it. `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` in `services/core-v2/.env`, never committed. The suite must pass with it unset
(day 4) — that's the check that no test is quietly making live calls.

**Ports.** `core-v2` on `:8090`, beside v1 on `:8080` and web on `:5000`/`:5001`.

---

## 7. Risks, and what to do about each

| Risk | Signal | Response |
|---|---|---|
| **CopilotKit's v2 hooks move under you.** `@copilotkit/react-core/v2` is new. | Import doesn't resolve, or `render` has different args. | Day 7 is the day you find out, not day 10. If v2 is unstable, fall back to the AG-UI React client directly — more code, same protocol. Don't spend more than half a day fighting it. |
| **Tool-name mismatch silently renders nothing.** | Chat streams text; your component never appears. | Check the Python tool name against the hook's `name` string *first*, before debugging React. This is the single most common failure in this stack. |
| **The model doesn't call the tool you expected.** | "What's coming up?" returns prose, no calendar. | It's the docstring, not the model. Tool docstrings are prompt surface — rewrite them as instructions to a colleague. Day 4's `FunctionModel` tests are how you assert this deterministically. |
| **Day 7 is the biggest single step** — first React, first auth wiring, first CORS. | Runs past its slot. | Wire and verify the token + org header with `curl` on day 6, so day 7 is only React. CORS: `core-v2` must allow `:5000`/`:5001` — copy v1's dev branch. |
| **Approval round-trip is fiddly on the wire.** | Interrupt fires, resume doesn't. | Day 9 exists to see this in `curl` before React is in the picture. Don't skip that ordering. |
| **You've never used any of this.** | Day 2 or 5 takes twice its slot. | Expected. That's why days 9–12 are the cut zone and the spine ends on day 8. |

---

## 8. Interview answers this actually earns

The point of the cut is that these get *better*, not worse. Rehearse these five out loud on day 14.

1. **"How do you stop an agent doing something destructive?"** — Two different controls, and
   conflating them is the mistake. `requires_approval=True` stops the *model* acting without a
   human; it's a UX gate and it lives in the agent. The *authorization* control is v1's org-scoped
   permission check, which runs whether the caller is a browser or an agent. A malicious client
   could skip the approval card entirely by calling v1 directly — and would still be stopped,
   because the real boundary was never in the agent.

2. **"How does the agent get permissions?"** — It doesn't have any. Every tool forwards the
   signed-in organizer's own bearer token and `X-Organization-Id` to the existing API. The agent's
   authority is exactly the caller's authority, and there is no new permission surface to audit.
   That was a deliberate design constraint, not a convenience.

3. **"What is AG-UI actually?"** — A typed SSE event stream, ~16 event types, between an agent and
   a UI. Not request/response. It's what lets a single answer be *both* streamed prose and a
   rendered React component: the tool call is an event on that stream, and the frontend binds a
   component to the tool's name. Name three events and what they carry.

4. **"Why Python for this and not your existing TypeScript service?"** — pydantic-ai's typed tool
   calling and the deferred-tool/approval machinery. And a boundary that's honest about itself: the
   Python service owns the agent and nothing else — no database, no auth of its own — so the new
   language didn't duplicate a working system, it added one capability beside it.

5. **"What would you do differently?"** — Two real ones. The tools call v1 over HTTP, so every
   agent question costs a network hop; in-process would be faster but would mean the agent lives in
   TypeScript, which was the trade. And there's no evaluation harness — `TestModel` proves the
   wiring, but nothing measures whether the agent picks the *right* tool across a spread of real
   phrasings. That's the first thing I'd build next.

**And the honest one, unprompted if it fits:** you didn't write async SQLAlchemy. If asked about
databases from FastAPI, say you deliberately kept persistence out of the Python service and can
speak to the design reason, rather than claiming depth you don't have. Naming a scope cut you made
on purpose reads as judgment; bluffing it reads as the opposite.

---

## 9. Critique of this plan

Where it's weak, so you know before someone else notices.

- **14 days is not a lot of slack.** Days 9–12 are the buffer. If day 5 (AG-UI) or day 7 (React
  wiring) doubles, you'll land on day 8's generative UI with the HITL half unbuilt. That's a real
  possibility, and the milestone ordering in §3 exists so the demo degrades gracefully instead of
  vanishing.
- **The learning is narrow by construction.** You'll know pydantic-ai, AG-UI, and enough FastAPI to
  serve one endpoint. You won't know FastAPI's dependency-injection depth, its testing story
  against a database, or SQLAlchemy at all. `Depends` barely appears. That is the trade §0 makes
  and it should be stated in an interview, not hidden.
- **One agent, four tools, no evaluation.** Nothing here measures agent *quality* — only that the
  wiring works. If Citadel probes on evals, that's the gap, and answer 5 in §8 is how you meet it.
- **CopilotKit is a dependency on someone else's abstraction.** You'll understand AG-UI the
  protocol well; you'll understand the React layer only as far as its hooks. That's the right trade
  for a backend-focused interview, but don't claim the frontend depth.
- **Every tool is a read except one.** The write path is exercised exactly once, by `cancel_event`.
  A second write tool would test more, and there isn't time. Acknowledged, not fixed.
