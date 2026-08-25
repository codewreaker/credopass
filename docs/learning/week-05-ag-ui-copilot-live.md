# Week 5 — AG-UI protocol, CopilotKit, the Copilot live in the web app

Status: not started

## Objectives

By the end of this week you can:
- Explain what `RunAgentInput` carries and what an AG-UI event stream actually is — a typed SSE
  stream of ~16 standard event types, not a single request/response.
- Explain what `StateDeps` synchronizes between frontend and agent, and why the Copilot "remembers"
  the active event without you repeating it every message.
- Point at a real chat panel, in the actual `apps/web` app, streaming a live, tool-backed answer.
  **This is the headline demo artifact for the whole project — treat this week as non-negotiable
  even if something upstream slipped.**

## New this week (read before starting)

**The protocol** — read the spec side first, so the SDKs look like implementations of something you
already understand rather than magic:

- [AG-UI — introduction](https://docs.ag-ui.com/introduction) (plan Key Sources).
- [AG-UI — architecture](https://docs.ag-ui.com/concepts/architecture) — where the agent, the
  transport and the client sit relative to each other.
- [AG-UI — events](https://docs.ag-ui.com/concepts/events) — **the page that matters most this
  week.** The ~16 standard event types are the vocabulary; this week's first objective is being
  able to name what's on the wire, and this is where that lives. Have it open next to your `curl -N`
  output in task 1.
- [AG-UI — quickstart](https://docs.ag-ui.com/quickstart) and
  [Python SDK overview](https://docs.ag-ui.com/sdk/python/core/overview) — reference for the
  concrete types once the concepts are clear.

**The two SDK halves:**

- [pydantic-ai — AG-UI integration](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/) — the
  `AGUIAdapter.dispatch_request` pattern, `StateDeps`, and the tool-approval example (you'll use
  the approval pattern next week, but read it now while the rest of AG-UI is fresh). The same page
  lives in the repo as [`docs/ui/ag-ui.md`](https://github.com/pydantic/pydantic-ai/blob/main/docs/ui/ag-ui.md)
  if you'd rather read the raw markdown, and there's an
  [`ag_ui` API reference](https://pydantic.dev/docs/ai/api/pydantic-ai/ag_ui/) for exact signatures.
- [CopilotKit — connect AG-UI agents](https://docs.copilotkit.ai/backend/ag-ui) — the frontend
  half. Also useful: [CopilotKit's Pydantic AI page](https://docs.copilotkit.ai/pydantic-ai),
  which covers this exact pairing, and their
  [AG-UI protocol page](https://docs.copilotkit.ai/agentic-protocols/ag-ui) for how the React
  components map onto the event types above.

**Repo context:**

- Skim `apps/web/src/containers/UserMenu/` and `RightSidebar/` — not for their content, for how
  this repo structures a container, so `Copilot/` matches the existing shape rather than inventing
  a new one.

## Hands-on task

**Mode A — worked example (I write this, throwaway):** the minimal `AGUIAdapter.dispatch_request`
wiring — roughly the 10-line pattern from the plan's research — as a standalone endpoint with a toy
agent, so you see the shape before wiring the real Copilot behind it.

**Mode B — you write, I review at each layer separately (cheaper to debug HTTP before React):**
1. Mount `organizer_copilot` behind `AGUIAdapter` at `/api/v2/agent/organizer-copilot`, using
   `StateDeps[CopilotState]` (`active_organization_id`, `active_event_id`). Verify the raw SSE
   output yourself with `curl -N` before touching the frontend at all — if the event stream is
   wrong, it's much cheaper to see that here than through a React error.
2. Build `apps/web/src/containers/Copilot/` using CopilotKit's prebuilt `<CopilotChat>` (not a
   hand-built chat UI — the backend depth is the point, not frontend polish, per plan §9's
   critique). Gate it with `useCan` the same way `/account?tab=members` gates member management,
   and behind a dev-only env toggle so it never reaches the default `apps/web` config.

## Done when

- Signed in to the real CredoPass web app, dev toggle on: you can open the Copilot panel, ask a
  real question about real event/attendance data, and watch the answer stream in token by token,
  backed by an actual tool call you can see in the network tab.

## Retro (fill in at the end)

- What was harder than expected:
- Fundamentals gap surfaced, if any:
- Carry into week 6:
