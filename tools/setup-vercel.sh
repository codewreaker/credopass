#!/bin/bash

# CredoPass Vercel Setup Script
# This script helps automate the Vercel setup process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        CredoPass Vercel Deployment Setup Script             ║${NC}"
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    bun install -g vercel
    echo -e "${GREEN}✅ Vercel CLI installed${NC}"
else
    echo -e "${GREEN}✅ Vercel CLI found${NC}"
fi
echo ""

# Navigate to web app directory
WEB_DIR="apps/web"
if [ ! -d "$WEB_DIR" ]; then
    echo -e "${RED}❌ Web app directory not found: $WEB_DIR${NC}"
    exit 1
fi

cd "$WEB_DIR"
echo -e "${GREEN}✅ Changed to web app directory${NC}"
echo ""

# Check if already linked
if [ -d ".vercel" ]; then
    echo -e "${YELLOW}⚠️  Project already linked to Vercel${NC}"
    echo -e "${YELLOW}Do you want to re-link? (y/n):${NC}"
    read -r RELINK
    if [ "$RELINK" = "y" ]; then
        rm -rf .vercel
        echo -e "${GREEN}✅ Cleared existing Vercel link${NC}"
    else
        echo -e "${YELLOW}Using existing link${NC}"
    fi
fi
echo ""

# Link project
if [ ! -d ".vercel" ]; then
    echo -e "${YELLOW}🔗 Linking project to Vercel...${NC}"
    echo -e "${YELLOW}Follow the prompts to link your project${NC}"
    vercel link
    echo -e "${GREEN}✅ Project linked${NC}"
fi
echo ""

# Read project.json
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${RED}❌ .vercel/project.json not found${NC}"
    exit 1
fi

# Extract IDs using multiple methods for compatibility
if command -v jq &> /dev/null; then
    # Use jq if available (most reliable)
    ORG_ID=$(jq -r '.orgId' .vercel/project.json 2>/dev/null)
    PROJECT_ID=$(jq -r '.projectId' .vercel/project.json 2>/dev/null)
else
    # Fallback to grep/sed parsing
    ORG_ID=$(grep -o '"orgId"[[:space:]]*:[[:space:]]*"[^"]*"' .vercel/project.json | sed 's/.*"orgId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    PROJECT_ID=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' .vercel/project.json | sed 's/.*"projectId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
fi

if [ -z "$ORG_ID" ] || [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Could not extract IDs from project.json${NC}"
    echo -e "${YELLOW}Contents of .vercel/project.json:${NC}"
    cat .vercel/project.json
    echo ""
    echo -e "${YELLOW}Please manually copy the orgId and projectId from above${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Project Information:${NC}"
echo -e "  Organization ID: ${YELLOW}$ORG_ID${NC}"
echo -e "  Project ID: ${YELLOW}$PROJECT_ID${NC}"
echo ""

# Get token
echo -e "${YELLOW}📋 To get your Vercel token:${NC}"
echo "  1. Go to: https://vercel.com/account/tokens"
echo "  2. Click 'Create Token'"
echo "  3. Name it 'GitHub Actions' (or similar)"
echo "  4. Copy the token"
echo ""
echo -e "${YELLOW}Paste your Vercel token (input hidden):${NC}"
read -rs VERCEL_TOKEN
echo ""

if [ -z "$VERCEL_TOKEN" ]; then
    echo -e "${RED}❌ Token is required${NC}"
    exit 1
fi

# Test token
echo -e "${YELLOW}🧪 Testing token...${NC}"
if vercel whoami --token="$VERCEL_TOKEN" &> /dev/null; then
    echo -e "${GREEN}✅ Token is valid${NC}"
else
    echo -e "${RED}❌ Token is invalid${NC}"
    exit 1
fi
echo ""

# Return to root
cd ../..

# Summary
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete! 🎉                        ║${NC}"
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${GREEN}🔐 GitHub Secrets to Add:${NC}"
echo ""
echo -e "${YELLOW}1. VERCEL_TOKEN${NC}"
echo "   Value: (the token you just entered)"
echo ""
echo -e "${YELLOW}2. VERCEL_ORG_ID${NC}"
echo "   Value: $ORG_ID"
echo "   Command: echo '$ORG_ID' | pbcopy"
echo ""
echo -e "${YELLOW}3. VERCEL_PROJECT_ID${NC}"
echo "   Value: $PROJECT_ID"
echo "   Command: echo '$PROJECT_ID' | pbcopy"
echo ""
echo -e "${GREEN}📍 Add these at:${NC}"
echo "   GitHub Repo → Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo -e "${GREEN}✅ Next Steps:${NC}"
echo "   1. Add the three secrets to GitHub"
echo "   2. Set up GCP integration (run tools/setup-gcp.sh)"
echo "   3. Test a deployment"
echo "   4. Refer to .github/DEPLOYMENT_SETUP.md for details"
echo ""
