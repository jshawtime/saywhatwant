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
UPLOADED_FILES=""

for video_path in "${TO_UPLOAD[@]}"; do
    filename=$(basename "$video_path")
    echo -ne "${YELLOW}Uploading ${filename}... ${NC}"
    
    if wrangler r2 object put "${R2_BUCKET_NAME}/${filename}" --file="$video_path" --remote 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        SUCCESS=$((SUCCESS + 1))
        # Track successfully uploaded files for manifest update
        if [ -z "$UPLOADED_FILES" ]; then
            UPLOADED_FILES="$filename"
        else
            UPLOADED_FILES="$UPLOADED_FILES,$filename"
        fi
    else
        echo -e "${RED}✗${NC}"
        FAILED=$((FAILED + 1))
    fi
done

echo -e "\n${GREEN}✓ Uploaded: ${SUCCESS}${NC}"
if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}✗ Failed:   ${FAILED}${NC}"
fi

# Export for manifest update
export UPLOADED_FILES

# Update manifest (don't regenerate - preserve existing videos)
echo -e "\n${CYAN}═══ Updating manifest ═══${NC}"

MANIFEST_FILE="${PROJECT_ROOT}/public/r2-video-manifest.json"

# Use Node.js to safely update the JSON manifest
node -e "
const fs = require('fs');

// Read existing manifest
const manifestPath = '${MANIFEST_FILE}';
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('Loaded existing manifest with', manifest.videos.length, 'videos');
} catch (e) {
  console.error('Error reading manifest:', e.message);
  process.exit(1);
}

const publicUrl = '${R2_PUBLIC_URL}';

// Get list of successfully uploaded files from environment
const uploadedFiles = process.env.UPLOADED_FILES ? process.env.UPLOADED_FILES.split(',').filter(f => f) : [];
console.log('Files to add:', uploadedFiles.length);

let added = 0;
for (const filename of uploadedFiles) {
  // Check if already exists
  if (manifest.videos.find(v => v.key === filename)) {
    console.log('  Already exists:', filename);
    continue;
  }
  
  // Determine if intro video (doesn't start with sww-)
  const isIntro = !filename.startsWith('sww-');
  const entityId = isIntro ? filename.replace(/\.[^.]*$/, '') : undefined;
  const ext = filename.split('.').pop().toLowerCase();
  const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  
  const entry = {
    key: filename,
    url: publicUrl + '/' + filename,
    contentType: contentType
  };
  
  if (isIntro) {
    entry.isIntro = true;
    entry.entityId = entityId;
    // Insert intro videos at the beginning (after other intros)
    const lastIntroIndex = manifest.videos.findIndex(v => !v.isIntro);
    const insertAt = lastIntroIndex === -1 ? manifest.videos.length : lastIntroIndex;
    manifest.videos.splice(insertAt, 0, entry);
  } else {
    // Append background videos at the end
    manifest.videos.push(entry);
  }
  
  console.log('  Added:', filename, isIntro ? '(intro)' : '');
  added++;
}

// Update metadata
manifest.totalVideos = manifest.videos.length;
manifest.generated = new Date().toISOString();

// Save manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Saved manifest:', manifest.totalVideos, 'total videos');
console.log('Added', added, 'new videos');
" 

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Manifest updated${NC}"
else
    echo -e "${RED}✗ Failed to update manifest${NC}"
fi

# Copy to cloudflare folder for compatibility
mkdir -p "${PROJECT_ROOT}/public/cloudflare"
cp "$MANIFEST_FILE" "${PROJECT_ROOT}/public/cloudflare/video-manifest.json"
echo -e "${GREEN}✓ Copied to: public/cloudflare/video-manifest.json${NC}"

# Upload manifest to R2
echo -e "\n${YELLOW}Uploading manifest to R2...${NC}"
if wrangler r2 object put "${R2_BUCKET_NAME}/video-manifest.json" --file="$MANIFEST_FILE" --remote 2>/dev/null; then
    echo -e "${GREEN}✓ Manifest uploaded to R2${NC}"
else
    echo -e "${RED}✗ Failed to upload manifest to R2${NC}"
fi

# Get final count
TOTAL_VIDEOS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('${MANIFEST_FILE}', 'utf8')).totalVideos)")

# Final summary
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           ✅ Sync Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Uploaded:       ${SUCCESS} videos${NC}"
echo -e "${GREEN}Total in manifest: ${TOTAL_VIDEOS} videos${NC}"
echo -e "${GREEN}Manifest:       ${R2_PUBLIC_URL}/video-manifest.json${NC}"
echo -e "\n${YELLOW}Videos are now available at:${NC}"
echo -e "${CYAN}${R2_PUBLIC_URL}/[filename]${NC}"

