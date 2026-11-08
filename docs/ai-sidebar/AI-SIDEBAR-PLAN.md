# The Copilot rail — 5-day plan (pydantic-ai · AG-UI · FastAPI)

**Status: active. Recompressed 2026-09-06 from 14 days to 5.** Working days **Mon 8 – Fri 12
September**, ~6–8h/day (~35h). Interview ~2026-09-16, so Sat 13 – Mon 15 are slack, not plan.

The 14-day plan and its eleven day files are gone. This is the only plan. **The scope has not
changed** — same deliverable, same three technologies, same interview answers. What changed is who
types what, and the removal of every hour that wasn't buying one of those three things.

- **Live progress:** [`learning/STATUS.md`](learning/STATUS.md) — start every session here.
- **Day files:** [`learning/day-NN-*.md`](learning/) — five files, one per day. Each is
  self-contained: **Learn → Build → Done when → If it breaks → Say it out loud → Retro.**

---

## 0. What changed, and what didn't

### Unchanged

The deliverable, verbatim from the 14-day plan:

> The right-hand rail of the CredoPass dashboard is a chat. You ask it "what's coming up?" and it
> streams back prose **plus a real rendered calendar of your actual events** — not a text list, the
> same `EventCalendar` component the rail used to hold, drawn from a tool call. You ask it to
> cancel one, and a confirm/deny card blocks the run until you answer. Deny it and nothing happens.

Also unchanged: the architecture (§1), the four tools (§2), the no-database rule, the
token-forwarding property, and all five interview answers in §8. **Nothing has been cut from the
scope.** The port stays cancelled; it was cancelled on 2026-09-02 and that decision is not revisited
here.

### Changed — the three compressions

**1. I write all tests, and all boilerplate. You write everything load-bearing.**

The 14-day plan's rule was "you write every line." At 5 days that rule costs you the demo. The new
split, agreed 2026-09-06:

| Who | What | Why |
|---|---|---|
| **You** | The agent, its tools, the deps and their composition with `StateDeps`, the v1 client, the AG-UI mount, the approval tool, the React hooks (`useRenderTool`, `useHumanInTheLoop`), the header/state wiring | This is the entire set of things you will be asked about. **You must be able to say "I implemented an AG-UI integration" and have it be true** — so the mount, the deps-per-request, the state sync and the hook bindings are all yours. |
| **Me** | Every test, without exception. Plus: CORS config, the FastAPI provider/`CopilotKitProvider` scaffolding, `ConfirmCard` styling, the throwaway worked examples | Test-writing is the highest-hours/lowest-interview-value work in the plan. You asked me to take it; taken. |

You still **read** the tests — they are the executable spec for what you're building, and on day 2
and day 4 they're how you know you're done. You just don't write them.

**2. Learning is compressed into the build, not staged before it.**

The 14-day plan had a Python-fundamentals day (old day 2, part 1) and a protocol-reading day (old
day 5) that produced no artifact. Both are folded in: the Python you need appears in a single
20-minute primer in day 1's Learn, and AG-UI's event vocabulary is learned **from your own `curl -N`
output on day 3**, with the docs open beside it, rather than read cold the day before.

This is the one genuinely risky compression, and §9 says so.

**3. Days 11–12 of the old plan (errors, polish) collapse into a half-day.**

Old day 11 walked five failure modes one at a time. The new day 5 does the two that carry an
interview answer — the 404 cross-tenant phrasing (golden rule 6) and the expired token — and I
write tests for the rest. Old day 12's structured logging survives; its README work merges into the
day-5 write-up.

### What the compression costs, honestly

- **You'll have written less Python by hand.** Roughly 35h of build instead of 90h. The code you
  write is the interview-relevant code, but there's less of it, and less repetition to make it
  stick. Mitigation: day 5 morning is a re-derivation pass, not a polish pass — you delete and
  rewrite the AG-UI mount from memory.
- **No `FunctionModel` deep-dive day.** You'll be able to say what `TestModel` and `FunctionModel`
  each do and read the tests I wrote, but you won't have written one from scratch. If asked "how do
  you test an agent," that's a read-and-reviewed answer, not a wrote-it answer. Say so.
