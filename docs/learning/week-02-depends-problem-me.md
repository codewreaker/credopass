# Week 2 — Depends, ProblemError, JWT verification, /me

Status: not started

## Objectives

By the end of this week you can:
- Explain what a FastAPI `Depends` actually does at request time — not just reproduce the syntax,
  but say what FastAPI calls, when, and what it does with the return value.
- Write a pytest test against a FastAPI app using `httpx.AsyncClient`, no browser involved.
- Explain why `ProblemError`'s "generic detail unless dev mode" rule exists (`problem.ts`), and
  reproduce the equivalent in Python.
- Explain why building the JWT-verification dependency as an `HTTPBearer` subclass (rather than an
  ad-hoc header-parsing function) gets you OpenAPI security-scheme documentation for free — plan
  §1's OpenAPI-parity note, confirmed against FastAPI's own docs.

## New this week (read before starting)

**FastAPI:**

- [Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) — the whole section, it's
  short. Then [dependencies with `yield`](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/),
  which is how the per-request DB session gets opened and closed; it's the Python shape of what
  middleware does in Hono.
- [Security — First Steps](https://fastapi.tiangolo.com/tutorial/security/first-steps/) and
  [OAuth2 with JWT](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/). Read the JWT page
  for the `HTTPBearer`/`SecurityBase` mechanics and how it lands in `/docs`, **not** for its
  token-*issuing* half — CredoPass doesn't issue tokens, Supabase does. You're only verifying.
- [Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/) — specifically
  `@app.exception_handler(...)`, the FastAPI counterpart to v1's `v1.onError()`.
- [Testing](https://fastapi.tiangolo.com/tutorial/testing/) then
  [Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/) — the second one is the pattern
  you actually want (`httpx.AsyncClient` + `ASGITransport`, in-process, no live server).
  Reference: [httpx async docs](https://www.python-httpx.org/async/),
  [pytest-asyncio](https://pytest-asyncio.readthedocs.io/en/latest/).

**JWT / JWKS — plan §9 flags this as an easy-to-underestimate yak; budget for it:**

- [Supabase — JWTs](https://supabase.com/docs/guides/auth/jwts) and
  [signing keys / JWKS](https://supabase.com/docs/guides/auth/signing-keys) — what's actually in
  the token you'll be verifying, and where the public keys come from.
- [PyJWT usage — retrieving RSA signing keys from a JWKS endpoint](https://pyjwt.readthedocs.io/en/stable/usage.html)
  — `PyJWKClient` does the fetching and caching. Read this before hand-rolling a JWKS fetch;
  it's most of the job already done.
- Compare what you find there against what `caller.ts` + `identity/issuer-registry.ts` verify on
  the TS side — same claims, same issuer check, different library.

**SQLAlchemy (engine/session only this week):**

- [SQLAlchemy 2.0 ORM Quick Start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html) — just
  the engine/session parts; the `Mapped`/`mapped_column` modeling itself is week 3's material.
- [SQLAlchemy asyncio extension](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) —
  `create_async_engine` / `async_sessionmaker` / `AsyncSession`. **Use this, not FastAPI's own SQL
  tutorial**, which is SQLModel and synchronous (plan §7). Copying that one gives you blocking DB
  calls inside `async def` handlers.

**The TypeScript you're porting** — re-read these directly, don't summarize from memory:

- `services/core/src/http/problem.ts:105-136` (the `ProblemError` class and the `problem` factory).
- `services/core/src/middleware/caller.ts:53-95` (`requireCaller`).

## Hands-on task

**Mode A — worked example (I write this, ~20 lines, throwaway):** a minimal `Depends` chain
unrelated to CredoPass — request → dependency → handler — so the mechanics are clear before you
touch anything real.

**Mode B — you write, tests + spec provided:**
1. **`ProblemError` port.** Spec: same closed code enum as `problem.ts` (`VALIDATION_FAILED`,
   `UNAUTHENTICATED`, `NOT_FOUND`, etc.), same RFC 9457 body shape, same dev-mode-only detail
   leak-avoidance. I write the tests (including one asserting a raised internal exception never
   leaks its message in production mode); you implement the exception class and the FastAPI
   exception handler.
2. **`get_current_account` dependency.** Spec: verify a Supabase-issued JWT via JWKS (RS256),
   resolve to an account — a Python port of `requireCaller`'s token-verification half (not the
   auto-provisioning half; that's tenancy, week 3). Build it as an `HTTPBearer` subclass so the
   OpenAPI security scheme registers automatically. I write tests for: valid token → account,
   expired token → 401, malformed token → 401, wrong issuer → 401 (all flat 401s, deliberately
   non-specific, matching `caller.ts`'s stated reasoning).
3. **Port `me.ts`** (`GET /me`, `GET /me/context` — 2 routes) using the dependency above.

## Done when

- `uv run pytest` is green on this week's test file, no network calls except to the local
  `credopass_v2_dev` DB.
- `GET /api/v2/core/me` with your real CredoPass browser session token returns your real account.
- `/docs` shows an "Authorize" button and a lock icon on both `/me` routes, without you having
  manually registered a security scheme anywhere.

## Retro (fill in at the end)

- What was harder than expected:
- Fundamentals gap surfaced, if any:
- Carry into week 3:
