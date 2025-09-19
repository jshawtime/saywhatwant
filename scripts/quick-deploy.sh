#!/bin/bash

# Say What Want - Quick Deployment Script
# Run this after initial Cloudflare setup is complete

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
header() { echo -e "\n${BLUE}═══ $1 ═══${NC}\n"; }

# Start deployment
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Say What Want - Quick Deploy Script    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}\n"

# Check if environment files exist
header "Checking Environment"

if [ ! -f ".env.local" ]; then
    log_error ".env.local not found! Run 'node scripts/cloudflare-setup.js' first"
    exit 1
fi

if [ ! -f "workers/wrangler.toml" ]; then
    log_error "workers/wrangler.toml not found!"
    exit 1
fi

# Check if KV namespace is configured
if grep -q "YOUR_KV_NAMESPACE_ID_HERE" workers/wrangler.toml; then
    log_error "KV namespace not configured in wrangler.toml"
    log_info "Run 'node scripts/cloudflare-setup.js' to configure"
    exit 1
fi

log_success "Environment files found"

# Deploy Worker
header "Deploying Comments Worker"

cd workers
if wrangler deploy; then
    log_success "Worker deployed successfully"
    WORKER_URL=$(grep NEXT_PUBLIC_COMMENTS_API ../.env.local | cut -d '=' -f2 | sed 's|/api/comments||')
    log_info "Worker URL: $WORKER_URL"
else
    log_error "Worker deployment failed"
    exit 1
fi
cd ..

# Build Next.js app
header "Building Next.js Application"

if npm run build; then
    log_success "Build completed successfully"
else
    log_error "Build failed"
    exit 1
fi

# Check if video manifest exists
header "Checking Video Manifest"

if [ -f "public/cloudflare/video-manifest.json" ]; then
    log_success "Video manifest found"
else
    log_warning "No video manifest found"
    log_info "If you have videos in R2, run: npm run manifest:generate"
fi

# Deploy to Cloudflare Workers
header "Deploying to Cloudflare Workers"

echo -e "${YELLOW}Deploying main site to Workers...${NC}\n"
if wrangler deploy; then
    log_success "Main site deployed successfully!"
    SITE_URL=$(wrangler deployments list | head -2 | tail -1 | awk '{print $3}')
    log_info "Site URL: $SITE_URL"
else
    log_warning "Deployment failed - you can manually deploy with: wrangler deploy"
fi

# Display test URLs
header "Post-Deployment Testing"

echo "Your deployment URLs:"
echo ""
echo "1. Main site: ${GREEN}https://say-what-want.[YOUR-SUBDOMAIN].workers.dev${NC}"
if [ ! -z "$SITE_URL" ]; then
    echo "   Actual: ${GREEN}$SITE_URL${NC}"
fi
echo "2. Comments API: ${GREEN}$WORKER_URL/api/comments${NC}"
echo ""
echo "Test commands:"
echo "  ${YELLOW}curl $WORKER_URL/api/comments${NC}"
echo "  ${YELLOW}wrangler tail${NC} (for main site)"
echo "  ${YELLOW}cd workers && wrangler tail${NC} (for comments API)"
echo ""

log_success "Deployment preparation complete! 🚀"
