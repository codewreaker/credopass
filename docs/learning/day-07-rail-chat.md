# Day 7 — the rail becomes a chat

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §1, §7

**Milestone day, and the riskiest one.** First React, first auth wiring across the boundary, first
CopilotKit. Day 6's `curl` rehearsal exists to make today only-React.

By tonight the right-hand rail of the real app is a working chat. Plain text answers only — the
calendar rendering is tomorrow. **If days 8–10 collapse entirely, this is still a demo.**

## Objectives

By the end of today you can:
- Point at a chat panel in the real CredoPass app streaming a real answer about real events.
- Say what CopilotKit is doing for you and what it isn't — it's a React client for AG-UI, not a
  framework your agent has to know about. The Python side is unchanged today.

---

# Learn

No new protocol today — this is wiring. Keep day 5's event vocabulary handy for reading the
network tab.

## What CopilotKit is, and isn't

It's a **React client for AG-UI**. Your Python side is unchanged today: the agent doesn't know
CopilotKit exists, and would work identically against a hand-written client. What you get is the
prebuilt chat UI, the streaming plumbing, and (days 8 and 10) the hooks that bind components to
tool names.

That boundary matters for the interview: you understand *the protocol*, and you chose not to spend
a week rebuilding a chat UI that teaches nothing about it.

## Docs

- [CopilotKit × Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai) — this exact pairing.
  Prefer it over the generic CopilotKit docs, which cover several backends and bury the one you have.
- [`useAgent`](https://docs.copilotkit.ai/reference/hooks/useAgent) — sits directly on AG-UI, if
  the prebuilt chat needs escaping.

## Repo shape — read before writing

- `apps/web/src/containers/RightSidebar/index.tsx` — switches on `viewedItem` between
  `OverviewView` and `ProfileView`. You're adding a third view. Match that shape; don't invent a
  new container pattern.
- `apps/web/src/contexts/session.tsx` — `useSession` for the token, `useCan` for the gate.
- `packages/api-client/src/active-organization.ts` — the org id, for the header and for
  `CopilotState`.

---

# Build

**Mode A — worked example (I write this):** the provider + `<CopilotChat>` wiring with the custom
headers attached, ~20 lines. The headers-on-the-agent-connection part is the fiddly bit and it's
badly documented; you shouldn't lose an afternoon to it.

**Mode B — you write:**

1. `bun add @copilotkit/react-core @copilotkit/react-ui` in `apps/web`.
2. **`apps/web/src/containers/Copilot/`** — a `CopilotView` rendering `<CopilotChat>`, pointed at
   `http://localhost:8090/api/v2/agent/organizer-copilot`, sending:
   - `Authorization: Bearer <token from useSession>`
   - `X-Organization-Id: <active org>`
   - AG-UI `state`: `{ active_organization_id, active_event_id }` — the day-6 contract, now real.
3. **Wire it into `RightSidebar`** as the default view, replacing `OverviewView`. Keep
   `OverviewView` in the tree — behind the flag being off, it's the fallback, and you may want the
   calendar back beside the chat later.
4. **Gate it:** `VITE_COPILOT_ENABLED` off by default (plan §1 — never wired into prod), plus
   `useCan` the same way `/account?tab=members` gates member management.
5. Style it enough to not embarrass the demo. **Time-box this to 30 minutes.** The rail is dark,
   narrow and lime-accented; `<CopilotChat>` ships light and wide. Get it legible, stop there — no
   one is interviewing you on chat bubble padding.

---

# Done when

- Signed in to the real app with the flag on: open the rail, ask "what events do I have coming
  up?", watch the answer stream in token by token.
- The network tab shows the SSE stream and the forwarded headers.
- The flag off → the old calendar rail, unchanged. Verify this; it's the blast-radius claim.

---

# If it breaks

Today is when these bite, so they're here rather than in the plan's risk table.

| Looks like | Actually is |
|---|---|
| `@copilotkit/react-core/v2` imports don't resolve | v2 is new. Check the installed version's exports before assuming your code is wrong. **Half a day maximum**, then fall back to the AG-UI React client directly — more code, same protocol. |
| Browser blocked, `curl` fine | CORS. Should be done on day 5. `:5000` **and** `:5001` (AirPlay). |
| 401 from Python | Is the browser token reaching it? Log the header's *presence* server-side once, then remove the log. Never log the value. |
| Chat renders, nothing streams | Wrong endpoint URL, or the response isn't being treated as a stream. |
| Old calendar gone with the flag off | The flag isn't actually gating — that's the blast-radius claim broken. |

---

# Say it out loud

> "CopilotKit is a React client for AG-UI — the agent doesn't know it exists and would work
> against any client speaking the protocol. I used the prebuilt chat deliberately: the
> interview-relevant depth is the protocol and the agent, not rebuilding a streaming chat UI."

---

## Retro

- How long the CopilotKit wiring actually took:
- Anything about v2 that differed from the docs:
- Carry into day 8:
