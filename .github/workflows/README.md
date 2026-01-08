# GitHub Actions Deployment Configuration

This directory contains CI/CD workflows for the DwellPass monorepo.

## Workflows

### 1. `ci.yml` - Quality Checks Only
**Triggers:** Push to `main`/`develop`, Pull Requests

**Jobs:**
- **detect-changes**: Uses Nx affected to detect which projects changed
- **quality-checks**: Runs linting, type checking, and tests on affected projects
- **summary**: Provides CI status summary

**Key Features:**
- ✅ Smart change detection using Nx
- ✅ Parallel execution of quality checks
- ✅ No deployments (handled by separate workflows)

### 2. `deploy-web.yml` - Web App Deployment
**Triggers:** 
- Push to `main`/`develop` (with path filters)
- Manual workflow dispatch

**Jobs:**
- **check-affected**: Determines if web app should be deployed
- **quality-checks**: Runs web-specific quality checks
- **deploy**: Builds and deploys to Vercel

**Key Features:**
- ✅ Path-based triggers (only runs when web code changes)
- ✅ Independent from API deployments
- ✅ Manual deployment option with environment selection
- ✅ Production vs preview environments

### 3. `deploy-api.yml` - API Service Deployment
**Triggers:**
- Push to `main`/`develop` (with path filters)
- Manual workflow dispatch

**Jobs:**
- **check-affected**: Determines if API should be deployed
- **quality-checks**: Runs API-specific quality checks
- **deploy**: Builds Docker image and deploys to Cloud Run

**Key Features:**
- ✅ Path-based triggers (only runs when API code changes)
- ✅ Independent from web deployments
- ✅ Manual deployment option with environment selection
- ✅ Production vs staging environments
- ✅ Environment-specific scaling configuration

### 4. `preview.yml` - Preview Deployments
**Triggers:** Pull Requests with `[preview]` in title or `preview` label

**Jobs:**
- Deploys web app to Vercel preview environment
- Adds comment to PR with preview URL

### 5. `manual-deploy.yml` - Manual Deployments
**Triggers:** Manual workflow dispatch

**Options:**
- Target: web, api, or both
- Environment: production, staging, or preview

## Deployment Independence

The workflows are designed to run independently:

- **Web changes** → Only `deploy-web.yml` runs
- **API changes** → Only `deploy-api.yml` runs
- **Shared package changes** → Both workflows run
- **Manual trigger** → Choose which to deploy

### Path Filters

**`deploy-web.yml` triggers on:**
```yaml
- 'apps/web/**'
- 'packages/ui/**'
- 'packages/validation/**'
```

**`deploy-api.yml` triggers on:**
```yaml
- 'services/api/**'
- 'packages/validation/**'
```

## Required Secrets

### Vercel (Web App)
```
VERCEL_TOKEN          # Vercel API token
VERCEL_ORG_ID         # Vercel organization ID
VERCEL_PROJECT_ID     # Vercel project ID
```

### Google Cloud (API Service)
```
GCP_SERVICE_ACCOUNT_KEY  # GCP service account JSON key
GCP_PROJECT_ID           # GCP project ID
GCP_REGION               # e.g., us-central1
```

### Optional
```
NX_CLOUD_ACCESS_TOKEN    # For Nx Cloud distributed caching
```

## Setup Instructions

### 1. Set up Vercel
```bash
# Install Vercel CLI
bun install -g vercel

# Link your project
cd apps/web
vercel link

# Get project details
vercel project ls
```

Add secrets to GitHub:
- `VERCEL_TOKEN`: Create at https://vercel.com/account/tokens
- `VERCEL_ORG_ID`: Found in `.vercel/project.json`
- `VERCEL_PROJECT_ID`: Found in `.vercel/project.json`

### 2. Set up Google Cloud

#### Create Service Account
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant necessary permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

# Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@PROJECT_ID.iam.gserviceaccount.com
```

#### Create Artifact Registry
```bash
gcloud artifacts repositories create dwellpass \
  --repository-format=docker \
  --location=us-central1 \
  --description="DwellPass Docker images"
```

#### Set Secrets
```bash
# Create secrets in Secret Manager
gcloud secrets create DATABASE_URL \
  --data-file=- <<< "postgresql://user:pass@host:5432/db"
```

Add to GitHub:
- `GCP_SERVICE_ACCOUNT_KEY`: Contents of `key.json`
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_REGION`: e.g., `us-central1`

