#!/bin/bash

# DwellPass Deployment Setup Script
# This script helps automate the GCP setup process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        DwellPass GCP Deployment Setup Script                ║${NC}"
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo -e "${GREEN}✅ gcloud CLI found${NC}"
echo ""

# Get project ID
echo -e "${YELLOW}Enter your GCP Project ID:${NC}"
read -r PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Project ID is required${NC}"
    exit 1
fi

# Set project
gcloud config set project "$PROJECT_ID"
echo -e "${GREEN}✅ Project set to: $PROJECT_ID${NC}"
echo ""

# Set region
echo -e "${YELLOW}Enter your preferred region (default: us-central1):${NC}"
read -r REGION
REGION=${REGION:-us-central1}
echo -e "${GREEN}✅ Region set to: $REGION${NC}"
echo ""

# Service account name
SERVICE_ACCOUNT="github-actions"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com"

# Enable required APIs
echo -e "${YELLOW}📦 Enabling required GCP APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    --project="$PROJECT_ID"
echo -e "${GREEN}✅ APIs enabled${NC}"
echo ""

# Create service account
echo -e "${YELLOW}👤 Creating service account: $SERVICE_ACCOUNT${NC}"
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Service account already exists${NC}"
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT" \
        --display-name="GitHub Actions Service Account" \
        --project="$PROJECT_ID"
    echo -e "${GREEN}✅ Service account created${NC}"
fi
echo ""

# Grant permissions
echo -e "${YELLOW}🔐 Granting permissions to service account...${NC}"

ROLES=(
    "roles/run.admin"
    "roles/iam.serviceAccountUser"
    "roles/artifactregistry.admin"
    "roles/storage.admin"
    "roles/secretmanager.secretAccessor"
)

for ROLE in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="$ROLE" \
        --condition=None \
        --no-user-output-enabled
    echo -e "${GREEN}  ✅ Granted $ROLE${NC}"
done
echo ""

# Create Artifact Registry repository
echo -e "${YELLOW}📦 Creating Artifact Registry repository...${NC}"
if gcloud artifacts repositories describe dwellpass --location="$REGION" --project="$PROJECT_ID" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Repository already exists${NC}"
else
    gcloud artifacts repositories create dwellpass \
        --repository-format=docker \
        --location="$REGION" \
        --description="DwellPass Docker images" \
        --project="$PROJECT_ID"
    echo -e "${GREEN}✅ Artifact Registry repository created${NC}"
fi
echo ""

# Create service account key
echo -e "${YELLOW}🔑 Creating service account key...${NC}"
KEY_FILE="github-actions-key-$PROJECT_ID.json"

if [ -f "$KEY_FILE" ]; then
    echo -e "${YELLOW}⚠️  Key file already exists: $KEY_FILE${NC}"
    echo -e "${YELLOW}Do you want to create a new key? (y/n):${NC}"
    read -r CREATE_NEW_KEY
    if [ "$CREATE_NEW_KEY" != "y" ]; then
        echo -e "${YELLOW}Using existing key file${NC}"
    else
        rm "$KEY_FILE"
        gcloud iam service-accounts keys create "$KEY_FILE" \
            --iam-account="$SERVICE_ACCOUNT_EMAIL" \
            --project="$PROJECT_ID"
        echo -e "${GREEN}✅ New service account key created${NC}"
    fi
else
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SERVICE_ACCOUNT_EMAIL" \
        --project="$PROJECT_ID"
    echo -e "${GREEN}✅ Service account key created: $KEY_FILE${NC}"
fi
echo ""

# Create secrets
echo -e "${YELLOW}🔒 Setting up Secret Manager...${NC}"
echo -e "${YELLOW}Enter your DATABASE_URL (or press Enter to skip):${NC}"
read -rs DATABASE_URL

if [ -n "$DATABASE_URL" ]; then
    if gcloud secrets describe DATABASE_URL --project="$PROJECT_ID" &> /dev/null; then
        echo -e "${YELLOW}⚠️  DATABASE_URL secret already exists. Updating...${NC}"
        echo -n "$DATABASE_URL" | gcloud secrets versions add DATABASE_URL \
            --data-file=- \
            --project="$PROJECT_ID"
    else
        echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL \
            --data-file=- \
            --project="$PROJECT_ID"
    fi
    
    # Grant access to the secret
    gcloud secrets add-iam-policy-binding DATABASE_URL \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/secretmanager.secretAccessor" \
        --project="$PROJECT_ID" \
        --no-user-output-enabled
    echo -e "${GREEN}✅ DATABASE_URL secret created${NC}"
else
    echo -e "${YELLOW}⏭️  Skipped DATABASE_URL secret creation${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete! 🎉                        ║${NC}"
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${GREEN}📋 Summary:${NC}"
echo -e "  Project ID: ${YELLOW}$PROJECT_ID${NC}"
echo -e "  Region: ${YELLOW}$REGION${NC}"
echo -e "  Service Account: ${YELLOW}$SERVICE_ACCOUNT_EMAIL${NC}"
echo -e "  Key File: ${YELLOW}$KEY_FILE${NC}"
echo ""
echo -e "${GREEN}🔐 GitHub Secrets to Add:${NC}"
echo ""
echo -e "${YELLOW}1. GCP_SERVICE_ACCOUNT_KEY${NC}"
echo "   Copy the contents of: $KEY_FILE"
echo "   Command: cat $KEY_FILE | pbcopy"
echo ""
echo -e "${YELLOW}2. GCP_PROJECT_ID${NC}"
echo "   Value: $PROJECT_ID"
echo ""
echo -e "${YELLOW}3. GCP_REGION${NC}"
echo "   Value: $REGION"
echo ""
echo -e "${GREEN}📍 Add these at:${NC}"
echo "   GitHub Repo → Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo -e "${RED}⚠️  Security Note:${NC}"
echo "   After adding the key to GitHub, delete the local file:"
echo "   ${YELLOW}rm $KEY_FILE${NC}"
echo ""
echo -e "${GREEN}✅ Next Steps:${NC}"
echo "   1. Add the secrets to GitHub"
echo "   2. Set up Vercel integration"
echo "   3. Test a deployment"
echo "   4. Refer to .github/DEPLOYMENT_SETUP.md for details"
echo ""
