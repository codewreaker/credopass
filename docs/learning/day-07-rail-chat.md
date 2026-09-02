# Day 7 — the rail becomes a chat

Status: not started · plan: [`AI-SIDEBAR-PLAN.md`](../AI-SIDEBAR-PLAN.md) §1, §7

**Milestone day, and the riskiest one.** First React, first auth wiring across the boundary, first
CopilotKit. Plan §7 flags it as the single biggest step; day 6's `curl` rehearsal exists to make
today only-React.

By tonight the right-hand rail of the real app is a working chat. Plain text answers only —
the calendar rendering is tomorrow. **If days 8–10 collapse entirely, this is still a demo.**

## Objectives

By the end of today you can:
- Point at a chat panel in the real CredoPass app streaming a real answer about real events.
- Say what CopilotKit is doing for you and what it isn't — it's a React client for AG-UI, not a
  framework your agent has to know about. The Python side is unchanged today.

## New today

- [CopilotKit × Pydantic AI](https://docs.showcase.copilotkit.ai/pydantic-ai) — this exact pairing.
  Prefer it over the generic CopilotKit docs, which cover several backends and bury the one you have.
- [`useAgent`](https://docs.copilotkit.ai/reference/hooks/useAgent) — the hook that sits directly on
  AG-UI, if the prebuilt chat needs escaping.
- **Repo shape, read before writing:** `apps/web/src/containers/RightSidebar/index.tsx` — it
  switches on `viewedItem` between `OverviewView` and `ProfileView`. You're adding a third view.
  Match that shape; don't invent a new container pattern.
- `apps/web/src/contexts/session.tsx` — `useSession` for the token, `useCan` for the gate.
- `packages/api-client/src/active-organization.ts` — the org id for the header and for
  `CopilotState`.

## Hands-on task

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

## Done when

- Signed in to the real app with the flag on: open the rail, ask "what events do I have coming
  up?", watch the answer stream in token by token.
- The network tab shows the SSE stream and the forwarded headers.
- The flag off → the old calendar rail, unchanged. Verify this; it's the blast-radius claim.

## If it fights you

Plan §7's risk table, condensed, because today is when these bite:

- **`@copilotkit/react-core/v2` imports don't resolve** → v2 is new. Check the installed version's
  exports before assuming your code is wrong. If v2 is unstable, fall back to the AG-UI React
  client directly — more code, same protocol. **Half a day maximum, then fall back.**
- **CORS** → should be done (day 5). If not, that's `services/core-v2`, not React.
- **401s** → is the browser token actually reaching Python? Log the header server-side once, then
  remove the log. Never log the token's value.

## Retro

- How long the CopilotKit wiring actually took:
- Anything about v2 that differed from the docs:
- Carry into day 8:
