# Day 5 — Fri 12 Sep — human-in-the-loop, then rehearsal

Plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §2, §5, §8 · ~7h · Reading budget: 30 min

The last day, and it carries four of the old plan's. Morning is the feature; afternoon is
everything that turns a demo into something you can talk about under pressure.

**A chat that streams a rendered calendar is impressive. A chat that stops and asks permission
before doing something destructive is the one people remember.** That's the morning.

**The afternoon is not optional.** An unrehearsed demo of a polished feature goes worse than a
rehearsed demo of a rough one. If the morning overruns, cut features from it — never the rehearsal.

## Objectives

By tonight you can:
- Explain that the run is **paused and resumed, not blocked.** Nothing sits on a thread waiting;
  the run *ends* with a deferred request, and a *later* request resumes it with the answer. Saying
  that precisely is most of the interview value here.
- **Draw the distinction interview answer #1 rests on:** `requires_approval=True` guards against
  the *model* acting without a human. It is **not** an authorization boundary against a *client*.
- Say all five §8 answers out loud, without notes.

---

# Learn

## Morning read (~30 min)

- [pydantic-ai deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/) — the
  human-in-the-loop approval section specifically.
- [CopilotKit HITL with Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai/human-in-the-loop).
- `services/core/src/api/v1/core/events.ts:303` — `POST /events/{id}/cancel`, the thing you're
  actually calling.

## The distinction — read this before the mechanism

> **`requires_approval=True` is a UX gate, not a security boundary.**
>
> It stops the **model** acting without a human. It does **not** stop a **client.** Anyone who can
> reach the agent endpoint can reach v1 directly and call the cancel endpoint themselves — the
> approval card is in the browser, and the browser is not a trusted place to put a control.
>
> The real authorization boundary is v1's org-scoped permission check, which runs regardless of
> whether the caller is a browser, an agent, or `curl`.

Getting this backwards — "the approval card is how we secure destructive actions" — is the common
mistake and an expensive one to make out loud at Citadel. Approval is about **model autonomy**: the
model shouldn't cancel things on its own reading of an ambiguous sentence. It isn't about
**authorization**: that was already handled one layer down, by code that doesn't know the agent
exists. **Both controls are real. They defend different things.**

## The mechanism

```
1. user: "cancel Touching Gods Heart"
2. model decides to call cancel_event(event_id='evt_123')
3. tool is marked requires_approval → NOT executed
4. run ENDS, its output being a DeferredToolRequests
5. …minutes pass. no server-side state is held…
6. client sends a NEW request: same conversation + the user's decision
7. run resumes: approved → the tool executes. denied → it doesn't.
```

**Step 4 is the part worth being precise about.** It ends the run — it doesn't suspend a coroutine.
That's why it survives a page refresh and why the server stays stateless, and it's the detail that
shows you understand it rather than having watched it work.

```python
from pydantic_ai.tools import DeferredToolRequests

agent = Agent(
    'openai:gpt-5.2',
    output_type=[str, DeferredToolRequests],   # ← easy to forget; nothing works without it
)

@agent.tool(requires_approval=True)
async def cancel_event(ctx: RunContext[CopilotDeps], event_id: str) -> str:
    """Cancel an event. The organizer must confirm before this runs."""
```

**Two independent pieces, both required:** `requires_approval=True` marks the tool;
`DeferredToolRequests` in `output_type` gives the run somewhere to *end up* when it pauses.

The docs' example uses `tool_plain` because their toy tool needs nothing. Yours needs `ctx.deps`
for the HTTP client, so it's `@agent.tool`. **The flag is the point, not the decorator.**

## The React half

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
> Without the guard, **every resolved card in your scroll-back re-prompts on each re-render.**
> Better than returning `<></>`: render the *outcome* ("Cancelled" / "Kept"), so the transcript
> reads as history.

**A doc-shape warning:** the docs' `useHumanInTheLoop` example declares a tool with `parameters` —
i.e. a *frontend* tool. Yours already exists in Python. Work out which of `name` / `parameters` you
actually need to bind to a **backend** approval; the docs lean toward the other case.

## Two design decisions worth defending

**1. Don't resolve a destructive tool's target from ambient state.** `get_event_summary(event_id=None)`
falling back to `active_event_id` is a convenience. `cancel_event` doing the same is a trap: the
model infers a target from context and the user confirms a card without re-reading which event it
names. **Require an explicit `event_id`.** If the model can't say what it's cancelling, the user
should.

**2. The card is the safety mechanism, so it must be readable.** "Cancel *Touching Gods Heart*
(Aug 18)?" — **not** "Approve tool call `cancel_event`?" with a raw id. A human given an opaque id
can't be a safety mechanism. The `args` give you the id; you may need a name lookup.

---

# Build

## Morning (~3.5h) — HITL, backend first

**Do the backend and `curl` it before you open React.** The approval round trip is the fiddliest
thing in this stack and debugging it through a React layer you wrote yesterday is how a day
disappears. **Don't reorder this.**

**Mode A — I write this:** a toy approval-gated tool run end to end via `curl` — request, interrupt,
resume with an approval, execution. Unrelated to CredoPass. **The resume request body is the part
that's easy to get wrong**; you see it working once first.

**Mode B — you write:**

1. **`output_type=[str, DeferredToolRequests]`** on `organizer_copilot`. Easy to miss, and nothing
   works without it — approval isn't only a decorator flag.
2. **`cancel_event(event_id: str)`** as `@agent.tool(requires_approval=True)`, calling
   `POST /events/{id}/cancel` through your v1 client, forwarding the caller's token as always.
   **Require an explicit `event_id`** — deliberately don't resolve this one from `active_event_id`.
3. **`curl` the whole round trip.** Ask it to cancel a real event. Watch the run end with a
   deferred request. Send the resume with an approval. Watch it execute. **Then do it again with a
   denial and confirm the event is untouched.**
4. **`useHumanInTheLoop({ name: 'cancel_event', … })`** in `CopilotView`, rendering a confirm/deny
   card. `if (!respond)` → render the *outcome*, not nothing.
5. **Make the card name the event**, per design decision 2 above.
6. **Test all four browser paths:** confirm → cancelled. Deny → untouched. Ask again after denying
   → prompts again. Scroll up past an old resolved card → **it doesn't re-prompt.**

**Mode C — I do this:** `ConfirmCard` styling in the rail's dark/lime language, and a
`FunctionModel` test asserting the deferred request is raised rather than the tool being executed.

Make a throwaway event in the app to cancel. You'll cancel several this morning.

**If `useHumanInTheLoop` fights you for more than an hour**, fall back to `useRenderTool` plus a
manual resume through `useAgent` — more code, same protocol, same demo. Don't lose the morning to
hook archaeology. **And if it's still fighting at noon: keep the backend half, demo the pause via
`curl`, and move on.** You keep the entire interview answer; you lose a screenshot.

## Afternoon (~3.5h) — the part that isn't code

### 1. Errors that carry an answer (~45 min)

Not all five from the old plan — the two that matter, and I'll write tests for the rest.

- **v1 returns 404** (event in another tenant, or deleted) → **do not let the agent distinguish
  "doesn't exist" from "not yours."** That's golden rule 6, and it applies to the agent's
  *phrasing*, not just the HTTP status. An agent that says "that event belongs to another
  organization" has leaked exactly what the 404 exists to hide. **This is a real interview answer**
  — a tenancy control that had to be re-established one layer up, in prose.
- **The token expires mid-conversation** → the next tool call 401s. The user must see something
  they can act on ("your session expired, reload"), not a silent failure.

Also: **set a timeout on the httpx client** if you haven't. A hung tool is a hung chat with no
explanation.

*(On `ModelRetry`: a tool raising it hands the error back to the model to try again. Powerful and
easy to misuse — retrying a 403 just burns tokens on something that will never succeed. Know that
much; you don't need to implement it.)*

### 2. Logging and README (~45 min)

- **Structured logging** on the agent endpoint: which tools ran, how long, success/failure. **Not
  the token, not the message content.** This is the "I've operated a service before" signal.
- **`services/ai-chat/README.md`** following the repo's other package READMEs. A stranger goes from
  clone to a working chat. Cover: what the service is (one endpoint, no database, on purpose), how
  to run it, the tools, how token forwarding works, how to run tests with no API key.
- **`docs/rebuild/REBUILD-LOG.md`** — a dated entry for the Copilot rail. Repo convention, and this is a
  real architectural addition.
- **Clean up:** keep `scripts/ask_copilot.py` (genuinely useful, and a demo fallback). `scratch/`
  gitignored or gone.

### 3. The write-up (~45 min)

One page, in the README or beside it. **In your own words, not copied from the plan** — the act of
rewriting it is the rehearsal.

1. **The architecture** — why Python owns only the agent, why no database, why the tools call v1
   over HTTP.
2. **The approval-vs-authorization distinction.** If you write one thing carefully, this.
3. **The permission-inheritance property** — the agent forwards the caller's token and gains
   nothing.
4. **What you'd do differently** — the HTTP hop, and the missing eval harness.
5. **The scope cut itself.** You cancelled a backend port to ship one feature properly, then
   compressed 14 days into 5 and moved test-writing to a pairing partner to protect the build
   hours. Written down as deliberate trades with stated costs, that reads as judgment.

### 4. Rehearsal (~60 min) — no new code. None.

**Not even a small fix.** A demo that broke because of a Friday-evening tweak is a bad story and
there's no time to recover.

1. **Cold run, twice.** Closed laptop → running demo. Time it. **Under 90 seconds to the first
   rendered calendar.**
   - Both services up (`:8080`, `:8090`), web on `:5000`/`:5001`, flag on.
   - Signed in, an org with real events, **a throwaway event created specifically to cancel.**
   - "What's coming up?" → calendar renders.
   - Ask about one event → summary card.
   - Ask to cancel the throwaway → card appears → **deny it.** Show it survived. *Then* confirm.
2. **Say the five §8 answers out loud. Twice each.** Out loud, not in your head — the gap between
   "I understand this" and "I can say this" is where interviews are lost.
3. **Rehearse the honest ones** — no async SQLAlchemy, and you specified and reviewed the tests
   rather than writing them. Practise saying both without apology.
4. **Record the demo.** Screen recording plus `ask_copilot.py` output saved to a file. If the
   network or the model provider is down live, that recording is the demo.

---

# Done when

- The full `curl` round trip works: request → interrupt → resume-approve → cancelled.
- **In the real app: "cancel \<event\>" → a card naming the event, blocking the run. Deny → the
  event is still there.** Confirm that in the events list, **not** in the chat transcript — the
  agent saying "I didn't cancel it" isn't evidence.
- Old cards in scroll-back don't re-prompt.
- A 404 produces phrasing that doesn't distinguish "gone" from "not yours."
- `nx run ai-chat:verify` green.
- README written, REBUILD-LOG entry added.
- **Two clean cold runs, five answers out loud without notes, and a recording that exists.**

---

# If it breaks

| Looks like | Actually is |
|---|---|
| Tool executes with no pause | `DeferredToolRequests` missing from `output_type`. |
| Run pauses, resume does nothing | Resume body malformed — that's why the worked example exists. |
| Deny still cancels | The tool ran before approval. **Verify against the events list, not the chat.** |
| Old cards re-prompt on scroll | Missing `if (!respond)`. |
| Card shows a raw id | No name lookup. A human can't approve what they can't read. |
| Hook doesn't bind | Frontend-tool vs backend-approval shape — see the doc-shape warning. |
| Can't decide `tool` vs `tool_plain` | Needs `ctx.deps` → `@agent.tool`. |

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

Then the other four, from plan §8. Twice each, out loud.

---

## Retro

- What the resume request body actually looks like:
- Which hook shape worked for a backend approval, and whether you fell back:
- Approval-vs-authz, in your own words (rehearse it — it's the answer):
- What you'd tell yourself on Monday morning if you could:
