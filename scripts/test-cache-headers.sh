#!/bin/bash

# Test Cache Headers Script
# Verifies that cache-busting configuration is working correctly

echo "🔍 Testing Cache Headers for saywhatwant.app"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_url() {
    local url=$1
    local expected_pattern=$2
    local description=$3
    
    echo "Testing: $description"
    echo "URL: $url"
    
    # Fetch headers
    headers=$(curl -sI "$url" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to fetch URL${NC}"
        echo ""
        return 1
    fi
    
    # Check for Cache-Control header
    cache_control=$(echo "$headers" | grep -i "cache-control:" | head -1)
    
    if [ -z "$cache_control" ]; then
        echo -e "${RED}❌ No Cache-Control header found${NC}"
        echo ""
        return 1
    fi
    
    echo "Cache-Control: $cache_control"
    
    # Check if it matches expected pattern
    if echo "$cache_control" | grep -qi "$expected_pattern"; then
        echo -e "${GREEN}✅ PASS: Correct cache policy${NC}"
    else
        echo -e "${RED}❌ FAIL: Expected pattern '$expected_pattern' not found${NC}"
    fi
    
    echo ""
}

# Test 1: Root HTML (should NOT be cached)
echo "Test 1: HTML Caching"
echo "--------------------"
test_url "https://saywhatwant.app/" "no-cache" "Root HTML should have no-cache"

# Test 2: Direct index.html (should NOT be cached)
echo "Test 2: Index.html"
echo "------------------"
test_url "https://saywhatwant.app/index.html" "no-cache" "index.html should have no-cache"

# Test 3: JavaScript file (should be cached)
echo "Test 3: JavaScript Files"
echo "------------------------"
echo "ℹ️  Testing JS caching (looking for any .js file)"
# Note: We can't easily test specific hashed files without knowing their names
# So we'll just check that the worker is responding
curl -sI "https://saywhatwant.app/version-check.js" | grep -i "cache-control:" | head -1
echo ""

# Test 4: Check if version-check.js is accessible
echo "Test 4: Version Check Script"
echo "---------------------------"
status_code=$(curl -sI "https://saywhatwant.app/version-check.js" | grep -i "HTTP/" | head -1 | awk '{print $2}')
if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ version-check.js is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  version-check.js returned status: $status_code${NC}"
fi
echo ""

# Test 5: Check for build timestamp in HTML
echo "Test 5: Build Timestamp"
echo "----------------------"
html_content=$(curl -s "https://saywhatwant.app/")
build_time=$(echo "$html_content" | grep -o 'Build: [0-9T:-]*Z' | head -1 | sed 's/Build: //')

if [ -n "$build_time" ]; then
    echo -e "${GREEN}✅ Build timestamp found: $build_time${NC}"
else
    # Check in meta tag
    meta_build=$(echo "$html_content" | grep -o 'name="build-time" content="[^"]*"' | sed 's/.*content="\([^"]*\)".*/\1/')
    if [ -n "$meta_build" ]; then
        echo -e "${GREEN}✅ Build timestamp in meta tag: $meta_build${NC}"
    else
        echo -e "${YELLOW}⚠️  No build timestamp found in HTML${NC}"
    fi
fi
echo ""

# Summary
echo "=============================================="
echo "📊 Test Summary"
echo "=============================================="
echo ""
echo "Expected Results:"
echo "  ✅ HTML files have 'no-cache' header"
echo "  ✅ JS files are accessible"
echo "  ✅ Build timestamp is visible"
echo ""
echo "If all tests pass, your cache configuration is correct! 🎉"
echo ""
echo "Next steps:"
echo "  1. Deploy a new build: npm run build && wrangler deploy"
echo "  2. Purge Cloudflare cache"
echo "  3. Visit site without hard refresh"
echo "  4. You should see the latest build immediately!"
echo ""