- **Still no async SQLAlchemy.** Unchanged from the 14-day plan. §8's honest answer stands verbatim.

---

## 1. Architecture

Unchanged from the 14-day plan.

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
  services/ai-chat  (FastAPI, :8090)
  ┌──────────────────────────────────────────────────────┐
  │  POST /api/v1/ai-chat/agent/organizer-copilot        │
  │    AGUIAdapter.dispatch_request(...)                 │
  │                                                      │
  │  organizer_copilot: Agent[StateDeps[...], …]         │
  │    @agent.tool   list_events        ─┐               │
  │    @agent.tool   get_event_summary   │ httpx         │
  │    @agent.tool   get_checkin_state   │               │
  │    @agent.tool(requires_approval=True)               │
  │                  cancel_event       ─┘               │
  └───────────────────┬──────────────────────────────────┘
                      │  httpx, forwarding the caller's OWN token
                      ▼
  services/core  (Hono, :8080)  — unchanged, untouched
      GET /api/v1/core/events, /events/{id}, /events/{id}/checkin-state
      POST /api/v1/core/events/{id}/cancel
```

### The decisions this rests on

| Decision | Call | Why |
|---|---|---|
| **Python owns the agent, nothing else** | `ai-chat` = one AG-UI endpoint + `/health` | The three target technologies all live in that one endpoint. Anything else is hours spent away from them. |
| **No database in Python** | Tools call v1 over `httpx` | Deletes SQLAlchemy, `asyncpg`, models, sessions, and the whole "second migrated DB" apparatus from the critical path. The DB access happens — in TypeScript, where it already works and is already tested. |
| **The agent gets no new permissions** | Every tool forwards the caller's real bearer token + `X-Organization-Id` | The agent can see and do exactly what the signed-in organizer could already do through the browser. There is no new authz surface to audit. **This is the strongest security answer you have — §8.** |
| **Approval is a UX gate, not a security gate** | `requires_approval=True` on `cancel_event` (`@agent.tool`, since it needs deps — the docs' example uses `tool_plain`); the real control is v1's org-scoped permission check | Approval stops the *model* acting unilaterally. It does not stop a malicious *client* — that client could call v1 directly. Knowing which one it is separates people who've read the docs from people who've shipped it. |
| **CopilotKit for the React half** | `@copilotkit/react-core/v2` + `@copilotkit/react-ui` | Hand-building a streaming chat UI is a week of React that teaches nothing about AG-UI. At 5 days it is not a preference, it is the only option. |
| **The rendered calendar is the existing component** | `useRenderTool` renders `<EventCalendar>` from `@credopass/ui` | This is what makes it generative UI rather than a chatbot printing markdown. The tool call replaces the `useEventsCalendar` hook, not the component. |
| **Never wired into prod** | Rail is behind `VITE_COPILOT_ENABLED` | Zero blast radius. |

### How the work is done — the 5-day split

**You implement everything the interview touches.** The point is unchanged: you can talk about this
code because you wrote it. What's changed is that I absorb the parts nobody will ask you about.

| Mode | When | What I do |
|---|---|---|
| **A — worked example** | First `@agent.tool` (day 1), first `AGUIAdapter` mount (day 3), first approval round trip (day 4) | A small **throwaway**, unrelated example — a dice tool, not a CredoPass tool. You build the real thing from the spec, not by editing mine. Three of these all week; each is ~20 lines. |
| **B — spec + my failing tests** | The default | I write a spec and the tests that encode it. You implement until green. You show me the diff; I review for what tests can't catch — a blocking call in an `async def`, a leaked header, a docstring that won't earn a tool call. |
| **C — I scaffold** | Infrastructure with no learning in it: CORS, the CopilotKit provider, `ConfirmCard` CSS, every test file | I do it and say so. |

**The one rule that survives from the 14-day plan:** if you find yourself asking me to write a
tool, a deps class, or the AG-UI mount, that's the plan failing. Those four things are the whole
point. Ask me for anything else.

---

## 2. The feature, concretely

Unchanged from the 14-day plan.

### `CopilotState`

```python
class CopilotState(BaseModel):
    active_organization_id: str | None = None
    active_event_id: str | None = None
