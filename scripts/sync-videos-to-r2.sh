#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SYNC VIDEOS TO R2
# Uploads new videos from videos-to-upload/ folder to Cloudflare R2
# Only uploads files that don't already exist in R2
# ═══════════════════════════════════════════════════════════════════════════

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# R2 Configuration
export R2_ACCOUNT_ID="85eadfbdf07c02e77aa5dc3b46beb0f9"
export R2_ACCESS_KEY_ID="655dc0505696e129391b3a2756dc902a"
export R2_SECRET_ACCESS_KEY="789522e4838381732bdc6f51d316f33d3cc97a0bbf8cb8118f8bdb55d4a88365"
export R2_BUCKET_NAME="sww-videos"
export R2_PUBLIC_URL="https://pub-56b43531787b4783b546dd45f31651a7.r2.dev"

# Source directory - videos to upload
SOURCE_DIR="${PROJECT_ROOT}/videos-to-upload"

# Parse arguments
DRY_RUN=false
FORCE=false
INTROS_ONLY=false

for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --intros-only)
      INTROS_ONLY=true
      shift
      ;;
  esac
done

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}            Cloudflare R2 Video Sync                           ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Source:     ${SOURCE_DIR}${NC}"
echo -e "${GREEN}Bucket:     ${R2_BUCKET_NAME}${NC}"
echo -e "${GREEN}Public URL: ${R2_PUBLIC_URL}${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}MODE: DRY RUN (no changes will be made)${NC}"
fi
if [ "$FORCE" = true ]; then
  echo -e "${YELLOW}MODE: FORCE (re-upload all files)${NC}"
fi
if [ "$INTROS_ONLY" = true ]; then
  echo -e "${YELLOW}MODE: INTROS ONLY (only entity intro videos)${NC}"
fi

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "\n${YELLOW}Creating videos-to-upload directory...${NC}"
    mkdir -p "$SOURCE_DIR"
    echo -e "${GREEN}✓ Created: ${SOURCE_DIR}${NC}"
    echo -e "\n${YELLOW}Add video files to this folder and run the script again.${NC}"
    exit 0
fi

# Count videos in source
if [ "$INTROS_ONLY" = true ]; then
  # Only .mov and .mp4 files that don't start with sww- (entity intros)
  LOCAL_VIDEOS=$(find "$SOURCE_DIR" -maxdepth 1 \( -name "*.mp4" -o -name "*.mov" \) ! -name "sww-*" 2>/dev/null)
else
  LOCAL_VIDEOS=$(find "$SOURCE_DIR" -maxdepth 1 \( -name "*.mp4" -o -name "*.mov" \) 2>/dev/null)
fi

LOCAL_COUNT=$(echo "$LOCAL_VIDEOS" | grep -c . 2>/dev/null || echo "0")

if [ "$LOCAL_COUNT" -eq 0 ]; then
    echo -e "\n${YELLOW}No video files found in ${SOURCE_DIR}${NC}"
    echo -e "${YELLOW}Supported formats: .mp4, .mov${NC}"
    echo -e "\n${CYAN}Video naming:${NC}"
    echo -e "  • Background videos: ${GREEN}sww-XXXXX.mp4${NC}"
    echo -e "  • Entity intros:     ${GREEN}[entity-id].mov${NC} (e.g., the-eternal.mov)"
    exit 0
fi

echo -e "\n${GREEN}Found ${LOCAL_COUNT} video(s) in source folder${NC}"

# Ensure wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo -e "\n${YELLOW}Installing wrangler...${NC}"
    npm install -g wrangler
fi

# Get list of existing files in R2 using wrangler
echo -e "\n${YELLOW}Fetching existing files from R2...${NC}"
R2_FILES=$(wrangler r2 object list sww-videos --remote 2>/dev/null | grep -E '\.(mp4|mov)' | awk '{print $NF}')
R2_COUNT=$(echo "$R2_FILES" | grep -c . 2>/dev/null || echo "0")
echo -e "${GREEN}✓ Found ${R2_COUNT} files in R2${NC}"

# Determine which files need to be uploaded
echo -e "\n${CYAN}═══ Analyzing files ═══${NC}"

TO_UPLOAD=()
SKIPPED=0

while IFS= read -r video_path; do
    [ -z "$video_path" ] && continue
    
    filename=$(basename "$video_path")
    
    # Check if file exists in R2
    if [ "$FORCE" = false ] && echo "$R2_FILES" | grep -q "^${filename}$"; then
        echo -e "${YELLOW}⏭  Skip (exists): ${filename}${NC}"
        SKIPPED=$((SKIPPED + 1))
    else
        echo -e "${GREEN}📤 Will upload:   ${filename}${NC}"
        TO_UPLOAD+=("$video_path")
    fi
done <<< "$LOCAL_VIDEOS"

UPLOAD_COUNT=${#TO_UPLOAD[@]}

echo -e "\n${CYAN}═══ Summary ═══${NC}"
echo -e "${GREEN}To upload: ${UPLOAD_COUNT}${NC}"
echo -e "${YELLOW}Skipped:   ${SKIPPED}${NC}"

if [ "$UPLOAD_COUNT" -eq 0 ]; then
    echo -e "\n${GREEN}✅ All videos already in R2. Nothing to upload.${NC}"
    exit 0
fi

# Dry run - stop here
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}DRY RUN: No files were uploaded.${NC}"
    echo -e "${YELLOW}Remove --dry-run to perform actual upload.${NC}"
    exit 0
fi

# Upload new files
echo -e "\n${CYAN}═══ Uploading new files ═══${NC}"

SUCCESS=0
FAILED=0

for video_path in "${TO_UPLOAD[@]}"; do
    filename=$(basename "$video_path")
    echo -ne "${YELLOW}Uploading ${filename}... ${NC}"
    
    if wrangler r2 object put "${R2_BUCKET_NAME}/${filename}" --file="$video_path" --remote 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "${RED}✗${NC}"
        FAILED=$((FAILED + 1))
    fi
done

echo -e "\n${GREEN}✓ Uploaded: ${SUCCESS}${NC}"
if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}✗ Failed:   ${FAILED}${NC}"
fi

# Regenerate manifest
echo -e "\n${CYAN}═══ Regenerating manifest ═══${NC}"

# Get all files from R2 for manifest using wrangler
ALL_R2_FILES=$(wrangler r2 object list ${R2_BUCKET_NAME} --remote 2>/dev/null | grep -E '\.(mp4|mov)' | awk '{print $NF}')
TOTAL_VIDEOS=$(echo "$ALL_R2_FILES" | grep -c . 2>/dev/null || echo "0")

# Generate manifest JSON
MANIFEST_FILE="${PROJECT_ROOT}/public/cloudflare/video-manifest.json"
mkdir -p "$(dirname "$MANIFEST_FILE")"

echo "{" > "$MANIFEST_FILE"
echo "  \"version\": \"2.1.0\"," >> "$MANIFEST_FILE"
echo "  \"generated\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"," >> "$MANIFEST_FILE"
echo "  \"source\": \"r2\"," >> "$MANIFEST_FILE"
echo "  \"publicUrl\": \"${R2_PUBLIC_URL}\"," >> "$MANIFEST_FILE"
echo "  \"totalVideos\": ${TOTAL_VIDEOS}," >> "$MANIFEST_FILE"
echo "  \"videos\": [" >> "$MANIFEST_FILE"

FIRST=true
while IFS= read -r filename; do
    [ -z "$filename" ] && continue
    
    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        echo "," >> "$MANIFEST_FILE"
    fi
    
    # Determine if this is an entity intro video
    IS_INTRO="false"
    ENTITY_ID=""
    if [[ ! "$filename" =~ ^sww- ]]; then
        IS_INTRO="true"
        ENTITY_ID=$(echo "$filename" | sed 's/\.[^.]*$//')  # Remove extension
    fi
    
    echo -n "    {" >> "$MANIFEST_FILE"
    echo -n "\"key\": \"${filename}\", " >> "$MANIFEST_FILE"
    echo -n "\"url\": \"${R2_PUBLIC_URL}/${filename}\", " >> "$MANIFEST_FILE"
    echo -n "\"contentType\": \"video/mp4\"" >> "$MANIFEST_FILE"
    if [ "$IS_INTRO" = "true" ]; then
        echo -n ", \"isIntro\": true, \"entityId\": \"${ENTITY_ID}\"" >> "$MANIFEST_FILE"
    fi
    echo -n "}" >> "$MANIFEST_FILE"
done <<< "$ALL_R2_FILES"

echo "" >> "$MANIFEST_FILE"
echo "  ]" >> "$MANIFEST_FILE"
echo "}" >> "$MANIFEST_FILE"

echo -e "${GREEN}✓ Manifest generated: ${MANIFEST_FILE}${NC}"
echo -e "${GREEN}  Total videos: ${TOTAL_VIDEOS}${NC}"

# Also copy to r2-video-manifest.json for compatibility
cp "$MANIFEST_FILE" "${PROJECT_ROOT}/public/r2-video-manifest.json"
echo -e "${GREEN}✓ Copied to: public/r2-video-manifest.json${NC}"

# Upload manifest to R2
echo -e "\n${YELLOW}Uploading manifest to R2...${NC}"
if wrangler r2 object put "${R2_BUCKET_NAME}/video-manifest.json" --file="$MANIFEST_FILE" --remote 2>/dev/null; then
    echo -e "${GREEN}✓ Manifest uploaded to R2${NC}"
else
    echo -e "${RED}✗ Failed to upload manifest${NC}"
fi

# Final summary
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           ✅ Sync Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Uploaded:       ${SUCCESS} videos${NC}"
echo -e "${GREEN}Total in R2:    ${TOTAL_VIDEOS} videos${NC}"
echo -e "${GREEN}Manifest:       ${R2_PUBLIC_URL}/video-manifest.json${NC}"
echo -e "\n${YELLOW}Videos are now available at:${NC}"
echo -e "${CYAN}${R2_PUBLIC_URL}/[filename]${NC}"

