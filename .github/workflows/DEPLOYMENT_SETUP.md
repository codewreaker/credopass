# Deployment Setup Checklist

## Prerequisites
- [ ] GitHub repository with admin access
- [ ] Vercel account
- [ ] Coolify instance on Hetzner, with a deploy webhook for the API

---

## 1. Vercel Setup

> **The frontends deploy through Vercel's own Git integration**, which needs none of this — it
> builds on every push by itself. The steps below set up the `VERCEL_*` GitHub secrets, which are
> only used by `ci-web.yml`, and that workflow is currently **disabled**. Skip this section unless
> you are re-enabling it.

### Install Vercel CLI
```bash
bun install -g vercel
```

### Link Project
```bash
cd apps/web
vercel link
# Follow prompts to link to your Vercel project
```

### Get Organization and Project IDs
After linking, check `.vercel/project.json`:
```json
{
  "orgId": "team_xxxxx",
  "projectId": "prj_xxxxx"
}
```

### Create Vercel Token
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Name it "GitHub Actions"
4. Copy the token

### Add GitHub Secrets
```bash
# Go to: GitHub Repo → Settings → Secrets and variables → Actions
# Add the following secrets:

VERCEL_TOKEN=<your_token>
VERCEL_ORG_ID=<orgId from .vercel/project.json>
VERCEL_PROJECT_ID=<projectId from .vercel/project.json>
```

---

## 2. API Setup — Coolify on Hetzner

The API is **not** deployed from a developer machine and there is no `nx` deploy target. Everything
happens in `ci-api.yml` on a push to `main` or `develop` that touches `services/core/**`,
`packages/lib/**` or the workflow itself:

```
quality-checks ─┐
                ├─► build image ─► push ghcr.io/codewreaker/credopass-core:latest ─► Coolify webhook
adversarial ────┘
```

Both gate jobs must pass. The adversarial tenancy suite blocks the deploy unconditionally — a
tenancy failure is not "some tests are red", it is "the product leaks between customers".

### Coolify side

1. Create an application backed by the Docker image `ghcr.io/codewreaker/credopass-core:latest`.
2. If the GHCR package is private, add a registry credential in Coolify (a GitHub PAT with
   `read:packages`).
3. Set the runtime environment — at minimum `DATABASE_URL`, `SUPABASE_URL`, `PASS_SIGNING_KEY`,
   `PORT=8080`, and `NODE_ENV=production`. **`PASS_SIGNING_KEY` must differ from every other
   environment**: a staging leak must not be able to mint production passes.
4. Copy the application's deploy webhook URL and an API token.

### GitHub secrets

```
COOLIFY_WEBHOOK=<the deploy webhook URL for the API application>
COOLIFY_TOKEN=<a Coolify API token>
NX_CLOUD_ACCESS_TOKEN=<optional, for remote caching>
```

`GITHUB_TOKEN` is provided by Actions and needs no setup; it is what pushes to GHCR.

### Deploying by hand

Re-run the workflow (`workflow_dispatch`), or hit the Coolify webhook directly. There is no
`gcloud`, no Artifact Registry and no service account — the earlier Cloud Run setup was removed
along with `tools/setup-gcp.sh` and the `coreservice:deploy` target, which pointed at a service
that is not the live deployment.

---

## 3. Database

The API talks to the Supabase Postgres instance. Migrations are **not** applied by the deploy — see
[`docs/DATABASE-MIGRATION.md`](../../docs/DATABASE-MIGRATION.md). Every database the code runs
against must be migrated before the code ships.

---

## Checklist

- [ ] Vercel project linked, `VERCEL_*` secrets set
- [ ] Coolify application created from the GHCR image
- [ ] Registry credential added if the package is private
- [ ] Runtime env set, with an environment-specific `PASS_SIGNING_KEY`
- [ ] `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN` in GitHub secrets
- [ ] A push to `main` touching `services/core/**` produces a green run and a new revision
