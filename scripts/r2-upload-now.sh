#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# R2 Configuration
export R2_ACCOUNT_ID="85eadfbdf07c02e77aa5dc3b46beb0f9"
export R2_ACCESS_KEY_ID="655dc0505696e129391b3a2756dc902a"
export R2_SECRET_ACCESS_KEY="789522e4838381732bdc6f51d316f33d3cc97a0bbf8cb8118f8bdb55d4a88365"
export R2_BUCKET_NAME="sww-videos"
export R2_PUBLIC_URL="https://pub-56b43531787b4783b546dd45f31651a7.r2.dev"

# Source directory
SOURCE_DIR="/Users/terminal_1/_SWW/sww-videos"

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}         Cloudflare R2 Video Upload Manager              ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Bucket: ${R2_BUCKET_NAME}${NC}"
echo -e "${GREEN}Public URL: ${R2_PUBLIC_URL}${NC}"
echo -e "${GREEN}Source: ${SOURCE_DIR}${NC}"

# Install rclone if not present
if ! command -v rclone &> /dev/null; then
    echo -e "\n${YELLOW}Installing rclone for efficient bulk upload...${NC}"
    brew install rclone
fi

# Configure rclone for R2
echo -e "\n${YELLOW}Configuring rclone for R2...${NC}"
cat > ~/.config/rclone/rclone.conf << EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
acl = private
EOF

echo -e "${GREEN}✓ rclone configured${NC}"

# Count videos
TOTAL_VIDEOS=$(ls -1 "$SOURCE_DIR"/*.mp4 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$SOURCE_DIR" | cut -f1)

echo -e "\n${CYAN}═══ Upload Summary ═══${NC}"
echo -e "${YELLOW}Videos to upload: ${TOTAL_VIDEOS}${NC}"
echo -e "${YELLOW}Total size: ${TOTAL_SIZE}${NC}"

# Start upload with progress
echo -e "\n${GREEN}Starting upload to R2...${NC}"
echo -e "${YELLOW}This will take a few minutes for 1.3GB of videos...${NC}\n"

rclone copy "$SOURCE_DIR" r2:${R2_BUCKET_NAME} \
    --progress \
    --transfers 4 \
    --checkers 8 \
    --s3-chunk-size 64M \
    --s3-upload-concurrency 4

# Check if upload was successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ All videos uploaded successfully!${NC}"
    
    # List uploaded files to verify
    echo -e "\n${YELLOW}Verifying upload...${NC}"
    UPLOADED_COUNT=$(rclone ls r2:${R2_BUCKET_NAME} | wc -l)
    echo -e "${GREEN}✓ ${UPLOADED_COUNT} files in R2 bucket${NC}"
    
    # Update app configuration
    echo -e "\n${YELLOW}Updating app configuration...${NC}"
    
    # Update video source config
    cat > config/video-source.ts << 'EOF'
/**
 * Video Source Configuration
 * Toggle between local and R2 bucket sources
 */

export const VIDEO_SOURCE_CONFIG = {
  // ============================================
  // TOGGLE THIS TO SWITCH BETWEEN LOCAL AND R2
  // ============================================
  useLocal: false,  // Using R2 bucket now!
  
  // Local configuration
  local: {
    videosPath: '/sww-videos',  // Path in public folder
    manifestPath: '/sww-videos/video-manifest.json'
  },
  
  // R2 configuration (will be used when useLocal = false)
  r2: {
    bucketUrl: 'https://pub-56b43531787b4783b546dd45f31651a7.r2.dev',
    manifestPath: '/video-manifest.json'
  },
  
  // Bucket/folder name (same for both local and R2)
  bucketName: 'sww-videos'
};

/**
 * Get the current video source configuration
 */
export function getVideoSource() {
  if (VIDEO_SOURCE_CONFIG.useLocal) {
    return {
      type: 'local' as const,
      baseUrl: '',
      manifestUrl: VIDEO_SOURCE_CONFIG.local.manifestPath,
      videosPath: VIDEO_SOURCE_CONFIG.local.videosPath
    };
  } else {
    return {
      type: 'r2' as const,
      baseUrl: VIDEO_SOURCE_CONFIG.r2.bucketUrl,
      manifestUrl: `${VIDEO_SOURCE_CONFIG.r2.bucketUrl}${VIDEO_SOURCE_CONFIG.r2.manifestPath}`,
      videosPath: ''
    };
  }
}
EOF
    
    echo -e "${GREEN}✓ Configuration updated to use R2${NC}"
    
    # Create environment variables file for reference
    cat > .env.r2 << EOF
# R2 Configuration (for reference)
R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
R2_BUCKET_NAME=${R2_BUCKET_NAME}
R2_PUBLIC_URL=${R2_PUBLIC_URL}
NEXT_PUBLIC_R2_BUCKET_URL=${R2_PUBLIC_URL}
EOF
    
    echo -e "${GREEN}✓ Environment variables saved to .env.r2${NC}"
    
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}        🎉 R2 Upload Complete! 🎉${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ ${TOTAL_VIDEOS} videos uploaded to R2${NC}"
    echo -e "${GREEN}✅ App configured to use R2${NC}"
    echo -e "${GREEN}✅ Public URL: ${R2_PUBLIC_URL}${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo -e "1. ${CYAN}Generate R2 manifest:${NC} node scripts/r2-manifest-generator.js"
    echo -e "2. ${CYAN}Commit changes:${NC} git add . && git commit -m 'feat: configure R2 video storage'"
    echo -e "3. ${CYAN}Deploy:${NC} git push origin main"
    echo -e "\n${GREEN}Your videos will be served from R2 at:${NC}"
    echo -e "${CYAN}${R2_PUBLIC_URL}/<video-filename>${NC}"
    
else
    echo -e "\n${RED}❌ Upload failed. Please check your credentials and try again.${NC}"
    exit 1
fi
