#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SOURCE_DIR="/Users/terminal_1/_SWW/sww-videos"
BUCKET_NAME="sww-videos"
BATCH_SIZE=10

echo -e "${YELLOW}═══ Uploading Videos to Cloudflare R2 ═══${NC}"
echo -e "${GREEN}Source: ${SOURCE_DIR}${NC}"
echo -e "${GREEN}Bucket: ${BUCKET_NAME}${NC}"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: Source directory not found: $SOURCE_DIR${NC}"
    exit 1
fi

# Count total videos
TOTAL_VIDEOS=$(ls -1 "$SOURCE_DIR"/*.mp4 2>/dev/null | wc -l)

if [ "$TOTAL_VIDEOS" -eq 0 ]; then
    echo -e "${RED}No .mp4 files found in source directory${NC}"
    exit 1
fi

echo -e "${GREEN}Found ${TOTAL_VIDEOS} videos to upload${NC}\n"

# Check if wrangler is installed and logged in
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}wrangler is not installed. Installing...${NC}"
    npm install -g wrangler
fi

echo -e "${YELLOW}Checking wrangler authentication...${NC}"
wrangler whoami || {
    echo -e "${RED}Please login to wrangler first:${NC}"
    echo -e "${YELLOW}Run: wrangler login${NC}"
    exit 1
}

# Upload videos in batches
COUNT=0
FAILED=0
SUCCESS=0

echo -e "\n${YELLOW}Starting upload...${NC}"

for video in "$SOURCE_DIR"/*.mp4; do
    filename=$(basename "$video")
    COUNT=$((COUNT + 1))
    
    echo -ne "${YELLOW}[$COUNT/$TOTAL_VIDEOS]${NC} Uploading ${filename}... "
    
    if wrangler r2 object put "$BUCKET_NAME/$filename" --file="$video" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "${RED}✗${NC}"
        FAILED=$((FAILED + 1))
        echo "$filename" >> failed_uploads.txt
    fi
    
    # Small delay to avoid rate limiting
    if [ $((COUNT % BATCH_SIZE)) -eq 0 ]; then
        echo -e "${YELLOW}Batch complete. Brief pause...${NC}"
        sleep 2
    fi
done

# Summary
echo -e "\n${GREEN}═══ Upload Summary ═══${NC}"
echo -e "${GREEN}✓ Successful: $SUCCESS videos${NC}"
if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}✗ Failed: $FAILED videos${NC}"
    echo -e "${YELLOW}Failed uploads saved to: failed_uploads.txt${NC}"
fi

# Generate manifest after upload
echo -e "\n${YELLOW}Generating R2 manifest...${NC}"
if [ -f "scripts/r2-manifest-generator.js" ]; then
    node scripts/r2-manifest-generator.js
    echo -e "${GREEN}✓ Manifest generated${NC}"
else
    echo -e "${YELLOW}Note: Run 'node scripts/r2-manifest-generator.js' to generate manifest${NC}"
fi

echo -e "\n${GREEN}✅ Upload process complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update config/video-source.ts to use R2 (useLocal: false)"
echo -e "2. Set NEXT_PUBLIC_R2_BUCKET_URL in .env.local"
echo -e "3. Deploy changes to Cloudflare Pages"