### 3. Configure GitHub Environments

Create environments in GitHub repo settings:
- `production-web`
- `production-api`
- `staging-api`
- `preview-web`

Add protection rules as needed (e.g., require approvals for production).

## Local Testing

Test builds locally before pushing:

```bash
# Test web build
bun nx build web

# Test API build
bun nx build api

# Test Docker build
docker build -f services/api/Dockerfile -t dwellpass-api:test .

# Check affected projects
bun nx show projects --affected
```

## Deployment Flow

### Automatic Deployments

**Scenario 1: Only Web Changes**
1. Modify code in `apps/web/` or `packages/ui/`
2. Push to `main` or `develop`
3. `ci.yml` runs quality checks
4. `deploy-web.yml` runs automatically
5. Web app deploys to Vercel
6. API deployment is skipped

**Scenario 2: Only API Changes**
1. Modify code in `services/api/`
2. Push to `main` or `develop`
3. `ci.yml` runs quality checks
4. `deploy-api.yml` runs automatically
5. API service deploys to Cloud Run
6. Web deployment is skipped

**Scenario 3: Shared Package Changes**
1. Modify code in `packages/validation/`
2. Push to `main` or `develop`
3. `ci.yml` runs quality checks
4. Both `deploy-web.yml` and `deploy-api.yml` run
5. Both services deploy

**Scenario 4: Unrelated Changes**
1. Modify documentation or config files
2. Push to any branch
3. Only `ci.yml` runs
4. No deployments triggered

### Manual Deployments

**Option 1: Deploy Individually**
1. Go to Actions tab
2. Select "Deploy Web App" or "Deploy API Service"
3. Click "Run workflow"
4. Choose environment
5. Run

**Option 2: Deploy Both**
1. Go to Actions tab
2. Select "Manual Deployment"
3. Choose target: "both"
4. Choose environment
5. Run

### Preview Deployments (Web Only)
1. Create Pull Request
2. Add `[preview]` to title or add `preview` label
3. `preview.yml` runs automatically
4. Preview URL commented on PR

## How to Trigger Workflows Manually

### Deploy Web Only
```bash
# Via GitHub CLI
gh workflow run deploy-web.yml -f environment=production

# Or via GitHub UI:
# Actions → Deploy Web App → Run workflow → Select environment
```

### Deploy API Only
```bash
# Via GitHub CLI
gh workflow run deploy-api.yml -f environment=production

# Or via GitHub UI:
# Actions → Deploy API Service → Run workflow → Select environment
```

### Deploy Both
```bash
# Via GitHub CLI
gh workflow run manual-deploy.yml -f target=both -f environment=production

# Or via GitHub UI:
# Actions → Manual Deployment → Run workflow → Select target and environment
```

## Troubleshooting

### Build Failures
- Check Nx cache: `bun nx reset`
- Verify dependencies: `bun install --frozen-lockfile`
- Test locally first

### Vercel Deployment Issues
- Verify build output directory: `apps/web/dist`
- Check build command in vercel.json
- Ensure token has correct permissions

### Cloud Run Deployment Issues
- Check service account permissions
- Verify Artifact Registry access
- Check Cloud Run service logs: `gcloud run services logs read dwellpass-api`

### Secrets Issues
- Verify all required secrets are set
- Check secret names match workflow exactly
- Ensure service account key is valid JSON

## Monitoring

### Vercel
- Dashboard: https://vercel.com/dashboard
- Logs: Click deployment → View Logs

### Cloud Run
```bash
# View logs
gcloud run services logs read dwellpass-api --region us-central1

# Check service status
gcloud run services describe dwellpass-api --region us-central1
```

## Cost Optimization

### Nx Cloud
Enable Nx Cloud for distributed caching to speed up CI:
```bash
bun nx connect
```

### Cloud Run
- Minimum instances set to 0 (scales to zero)
- Maximum instances capped at 10
- 512Mi memory allocation
- 1 CPU per instance

### Vercel
- Using prebuilt deployment to skip redundant builds
- Leveraging Nx build cache

## Best Practices

1. **Always test locally** before pushing
2. **Use conventional commits** for clear history
3. **Tag releases** in `main` branch
4. **Monitor deployment status** in GitHub Actions
5. **Review preview deployments** before merging
6. **Keep secrets secure** - never commit them
7. **Update dependencies** regularly with Nx migrations
