# Day 9 — human-in-the-loop, the backend half

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2, §5, §8

The first write tool, and the one that pauses. Today is Python and `curl` only — **do not open
React.** The approval round-trip is the fiddliest thing in this stack, and debugging it through a
React layer you also wrote yesterday is how a day disappears.

## Objectives

By the end of today you can:
- Explain that the run is **paused and resumed**, not blocked. Nothing is sitting on a thread
  waiting; the run ends with a deferred request and a *later* request resumes it with the answer.
  Being able to say that precisely is most of the interview value here.
- **Draw the distinction that plan §8 answer #1 rests on:** `requires_approval=True` guards against
  the *model* acting without a human. It is **not** an authorization boundary against a *client* —
  a malicious client could call v1's cancel endpoint directly and skip the card entirely. The real
  control is v1's org-scoped permission check, which runs either way. Say this unprompted in the
  interview; it's the line that separates having read the docs from having shipped it.

## New today

- [pydantic-ai — deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/) —
  **the human-in-the-loop tool approval section specifically.** `requires_approval=True`,
  `DeferredToolRequests`, `DeferredToolResults`.
- [pydantic-ai — AG-UI](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/), the tool-approval
  example. Read it again now that you've watched the stream.
- [AG-UI — events](https://docs.ag-ui.com/concepts/events) — which events carry the interrupt
  round trip. You'll be matching your `curl` output against this.
- `services/core/src/api/v1/core/events.ts:303` — `POST /events/{id}/cancel`, the thing you're
  actually calling. Read what it requires and what it returns.

## Hands-on task

**Mode A — worked example (I write this):** a toy approval-gated tool, run end to end via `curl` —
request, interrupt, resume with an approval, execution. Unrelated to CredoPass. The resume request
body is the part that's easy to get wrong; you see it working once first.

**Mode B — you write:**

1. **`output_type=[str, DeferredToolRequests]`** on `organizer_copilot`. Easy to miss and nothing
   works without it — approval isn't only a decorator flag.
2. **`cancel_event(event_id: str)`** as `@agent.tool_plain(requires_approval=True)`, calling
   `POST /events/{id}/cancel` through your v1 client, forwarding the caller's token as always.
   - Note it's `tool_plain` in the plan, but it needs `ctx.deps` for the client — so it's
     `@agent.tool(requires_approval=True)`. Confirm against the docs and correct the plan if so;
     the flag is the point, not which decorator.
   - **Require an explicit `event_id`.** Deliberately *don't* resolve this one from
     `active_event_id`. A destructive tool should not infer its target from ambient state — if the
     model can't name what it's cancelling, the user should. That's a design decision worth stating.
3. **`curl` the whole round trip.** Ask it to cancel a real event. Watch the run end with a
   deferred request. Send the resume with an approval. Watch it execute. Then do it again with a
   denial and confirm the event is untouched.
4. **One `FunctionModel` test** asserting the deferred request is raised rather than the tool being
   executed. This is the behaviour that must not silently regress.

Make a throwaway event in the app to cancel. You'll cancel several today.

## Done when

- The full `curl` round trip works: request → interrupt → resume-approve → cancelled.
- The deny path works: resume-deny → the event is still scheduled. **Check it in the database or
  the UI, not just in the agent's reply** — the agent saying "I didn't cancel it" isn't evidence.
- `uv run pytest` green, including the new deferred-request test.

## Retro

- What the resume request body actually looks like:
- `tool_plain` vs `tool` for this — what you concluded:
- Approval-vs-authz, in your own words (rehearse it, it's an interview answer):
- Carry into day 10:
