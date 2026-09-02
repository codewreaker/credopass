# Day 8 — generative UI: the agent draws the calendar

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2

**This is the demo.** Everything so far has been a chatbot that happens to know your data. Today
the answer stops being text: you ask "what's coming up?" and the agent streams prose *and renders
the actual `EventCalendar` component* — the same one the rail used to hold, drawn from a tool call.

The neat part of the whole design, worth saying out loud in the interview: **the tool call replaced
the `useEventsCalendar` hook, not the component.** The old rail fetched events and drew a calendar.
The new rail has an agent decide to fetch events, and draws the same calendar. One layer swapped.

## Objectives

By the end of today you can:
- Explain the binding: the frontend registers a renderer against a **tool name**, the agent's tool
  call arrives as an event on the AG-UI stream, and the component renders inline in the chat with
  the tool's args and result.
- Say the difference between rendering a *backend* tool call (`useRenderTool` — what you're doing)
  and registering a *frontend* tool the agent can invoke (`useFrontendTool` / `useComponent` —
  what you're not).

## New today

- [`useRenderTool` with Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai/generative-ui/tool-rendering)
  — the hook, the `{ status, args, result }` render args, and the one rule that matters:
  **the hook's `name` must exactly match the Python tool's name.**
- [Generative UI overview](https://docs.copilotkit.ai/concepts/generative-ui-overview) — for
  objective 2's distinction.
- **`packages/ui/src/components/event-calendar/`** — read its props. `OverviewView.tsx` shows the
  call shape: `<EventCalendar events={events} variant="compact" month={month} onMonthChange={…} />`.
  You need the same `Event[]` shape out of your tool that `useEventsCalendar` produces today.

## Hands-on task

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

## Done when

- In the real app: "what's coming up?" → prose **and** a rendered calendar showing your real events.
- "tell me about \<event\>" → the summary card.
- The rendered calendar is visibly the same component as the old rail's — because it is.

## If nothing renders

In this order, because this is the common failure and it looks like everything else:

1. **Tool name mismatch.** `name: 'list_events'` vs. the Python function's name. Character for
   character. This is the first thing to check, every time.
2. **Did the tool actually get called?** Network tab → the SSE stream → is there a tool-call event?
   If not, it's a day-2 problem (the docstring), not a React problem.
3. **Is the result shape what the renderer expects?** `console.log` the render args once.

## Retro

- Where you put the shape mapping (Python or React), and whether that was right:
- What was harder than expected:
- Carry into day 9:
