# n8n: evaluated, and mostly declined

> **Question asked:** exercising `/events` by hand is tedious — mint a token, create an org, create a
> membership, create events at several times, create people, create attendance, then look. Would an
> n8n instance on the Coolify box turn that into repeatable workflows?
>
> **Status:** decision document, no code written · **Date:** 2026-07-26

---

## Recommendation

**No for development and testing. Not yet for scheduled jobs. Probably yes, much later, for
customer-facing integrations — and by then the right shape is most likely "we publish webhooks and the
customer brings their own n8n", not one we host.**

The problem being solved is real, but it is a scripting problem, and the repo already has every part
needed to solve it properly. Three changes, perhaps a day's work in total, remove the friction
entirely and produce artefacts that are typechecked, reviewable in a pull request, and runnable in
CI — none of which an n8n workflow is.

| Use | Verdict | Why |
|---|---|---|
| Seeding + exercising the API in development | **No** | Cheaper and stronger in-repo. §2, §3 |
| Integration / regression testing | **No** | Weaker than the contract harness that already exists. §2.3 |
| Scheduled jobs (D-E no-shows, D3 materialisation) | **Not yet, and probably not n8n** | `POST /internal/jobs/{name}` already holds the logic; a cron is one line. §5.1 |
| Stripe webhooks | **No, actively wrong** | Signature verification and the state change belong in one transaction. §5.2 |
| Transactional email | **No** | D18 makes delivery state a table we own. §5.2 |
| Customer integrations ("check-in → Mailchimp") | **Yes, eventually** | Genuinely an integration problem. Blocked on Phase 4. §5.3 |

---

## 1. The decisive fact: the workflows cannot be built

The API has **23 operations**, and only six of them write:

```
POST   /organizations
POST   /organizations/{id}/invitations
DELETE /organizations/{id}/invitations/{invitationId}
POST   /invitations/{token}/accept
PATCH  /organizations/{id}/members/{accountId}
DELETE /organizations/{id}/members/{accountId}
```

