# Week 6 — attendance.ts, the approval-gated tool, Copilot Phase B

Status: not started

## Objectives

By the end of this week you can:
- Explain the idempotency and capacity-enforcement rules in `AttendanceService`, and specifically
  why the unique index on `(event_id, person_id)` is what makes a repeated check-in safe under
  concurrent requests rather than a race condition.
- Explain `requires_approval=True` / `DeferredToolRequests`, and what actually happens on the wire
  between the tool call being requested and it executing.
- Have `attendance.ts` ported, `cancel_event` wired as a working approval-gated tool with a real
  interrupt card in the browser, and the Copilot's read tools switched from calling v1 over HTTP
  (Phase A) to calling `core-v2`'s own services in-process (Phase B).

## New this week (read before starting)

- Re-read `services/core/src/services/attendance.ts` directly and closely — this is the actual
  product differentiator, read the real file, not a summary of it.
- [pydantic-ai — deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/),
  and specifically its **human-in-the-loop tool approval** section — `requires_approval=True`,
  `DeferredToolRequests`, `DeferredToolResults`, and how a run is *paused and resumed* rather than
  blocked. This is the primary source for this week's second objective.
  - One line from that page worth internalising before you demo it: approval guards against the
    *model* acting without human sign-off — it is **not** an authorization boundary against the
    client. The real control on `cancel_event` is still the org-scoped API permission underneath,
    exactly as plan §3's safety property says. Being able to draw that distinction unprompted is a
    better interview moment than the card rendering.
- The tool-approval section of [pydantic-ai's AG-UI integration doc](https://pydantic.dev/docs/ai/integrations/ui/ag-ui/)
  (already read in week 5 — re-read the `DeferredToolRequests` example specifically) and
  [AG-UI's event reference](https://docs.ag-ui.com/concepts/events) for which events carry the
  interrupt round trip on the wire.

## Hands-on task

**Mode A — worked example (I write this, throwaway):** a toy approval-gated tool, unrelated to
CredoPass, run end to end once — request, interrupt card, confirm, execution — so you've seen the
full round trip before building the real one.

**Mode B — you write, tests + spec provided:**
1. **`attendance.ts`** (5 routes: register, check-in, check-out, checkin-state, close). I write
   tests including a concurrency case — two simultaneous check-in requests for the same
   `(event, person)` pair must not create two attendance rows — and a capacity-enforcement case.
   You implement until green.
2. **`cancel_event`** as `@agent.tool_plain(requires_approval=True)`. You wire it into the agent
   and the frontend's approval UI; I review specifically for whether the confirm/deny path is
   distinguishable from the "no approval needed" tools in the rendered UI, not just in the code.
3. **Phase B swap**: change the three Phase-A read tools (`get_event_summary`, `get_checkin_state`,
   `search_people`) from calling v1 over `httpx` to calling `core-v2`'s own event/attendance/people
   services in-process. Same tool signatures, different implementation — I review the diff for
   whether the swap actually changed nothing observable from the agent's or frontend's perspective.

## Done when

- `uv run pytest` covers the idempotent-check-in race case and passes reliably (run it a few times
  if it involves any real concurrency, not just a single deterministic pass).
- In the browser, asking the Copilot to cancel a real event produces a visible confirm/deny card
  that genuinely blocks execution until answered — try denying it once, not just confirming.

## Retro (fill in at the end)

- What was harder than expected:
- Fundamentals gap surfaced, if any:
- Carry into week 7:
