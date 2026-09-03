# Day 9 — human-in-the-loop, the backend half

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2, §5, §8

The first write tool, and the one that pauses. Today is Python and `curl` only — **do not open
React.** The approval round trip is the fiddliest thing in this stack, and debugging it through a
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

---

# Learn

Docs: [pydantic-ai deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/) —
the human-in-the-loop approval section specifically ·
[AG-UI events](https://docs.ag-ui.com/concepts/events) for which events carry the interrupt.

Also read `services/core/src/api/v1/core/events.ts:303` — `POST /events/{id}/cancel`, the thing
you're actually calling.

## The distinction — read this before the mechanism

> **`requires_approval=True` is a UX gate, not a security boundary.**
>
> It stops the **model** acting without a human. It does **not** stop a **client**. Anyone who can
> reach the agent endpoint can reach v1 directly and call the cancel endpoint themselves — the
> approval card is in the browser, and the browser is not a trusted place to put a control.
>
> The real authorization boundary is v1's org-scoped permission check, which runs regardless of
> whether the caller is a browser, an agent, or `curl`.

Getting this backwards — "the approval card is how we secure destructive actions" — is the common
mistake, and it's an expensive one to make out loud in an interview. Approval is about **model
autonomy**: the model shouldn't cancel things on its own reading of an ambiguous sentence. It isn't
about **authorization**: that was already handled, one layer down, by code that doesn't know the
agent exists.

Both controls are real. They defend different things.

## The mechanism

The run **pauses and resumes**. Nothing blocks a thread waiting for a human:

```
1. user: "cancel Touching Gods Heart"
2. model decides to call cancel_event(event_id='evt_123')
3. tool is marked requires_approval → NOT executed
4. run ENDS, its output being a DeferredToolRequests
5. …minutes pass. no server-side state is held…
6. client sends a NEW request: same conversation + the user's decision
7. run resumes: approved → the tool executes. denied → it doesn't.
```

Step 4 is the part worth being precise about. It ends the run — it doesn't suspend a coroutine.
That's why it survives a page refresh and why the server stays stateless, and it's the detail that
shows you understand it rather than having watched it work.

### Python

```python
from pydantic_ai.tools import DeferredToolRequests

agent = Agent(
    'openai:gpt-5.2',
    output_type=[str, DeferredToolRequests],   # ← easy to forget; nothing works without it
)

@agent.tool(requires_approval=True)
async def cancel_event(ctx: RunContext[CopilotDeps], event_id: str) -> str:
    """Cancel an event. The organizer must confirm before this runs."""
    ...
```

Two independent pieces, and both are required:

- `requires_approval=True` marks the tool.
- `DeferredToolRequests` in `output_type` gives the run somewhere to *end up* when it pauses.

The docs' example uses `tool_plain`. Yours needs `ctx.deps` for the HTTP client, so it's
`@agent.tool`. Confirm against the docs on day 9 — the flag is the point, not the decorator.

### React

```tsx
import { useHumanInTheLoop } from "@copilotkit/react-core/v2";

useHumanInTheLoop({
  name: "cancel_event",
  render: ({ args, respond }) => {
    if (!respond) return <></>;            // ← load-bearing, see below
    return (
      <ConfirmCard
        onConfirm={() => respond("approved")}
        onDeny={() => respond("denied")}
      />
    );
  },
});
```

> **Why `if (!respond)` matters.** `respond` is absent for a card that's already been answered.
> Without the guard, every resolved card in your scroll-back re-prompts on each re-render. Better
> than returning `<></>`: render the *outcome* ("Cancelled" / "Kept"), so the transcript reads as a
> history.

## Design decision worth defending

**Don't resolve a destructive tool's target from ambient state.** `get_event_summary(event_id=None)`
falling back to `active_event_id` is a convenience. `cancel_event` doing the same is a trap: the
model infers a target from context and the user confirms a card without re-reading which event it
names.

Require an explicit `event_id`. If the model can't say what it's cancelling, the user should.

The same reasoning applies to the card itself: it must say **"Cancel *Touching Gods Heart* (Aug
18)?"**, not "Approve tool call `cancel_event`?". A human is the safety mechanism here, and a human
given an opaque id can't be one.

---

# Build

**Mode A — worked example (I write this):** a toy approval-gated tool, run end to end via `curl` —
request, interrupt, resume with an approval, execution. Unrelated to CredoPass. The resume request
body is the part that's easy to get wrong; you see it working once first.

**Mode B — you write:**

1. **`output_type=[str, DeferredToolRequests]`** on `organizer_copilot`. Easy to miss and nothing
   works without it — approval isn't only a decorator flag.
2. **`cancel_event(event_id: str)`** as `@agent.tool(requires_approval=True)`, calling
   `POST /events/{id}/cancel` through your v1 client, forwarding the caller's token as always.
   - The docs' approval example uses `tool_plain`, because their toy tool needs nothing. Yours
     needs `ctx.deps` for the HTTP client, so it's `@agent.tool`. The approval flag is the point,
     not the decorator — confirm against the docs as you go.
   - **Require an explicit `event_id`.** Deliberately *don't* resolve this one from
     `active_event_id`. A destructive tool should not infer its target from ambient state — if the
     model can't name what it's cancelling, the user should. That's a design decision worth stating.
3. **`curl` the whole round trip.** Ask it to cancel a real event. Watch the run end with a
   deferred request. Send the resume with an approval. Watch it execute. Then do it again with a
   denial and confirm the event is untouched.
4. **One `FunctionModel` test** asserting the deferred request is raised rather than the tool being
   executed. This is the behaviour that must not silently regress.

Make a throwaway event in the app to cancel. You'll cancel several today.

---

# Done when

- The full `curl` round trip works: request → interrupt → resume-approve → cancelled.
- The deny path works: resume-deny → the event is still scheduled. **Check it in the database or
  the UI, not just in the agent's reply** — the agent saying "I didn't cancel it" isn't evidence.
- `uv run pytest` green, including the new deferred-request test.

---

# If it breaks

| Looks like | Actually is |
|---|---|
| Tool executes with no pause | `DeferredToolRequests` missing from `output_type`. |
| Run pauses, resume does nothing | Resume body malformed — that's why the worked example exists. |
| Deny still cancels | The tool ran before approval. Verify against the database, not the chat. |
| Can't decide `tool` vs `tool_plain` | Needs `ctx.deps` -> `@agent.tool`. The docs' example is `tool_plain` only because their toy tool needs nothing. |

---

# Say it out loud

The one to have word-perfect:

> "`requires_approval=True` guards against the *model* acting without a human — it's a UX gate. It
> is not an authorization boundary: a malicious client could call the underlying API directly and
> skip the card entirely, and would still be stopped, because the real control is the org-scoped
> permission check in the existing API, which runs whether the caller is a browser or an agent.
> Mechanically the run doesn't block — it *ends*, with a deferred tool request as its output, and a
> later request resumes the conversation with the user's decision. So the server stays stateless
> and the approval survives a page refresh."

---

That's the course. Days 11–14 are hardening, the write-up and rehearsal — no new concepts. See
[`../day-11-14-hardening-and-prep.md`](day-11-14-hardening-and-prep.md).

---

## Retro

- What the resume request body actually looks like:
- `tool_plain` vs `tool` for this — what you concluded:
- Approval-vs-authz, in your own words (rehearse it, it's an interview answer):
- Carry into day 10:
