# Day 10 — human-in-the-loop, the card

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2

The backend pauses correctly. Today a human gets to answer it, in the browser. **This is the demo
you'd rather give** — a chat that streams a rendered calendar is impressive; a chat that stops and
asks permission before doing something destructive is the one people remember.

## Objectives

By the end of today you can:
- Explain what `respond` is in the render args, and why `if (!respond) return <></>` is
  load-bearing — it's how the card distinguishes "awaiting your answer" from "already answered,
  showing history." Without it, old cards re-prompt on every re-render.

## New today

- [CopilotKit HITL with Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai/human-in-the-loop)
  — `useHumanInTheLoop`, the `render: ({ args, respond }) =>` signature, and the `respond` guard.
- Re-skim yesterday's [deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/)
  page — now from the client's side of the round trip.

**Note the docs' framing carefully:** their `useHumanInTheLoop` example declares a tool with
`parameters`, i.e. a *frontend* tool. Yours already exists in Python. Work out which of `name` /
`parameters` you actually need for binding to a backend approval — the docs lean toward the
frontend-tool case and your case is the other one. **If this fights you for more than an hour**,
fall back to `useRenderTool` plus a manual resume through `useAgent`; more code, same protocol,
same demo. Don't lose the day to hook archaeology.

## Hands-on task

**Mode B — you write:**

1. **`useHumanInTheLoop({ name: 'cancel_event', … })`** in `CopilotView`, rendering a confirm/deny
   card. `if (!respond) return <></>` — or render the *outcome* ("cancelled" / "kept") for
   already-answered cards, which is nicer.
2. **Make the card say what it's about to do.** "Cancel *Touching Gods Heart* (Aug 18)?" — not
   "Approve tool call `cancel_event`?" with a raw id. If a human is the safety mechanism, they need
   enough information to be one. The `args` give you the id; you may need a name lookup.
3. **Make deny visually distinct from confirm**, and make the resolved state obvious. Someone
   watching over your shoulder should be able to tell what happened without narration.
4. **Test all four paths in the browser:** confirm → cancelled. Deny → untouched. Ask again after
   denying → prompts again. Scroll up past an old resolved card → it doesn't re-prompt.

Style within the rail's dark/lime language — see the design memory. Time-box to 45 minutes.

## Done when

- In the real app: "cancel \<event\>" → a card naming the event, blocking the run.
- **Deny → the event is still there.** Confirm in the events list, not in the chat transcript.
- Confirm → it's cancelled, and the chat says so.
- Old cards in scroll-back don't re-prompt.

## Retro

- Which hook shape actually worked for a backend approval:
- Whether you had to fall back to `useRenderTool` + `useAgent`:
- What was harder than expected:
- Carry into day 11:
