# Days 11–14 — hardening, write-up, rehearsal

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §3, §8

One file for four days, because these are less prescriptive than the spine and how much of 11–12
you get depends on how 1–10 actually went.

**These are the cut zone.** If you're behind, days 11 and 12 compress or vanish. Days 13 and 14 do
not — an unrehearsed demo of a polished feature goes worse than a rehearsed demo of a rough one.

---

## Day 11 — errors and edges

The feature works when everything works. Today: what it does when things don't. This is where
"I built a demo" becomes "I built a feature," and it's a much better answer to "what did you learn"
than another tool would be.

### Objectives

- Say what a tool should do when its upstream call fails, and when `ModelRetry` is right versus
  when failing hard is right.

### New today

- [pydantic-ai — error handling / `ModelRetry`](https://pydantic.dev/docs/ai/tools-toolsets/tools/#tool-errors-and-retries)
  — a tool raising `ModelRetry` hands the error *back to the model* to try again. Powerful and
  easy to misuse: retrying a 403 just burns tokens on something that will never succeed.

### Task (Mode B)

Work through these deliberately, one at a time, and fix what's wrong:

1. **v1 returns 403** (caller lacks `event:read`) → the agent should say it can't see that, not
   retry, not invent an answer.
2. **v1 returns 404** (event in another tenant, or deleted) → same. **Do not let the agent
   distinguish "doesn't exist" from "not yours"** — that's golden rule 6, and it applies to the
   agent's *phrasing*, not just the HTTP status. An agent that says "that event belongs to another
   organization" has leaked exactly what the 404 exists to hide.
3. **v1 returns 500** → a sensible apology, and the error logged server-side.
4. **The token expires mid-conversation** → the next tool call 401s. What does the user see? At
   minimum, something that tells them to reload rather than a silent failure.
5. **A tool times out** → set a timeout on the httpx client if you haven't. A hung tool means a
   hung chat with no explanation.

Add a test per case where cheap. Case 2 is the one to test properly.

### Done when

- Each of the five produces something a user could act on, and nothing leaks cross-tenant existence.
- `uv run pytest` green.

---

## Day 12 — polish and README

### Task (Mode B + C)

1. **Streaming and loading states.** Does the rail show *something* between question and first
   token? Silence reads as broken.
2. **Structured logging** on the agent endpoint: which tools ran, how long, success/failure. Not
   the token, not the message content. This is the "I've operated a service before" signal.
3. **`services/core-v2/README.md`**, following the repo's other package READMEs. A stranger should
   get from clone to a working chat. Cover: what the service is (one endpoint, no database, on
   purpose), how to run it, the four tools, how the token forwarding works, and how to run the
   tests with no API key.
4. **Clean up.** `scripts/ask_copilot.py` and `scratch/` — keep `ask_copilot.py`, it's a genuinely
   useful debug tool and demoing the agent without the browser is a good fallback. `scratch/`
   should be gitignored or gone.
5. **Update `docs/REBUILD-LOG.md`** — a dated entry for the Copilot rail. That's the repo's
   convention and this is a real architectural addition.

### Done when

- `nx run corev2:verify` green.
- Someone else could follow the README.

---

## Day 13 — the write-up

No new code. One page, in `services/core-v2/README.md` or beside it.

Cover, in your own words, not copied from the plan:

1. **The architecture** — why Python owns only the agent, why no database, why the tools call v1
   over HTTP. Include the diagram from plan §1 or draw a better one.
2. **The approval-vs-authorization distinction** (plan §8 answer #1). If you write one thing
   carefully, this.
3. **The permission-inheritance property** (answer #2) — the agent forwards the caller's token and
   gains nothing.
4. **What you'd do differently** (answer #5) — the HTTP hop, and the missing eval harness.
5. **The scope cut itself.** You cancelled a backend port to ship one feature properly. Written
   down as a deliberate trade with a stated cost, that reads as judgment. Say what it cost:
   no async SQLAlchemy, shallow `Depends`.

---

## Day 14 — rehearsal

**No new code. None. Not even a small fix** — a demo that broke because of a day-14 tweak is a
bad story, and there's no time to recover.

1. **Cold run, twice.** Closed laptop → running demo. Time it. It should be under 90 seconds to the
   first rendered calendar.
   - Both services up (`:8080`, `:8090`), web on `:5000`/`:5001`, flag on.
   - Signed in, an org with real events, **a throwaway event created specifically to cancel.**
   - Ask "what's coming up?" → calendar renders.
   - Ask about one event → summary card.
   - Ask to cancel the throwaway → card appears → **deny it.** Show it survived. *Then* confirm.
2. **Say the five answers in plan §8 out loud.** Out loud, not in your head — the gap between
   "I understand this" and "I can say this" is where interviews are lost. Twice each.
3. **Rehearse the honest one:** you didn't write async SQLAlchemy, you cut the port on purpose,
   here's why. Practise saying it without apology.
4. **Have a fallback.** If the network or the model provider is down live: `ask_copilot.py` output
   saved to a file, plus a screen recording of the full demo. Record it on day 13.

### Done when

- Two clean cold runs.
- Five answers, out loud, without notes.
- A recording exists.
