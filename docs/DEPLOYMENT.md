# Deployment Guide

Complete deployment instructions for CredoPass frontend (Vercel) and backend (Google Cloud Run).

**CredoPass** is an event attendance tracking platform that works alongside ticketing systems like EventBrite. While EventBrite manages ticket sales, CredoPass captures detailed attendance data—check-in times, check-out times, and actual attendance records.

---

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
- [Backend Deployment (Cloud Run)](#backend-deployment-cloud-run)
- [Database Deployment](#database-deployment)
- [Environment Variables](#environment-variables)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Logging](#monitoring--logging)

---

## Deployment Overview

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Users (Browser)                     │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│             Vercel (Frontend CDN)                     │
│  ┌────────────────────────────────────────────────┐  │
│  │  Static Assets (HTML, CSS, JS)                 │  │
│  │  Domain: credopass.vercel.app                  │  │
│  │  Rewrite: /api/* → Cloud Run API              │  │
│  └────────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────────┘
                    │ API Requests (/api/*)
                    ▼
┌──────────────────────────────────────────────────────┐
│         Google Cloud Run (Backend API)               │
│  ┌────────────────────────────────────────────────┐  │
│  │  Hono Server (Docker Container)                │  │
│  │  Domain: api.credopass.com                     │  │
│  │  Auto-scaling: 0-100 instances                 │  │
│  └────────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────────┘
                    │ SQL Queries
                    ▼
┌──────────────────────────────────────────────────────┐
│         Google Cloud SQL (PostgreSQL)                │
│  Private IP, SSL/TLS, Automated Backups              │
└──────────────────────────────────────────────────────┘
```

### Deployment Targets

| Component | Platform | Domain |
|-----------|----------|--------|
| Frontend | Vercel | `credopass.vercel.app` |
| Backend | Google Cloud Run | `api.credopass.com` |
| Database | Google Cloud SQL | Private IP (VPC) |

---

## Frontend Deployment (Vercel)

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI** (optional):
   ```bash
   bun add -g vercel
   ```

### Deployment Configuration

**File**: `apps/web/vercel.json`

```json
{
  "buildCommand": "cd ../.. && bun nx build web",
  "outputDirectory": "dist",
  "installCommand": "cd ../.. && bun install",
  "framework": null,
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.credopass.com/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

**Key Settings**:
- **Build Command**: Uses Nx to build the web app from monorepo root
- **Output Directory**: `dist` (relative to `apps/web`)
- **API Rewrites**: Proxies `/api/*` to Cloud Run backend
- **Security Headers**: Adds XSS protection, clickjacking prevention

### Manual Deployment

#### Using Vercel CLI

```bash
# Login to Vercel
vercel login

# Link project (first time only)
cd apps/web
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### Using Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import Git repository
3. Set **Root Directory**: `apps/web`
4. Framework Preset: **Other**
5. Build Settings:
   - **Build Command**: `cd ../.. && bun nx build web`
   - **Output Directory**: `dist`
   - **Install Command**: `cd ../.. && bun install`
6. Add environment variables (see [Environment Variables](#environment-variables))
7. Click **Deploy**

### Automatic Deployment (Git Integration)

**Setup**:
1. Connect repository to Vercel
2. Enable Git integration
3. Configure branch deployments:
   - `main` → Production
   - `develop` → Preview
   - PRs → Preview

**Workflow**:
```bash
# Make changes
git add .
git commit -m "Update frontend"
git push origin main

# Vercel automatically:
# 1. Detects push
# 2. Runs build
# 3. Deploys to production
# 4. Updates domain
```

### Custom Domain Setup

1. **Add Custom Domain** in Vercel Dashboard:
   - Go to Project Settings → Domains
   - Add: `credopass.com`, `www.credopass.com`

2. **Update DNS Records**:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21 (Vercel's IP)

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

3. **Update API Rewrite**:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://api.credopass.com/api/:path*"
       }
     ]
   }
   ```

---

## Backend Deployment (Cloud Run)

### Prerequisites

1. **Google Cloud Account**: Sign up at [cloud.google.com](https://cloud.google.com)
2. **Google Cloud SDK**:
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Verify
   gcloud --version
   ```
3. **Docker**: Ensure Docker is installed and running

### Initial Setup

```bash
# 1. Login to Google Cloud
gcloud auth login

# 2. Set project
gcloud config set project credopass-project

# 3. Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  sql-component.googleapis.com

# 4. Configure Docker for GCR
gcloud auth configure-docker
```

### Dockerfile

**File**: `services/core/Dockerfile`

```dockerfile
# Multi-stage build for optimized image size

# Stage 1: Dependencies
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY services/core/package.json services/core/
COPY packages/lib/package.json packages/lib/

# Install dependencies
RUN bun install --frozen-lockfile --production

# Stage 2: Build
FROM oven/bun:1.3-alpine AS builder
WORKDIR /app

# Copy source
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Build application
RUN bun nx build coreservice

# Stage 3: Production
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist/services/core ./dist
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start server
CMD ["bun", "dist/index.js"]
```

**Key Features**:
- Multi-stage build (reduces image size)
- Non-root user (security best practice)
- Port 8080 (Cloud Run standard)
- Production dependencies only

### Build Docker Image

```bash
# Navigate to project root
cd /path/to/dwellpass

# Build image
nx run coreservice:docker:build

# Or manually:
docker build -t gcr.io/credopass-project/credopass-api:latest -f services/core/Dockerfile .

# Test locally
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  gcr.io/credopass-project/credopass-api:latest
```

### Push to Google Container Registry

```bash
# Push image
docker push gcr.io/credopass-project/credopass-api:latest
```

### Deploy to Cloud Run

#### Using gcloud CLI

```bash
# Deploy with configuration
gcloud run deploy credopass-api \
  --image gcr.io/credopass-project/credopass-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=database-url:latest \
  --min-instances 0 \
  --max-instances 100 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300s \
  --concurrency 80

# Output:
# Service URL: https://credopass-api-abc123-uc.a.run.app
```

**Configuration Options**:
- `--region`: Geographic location (us-central1, europe-west1, etc.)
- `--allow-unauthenticated`: Public access (or use IAM for private)
- `--min-instances 0`: Scale to zero when idle (saves cost)
- `--max-instances 100`: Auto-scale up to 100 containers
- `--memory`: RAM per instance
- `--cpu`: CPU cores per instance
- `--timeout`: Request timeout (300s max)
- `--concurrency`: Requests per instance

#### Using Nx Command

```bash
# Configure in project.json (services/core/project.json)
nx run coreservice:deploy
```

**Configuration**:
```json
{
  "targets": {
    "deploy": {
      "executor": "@nx/run-commands",
      "options": {
        "command": "gcloud run deploy credopass-api --source ../.. --region us-central1"
      }
    }
  }
}
```

### Custom Domain for Backend

1. **Map Custom Domain** in Cloud Run:
   ```bash
   gcloud run domain-mappings create \
     --service credopass-api \
     --domain api.credopass.com \
     --region us-central1
   ```

2. **Update DNS Records**:
   ```
   Type: CNAME
   Name: api
   Value: ghs.googlehosted.com
   ```

3. **Verify Domain**:
   ```bash
   gcloud run domain-mappings describe \
     --domain api.credopass.com \
     --region us-central1
   ```

---

## Database Deployment

### Google Cloud SQL Setup

#### 1. Create PostgreSQL Instance

```bash
# Create instance
gcloud sql instances create credopass-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup \
  --backup-start-time=03:00

# Create database
gcloud sql databases create dwellpass_db \
  --instance=credopass-db

# Create user
gcloud sql users create credopass \
  --instance=credopass-db \
  --password=<strong-password>
```

#### 2. Enable Private IP (Recommended)

```bash
# Create VPC connector for Cloud Run
gcloud compute networks vpc-access connectors create credopass-connector \
  --region=us-central1 \
  --network=default \
  --range=10.8.0.0/28

# Update Cloud Run to use VPC
gcloud run services update credopass-api \
  --vpc-connector=credopass-connector \
  --region=us-central1
```

#### 3. Get Connection String

```bash
# Get connection name
gcloud sql instances describe credopass-db \
  --format="value(connectionName)"

# Output: credopass-project:us-central1:credopass-db

# Connection string format:
# postgresql://credopass:<password>@/<dbname>?host=/cloudsql/<connection-name>
```

#### 4. Run Migrations on Cloud SQL

```bash
# Option 1: Cloud Shell (recommended)
gcloud sql connect credopass-db --user=credopass
# Then run: \i /path/to/migration.sql

# Option 2: From local machine with Cloud SQL Proxy
cloud_sql_proxy -instances=credopass-project:us-central1:credopass-db=tcp:5432

# In another terminal
DATABASE_URL="postgresql://credopass:<password>@localhost:5432/dwellpass_db" \
  nx run coreservice:migrate
```

### Database Backup & Restore

**Automated Backups** (configured in instance creation):
- Daily backups at 3:00 AM
- 7-day retention
- Transaction logs for point-in-time recovery

**Manual Backup**:
```bash
# Create on-demand backup
gcloud sql backups create \
  --instance=credopass-db \
  --description="Pre-migration backup"
```

**Restore from Backup**:
```bash
# List backups
gcloud sql backups list --instance=credopass-db

# Restore
gcloud sql backups restore <BACKUP_ID> \
  --backup-instance=credopass-db \
  --backup-id=<BACKUP_ID>
```

---

## Environment Variables

### Frontend (Vercel)

Set in **Vercel Dashboard** → Project Settings → Environment Variables:

```env
# API Configuration
VITE_API_BASE_URL=https://api.credopass.com

# Environment
NODE_ENV=production
```

### Backend (Cloud Run)

Set using **Secret Manager** (recommended) or environment variables:

#### Using Secret Manager

```bash
# Create secret
echo -n "postgresql://credopass:password@/dwellpass_db?host=/cloudsql/..." | \
  gcloud secrets create database-url --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Deploy with secret
gcloud run deploy credopass-api \
  --set-secrets DATABASE_URL=database-url:latest
```

#### Using Environment Variables

```bash
# Deploy with env vars
gcloud run deploy credopass-api \
  --set-env-vars NODE_ENV=production,PORT=8080
```

**Required Variables**:

```env
# Database
DATABASE_URL=postgresql://...

# Environment
NODE_ENV=production
PORT=8080

# Optional
THROTTLE=false
DEBUG=false
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy CredoPass

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun nx run-many --target=lint --all
      - run: bun nx run-many --target=test --all

  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  deploy-backend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: google-github-actions/setup-gcloud@v0
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: credopass-project
      
      - run: gcloud auth configure-docker
      
      - name: Build and Push
        run: |
          docker build -t gcr.io/credopass-project/credopass-api:${{ github.sha }} -f services/core/Dockerfile .
          docker push gcr.io/credopass-project/credopass-api:${{ github.sha }}
      
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy credopass-api \
            --image gcr.io/credopass-project/credopass-api:${{ github.sha }} \
            --region us-central1 \
            --platform managed
```

### Required Secrets

Add to **GitHub Repository Settings** → Secrets:

```
VERCEL_TOKEN          # Vercel API token
VERCEL_ORG_ID         # Vercel organization ID
VERCEL_PROJECT_ID     # Vercel project ID
GCP_SA_KEY            # Google Cloud service account key (JSON)
```

---

## Monitoring & Logging

### Cloud Run Monitoring

**View Logs**:
```bash
# Recent logs
gcloud run services logs read credopass-api \
  --region us-central1 \
  --limit 100

# Follow logs (live)
gcloud run services logs tail credopass-api \
  --region us-central1
```

**View Metrics** in Cloud Console:
- Request count
- Request latency (p50, p95, p99)
- Instance count
- Error rate
- CPU/memory utilization

### Vercel Monitoring

**Analytics** in Vercel Dashboard:
- Page views
- Unique visitors
- Web Vitals (LCP, FID, CLS)
- Geographic distribution

**Real-time Logs**:
```bash
vercel logs <deployment-url>
```

### Alerting

**Cloud Monitoring Alerts**:
```bash
# Create alert for high error rate
gcloud alpha monitoring policies create \
  --notification-channels=<CHANNEL_ID> \
  --display-name="High Error Rate" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=60s \
  --condition-filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count" AND metric.label.response_code_class="5xx"'
```

---

## Troubleshooting

### Common Deployment Issues

#### Frontend Not Updating

```bash
# Clear Vercel cache
vercel --prod --force

# Verify build output
ls -la apps/web/dist
```

#### Backend 502/503 Errors

```bash
# Check logs
gcloud run services logs read credopass-api --limit 50

# Common causes:
# - Container startup failure (check Dockerfile)
# - Database connection timeout (check DATABASE_URL)
# - Out of memory (increase --memory)
```

#### Database Connection Failed

```bash
# Test connection
gcloud sql connect credopass-db --user=credopass

# Check Cloud SQL Proxy
cloud_sql_proxy -instances=<CONNECTION_NAME>=tcp:5432

# Verify secrets
gcloud secrets versions access latest --secret=database-url
```

---

## Next Steps

- **Monitoring**: Set up Cloud Monitoring and Vercel Analytics
- **Backups**: Configure automated database backups
- **SSL/TLS**: Ensure HTTPS for all endpoints
- **CDN**: Configure Vercel Edge Network
- **Scaling**: Adjust Cloud Run concurrency and instances based on traffic

---

For development setup, see [SETUP.md](SETUP.md).
