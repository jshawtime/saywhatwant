#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SOURCE_DIR="/Users/terminal_1/_SWW/sww-videos"
DEST_DIR="public/sww-videos"
MAX_VIDEOS=10  # Copy only first 10 videos for testing (change to copy all)

echo -e "${YELLOW}═══ Copying Videos for Local Testing ═══${NC}"

# Create destination directory
mkdir -p "$DEST_DIR"

# Count videos to copy
if [ "$1" == "all" ]; then
    echo -e "${YELLOW}Copying ALL videos (1.3GB)...${NC}"
    cp "$SOURCE_DIR"/*.mp4 "$DEST_DIR/"
    VIDEO_COUNT=$(ls -1 "$DEST_DIR"/*.mp4 | wc -l)
else
    echo -e "${YELLOW}Copying first $MAX_VIDEOS videos for testing...${NC}"
    echo -e "${GREEN}(Run with 'all' parameter to copy all videos)${NC}\n"
    
    COUNT=0
    for video in "$SOURCE_DIR"/*.mp4; do
        if [ $COUNT -ge $MAX_VIDEOS ]; then
            break
        fi
        filename=$(basename "$video")
        echo "Copying $filename..."
        cp "$video" "$DEST_DIR/"
        COUNT=$((COUNT + 1))
    done
    VIDEO_COUNT=$COUNT
fi

# Generate local manifest
echo -e "\n${YELLOW}Generating local manifest...${NC}"
node scripts/local-video-manifest-generator.js

echo -e "\n${GREEN}✅ Copied $VIDEO_COUNT videos to $DEST_DIR${NC}"
echo -e "${YELLOW}Note: Videos are being served locally (not from R2)${NC}"
echo -e "${GREEN}Your app should now show videos at: https://say-what-want.pages.dev${NC}"

# Show size warning
SIZE=$(du -sh "$DEST_DIR" | cut -f1)
echo -e "\n${YELLOW}Local videos size: $SIZE${NC}"
if [ "$1" == "all" ]; then
    echo -e "${RED}Warning: 1.3GB of videos in git repo is not recommended!${NC}"
    echo -e "${YELLOW}Consider using R2 for production instead.${NC}"
fi