```

Synced from the browser via AG-UI's `state`. This is why "how many are checked in?" works while
you're looking at an event, with no event id in the sentence.

### Tools

| Tool | Approval | Calls | Renders as | Day |
|---|---|---|---|---|
| `list_events(when: Literal['upcoming','past','all'])` | no | `GET /api/v1/core/events` | **`<EventCalendar>`** | 2 → 4 |
| `get_event_summary(event_id=None)` | no | `GET /api/v1/core/events/{id}` | a summary card | 2 → 4 |
| `get_checkin_state(event_id=None)` | no | `GET /api/v1/core/events/{id}/checkin-state` | a live counts card | **cut first** |
| `cancel_event(event_id)` | **yes** | `POST /api/v1/core/events/{id}/cancel` | **confirm/deny card** | 4 → 5 |

**`get_checkin_state` is now explicitly optional** — build it on day 5 only if day 5 morning runs
clean. It's the most redundant with `get_event_summary` and teaches nothing the other three don't.
The 14-day plan already named it as the first cut; at 5 days it starts cut.

### The two moments that are the demo

1. **Generative UI.** "What's coming up?" → the agent calls `list_events` → `useRenderTool` draws
   the real `EventCalendar` inline in the chat. **End of day 4.**
2. **Human-in-the-loop.** "Cancel Touching Gods Heart" → the run pauses on `DeferredToolRequests`
   → `useHumanInTheLoop` renders confirm/deny → deny, and the event is still there. **Day 5.**

Deny at least once in the live demo; confirming is the boring half.

---

## 3. The 5 days

**Mon 8 – Fri 12 September, ~7h/day.** Each day has a morning block and an afternoon block, because
at this density "a day" is too coarse a unit to notice slippage in.

| Day | Morning (~3.5h) | Afternoon (~3.5h) | Artifact at end of day |
|---|---|---|---|
| **1 — Mon 8** | Python primer (20 min) + pydantic-ai: `Agent`, `@agent.tool` vs `tool_plain`, `RunContext`, `deps_type`, **docstrings-are-prompt-surface**. My dice worked example. | Your toy agent in `scratch/` — two tools, one with deps. Break a docstring on purpose and watch tool choice change. | A toy agent that calls both tools. You can say what `RunContext` carries. |
| **2 — Tue 9** | **The real agent, offline.** `deps.py`, `client.py` (one place that builds headers), `copilot.py` with `list_events` + `get_event_summary`. | `scripts/ask_copilot.py`. Get a real answer about real events. Watch it chain two tools. I write the `TestModel`/`FunctionModel` suite alongside. | **Milestone:** `uv run python scripts/ask_copilot.py "what's coming up?"` prints a real, tool-derived answer. Suite green with the key unset. |
| **3 — Wed 10** | **AG-UI.** Read the events page, mount `AGUIAdapter.dispatch_request`, build deps from **request headers**. `curl -N` and name what's on the wire. I do CORS. | **`StateDeps`.** Compose your deps with `StateDeps[CopilotState]`, `replace(deps)` per request, `event_id=None` resolves from state. `curl` proves both. | `curl -N` streams SSE; you can name three event types from your own terminal. State works and doesn't leak between requests. |
| **4 — Thu 11** | **The rail becomes a chat.** `CopilotView` in `RightSidebar`, `<CopilotChat>`, token + org header + state wired, `VITE_COPILOT_ENABLED`. I scaffold the provider. | **Generative UI.** `useRenderTool('list_events')` → the real `<EventCalendar>`. Plus a summary card for `get_event_summary`. | **The demo.** Ask "what's coming up?" in the real app, get prose *and* a rendered calendar. |
| **5 — Fri 12** | **HITL, both halves.** `output_type=[str, DeferredToolRequests]`, `cancel_event(requires_approval=True)`, `curl` the round trip **first**, then `useHumanInTheLoop`. My worked example de-risks the resume body. | **Errors, write-up, rehearsal.** The 404 phrasing, the expired token, structured logging. The one-page architecture note. Two cold demo runs. Record a fallback video. | **The better demo.** Deny in the browser, the event survives. README written. Recording exists. |

### Milestones, in one line each

- **End of day 2** — the agent works in a terminal. Everything after this is transport and UI.
- **End of day 3** — the protocol works. This is the day that earns the AG-UI answer.
- **End of day 4** — generative UI in the real app. **This is the demo.**
- **End of day 5** — HITL. This is the demo you'd rather give.

### If you slip

The order to sacrifice, most-expendable first:

1. `get_checkin_state` — already cut, don't uncut it.
2. Day 5 afternoon's polish (logging, the second summary-card renderer). **Never the rehearsal.**
3. Day 5's `useHumanInTheLoop` React half — keep the backend half and demo the pause via `curl`.
   You keep the whole interview answer; you lose a screenshot.
4. Day 4 afternoon's generative UI — the plain chat from day 4 morning is still a demo.

**Never cut:** day 2 (the agent), day 3 (AG-UI), or Friday's rehearsal. An unrehearsed demo of a
polished feature goes worse than a rehearsed demo of a rough one.

**Saturday 13 – Monday 15 are slack.** If Friday afternoon is a mess, that's what they're for.
Don't plan into them; they exist so a bad Thursday isn't fatal.

---

## 4. What to read, and when

Ordered by the day that needs it. Don't read ahead. **Total reading budget this week: about 3
hours.** If you're reading more than that, you're avoiding the keyboard.

**Day 1 — pydantic-ai** (~50 min)
- [Agents](https://pydantic.dev/docs/ai/core-concepts/agent/) — the core abstraction.
- [Dependencies](https://pydantic.dev/docs/ai/core-concepts/dependencies/) — `deps_type` /
  `RunContext`, and why the wiring is type-checked rather than stringly-typed.
- [Tools](https://pydantic.dev/docs/ai/tools-toolsets/tools/) — `@agent.tool` vs `@agent.tool_plain`.
  The function's **signature and docstring become the schema the model sees**.

**Day 2 — httpx** (~15 min)
- [httpx async](https://www.python-httpx.org/async/) — `AsyncClient`, and why one long-lived client
  beats one per call.
- *Skim only, since I'm writing the tests:* [Unit testing](https://pydantic.dev/docs/ai/guides/testing/)
  — enough to read my suite and say what `TestModel` and `FunctionModel` each replace.

**Day 3 — AG-UI, the protocol before the SDK** (~60 min, the biggest read of the week)
- [AG-UI introduction](https://docs.ag-ui.com/introduction) and
  [architecture](https://docs.ag-ui.com/concepts/architecture).
- [**AG-UI events**](https://docs.ag-ui.com/concepts/events) — the page that matters most. The ~16
  standard event types are the vocabulary. **Have it open beside your `curl -N` output**, not
  before it.
- [pydantic-ai — AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/) —
  `AGUIAdapter.dispatch_request`, `StateDeps`, the approval example. **Verified current
  2026-09-02**; older write-ups showing `agent.to_ag_ui()` predate this API.

**Day 4 — CopilotKit** (~30 min)
- [CopilotKit × Pydantic AI showcase](https://docs.showcase.copilotkit.ai/pydantic-ai) — this exact
  pairing, which is why it's the primary source over the generic CopilotKit docs.
- [`useRenderTool`](https://docs.showcase.copilotkit.ai/pydantic-ai/generative-ui/tool-rendering) —
  **the hook's `name` must exactly match the Python tool's name.** That one line is the whole
  contract between the two halves.

**Day 5 — human-in-the-loop** (~30 min)
- [pydantic-ai deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/) —
  `requires_approval=True`, `DeferredToolRequests`, `DeferredToolResults`, and that the run is
  *paused and resumed*, not blocked.
- [CopilotKit HITL with Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai/human-in-the-loop)
  — `useHumanInTheLoop`, and the `render: ({ args, respond }) =>` signature. **`if (!respond)
  return <></>` is load-bearing.**

**Repo context, day 4** (read, don't budget — it's your own code)
- `apps/web/src/containers/RightSidebar/` — `index.tsx` and `OverviewView.tsx`.
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

**Approval** — `DeferredToolRequests` must be in `output_type`, not just on the tool. (Verbatim
from the docs, so `tool_plain`; ours is `@agent.tool` because it needs `ctx.deps` for the client.)

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
uv add pydantic-ai
# day 2
uv add httpx
# day 3
uv add "pydantic-ai[ag-ui]"
```

Frontend, day 4, in `apps/web`:

```bash
bun add @copilotkit/react-core @copilotkit/react-ui
```

**Deliberately absent:** `sqlalchemy`, `asyncpg`, `pyjwt`, `cryptography`. No DB, and **no JWT
verification in Python** — the service forwards the token to v1 and lets v1 verify it. If v1
rejects it, the tool call fails and the agent says so. That's one fewer security-critical thing to
get wrong, and it's the same trust boundary the browser already relies on.

**Model choice.** Pick one provider on **day 1, in the first hour**, and don't revisit it.
`OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `services/ai-chat/.env`, never committed. The suite must
pass with it unset — that's the check that no test is quietly making live calls.

**Ports.** `ai-chat` on `:8090`, beside v1 on `:8080` and web on `:5000`/`:5001`.

---

## 7. Risks, and what to do about each

Reordered for 5 days: the top three are the ones that can actually cost you the demo now.

| Risk | Signal | Response |
|---|---|---|
| **Day 4 is two old days in one.** First React, first auth across the boundary, first CopilotKit, *and* generative UI. | Morning runs past 1pm. | Day 3's `curl` work is the mitigation — headers, CORS and state are all proven before React exists. If the morning slips, **ship plain chat and move `useRenderTool` to Friday morning**, pushing HITL to Friday afternoon. The order in §3's "If you slip" is the fallback ladder. |
| **CopilotKit's v2 hooks move under you.** `@copilotkit/react-core/v2` is new. | Import doesn't resolve, or `render` has different args. | **Two hours maximum**, then fall back to the AG-UI React client directly — more code, same protocol, and arguably a better interview answer. Do not spend Thursday afternoon on hook archaeology. |
| **Tool-name mismatch silently renders nothing.** | Chat streams text; your component never appears. | Check the Python tool name against the hook's `name` string *first*, before debugging React. The single most common failure in this stack. |
| **AG-UI in one day instead of two.** Day 3 carries the whole protocol *and* `StateDeps`. | Afternoon starts and the mount still 422s. | The `RunAgentInput` body shape is the usual culprit and my worked example hands it to you working. If the mount isn't streaming by 1pm, take the mount from the worked example and spend the afternoon on `StateDeps` — the state composition is the part with an interview answer in it. |
| **The model doesn't call the tool you expected.** | "What's coming up?" returns prose, no calendar. | It's the docstring, not the model. Tool docstrings are prompt surface — rewrite them as instructions to a colleague. Day 1's deliberate docstring-breaking exercise is why you'll recognise this. |
| **Approval round-trip is fiddly on the wire.** | Interrupt fires, resume doesn't. | Friday morning does `curl` before React, in that order, for exactly this reason. Don't reorder it. |
| **Expired tokens eat your Tuesday.** Supabase access tokens last about an hour. | Every tool 401s, suddenly, having worked ten minutes ago. | Re-copy from devtools. From day 3 the browser supplies it and this stops. Budget for hitting it three or four times on Tuesday. |

---

## 8. Interview answers this actually earns

Unchanged from the 14-day plan — the compression was designed around keeping these intact.
Rehearse all five out loud on **Friday afternoon**.

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
   component to the tool's name. Name three events and what they carry — **from your own day-3
   terminal output, not from the docs page.**

4. **"Why Python for this and not your existing TypeScript service?"** — pydantic-ai's typed tool
   calling and the deferred-tool/approval machinery. And a boundary that's honest about itself: the
   Python service owns the agent and nothing else — no database, no auth of its own — so the new
   language didn't duplicate a working system, it added one capability beside it.

5. **"What would you do differently?"** — Two real ones. The tools call v1 over HTTP, so every
   agent question costs a network hop; in-process would be faster but would mean the agent lives in
   TypeScript, which was the trade. And there's no evaluation harness — the test suite proves the
   wiring, but nothing measures whether the agent picks the *right* tool across a spread of real
   phrasings. That's the first thing I'd build next.

**And the honest ones, unprompted if they fit.** Two now, not one:

- **Databases from FastAPI.** You deliberately kept persistence out of the Python service and can
  speak to the design reason, rather than claiming depth you don't have.
- **The test suite.** You specified its behaviour and reviewed it, but you didn't write it — the
  week was five days and you spent them on the agent, the protocol and the UI binding. If asked
  about testing strategy, answer about `TestModel` vs `FunctionModel` and about stubbing the httpx
  transport (both true, both yours to explain), and be straight that a pairing partner wrote the
  suite to that spec.

Naming a scope cut you made on purpose reads as judgment; bluffing it reads as the opposite. That
was true of the port and it's true of this.

---

## 9. Critique of this plan

Where it's weak, so you know before someone else notices.

- **Five days has almost no slack, and the slack it has is a weekend.** The 14-day plan had days
  9–12 as a buffer; this one has Saturday. The fallback ladder in §3 exists because the demo has to
  degrade gracefully rather than vanish, and you should expect to use at least one rung of it.
- **Day 3 is the compression that could break.** AG-UI's protocol *and* `StateDeps` in one day,
  where the old plan took two, and it's the day that earns interview answer #3. If any day is
  going to overrun, it's this one. That's why day 3's afternoon has an explicit escape hatch.
- **You didn't write the tests.** A deliberate trade for build hours, and §8 tells you to say so.
  The cost is real: writing a `FunctionModel` test is how most people finally understand that the
  model is a replaceable component, and you're getting that understanding by reading instead.
- **The learning is narrow by construction, and now narrower.** pydantic-ai, AG-UI, enough FastAPI
  for one endpoint. No `Depends` depth, no SQLAlchemy, and now no hand-written test suite.
- **One agent, three tools, no evaluation.** Nothing here measures agent *quality* — only that the
  wiring works. If Citadel probes on evals, that's the gap, and answer 5 is how you meet it.
- **CopilotKit is a dependency on someone else's abstraction.** You'll understand AG-UI the
  protocol well; you'll understand the React layer only as far as its hooks. Right trade for a
  backend-focused interview, but don't claim the frontend depth.
- **Every tool is a read except one.** The write path is exercised exactly once, by `cancel_event`.
  Acknowledged, not fixed — and at 5 days, not fixable.


---

## 10. Free models, and whether any of them can run in the browser

> Added 2026-11-08, answering "start looking into free models that work in-browser".
> **Nothing here is built.** It is the research, and the one decision it forces.

### 10.1 The tension to resolve first

The plan above puts inference **server-side**: `pydantic-ai` holds the agent, the tools, the
approval gate, and an `llm_api_key`. "A model running in the browser" puts inference **client-side**.
These are not two implementations of one thing — they are different places, and only one of them
can hold the agent loop.

A browser model **cannot** be the agent in this design, for a reason that has nothing to do with
how good it is:

- The tools forward **the caller's own bearer token** to v1. That is the security property the
  whole plan rests on (§1) — the agent can do exactly what the signed-in organiser could already
  do, so there is no new authz surface. A browser model can technically make those calls, but then
  the "agent" is untrusted client code and every guard-rail is advisory.
- AG-UI is a **server→client** streaming protocol. With the model in the tab there is no server
  leg, so the thing being learned here — AG-UI, `pydantic-ai`, the adapter — is not exercised.
- `requires_approval` is enforced by the agent runtime. Move the runtime into the tab and the user
  is approving their own code's intentions.

So: **the browser model is not a replacement for the Python agent.** It is only interesting in two
narrower roles, and they are worth separating.

| Role | Runs where | Verdict |
|---|---|---|
| The organiser copilot (tools, approvals, data) | Python, server | **Keep as planned.** |
| Zero-cost local inference for the *same* agent | Browser | **No.** Breaks the token-forwarding property and skips AG-UI entirely. |
| Small local jobs with no data access — summarising a description the user just typed, suggesting an event name, tidying copy | Browser | **Plausible, later.** No token, no tenancy, nothing to leak. |
| Embeddings for local search over the events already in the page | Browser | **The best fit.** Small models, no streaming UI, genuinely free. |

**Recommendation:** build §1–§9 as written with a hosted model, and treat in-browser inference as a
separate experiment aimed at the last two rows. Do not try to make one serve both.

### 10.2 What is actually available

Two libraries, and the split between them is consistent across sources:

- **WebLLM** (`@mlc-ai/web-llm`) — chat-focused, **WebGPU only**, OpenAI-shaped chat API, a large
  catalogue of prebuilt models from SmolLM2 360M upward. The right pick *if* the job is chat.
- **Transformers.js** (`@huggingface/transformers`) — broader. Defaults to a **WASM/CPU** backend
  with WebGPU optional, so it degrades instead of failing. Covers embeddings, ASR, vision and
  classification, not just chat. The right pick for the embeddings role above.

Model sizes people report as practical: **1–3B is the ceiling** for most machines. A 4-bit
Llama 3.2 1B is roughly a **695MB download** needing about **880MB of GPU memory** — which is the
real cost here, and it is paid by the visitor on a phone. Names that keep recurring for browser
use: Gemma 3n, Phi-4 Mini, Gemma 3 2B, Qwen 2.5-0.5B.

Reported throughput (treat as indicative — these are blog benchmarks on high-end hardware, not
measurements of ours): ~41 tok/s for Llama-3.1-8B and ~71 tok/s for Phi-3.5-mini under WebLLM on an
M3 Max; ~60 tok/s for Llama 3.2 3B under Transformers.js.

### 10.3 The things that will actually decide it

1. **WebGPU coverage is not universal** — around 82.7% of browsers as of March 2026. A WebGPU-only
   path needs a fallback or an honest "not supported here", which is why Transformers.js is the
   safer library if this ships to real users.
2. **The download is the feature's cost.** ~700MB before the first token, on a product whose
   attendees open a link on a phone at a church door. Anything in-browser must therefore be
   **organiser-side only**, never on `/e/{id}` or `/p/{token}`.
3. **Version numbers in the sources conflict** (Transformers.js v4 is dated both February and
   September 2026). Check npm and the GitHub releases before pinning — do not take a version from
   a blog, or from this document.

### 10.4 Sources

- [Run an LLM Inside a Browser Tab: WebGPU and Local Inference in 2026](https://pinggy.io/blog/run_llm_in_browser_webgpu/)
- [WebLLM vs. Transformers.js: Can We Actually Run Smart 3B Models in the Browser?](https://mograblog.com/2026/09/webllm-running-smart-models-in-browser)
- [Running LLMs in the Browser — WebLLM vs transformers.js](https://lofttools.com/blog/browser-llms-2026-webllm-transformers-js/)
- [WebGPU 2026: Run LLMs in the Browser with Transformers.js](https://vucense.com/dev-corner/webgpu-browser-llm-2026/)
- [Run AI Models in the Browser with WebGPU & WASM](https://maddevs.io/writeups/running-ai-models-locally-in-the-browser/)

### 10.5 Status of the rest of this document

Restored on 2026-11-08. It was deleted in a tree-wide refactor (`f4907dd`) while
`services/ai-chat/src/app/settings.py` still cited it by name — so the only tracked Python file in
the repo pointed at a document that was not there. Nothing in §0–§9 has been re-verified against
the current API surface; **§5 in particular lists endpoints that have moved on** (`/me/tickets`,
`/me/claim` and `/media/recent` did not exist when it was written).
