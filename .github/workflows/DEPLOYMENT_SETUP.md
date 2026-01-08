# Deployment Setup Checklist

## Prerequisites
- [ ] GitHub repository with admin access
- [ ] Vercel account
- [ ] Google Cloud Platform account with billing enabled

---

## 1. Vercel Setup

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

## 2. Google Cloud Setup

### Install gcloud CLI (if not installed)
```bash
# macOS
brew install --cask google-cloud-sdk

# Initialize
gcloud init
```

### Set Variables
```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_ACCOUNT="github-actions"
```

### Create Service Account
```bash
gcloud iam service-accounts create $SERVICE_ACCOUNT \
  --display-name="GitHub Actions Service Account" \
  --project=$PROJECT_ID
```

### Grant Permissions
```bash
# Cloud Run Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Service Account User (required to act as Cloud Run service account)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Artifact Registry Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

# Storage Admin (for build artifacts)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### Create Service Account Key
```bash
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com

# View the key (you'll add this to GitHub)
cat github-actions-key.json
```

### Create Artifact Registry Repository
```bash
gcloud artifacts repositories create credopass \
  --repository-format=docker \
  --location=$REGION \
  --description="CredoPass Docker images" \
  --project=$PROJECT_ID
```

### Create Secret Manager Secrets
```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID

# Create DATABASE_URL secret
echo -n "postgresql://user:password@host:5432/dbname" | \
  gcloud secrets create DATABASE_URL \
  --data-file=- \
  --project=$PROJECT_ID

# Grant Cloud Run service account access to secrets
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

### Add GitHub Secrets
```bash
# Go to: GitHub Repo → Settings → Secrets and variables → Actions
# Add the following secrets:

GCP_SERVICE_ACCOUNT_KEY=<contents of github-actions-key.json>
GCP_PROJECT_ID=<your project ID>
GCP_REGION=us-central1
```

### Clean up local key (security)
```bash
# After adding to GitHub, delete the local key
rm github-actions-key.json
```

---

## 3. GitHub Environment Setup

### Create Environments
Go to: GitHub Repo → Settings → Environments

Create the following environments:
1. **production-web**
   - Protection rules: Require approvals (optional)
   - Environment secrets: (none needed, uses repo secrets)

2. **production-api**
   - Protection rules: Require approvals (optional)
   - Environment secrets: (none needed, uses repo secrets)

3. **staging-api**
   - Protection rules: (none)
   - Environment secrets: Can override with staging-specific values

4. **preview-web**
   - Protection rules: (none)
   - Environment secrets: (none needed)

---

## 4. Optional: Nx Cloud Setup

Speed up CI with distributed caching:

```bash
# Connect to Nx Cloud
bun nx connect

# Copy the access token when prompted
# Add to GitHub secrets as NX_CLOUD_ACCESS_TOKEN
```

---

## 5. Test Deployments

### Test Locally First
```bash
# Build web
bun nx build web

# Build API
bun nx build api

# Test Docker build
docker build -f services/api/Dockerfile -t test-api .
```

### Test GitHub Actions
1. Create a new branch
2. Make a small change (e.g., add a comment)
3. Push and create a pull request
4. Check Actions tab for workflow execution

### Test Manual Deployment
1. Go to Actions tab
2. Select "Manual Deployment"
3. Click "Run workflow"
4. Choose target and environment
5. Monitor execution

---

## 6. Verification Checklist

After setup, verify:

- [ ] GitHub Actions workflows appear in Actions tab
- [ ] All required secrets are set (8 total)
- [ ] Environments are created (4 total)
- [ ] Vercel project is linked
- [ ] GCP Artifact Registry exists
- [ ] GCP service account has correct permissions
- [ ] Secrets in Secret Manager are accessible
- [ ] Test deployment succeeds

---

## Troubleshooting

### Cannot authenticate to Vercel
- Verify `VERCEL_TOKEN` is set correctly
- Check token hasn't expired
- Ensure token has deployment permissions

### Cannot push to Artifact Registry
```bash
# Test authentication locally
gcloud auth configure-docker us-central1-docker.pkg.dev

# Try manual push
docker push us-central1-docker.pkg.dev/PROJECT_ID/credopass/api:test
```

### Cloud Run deployment fails
```bash
# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com"

# Check Cloud Run logs
gcloud run services logs read credopass-api --region=$REGION --limit=50
```

### Nx affected not working
- Ensure `fetch-depth: 0` in checkout action
- Verify `nrwl/nx-set-shas` action is used
- Check base branch is set correctly in nx.json

---

## Security Notes

1. **Never commit secrets** to the repository
2. **Rotate tokens regularly** (every 90 days recommended)
3. **Use least privilege** for service accounts
4. **Enable branch protection** for main/develop
5. **Review GitHub Actions logs** - they don't show secret values
6. **Use environment-specific secrets** when possible
7. **Enable audit logging** in GCP

---

## Next Steps

After successful setup:
1. Configure monitoring and alerting
2. Set up error tracking (e.g., Sentry)
3. Configure custom domains
4. Set up database backups
5. Document runbooks for common issues
6. Create staging environment variables
