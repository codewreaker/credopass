# Week 3 — SQLAlchemy modeling, tenancy resolution, organizations.ts

Status: not started

## Objectives

By the end of this week you can:
- Explain `Mapped`/`mapped_column` vs. old-style `Column(...)` SQLAlchemy declarations, and why
  the new style type-checks under `pyright`/`mypy` where the old one didn't.
- State, from memory, the header → path-param → sole-membership tenancy resolution order, and the
  403-vs-404 split, with a concrete example of each — the single highest-value piece of business
  logic in this whole project (plan §1).
- Point at `organizations.ts`'s 12 routes, ported and passing, including cross-tenant tests.

## New this week (read before starting)

- [SQLAlchemy 2.0 ORM Quick Start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html), the
  modeling sections (`Mapped`, `mapped_column`, relationships).
- [What's New in SQLAlchemy 2.0](https://docs.sqlalchemy.org/en/20/changelog/whatsnew_20.html) —
  read the ORM-declarative and typing sections. This is the doc that explains *why* `Mapped[str]`
  exists, which is this week's first objective; almost every SQLAlchemy tutorial you'll find via
  search is still 1.x-style `Column(...)`, and this is how you tell them apart at a glance.
- [SQLAlchemy asyncio extension](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) —
  re-read the session/`selectinload` parts. Lazy loading is the classic async trap: a relationship
  access that works fine in sync code raises in async unless you eager-load it.
- [The 2.0 unified tutorial](https://docs.sqlalchemy.org/en/20/tutorial/index.html) — reference
  when a query shape isn't obvious (`select()`, joins, `scalars()`), not a read-through.
- [`dataclasses`](https://docs.python.org/3/library/dataclasses.html) (plan §6) — useful shape
  reference before pydantic-ai's `deps_type` dataclasses show up in week 4.
- Re-read, closely, not from memory:
  - `services/core/src/tenancy/context.ts:20-26,55-62,77-78` — the branded `TenantContext`, its
    single constructor, and `can()`.
  - `services/core/src/middleware/caller.ts:128-197` — `requireTenant`'s resolution order and its
    §7.1 comment stating the 403-vs-404 rule explicitly; `requirePermission`.
  - `services/core/src/services/membership.ts` — owner-count invariants, role-elevation guards,
    the "last owner can't be removed" rule (row-dependent, so it lives in the service, not in the
    flat permission table).

**Decide and document, don't just default into it:** the Python side reuses Drizzle's migrations
against `credopass_v2_dev` (already done in week 0) rather than introducing Alembic. Write one
paragraph in this week's retro on why — the short version is schema authority stays with Drizzle
per plan §1, and running a second migration tool against the same schema would create two sources
of truth for no benefit here.

## Hands-on task

**Mode A — worked example (I write this, throwaway):** a tiny standalone SQLAlchemy 2.0 async
model (one table, one relationship, `Mapped[]`/`mapped_column`) with an async session, unrelated
to CredoPass, so the modeling syntax is clear before you touch real tables.

**Mode B — you write, tests + spec provided:** this is the week where the tests matter more than
usual, because the "correct answer" is well-defined (matching existing behavior), not a matter of
taste. I write tests for:
- Header names an org the caller isn't a member of → 403 `not_a_member`.
- Path param names an org the caller isn't a member of → 404 (never 403 — confirming existence
  would leak that another tenant owns the row).
- No org resolvable, caller has several memberships, no selector given → 400 `organization_required`.
- No org resolvable, caller has zero memberships → 403.
- A full round trip through 3–4 of the 12 `organizations.ts` routes (create, get, list members,
  invite) as an authenticated, correctly-tenant-scoped caller.

You implement `require_tenant`, `require_permission`, the SQLAlchemy models for `organizations`,
`org_memberships`, and `invitations`, and all 12 routes until every test is green.

## Done when

- `uv run pytest` is green including all four tenancy-resolution edge cases above.
- You can explain the 403-vs-404 split out loud, unprompted, with your own example — not the one
  from the test file.

## Retro (fill in at the end)

- What was harder than expected:
- Fundamentals gap surfaced, if any:
- Carry into week 4:
