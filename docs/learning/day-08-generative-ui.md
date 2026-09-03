# Day 8 — generative UI: the agent draws the calendar

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2

**This is the demo.** Everything so far has been a chatbot that happens to know your data. Today
the answer stops being text: you ask "what's coming up?" and the agent streams prose *and renders
the actual `EventCalendar`* — the same component the rail used to hold, drawn from a tool call.

## Objectives

By the end of today you can:
- Explain the binding: the frontend registers a renderer against a **tool name**, the agent's tool
  call arrives as an event on the AG-UI stream, and the component renders inline in the chat with
  the tool's args and result.
- Say the difference between rendering a *backend* tool call (`useRenderTool` — what you're doing)
  and registering a *frontend* tool the agent can invoke (`useFrontendTool` / `useComponent` —
  what you're not).

---

# Learn

Docs: [`useRenderTool` with Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai/generative-ui/tool-rendering) ·
[Generative UI overview](https://docs.copilotkit.ai/concepts/generative-ui-overview)

Also read `packages/ui/src/components/event-calendar/` for its props — `OverviewView.tsx` shows the
call shape you need to match.

## The idea

"Generative UI" sounds like the model generates markup. It doesn't, and that's the point — a model
emitting HTML would be unstyleable, unsafe, and inconsistent with your design system.

**What actually happens: you register a React component against a tool name.** When that tool is
called, the component renders inline in the chat, with the tool's arguments and result as props.
The model chooses *when* your component appears and *what data* fills it. You wrote the component.

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

## The mechanism

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

Three render args:

- **`status`** — the tool call's progress. You get called *while it runs*, not only at the end,
  which is what makes the loading state possible.
- **`args`** — what the model passed. Useful for context: "showing your upcoming events."
- **`result`** — the tool's return value, once complete.

> **The one rule:** `name` must equal the Python function's name, character for character. There is
> no type checking across that boundary — it's a string on one side and a function name on the
> other. When nothing renders, check this first, every time.

### Two different things, easily confused

| Hook | Direction | Use |
|---|---|---|
| `useRenderTool` | **Backend** tool call → React renders it | **This project.** The tool runs in Python; React only decides how it looks. |
| `useFrontendTool` / `useComponent` | React registers a tool the **agent can call** | Client-side actions (navigate, open a modal). Not used here. |

Objective 2 of day 8 is being able to state that difference. The docs cover both and it's easy to
follow the wrong example.

## Where the shape mapping goes

Your tool returns whatever v1's `/events` gave it. `EventCalendar` wants `Event[]`. Something must
map between them — and the choice is worth making deliberately:

**Put it in Python** (recommended). Give the tool a typed return. The model then sees a clean
schema, the renderer gets no surprises, and the contract is in one place.

**Putting it in React** works but is invisible to the agent: the model reasons about the raw v1
shape while the UI shows something else. That gap causes confusing behaviour later — the model
describes fields the user can't see.

---

# Build

**Mode B — you write. Small day by design; use the slack to make it look good.**

1. **Check the tool's return shape.** `list_events` currently returns whatever v1's `/events` gave
   it. The renderer needs `Event[]` as `EventCalendar` expects. Decide where the mapping lives —
   in the Python tool's return type, or in the React renderer. **Recommendation: Python.** Making
   it a typed return there means the model sees a clean schema and the renderer gets no surprises;
   a mapping in React is invisible to the agent.
2. **`useRenderTool({ name: 'list_events', render: … })`** in `CopilotView` — renders
   `<EventCalendar>` from the tool result.
3. **Handle all three states.** `status !== 'complete'` → a skeleton or "checking your calendar…".
   `complete` with events → the calendar. `complete` with none → an empty state, not an empty
   calendar grid.
4. **A second, simpler renderer** for `get_event_summary` — a small card. Two renderers prove the
   pattern generalises; one could be a fluke.

---

# Done when

- In the real app: "what's coming up?" → prose **and** a rendered calendar showing your real events.
- "tell me about \<event\>" → the summary card.
- The rendered calendar is visibly the same component as the old rail's — because it is.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| Text streams, component never appears | **Tool name mismatch.** Check first, always. |
| Nothing renders, no tool event in the network tab | The tool was never called — a day 2 problem (the docstring), not a React one. |
| Renders, then vanishes | Only handling `status === 'complete'` while an earlier status returned `undefined`. |
| `result` is `undefined` | Rendering before completion. Guard on `status`. |
| Renders raw JSON | The shape mapping question above — decide where it lives. |

**Debug order, when nothing appears:** ① names match? ② tool actually called (network tab, SSE
stream)? ③ result shape as expected (`console.log` the render args once)?

In this order, because this is the common failure and it looks like everything else:

1. **Tool name mismatch.** `name: 'list_events'` vs. the Python function's name. Character for
   character. This is the first thing to check, every time.
2. **Did the tool actually get called?** Network tab → the SSE stream → is there a tool-call event?
   If not, it's a day-2 problem (the docstring), not a React problem.
3. **Is the result shape what the renderer expects?** `console.log` the render args once.

---

# Say it out loud

> "The model doesn't generate markup — it chooses when a component appears and what data fills it.
> I register a React component against a tool name, and when the agent calls that tool the
> component renders inline with the tool's args and result. In our case it renders the *same*
> `EventCalendar` the sidebar already used, so the tool call replaced the data-fetching hook rather
> than the UI."

---

---

## Retro

- Where you put the shape mapping (Python or React), and whether that was right:
- What was harder than expected:
- Carry into day 9:
