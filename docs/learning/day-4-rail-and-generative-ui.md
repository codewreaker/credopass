# Day 4 — Thu 11 Sep — the rail becomes a chat, then draws the calendar

Plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §1, §2 · ~7h · Reading budget: 30 min

**The biggest day of the week and the one that produces the demo.** Two of the old plan's days in
one: the rail becomes a chat before lunch, and the agent renders a real calendar after it.

Yesterday's `curl` dress rehearsal exists so today is **only React**. Headers, CORS, state and the
protocol are already proven. If you find yourself debugging Python today, something went wrong
yesterday — go back and fix it there.

## Objectives

By tonight you can:
- Point at a chat panel in the real CredoPass app streaming a real answer about real events.
- Say what CopilotKit is doing for you and what it isn't — **a React client for AG-UI**, not a
  framework your agent has to know about.
- Explain the binding: the frontend registers a renderer against a **tool name**, the agent's tool
  call arrives as an event on the AG-UI stream, and the component renders inline with the tool's
  args and result.
- Say the difference between rendering a *backend* tool call (`useRenderTool` — what you're doing)
  and registering a *frontend* tool the agent can invoke (`useFrontendTool` / `useComponent` — what
  you're not).

---

# Learn

## What CopilotKit is, and isn't (~15 min)

It's a **React client for AG-UI**. Your Python side is unchanged today: the agent doesn't know
CopilotKit exists and would work identically against a hand-written client. What you get is the
prebuilt chat UI, the streaming plumbing, and the hooks that bind components to tool names.

That boundary matters for the interview: **you understand the protocol, and you chose not to spend
a week rebuilding a chat UI that teaches nothing about it.** At five days that's not a preference,
it's the only option — say the first half, not the second.

Docs:
- [CopilotKit × Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai) — this exact pairing.
  Prefer it over the generic CopilotKit docs, which cover several backends and bury yours.
- [`useAgent`](https://docs.copilotkit.ai/reference/hooks/useAgent) — sits directly on AG-UI, if the
  prebuilt chat needs escaping.

## Generative UI (~15 min, read after lunch)

Docs: [`useRenderTool` with Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai/generative-ui/tool-rendering)
· [Generative UI overview](https://docs.copilotkit.ai/concepts/generative-ui-overview)

"Generative UI" sounds like the model generates markup. It doesn't, and that's the point — a model
emitting HTML would be unstyleable, unsafe, and inconsistent with your design system.

**What actually happens: you register a React component against a tool name.** When that tool is
called, the component renders inline in the chat with the tool's arguments and result as props.
**The model chooses when your component appears and what data fills it. You wrote the component.**

```
agent calls list_events ──> TOOL_CALL_* events on the AG-UI stream
                              │
frontend: useRenderTool({ name: 'list_events', render })
                              │
                              └──> <EventCalendar events={result} />
```

The neat consequence in this project, and the thing to say in an interview:

> The rail already had an `EventCalendar` fed by a `useEventsCalendar` hook. The Copilot version
> renders **the same component**, fed by a tool call instead. Generative UI replaced the fetching
> layer, not the UI layer.

```tsx
import { useRenderTool } from "@copilotkit/react-core/v2";

useRenderTool({
  name: "list_events",           // MUST match the Python tool name exactly
  render: ({ status, args, result }) => {
    if (status !== "complete") return <p>Checking your calendar…</p>;
    if (!result?.length) return <p>Nothing scheduled.</p>;
    return <EventCalendar events={result} variant="compact" />;
  },
});
```

Three render args: **`status`** (you're called *while it runs*, which is what makes a loading state
possible), **`args`** (what the model passed), **`result`** (the return value, once complete).

> **The one rule:** `name` must equal the Python function's name, character for character. There is
> no type checking across that boundary — a string on one side, a function name on the other. When
> nothing renders, check this first, every time.

### Two hooks, easily confused

| Hook | Direction | Use |
|---|---|---|
| `useRenderTool` | **Backend** tool call → React renders it | **This project.** The tool runs in Python; React only decides how it looks. |
| `useFrontendTool` / `useComponent` | React registers a tool the **agent can call** | Client-side actions (navigate, open a modal). Not used here. |

Being able to state that difference is objective 4. The docs cover both and it's easy to follow the
wrong example.

## Repo shape — read before writing

- `apps/web/src/containers/RightSidebar/index.tsx` — switches on `viewedItem` between
  `OverviewView` and `ProfileView`. **You're adding a third view. Match that shape**; don't invent a
  new container pattern.
- `apps/web/src/contexts/session.tsx` — `useSession` for the token, `useCan` for the gate.
- `packages/api-client/src/active-organization.ts` — the org id, for the header and for
  `CopilotState`.
- `packages/ui/src/components/event-calendar/` — its props. `OverviewView.tsx` shows the call shape
  you need to match.

---

# Build

```bash
cd apps/web
bun add @copilotkit/react-core @copilotkit/react-ui
```

## Morning (~3.5h) — the chat

**Mode C — I do this:** the provider wiring with custom headers attached (~20 lines). The
headers-on-the-agent-connection part is badly documented and there's no learning in losing a
morning to it. **You wire the state and the hooks; I wire the provider.**

**Mode B — you write:**

1. **`apps/web/src/containers/Copilot/`** — a `CopilotView` rendering `<CopilotChat>`, pointed at
   `http://localhost:8090/api/v1/ai-chat/agent/organizer-copilot`, sending:
   - `Authorization: Bearer <token from useSession>`
   - `X-Organization-Id: <active org>`
   - AG-UI `state`: `{ active_organization_id, active_event_id }` — yesterday's contract, now real.
2. **Wire it into `RightSidebar`** as the default view, replacing `OverviewView`. **Keep
   `OverviewView` in the tree** — with the flag off it's the fallback.
3. **Gate it:** `VITE_COPILOT_ENABLED` off by default (plan §1 — never wired into prod), plus
   `useCan` the same way `/account?tab=members` gates member management.
4. **Style it enough to not embarrass the demo. Time-box to 30 minutes.** The rail is dark, narrow
   and lime-accented; `<CopilotChat>` ships light and wide. Get it legible, stop there. No one is
   interviewing you on chat bubble padding.

### The 1pm checkpoint

**If the chat isn't streaming in the browser by 1pm, that's the day's fork.** Two hours maximum on
CopilotKit v2 import archaeology, then fall back to the AG-UI React client directly — more code,
same protocol, and arguably a better interview answer. If you're still fighting at 2pm, **ship
plain chat, move `useRenderTool` to Friday morning, and push HITL to Friday afternoon.** Plain chat
in the real app is already a demo.

## Afternoon (~3.5h) — the calendar

**Mode B — you write. Small by design; use the slack to make it look good.**

5. **Decide where the shape mapping lives, and put it in Python.** `list_events` currently returns
   whatever v1's `/events` gave it; `EventCalendar` wants `Event[]`. Give the tool a typed return.
   **Recommendation, and the reasoning is the interview-relevant part:** in Python the model sees a
   clean schema and the renderer gets no surprises. A mapping in React is invisible to the agent —
   the model reasons about the raw v1 shape while the UI shows something else, and then it describes
   fields the user can't see.
6. **`useRenderTool({ name: 'list_events', render: … })`** in `CopilotView` → `<EventCalendar>`.
7. **Handle all three states.** `status !== 'complete'` → skeleton or "checking your calendar…".
   Complete with events → the calendar. Complete with none → an empty state, **not an empty
   calendar grid**.
8. **A second, simpler renderer** for `get_event_summary` — a small card. Two renderers prove the
   pattern generalises; one could be a fluke. *(This is the first thing to cut if the morning ran
   long.)*

---

# Done when

- Signed in to the real app with the flag on: open the rail, ask "what events do I have coming
  up?", and watch the answer stream in token by token.
- **"What's coming up?" → prose *and* a rendered calendar showing your real events.**
- "Tell me about \<event\>" → the summary card.
- The rendered calendar is visibly the same component as the old rail's — because it is.
- The network tab shows the SSE stream and the forwarded headers.
- **Flag off → the old calendar rail, unchanged.** Verify this; it's the blast-radius claim.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| Text streams, component never appears | **Tool name mismatch.** Check first, always. |
| `@copilotkit/react-core/v2` imports don't resolve | v2 is new. Check the installed version's exports before assuming your code is wrong. **Two hours maximum**, then the AG-UI React client. |
| Browser blocked, `curl` fine | CORS. Should have been done yesterday. `:5000` **and** `:5001`. |
| 401 from Python | Is the browser token reaching it? Log the header's *presence* server-side once, then remove the log. **Never log the value.** |
| Chat renders, nothing streams | Wrong endpoint URL, or the response isn't being treated as a stream. |
| Nothing renders, no tool event in the network tab | The tool was never called — a **docstring** problem, not a React one. |
| Renders, then vanishes | Only handling `status === 'complete'` while an earlier status returned `undefined`. |
| `result` is `undefined` | Rendering before completion. Guard on `status`. |
| Renders raw JSON | The shape mapping (task 5) — decide where it lives. |
| Old calendar gone with the flag off | The flag isn't actually gating — the blast-radius claim is broken. |

**Debug order when nothing appears, in this order because they look identical:**
① names match, character for character? ② tool actually called — network tab, SSE stream, is there a
tool-call event? ③ result shape as expected — `console.log` the render args once.

---

# Say it out loud

> "CopilotKit is a React client for AG-UI — the agent doesn't know it exists and would work against
> any client speaking the protocol. I used the prebuilt chat deliberately: the interview-relevant
> depth is the protocol and the agent, not rebuilding a streaming chat UI."

> "The model doesn't generate markup — it chooses when a component appears and what data fills it.
> I register a React component against a tool name, and when the agent calls that tool the component
> renders inline with the tool's args and result. In our case it renders the *same* `EventCalendar`
> the sidebar already used, so the tool call replaced the data-fetching hook rather than the UI."

---

## Retro

- How long the CopilotKit wiring actually took, and whether you hit the 1pm fork:
- Anything about v2 that differed from the docs:
- Where you put the shape mapping, and whether that was right:
- Carry into day 5:
