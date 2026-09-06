# Moving the rewritten backend onto a database

> **What this is.** The step-by-step for getting the `/api/v1/core` schema onto a database —
> a fresh local one, the throwaway test one, and the remote Supabase instance that is still
> running the pre-rewrite schema.
>
> **Read before running anything against the remote instance.** The remote database has
> never been migrated. It still holds `users`, `event_members` and `loyalty`; the rewrite
> replaced those with `accounts` + `identities` + `people`. There is no automatic path
> between them — §5 is that path, and it is manual on purpose.
>
> Companions: [`API-FIRST-REBUILD.md`](API-FIRST-REBUILD.md) (the plan) ·
> [`REBUILD-LOG.md`](REBUILD-LOG.md) (what actually happened) ·
> [`services/core/README.md`](../services/core/README.md).

---

## 0. The shape of the problem, in one picture

```mermaid
flowchart TD
    S["packages/lib/src/schemas/tables/*.ts<br/><b>the only source of truth</b>"]
    S -->|drizzle-kit generate| M["services/core/drizzle/NNNN_*.sql<br/>committed, reviewed like code"]
    M -->|drizzle-kit migrate| L["local postgres :5432<br/>credopass_db"]
    M -->|drizzle-kit migrate| T["test postgres :55432<br/>tmpfs, wiped constantly"]
    M -.->|"§5 — manual, one time"| R["remote Supabase<br/>db.*.supabase.co:5432"]
    style R fill:#fee,stroke:#c00
    style S fill:#efe,stroke:#0a0
```

Three rules follow from that diagram and nothing in this document contradicts them:

1. **You never write SQL to change the model.** Edit the Drizzle table, generate, review the
   SQL, commit it. A hand-applied `ALTER TABLE` produces a database that no migration file
   describes, and the next `migrate` fails on it.
2. **`drizzle/` is committed.** Migrations are reviewed like any other code. Do not re-ignore it.
3. **Adding a column is not additive at runtime.** Drizzle builds an explicit column list from
   the schema, so a new column makes *every* query ask for it. Every database the code runs
   against must be migrated **before** the code that expects it ships.

---

## 1. Which database am I pointed at?

Start here whenever anything is confusing. It is read-only and it names the three states worth
telling apart.

```bash
nx run coreservice:db status
```

```
Database: postgresql://postgres:****@localhost:5432/credopass_db
Host:     localhost (local)

Tables (11): accounts, attendance, events, identities, invitations, org_domains,
             org_identity_providers, org_memberships, organizations, passes, people
RLS policies:       11
credopass_api role: yes (bypassrls: false)
Migrations:         4 applied / 4 on disk

✅ Schema matches the committed migrations.
```

| What it says | What it means | What to do |
|---|---|---|
| `N migration(s) not applied` | The code is ahead of the database. | `nx run coreservice:migrate` |
| `Tables exist but there is NO migration journal` | Built with `drizzle-kit push`. `migrate` will try to `CREATE TABLE` over the top and fail. | `nx run coreservice:db reset` (local only — destroys data) |
| `Host: ... ⚠️ REMOTE` | You are aimed at Supabase. | Stop. Read §5. |

`status` exits non-zero when the database is behind, so it works in CI.

---

## 2. Fresh clone → working local database

One command does all of it. It is **non-destructive** and safe to re-run.

```bash
nx run coreservice:setup
```

It checks Bun and Docker, creates `services/core/.env` from `.env.example` if there isn't one,
starts Postgres (`:5432`) + MinIO (`:9000`) + the throwaway test Postgres (`:55432`), applies
every migration to **localhost only**, and exports `openapi.json`.

Step 5 deliberately overrides `DATABASE_URL` with the local one, so `setup` cannot touch a
remote instance whatever is in your `.env`.

Then:

```bash
nx run coreservice:db seed     # sample org + events
bun start                      # web :5000 (or :5001) + API :8080
# kill with: pkill -f "nx run web:serve|nx run coreservice:start"
```

To make your own signed-in account an owner of the seeded organisation:

```bash
nx run coreservice:token                     # mint a JWT
# paste it into Scalar at http://localhost:8080/api/v1/core/docs, call GET /me,
# copy the account id, then:
nx run coreservice:db join <account-id>
```

If the local database is ever in a state you do not trust:

```bash
nx run coreservice:db reset    # drop public+app+drizzle schemas, replay migrations, seed
```

`reset` refuses to run against anything that is not `localhost` / `127.0.0.1` /
`host.docker.internal`. That is a hostname allow-list, not a `--force` flag, because a flag is
something you can pass by accident and a hostname is a fact about where you are aimed.

---

## 3. Changing the model

```bash
# 1. Edit the table
$EDITOR packages/lib/src/schemas/tables/events.ts
#    …and register it in tables/index.ts if it is a new table.

# 2. Generate the migration and inspect it — this writes a file, it does not apply anything
cd services/core && bunx drizzle-kit generate && cd -
git diff services/core/drizzle/

# 3. Apply it locally
nx run coreservice:migrate

# 4. Prove nothing broke
nx run coreservice:db status
nx run coreservice:verify              # lint + typecheck + unit tests
nx run coreservice:test:integration    # services against real Postgres

# 5. Regenerate the client contract, because the API's shape may have moved
nx run coreservice:openapi:export
nx run api-client:generate
nx run api-client:typecheck

# 6. Commit the schema, the migration and the regenerated client together
git add packages/lib/src/schemas services/core/drizzle packages/api-client/src/generated
```

**Never edit an already-applied migration file.** The journal records a hash of it; changing it
makes every database that ran it unmigrateable. Write a new migration instead.

---

## 4. The test databases

The unit/structural suite (`nx run coreservice:test`) touches no database at all and must always
pass. The other two start their own Postgres on `:55432`:

```bash
nx run coreservice:test:integration    # services against real Postgres
nx run coreservice:test:adversarial    # the tenancy suite
```

That database is `tmpfs` and the adversarial suite `TRUNCATE`s every table between runs.
`TEST_DATABASE_URL` must never point at a database anyone cares about.

---

## 5. Migrating the remote Supabase instance

**This is the one-time cutover, and it is the riskiest thing in this repo.**

The remote instance still runs the pre-rewrite schema. The rewrite did not rename tables — it
replaced the model:

| Pre-rewrite | Rewrite | Why there is no automatic mapping |
|---|---|---|
| `users` | `accounts` + `identities` + `people` | One row split three ways: the login (`accounts`), the credential that proves it (`identities`, keyed on issuer + subject), and the person an organisation keeps records about (`people`, per-tenant). |
| `event_members` | `attendance` | Signing up and turning up were the same row. They are now distinct, and `attendance` is unique on `(event_id, person_id)`. |
| `loyalty` | — | Deleted outright. |
| quoted `"camelCase"` columns | unquoted `snake_case` | So RLS policies are writable without a quoting exercise. |

### 5.1 Decide what you are actually doing

Answer this first, because the rest differs:

- **(A) There is no production data worth keeping.** Overwhelmingly the simplest. Skip to §5.3
  and replay the migrations onto an empty database.
- **(B) There is data to carry across.** You need the backfill in §5.4. It does not exist yet —
  writing it is the last open item of Phase 1.

### 5.2 Before you touch anything

```bash
# 1. Take a backup you have restored at least once. An untested backup is a hope.
pg_dump "$REMOTE_DATABASE_URL" -Fc -f credopass-pre-rewrite-$(date +%F).dump
pg_restore --list credopass-pre-rewrite-$(date +%F).dump | head

# 2. Rehearse the whole thing locally against a restore of that dump
nx run coreservice:dev:up
pg_restore -d postgresql://postgres:Ax\!rtrysoph123@localhost:5432/credopass_db \
  --clean --if-exists credopass-pre-rewrite-$(date +%F).dump
DATABASE_URL=postgresql://postgres:Ax\!rtrysoph123@localhost:5432/credopass_db \
  nx run coreservice:db status
```

Whatever `status` says about the restored dump is what it will say about the remote instance.
Solve it locally, where `db reset` is available.

### 5.3 Applying the migrations

`migrate` is the only command that is allowed to run against a remote host, and it is
non-destructive — but on a database with a pre-rewrite `public` schema it will fail on
`CREATE TABLE` collisions rather than clobber anything. That is correct behaviour, not a bug.

```bash
# Point at the remote instance for exactly this command. Do not leave it in .env.
export DATABASE_URL='postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres'

nx run coreservice:db status     # expect: ⚠️ REMOTE, and a migration count
nx run coreservice:migrate
nx run coreservice:db status     # expect: 4 applied / 4 on disk
unset DATABASE_URL
```

Migration `0001_rls.sql` is the one that matters most here. It creates the `app` schema, the
`credopass_api` role (`NOSUPERUSER NOBYPASSRLS` — a connection that can bypass RLS makes every
policy decorative), and a membership-scoped policy on every tenant table.

### 5.4 Backfilling `users` → `accounts` + `people` (case B only)

**Not written yet.** When it is, it belongs in `services/core/scripts/` as a script that is
idempotent and re-runnable, not as a migration — migrations describe schema, and this is data.
The shape it has to have:

1. For each old `users` row, insert an `accounts` row (the login) and an `identities` row keyed
   on `('supabase', <auth.users.id>)`. Match on email, and **log every row that does not
   match** rather than guessing.
2. For each `(organization, user)` pair with any history, insert a `people` row — that is the
   per-tenant record, so the same human in two organisations is two `people` rows and one
   `accounts` row.
3. Replay `event_members` into `attendance` **only where someone actually attended**. A
   sign-up with no attendance does not become an `attendance` row; that distinction is the
   product.
4. Re-point `org_memberships` at `account_id`.
5. Verify with counts, per organisation, before and after. Then run the adversarial suite
   against a restore of the result.

### 5.5 Lock the public key out

Supabase exposes every table through PostgREST with the anon key, which ships in the browser
bundle. RLS being *enabled* is not enough — a table with no policy for `anon` still needs the
grant revoked.

```bash
psql "$REMOTE_DATABASE_URL" -f services/core/sql/001_revoke_public_data_access.sql
nx run coreservice:verify:public-access     # exits 1 if any table returns rows
```

### 5.6 Rotate credentials

Every password that has been in a `.env` in this repo must be assumed public. Rotate the
database password and the Supabase service key at cutover, and put the new ones in GCP Secret
Manager rather than a file.

---

## 6. The open item: RLS is currently inert on the API path

Worth stating plainly, because the policies exist and look like they are protecting you.

The API connects as `postgres`, which is `BYPASSRLS`. So every policy in
[`0001_rls.sql`](../services/core/drizzle/0001_rls.sql) is **not being evaluated on the API
path**. Tenancy is currently enforced by exactly one layer: the explicit `ctx.organizationId`
predicate every domain service applies by hand, which the adversarial suite exists to police.

Switching `DATABASE_URL` to the `credopass_api` role is **not** a one-line change. That role is
`NOBYPASSRLS`, and the policies read the caller from a session variable:

```sql
-- 0001_rls.sql
SELECT nullif(current_setting('app.account_id', true), '')::uuid;
```

Nothing in `src/` sets it. Point the API at `credopass_api` today and every query returns zero
rows. The order is:

1. Wire `SET LOCAL app.account_id = <caller>` into a per-transaction wrapper, so it is set on
   the same connection as the query and cleared when the transaction ends.
2. Route every service through that wrapper — a pooled connection without it is a query that
   silently sees nothing.
3. Prove it: run the adversarial suite as `credopass_api` **and** as `postgres`. Both must be
   green, and the `credopass_api` run is the one that proves layer 2 is real.
4. Only then change `DATABASE_URL`.

Until step 4, treat the policies as untested code.

---

## 7. Quick reference

```bash
nx run coreservice:setup                  # fresh clone → running local stack
nx run coreservice:db status              # START HERE when confused (read-only)
nx run coreservice:migrate                # apply pending migrations
nx run coreservice:db reset               # drop + replay + seed  (localhost only)
nx run coreservice:db seed                # sample data           (localhost only)
nx run coreservice:db join <account-id>   # make yourself an owner of the seeded org
nx run coreservice:studio                 # browse the database
nx run coreservice:dev:up                 # postgres + MinIO
nx run coreservice:dev:down               # stop everything
nx run coreservice:verify:public-access   # is the remote DB publicly readable?

cd services/core && bunx drizzle-kit generate    # after editing a table
```
