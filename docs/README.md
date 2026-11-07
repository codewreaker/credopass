# CredoPass docs — start here

**Last reviewed: 2026-11-06.**

Three questions, three files. Everything else is reference.

| Question | File |
|---|---|
| **What is true right now?** | [`../CLAUDE.md`](../CLAUDE.md) — the system as it stands, and the rules that break the build if you ignore them. |
| **What has been done?** | [`REBUILD-LOG.md`](REBUILD-LOG.md) — the record, newest entry last. **It wins over every plan.** |
| **What is left, and in what order?** | [`ROADMAP.md`](ROADMAP.md) — the one ordered plan. §2 below is the same list, unordered. |

---

## 1. The rule that keeps this directory honest

> **A plan describes work that has not happened. The moment it ships, it moves to
> [`archive/`](archive/) and the outcome is written in [`REBUILD-LOG.md`](REBUILD-LOG.md).**

A shipped plan left in `docs/` is worse than no document: it is written in the present tense about a
system that has moved, and it reads as current. `API-SECOND-REBUILD.md` spent months opening with
*"the web app currently does not compile — 18 files import modules that no longer exist"*, which had
been false for just as long.

So: if a file in `docs/` is not in the table below, it should not be there.

---

## 2. What is left — the whole of it, one line each

Nothing is "in progress" unless someone is actually working on it today.

> **Sequenced in [`ROADMAP.md`](ROADMAP.md)** (2026-11-07), which also carries the maintainer's
> testing feedback as items F1–F13 and decisions D39–D42. Read that for the order; read this for
> the inventory.

### Open now

| | Work | Where it is specified | Size |
|---|---|---|---|
| 🔴 | The composer shows "No organization" as a loading state | [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) §5.2 | S |
| ⬜ | RLS is inert on the API path — the API connects as `postgres` and bypasses it | [`DATABASE-MIGRATION.md`](DATABASE-MIGRATION.md) §6 · [`ROADMAP.md`](ROADMAP.md) stage 5g | M |
| ⬜ | No data migration from the pre-rewrite `users` table | [`DATABASE-MIGRATION.md`](DATABASE-MIGRATION.md) §5.4 · [`ROADMAP.md`](ROADMAP.md) stage 5g | M |
| ⬜ | `/analytics` draws the full dashboard from placeholder numbers, under a "these are made up" banner | [`ROADMAP.md`](ROADMAP.md) stage 5c (was U1) | S |
| ⬜ | QR scan check-in is reported broken, never reproduced | [`ROADMAP.md`](ROADMAP.md) stage 2 (was U2) | M |
| ⬜ | A check-in does not reach other screens — polling, then SSE | [`LIVE-UPDATES.md`](LIVE-UPDATES.md) | M→L |
| ⬜ | No email exists. Pass and invitation links must be shown on screen | [`archive/API-FIRST-REBUILD.md`](archive/API-FIRST-REBUILD.md) D18 | M |
| ⬜ | Account linking: two provider identities for one email get two accounts | [`../CLAUDE.md`](../CLAUDE.md) gotchas | — decision first |

### Planned, not started

| | Work | Where it is specified |
|---|---|---|
| ⬜ | Online events, optional location, offline handling, posters, first-run, chat panel | [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) §5 |
| ⬜ | The paid public API, webhooks, test mode, `pii_mode` | [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) Parts A |
| ⬜ | Phases 4–7: domain events, recurrence, media, real analytics, enterprise SSO | [`ROADMAP.md`](ROADMAP.md) stages 3–4 · [`archive/API-FIRST-REBUILD.md`](archive/API-FIRST-REBUILD.md) phase map |
| ⬜ | The AI chat panel — `services/ai-chat` (pydantic-ai) + an AG-UI client in the web app | [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) §5.7 |

Legend: 🔴 confirmed bug · 🟡 in progress · ⬜ not started · S ≤ ½ day · M 1–3 days · L a week+

---

## 3. Every file, and whether to trust it

### Live — read these

| File | What it is | Trust |
|---|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | The system now, and the golden rules | **Authoritative** |
| [`REBUILD-LOG.md`](REBUILD-LOG.md) | What happened, in order | **Authoritative — wins over any plan** |
| [`DATABASE-MIGRATION.md`](DATABASE-MIGRATION.md) | How to change the schema; local, test and remote | Reference, current |
| [`STORAGE.md`](STORAGE.md) | **Object storage** — how S3 and presigned uploads work, how to provision the production bucket, and the gotchas | Reference, current |
| [`RECURRING-EVENTS.md`](RECURRING-EVENTS.md) | **Recurring events: paused.** Why, every edge case (DST, clocks going back, the fifth Sunday, the horizon), and which libraries to use | **Read before rebuilding it** |
| [`ROADMAP.md`](ROADMAP.md) | **The ordered plan** — six stages, the 2026-11-07 feedback as F1–F13, D39–D42 | **Plan — start here** |
| [`NEXT-PHASE-PLAN.md`](NEXT-PHASE-PLAN.md) | Public API, data ownership, product backlog. D31–D38 | Plan; B1 shipped, rest not built |
| [`UI-REDESIGN.md`](UI-REDESIGN.md) | The measured 375×812 walk of all 20 routes. R1–R7 | Evidence; R1 and R4 shipped |
| [`LIVE-UPDATES.md`](LIVE-UPDATES.md) | Why a check-in doesn't reach other screens. D27–D30 | Plan |

### Archived — kept for the decision record

| File | Shipped |
|---|---|
| [`archive/API-FIRST-REBUILD.md`](archive/API-FIRST-REBUILD.md) | Phases −1 to 3.5. **4–7 have not shipped** — they are in [`ROADMAP.md`](ROADMAP.md). **D1–D26 live here** and ~40 source files cite it by section |
| [`archive/API-SECOND-REBUILD.md`](archive/API-SECOND-REBUILD.md) | Moving the web app onto `/api/v1/core` |
| [`archive/API-THIRD-REBUILD.md`](archive/API-THIRD-REBUILD.md) | The sign-up funnel; guest tier and device tokens deleted. **D20–D26 live here** |

### Deleted, and why — so nobody goes looking

| File | What happened |
|---|---|
| `GUEST-ONBOARDING.md` | Superseded by the sign-up funnel; the guest tier it assumed no longer exists. Deleted 2026-07-27. |
| `MULTI-TENANCY.md` | A patch plan for the pre-rewrite system. Every phase done; it described deleted files. |
| `MVP-READINESS.md` | Its sole P0 was the tenancy work above. |
| `.claude/commands/rebuild-api.md` | The brief that produced `API-FIRST-REBUILD.md`. Running it again would plan a rebuild that has happened. Deleted 2026-11-06. |
| `NEXT-UI-LIST.md` | U5, U6, U7 and U8 shipped; U1–U4 and the platform table were absorbed into [`ROADMAP.md`](ROADMAP.md) §1 and stages 1, 2 and 5. Deleted 2026-11-07. |
| `PYTHON-LEARNING-PLAN.md`, `LEARNING-WORKFLOW.md`, `learning/` | The eight-week Python curriculum, and the `/api/v2/core` port it was built around. Scope cut: the AI feature is being built as `services/ai-chat` on its own terms, not as a teaching vehicle. `services/core-v2`, `credopass_v2_dev` and `docker/initdb/` went with them. Deleted 2026-11-06. |

All of them are in git history if the reasoning is ever wanted.

---

## 4. Package READMEs

Scoped to their own directory and maintained with it — not plans, and not listed above:
[lib](../packages/lib/README.md) · [api-client](../packages/api-client/README.md) ·
[ui](../packages/ui/README.md) · [ui-mobile](../packages/ui-mobile/README.md) ·
[web](../apps/web/README.md) · [mobile](../apps/mobile/README.md) ·
[website](../apps/website/README.md) · [core](../services/core/README.md) ·
[docker](../docker/README.md) ·
[workflows](../.github/workflows/README.md)

---

## 5. When you finish a piece of work

1. Add an entry to [`REBUILD-LOG.md`](REBUILD-LOG.md) — what was built, what was decided
   differently, what broke.
2. Tick or delete its row in §2 above.
3. If a plan document is now fully shipped, `git mv` it to [`archive/`](archive/), add the archived
   banner, and record it in §3.

Three steps, and this file stays true. Skip them and it becomes the thing it was written to replace.
