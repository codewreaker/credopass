# Week 0 — crash course + scaffold

Status: 🟡 in progress · started 2026-08-24 · scaffold + database done and verified; the §5 skim
and the "why additive" answer are the only things left

See [`PYTHON-LEARNING-PLAN.md`](../PYTHON-LEARNING-PLAN.md) §4 and
[`LEARNING-WORKFLOW.md`](../LEARNING-WORKFLOW.md) for how this file is meant to be used.

## Objectives

By the end of this week you can:
- Say, honestly, which parts of §5's crash-course material are still fluent vs. actually rusty —
  the point of this week is to find that line quickly, not to re-do a full course.
- Explain in one sentence why `services/core-v2/` is a new additive service, not a rewrite of
  `services/core` in place (plan §1).
- Point at a working `services/core-v2/` skeleton: `uv`-managed, `ruff` configured, `pytest`
  running (even with zero real tests), and a second local Postgres database migrated and reachable.

## New this week (read before starting)

- Skim [`PYTHON-LEARNING-PLAN.md`](../PYTHON-LEARNING-PLAN.md) §5 (crash course links) in full —
  **hard time-box this to a single sitting.** The instant something feels obvious, stop reading and
  move to the next link; don't complete a course you don't need. The fastest useful pass:
  - [The Official Python Tutorial](https://docs.python.org/3/tutorial/) — skim the contents page,
    open only the chapters whose *titles* make you hesitate.
  - [The Python Cheatsheet](https://www.pythoncheatsheet.org/) — read it end to end in one go. It's
    a single page, and the parts that surprise you are your actual gap list.
  - Only if the skim found real gaps: [CS50P](https://cs50.harvard.edu/python/) (jump to the
    relevant lecture, don't start at week 1) or [Exercism's Python track](https://exercism.org/tracks/python)
    for writing fluency rather than reading fluency.
- Read plan §1 (architecture decision) and §7 (environment & tooling) once, closely — this is the
  only week where you need the *whole* picture before writing anything.
- Do **not** read §6 (modern Python / typing / async) yet in depth — that's week 1's material,
  timed to land right before you need it. A skim is fine if you're curious; don't study it now.
  The one exception worth 10 minutes: §6's *"two dating hazards"* table (pre-3.10 typing forms and
  Pydantic v1 idioms). Knowing it now stops you copying a stale snippet in week 1.

**Tooling reference for this week's scaffold** — you don't need to read these cover to cover, but
have them open when something in the generated `pyproject.toml` doesn't make sense:

- [uv — working on projects](https://docs.astral.sh/uv/guides/projects/) — what `uv init`,
  `uv add`, `uv run` and `uv.lock` actually do. The 10-minute version of the whole tool.
- [uv — installing Python](https://docs.astral.sh/uv/guides/install-python/) — how the 3.13 target
  gets satisfied on a machine whose `python3` is 3.11, without anything being installed globally
  or a `source .venv/bin/activate` ever being typed.
- [ruff](https://docs.astral.sh/ruff/linter/) · [ruff formatter](https://docs.astral.sh/ruff/formatter/)
  — skim the rule-selection section only; the config is already written for you.
- [pytest — getting started](https://docs.pytest.org/en/stable/) — test discovery rules
  (`test_*.py`, `test_*` functions) are the only part that matters this week.

## Hands-on task

**Mode C (scaffolding — I do this, it's infrastructure, not learning content):** ✅ done

- [x] `uv init` for `services/core-v2/`, `ruff` + `pytest` as dev dependencies, a minimal
  `pyproject.toml` (also carries the `ruff`, `pytest` and `pyright` config — one file, no
  `setup.py`/`setup.cfg`/`.flake8` sprawl; that's part of what changed since you last wrote Python).
- [x] A Docker Compose entry for a second local database (`credopass_v2_dev`) alongside the
  existing `docker/docker-compose.dev.yml` — new database, not a new container.
- [x] A README stub in `services/core-v2/` (filled in properly in week 7, per the workflow).
- [x] Branch `learn/api-v2-python` created, per `LEARNING-WORKFLOW.md` §4.

**Your task:**

- [ ] Skim §5's links per the time-box above. Note anything that felt genuinely unfamiliar, not
  just "I'd have to think about it" — that note becomes input for the reactive layer in
  `LEARNING-WORKFLOW.md` §5 if it turns out to matter later.
- [x] ~~Start Docker Desktop, bring the dev stack up (`nx run coreservice:dev:up`), then create the
  database: `cd services/core-v2 && ./scripts/create-db.sh`.~~ *Run for you — see "Reality check".*
- [x] ~~Run the *existing* Drizzle migrations against `credopass_v2_dev`~~ *— run for you.* The
  command is in [`services/core-v2/README.md`](../../services/core-v2/README.md#the-database).
  **Still worth doing yourself:** read the note under it on *why* the inline `DATABASE_URL=` is
  what keeps you off `credopass_db`, and run `bun run scripts/db.ts status` against each database
  in turn so you've seen both answers with your own eyes.
- [x] ~~Confirm `uv run pytest` executes cleanly against the placeholder test suite.~~ *— run for
  you, green from a wiped `.venv`. Run it once on your own shell anyway; it costs three seconds
  and it's the only proof that your PATH picks up `uv`.*

## Done when

- [x] `uv run pytest` exits 0. *(1 passed — the placeholder suite, green from a wiped `.venv`.
  `ruff check` and `ruff format --check` are clean too.)*
- [x] The `credopass_v2_dev` database has the same tables as the main dev database, post-migration.
  *Checked harder than `\dt`: identical 11-table list, identical 130-column set (name, type and
  nullability), 4/4 migrations in the journal on both, and `bun run scripts/db.ts status` reports
  "✅ Schema matches the committed migrations" against `credopass_v2_dev` — the repo's own tooling
  agreeing, not just a hand-rolled query.*
- [x] This is a second service because its written in another language and not meant to replace the existnig hono service. This is to help me implement and sharpen my python

## Reality check — where the plan met the machine

Written during the scaffold, per `LEARNING-WORKFLOW.md` §1 ("the fix is to edit the affected week
file directly"). Nothing here changes the plan's direction; these are details it couldn't have
known, plus one naming decision:

0. **Nothing is named after the language.** Both the service directory and the database were
   renamed on your call before the first commit, on the principle that a name shouldn't bake in the
   implementation language:
   - `services/core-py/` → **`services/core-v2/`**, which sits beside `services/core` the way the
     `/api/v2/core` surface sits beside `/api/v1/core`.
   - `credopass_py_dev` → **`credopass_v2_dev`** (plan §1 originally proposed the former).
     The new database was created and migrated from scratch through `scripts/create-db.sh`, verified
     against `credopass_db`, and only then was the old one dropped.

   The plan, every week file, the compose entry, the initdb SQL (also renamed, to
   `01-create-credopass-v2-dev.sql`) and the README were all updated, so neither old name survives
   anywhere in the repo.

1. **`uv` wasn't installed.** Installed with `brew install uv` (0.12.5). Your `python3` is 3.11.2,
   but that no longer matters: `.python-version` pins 3.13, and `uv` resolved it to a 3.13 already
   on the machine (`/opt/homebrew/opt/python@3.13`) — it would have downloaded one otherwise. The
   venv is `services/core-v2/.venv`, and nothing ever activates it; `uv run` does that per command.
   That whole arrangement is one of the more concrete "the packaging story changed completely"
   moments, and worth noticing rather than skipping past.
2. **The importable package is `app`, not `core_v2`.** `uv init --package` derives the module name
   from the project name, which would have made plan §7's documented `uv run uvicorn app.main:app`
   wrong. Pinned with `[tool.uv.build-backend] module-name = "app"` in `pyproject.toml`. Note the
   two names are independent: the *distribution* is `core-v2`, the *import* is `app`.
3. **The Compose init-script route only half-works — confirmed in both directions.** Postgres runs
   `/docker-entrypoint-initdb.d/*.sql` **only when the data directory is empty**. On this machine
   the `credopass_postgres_data` volume already exists, and sure enough, after
   `nx run coreservice:dev:up` the database list was still just `credopass_db` — the mounted
   `docker/initdb/01-create-credopass-v2-dev.sql` did not fire. Verified the other half too, by
   running a throwaway `postgres:16-alpine3.23` container with the same mount and an empty volume:
   there, `credopass_v2_dev` was created automatically. So the file is correct and does its job for
   fresh clones; `scripts/create-db.sh` (idempotent — tested twice, second run is a no-op) is what
   an existing machine needs.
4. **Adding that mount recreates the postgres container once.** `dev:up` reported
   `credopass-postgres  Recreated`, because the compose service definition changed. The named
   volume means no data loss — `credopass_db` still has its 11 tables and 4/4 migrations, checked
   before and after — but expect one container recreate the first time you pull this branch.
5. **Roles are cluster-wide, databases aren't.** `credopass_v2_dev` reports `credopass_api role:
   yes` and 11 RLS policies immediately after migrating, because the role already existed in the
   cluster from `credopass_db`'s migration and `0001_rls.sql` creates the policies per database.
   Same inert-RLS situation as v1 (plan §1) — worth knowing so the status output doesn't read as
   "RLS is enforcing something here."

## Retro (fill in at the end)

- What was harder than expected: So much more python tools, especially rustified tools
have been added that I had no idea about. Its almost as if pip has been completely replaced.
Even though it was hard remembering everything and learning new things, because of my experience in 
typescript and js ecosystem which seems to be driving innovations in other languages like types in python,
pydantic resembling zod etc, it was easy to pickup. Even uv is like bun/node

- Fundamentals gap surfaced, if any: been a while since I used the python syntax, so forgot about the `for in` and even some simple class decorators
- Carry into week 1: my python understanding and mode to help implement the rest
