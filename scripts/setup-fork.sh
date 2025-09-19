#!/bin/bash

# Setup Fork Script for Say What Want
# This script reconfigures git remotes after forking

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Say What Want - Fork Setup${NC}\n"

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USER

if [ -z "$GITHUB_USER" ]; then
    echo -e "${YELLOW}⚠ GitHub username is required${NC}"
    exit 1
fi

echo -e "\n${BLUE}Current git remotes:${NC}"
git remote -v

echo -e "\n${YELLOW}Updating remotes...${NC}\n"

# Rename current origin to upstream
echo "1. Renaming 'origin' to 'upstream' (original repo)..."
git remote rename origin upstream

# Add your fork as origin
echo "2. Adding your fork as 'origin'..."
git remote add origin "https://github.com/${GITHUB_USER}/saywhatwant.git"

echo -e "\n${GREEN}✓ Git remotes updated!${NC}\n"
echo -e "${BLUE}New configuration:${NC}"
git remote -v

echo -e "\n${BLUE}📋 Next Steps:${NC}"
echo "1. Push to your fork:"
echo -e "   ${GREEN}git push -u origin main${NC}\n"
echo "2. To sync with original repo later:"
echo -e "   ${GREEN}git fetch upstream${NC}"
echo -e "   ${GREEN}git checkout main${NC}"
echo -e "   ${GREEN}git merge upstream/main${NC}"
echo -e "   ${GREEN}git push origin main${NC}\n"
echo "3. Connect your fork to Cloudflare:"
echo "   - Go to Cloudflare Dashboard"
echo "   - Workers & Pages → Create → Connect to Git"
echo -e "   - Select: ${GREEN}${GITHUB_USER}/saywhatwant${NC}\n"
echo -e "${GREEN}✨ Fork setup complete!${NC}"
