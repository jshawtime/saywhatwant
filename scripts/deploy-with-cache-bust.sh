#!/bin/bash

# Git Push Deployment Script (for Cloudflare Pages with GitHub)
# This script commits and pushes to trigger auto-deployment

set -e

echo "🚀 Git-Based Deployment to Cloudflare Pages"
echo "============================================"
echo ""

# Check if we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "📝 Uncommitted changes detected"
    echo ""
    git status -s
    echo ""
    
    read -p "Do you want to commit all changes? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Get commit message
        read -p "Commit message: " commit_msg
        
        if [ -z "$commit_msg" ]; then
            commit_msg="Update build $(date -u +\"%Y-%m-%dT%H:%M:%SZ\")"
        fi
        
        # Add and commit
        git add -A
        git commit -m "$commit_msg"
        echo "✅ Changes committed"
    else
        echo "⚠️  Deployment cancelled - please commit changes first"
        exit 1
    fi
else
    echo "✅ Working directory clean"
fi

echo ""

# Check current branch
current_branch=$(git branch --show-current)
echo "📍 Current branch: $current_branch"

if [ "$current_branch" != "main" ]; then
    echo "⚠️  You're not on the main branch!"
    read -p "Push to $current_branch anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

echo ""
echo "🌐 Pushing to GitHub (will trigger Cloudflare Pages build)..."
git push origin $current_branch

echo ""
echo "✅ Push complete!"
echo ""
echo "📊 What happens next:"
echo "  1. GitHub receives your push"
echo "  2. Cloudflare Pages detects the change"
echo "  3. Cloudflare builds your app (npm run build)"
echo "  4. Build timestamp is generated automatically"
echo "  5. New version deploys with _headers file"
echo "  6. HTML is served with no-cache headers"
echo ""
echo "🎯 Deployment Status:"
echo "  Check: https://dash.cloudflare.com/ → Workers & Pages → say-what-want"
echo ""
echo "⏱️  Build usually takes 1-2 minutes"
echo ""
echo "🔍 After deployment completes:"
echo "  1. Wait for build to finish (green checkmark in dashboard)"
echo "  2. Visit: https://saywhatwant.app/"
echo "  3. Should see new build timestamp immediately (no hard refresh!)"
echo ""
echo "💡 Tips:"
echo "  - View build logs in Cloudflare dashboard"
echo "  - If old version persists, purge Cloudflare cache manually"
echo "  - Version check script will notify users within 5 minutes"
echo ""
echo "🎉 All done! Monitor deployment at Cloudflare Dashboard."