There is no `POST /events`. No `POST /people`. No `POST /events/{id}/register` or `/check-in`. Those
are Phase 3 ([§11](API-FIRST-REBUILD.md#phase-3--write-paths-and-local-first-deleted)); `src/api/v1/core/events.ts`
and `people.ts` are read-only today, which the log records as deliberate.

So the "create an event" workflow the question imagines cannot be written against the API. It would
have to write to Postgres directly — at which point it is a seed script with a browser GUI in front of
it, running on a different machine, unable to import the Drizzle schema that is the repo's single
source of truth.

That alone settles the development case. The rest of this document explains why it would still be the
wrong answer after Phase 3 lands.

---

## 2. What n8n would have to beat

### 2.1 The friction is three named things, not a general problem

Walking the current path end to end, the tedium is entirely accounted for by:

| Friction | Where it comes from |
|---|---|
| Mint a token, copy it, paste it into Scalar's auth box | `scripts/dev-token.ts` prints to stdout and stops there |
| After seeding you are a member of nothing | `src/db/seed.ts:175-182` closes by telling you to run a raw `INSERT` against `org_memberships` |
| Multi-step data with dependencies between steps | No scripted scenario exists; Scalar is one call at a time by design |

None of these is an integration problem. The second is the seed script printing SQL instead of running
it. That is a bug in the developer experience of a file we own, and the fix is in that file.

### 2.2 n8n gives nothing the repo lacks

The comparison that matters is against what is already installed, not against curl.

| Capability | Already have | n8n adds |
|---|---|---|
| Interactive single call, with schema and auth | Scalar at `/api/v1/core/docs` (D14) | Nothing |
| Repeatable fixture data | `nx run coreservice:seed` — two orgs, every derived status, attendance in every state | Nothing, and it cannot reach the schema |
| Ordered multi-step HTTP sequence with assertions | `src/test/support/actors.ts` — `request()` with actor identity, `X-Organization-Id`, idempotency keys | A GUI for the sequence, **minus** the assertions |
| Response validated against the emitted spec | `src/test/contract.ts` — every response, every test, ajv against OAS 3.1 | Nothing; an HTTP node checks a status code |
| Real Postgres, migrations from empty, RLS | `src/test/support/database.ts`, Testcontainers | Nothing |
| Runs in CI on every pull request | `.github/workflows/ci-api.yml`, two blocking jobs | **Cannot.** Workflows live in n8n's own database |

The last row is the important one. A regression suite that only runs when someone opens a browser and
presses a button is not a regression suite.

### 2.3 It is a *weaker* check than what exists

An n8n HTTP Request node knows a URL, a method and a JSON body. It does not know the response schema.
It will happily go green against a response that dropped a field, renamed `counts.attended`, or
started returning `{ error }` instead of RFC 9457 — the exact regressions the contract harness was
built to catch.

Meanwhile `scripts/scenario.ts` written with `openapi-fetch` (already the choice in
[D14](API-FIRST-REBUILD.md#d14-new--scalar-for-docs-openapi-fetch-for-the-client)) makes a renamed
field a **compile** error, before the request is ever sent.

### 2.4 The drift tax, against an API changing weekly

The repo's central discipline is that the contract is generated, never hand-maintained — golden rule
3 in the log, and §5's whole premise. n8n workflows are JSON blobs in n8n's database, authored in a
browser, versioned by n8n. They would be the one artefact in the system that is hand-written,
untypechecked, invisible to `nx affected`, and stale the moment a Zod schema changes. Phase 2 alone
added six endpoints and renamed the base path from `/api/v1` to `/api/v1/core`; every workflow would
have broken silently, discoverable only by running it.

This is precisely the failure mode the plan cites for the old hand-written OpenAPI document. Building
a second one, in a second system, while the API changes weekly, is a step backwards.

---

## 3. The alternative, in the same detail

Three changes, in order of value per hour. All in `services/core`, all typechecked, all in git.

### 3.1 `nx run coreservice:seed` should leave you able to use the API

The seed currently ends by printing SQL for the reader to run. Instead it should do that step:

- mint a token through the same anonymous sign-in path `scripts/dev-token.ts` already uses (a real
  token through the real auth path — the existing comment is right that a "skip auth" switch is how
  the auth path becomes the least-exercised code in the product);
- resolve the account it belongs to, insert the owner membership for `kharis-church`, and print an
  `export CREDOPASS_TOKEN=…` line plus the org id, ready to paste.

Roughly thirty lines in a file that already exists. It removes the single most annoying step, and it
removes a hand-written `INSERT` from a document a newcomer will copy.

Keep the flag opt-in (`--join`) so the plain seed stays purely data.

### 3.2 `services/core/scripts/scenario.ts` — the thing that actually replaces the n8n idea

A scripted walk over the real HTTP surface. Shape:

```
nx run coreservice:scenario onboard        # sign in → POST /organizations → GET /me/context
nx run coreservice:scenario events         # + events across every derived status, then GET /events,
                                           #   /events/summary, /events/calendar; print the table
nx run coreservice:scenario attendee-walk  # §12.3a, once Phase 3 lands: register → pass → check-in
                                           #   → claim → /me/tickets, across three isolated clients
```

Properties that matter, each of which n8n lacks:

- **Typed against the spec.** `openapi-fetch` over `openapi.json`, so a contract change fails at
  `nx run coreservice:typecheck` rather than at runtime in a browser tab.
- **Real HTTP, real auth, real tenancy headers** — not in-process, so it exercises middleware, CORS
  and the `X-Organization-Id` rules the way a client does.
- **Prints each step** — method, path, status, the interesting field — so it doubles as the "show me
  what `/events` does" tool the question was really asking for.
- **Assertable.** The same file can be pointed at CI as a smoke test against a deployed instance.
- **One place to fix** when an endpoint moves.

`attendee-walk` deserves emphasis: §12.3a already specifies that scenario step by step, including the
three-client isolation that proves the pass is durable rather than session-bound. Writing it as a
script now means Phase 3 lands with its acceptance test already written — the same discipline that
made the adversarial suite red-before-green.

### 3.3 `services/core/requests.http` — optional, and only for the one-off case

A `.http` file costs nothing, lives in git and works in VS Code and JetBrains without a server. But be
honest about the overlap: Scalar already covers "poke one endpoint with auth and a schema in front of
me", and §3.2 covers "run the same seven calls again". A `.http` file sits between them and is
strictly better than neither. Add it if it helps; do not count it as a deliverable.

**Why this is better, stated plainly.** It is less code than a Coolify deployment, it cannot drift
from the contract without failing a typecheck, it runs in CI, it is reviewed in pull requests
alongside the endpoints it exercises, and it holds no long-lived credential anywhere.

---

## 4. The security objection, which is not hypothetical

Phase −1 of this rebuild was "the database was publicly writable, confirmed live". That is recent
enough to weigh heavily on any proposal to stand up another internet-facing service holding
broad-permission credentials.

An n8n instance able to do what the question describes must hold a credential equivalent to an
organisation **owner**, long-lived, and it must hold it at rest. Concretely:

- **n8n's Code node executes arbitrary JavaScript by design**, and community nodes execute arbitrary
  npm packages. That is the product working correctly, and it means the blast radius of any
  authentication weakness on the n8n UI is the credential store behind it.
- **Execution history persists request and response bodies by default.** Every attendee record the
  workflow touched — names, email addresses — is copied into n8n's own Postgres, outside the RLS
  policies, the tenancy scoping and the migration discipline that the rest of this work exists to
  build. A second uncontrolled copy of personal data is not a small thing for a product whose
  customers include churches and support groups (§5.10's reasoning about `resend-pass` applies with
  more force here).
- **Pointed at production it bypasses nothing, because it *is* an owner.** Tenancy protects tenants
  from each other; it does not protect anyone from a credential we handed out.

For a *development* instance against a local database, none of this is fatal. But a development-only
n8n is one that must never be reachable from the internet — which removes most of the reason to host
it on Coolify rather than run a script locally.

### 4.1 A real gap this exposes, independent of n8n

§5 defines three caller kinds: 👤 account JWT, 📟 device token, ⚙️ system/cron. **Only the first two
have a stated credential mechanism.** `POST /internal/jobs/{name}`, `POST /events/{id}/close` and
`POST /event-series/{id}/materialise` are all marked ⚙️, and nothing in the plan says what a ⚙️ caller
presents.

Device tokens are not the answer — D9 scopes them to `checkin:record` on exactly one event, correctly
and deliberately. A Supabase JWT is not the answer either; it expires in about an hour and belongs to
a human.

So **the API design is missing a service-account or machine-credential concept**, and it will need one
in Phase 4 regardless of what happens with n8n. Worth capturing as a decision (a `D` entry) before
Phase 4 starts: probably a signed, revocable token bound to a fixed permission set and no tenant, or
an org-scoped API key with an explicit permission list. Whatever it is, designing it under pressure
because a scheduler needs it is how these end up over-privileged.

---

## 5. Where n8n would actually earn its keep

### 5.1 Scheduled jobs — n8n can, but should not be the first answer

D-E no-show finalisation and D3 series materialisation both need something to fire on a schedule.
But §5.11 already puts the logic behind `POST /internal/jobs/{name}`, so the scheduler's entire job is
to make one authenticated POST on a cron. Candidates:

| Option | Cost | Gives you |
|---|---|---|
| Coolify scheduled task | one config field | The POST |
| GitHub Actions `schedule` | six lines of YAML | The POST, plus history in a place already watched |
| Cloud Scheduler / systemd timer | minutes | The POST |
| **n8n** | a service, a database, a licence to think about | The POST, plus retries with backoff, execution history and failure alerting |

n8n's extras are real, not imaginary — a cron that fails silently is a genuine operational hazard. But
they are not worth a new service when the alternative is a config field, and job idempotency has to be
solved in the API anyway (§12.2 lists "scheduler idempotency" as a Phase 4 test). Revisit if the job
list grows past a handful and their failure modes start needing per-step retry.

### 5.2 Stripe webhooks and email — no, and it is worth being firm

Both are already designed as things the API owns, correctly.

`POST /webhooks/stripe` is signature-verified (§5.11, D15). Routing it through n8n means either
forwarding a raw body carefully enough that the signature still verifies downstream, or verifying it
in a Code node — moving the most security-sensitive parsing in the system into an untypechecked
JavaScript snippet in a database. The entitlement change also has to be transactional with the
webhook's own idempotency record; that transaction lives in Postgres next to the service.

Email is worse. D18 makes delivery infrastructure with an `email_deliveries` table, idempotency and
suppression, and §12.3a asserts on a `queued` row. Putting a "fallback" sender in n8n gives two
systems partial knowledge of whether a pass was delivered, which is the state you least want when a
customer says they never got their ticket.

### 5.3 Customer-facing integrations — the genuinely strong case

"When someone checks in, add them to my Mailchimp list." That is an integration problem by definition,
it is product surface rather than internal tooling, and it is a plausible reason for a church
administrator to choose CredoPass over a spreadsheet. This is what n8n is for.

It is also blocked on work that does not exist yet: D4's domain event table, Phase 4's event bus, and
an outbound webhook surface (which §5 does not currently define — worth noting, since customer
integrations of any kind need it, n8n or otherwise).

When it does arrive, there are two shapes, and the cheaper one is probably right:

| Shape | Cost | Note |
|---|---|---|
| **Publish signed outbound webhooks. Customers bring Zapier, Make or their own n8n.** | The webhook surface, which is needed anyway | Nothing to host, nothing to license, no customer credentials held. Start here. |
| **Embed n8n as the automation engine inside the product.** | Hosting, multi-tenant isolation of workflows, and an n8n embed licence — the Sustainable Use Licence does not cover offering it as part of a product | Only if "no-code automation" becomes a thing customers buy CredoPass *for*. |

### 5.4 Internal ops runbooks — plausible, later

Bulk-importing a customer's CSV of attendees, sending a one-off announcement, re-issuing passes after
a venue change. These are one-off internal flows where a GUI genuinely helps and where the caller is
staff rather than code. Reasonable to revisit once the write endpoints exist and there are real
customers to run them for. Not now: the write endpoints do not exist, and there is one tenant.

---

## 6. If it is stood up anyway

For a **development-only** instance, kept off the public internet:

- Docker Compose on Coolify: the `n8nio/n8n` image, its own Postgres (never the CredoPass database),
  a persisted `/home/node/.n8n` volume, and `N8N_ENCRYPTION_KEY` set explicitly and backed up — lose
  it and every stored credential is unreadable.
- `N8N_BASIC_AUTH_ACTIVE` is not sufficient on its own. Put it behind the Coolify proxy with an IP
  allow-list or an authenticating proxy, and give it no public DNS record.
- `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` and a short `EXECUTIONS_DATA_MAX_AGE`, to limit how much
  attendee PII accumulates in n8n's database.
- Authentication against `/api/v1/core`: there is nothing appropriate today (§4.1). The least-bad
  interim is a Supabase refresh token in n8n credentials with a refresh step at the head of every
  workflow — ugly, and a reason to treat §4.1 as the prerequisite it is.
- Export workflow JSON into the repo on every change, or accept that the workflows are not backed up
  and not reviewed.

Maintenance, honestly: the container and its Postgres are near-zero once running. The cost is
workflow drift — an unbounded, recurring tax for as long as the API changes weekly, paid in confusing
failures rather than in build errors.

---

## 7. When to revisit

Reopen this when **any** of these is true, and not before:

1. Phase 4 has landed a domain event bus and an outbound webhook surface, and a customer has asked for
   an integration by name.
2. The scheduled-job list has grown past a handful and cron failures are being noticed late.
3. Staff who do not write TypeScript need to run operational flows against real customer data.

Until then the answer to "exercising `/events` is tedious" is `scripts/scenario.ts` and a seed script
that finishes the job it starts.
