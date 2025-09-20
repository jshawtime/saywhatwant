# Cloudflare R2 Video Storage Setup

## Quick Setup Steps

### 1. Create R2 Bucket in Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Navigate to R2 → Create bucket
3. Name: `sww-videos`
4. Location: Automatic
5. Click "Create bucket"

### 2. Configure Public Access
1. In your R2 bucket settings → Settings tab
2. Under "Public Access", click "Allow Access"
3. Copy the public URL (looks like: `https://pub-xxxxx.r2.dev`)

### 3. Create R2 API Token
1. Go to R2 → Manage R2 API tokens
2. Click "Create API token"
3. Name: `sww-videos-upload`
4. Permissions: **Object Read & Write**
5. Specify bucket: `sww-videos`
6. Click "Create API Token"
7. **Save these values:**
   - Access Key ID
   - Secret Access Key

### 4. Install Wrangler R2 CLI
```bash
npm install -g @cloudflare/wrangler
```

### 5. Configure Environment Variables
Create `.env.local` file:
```env
# R2 Configuration
R2_ACCOUNT_ID=85eadfbdf07c02e77aa5dc3b46beb0f9
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
R2_BUCKET_NAME=sww-videos
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
NEXT_PUBLIC_R2_BUCKET_URL=https://pub-xxxxx.r2.dev
```

### 6. Upload Videos Script
Save this as `upload-videos-to-r2.sh`:

```bash
#!/bin/bash

# Configuration
SOURCE_DIR="/Users/terminal_1/_SWW/sww-videos"
BUCKET_NAME="sww-videos"

# Upload all videos
for video in "$SOURCE_DIR"/*.mp4; do
  filename=$(basename "$video")
  echo "Uploading $filename..."
  wrangler r2 object put "$BUCKET_NAME/$filename" --file="$video"
done

echo "✅ Upload complete!"
```

### 7. Alternative: Use rclone for Bulk Upload
```bash
# Install rclone
brew install rclone

# Configure rclone for R2
rclone config
# Choose: n (new remote)
# Name: r2
# Storage: s3
# Provider: Cloudflare
# Access Key ID: [your key]
# Secret Access Key: [your secret]
# Endpoint: https://[account-id].r2.cloudflarestorage.com
# Location constraint: auto

# Upload all videos
rclone copy /Users/terminal_1/_SWW/sww-videos/ r2:sww-videos/ --progress
```

### 8. Update App Configuration
In `config/video-source.ts`, change:
```typescript
useLocal: false,  // Switch from local to R2
```

### 9. Generate R2 Manifest
```bash
node scripts/r2-manifest-generator.js
```

### 10. Deploy Changes
```bash
git add .
git commit -m "feat: configure R2 video storage"
git push origin main
# Auto-deploys to Cloudflare Pages
```

## Your Videos
- **Total Videos**: 238 files
- **Total Size**: 1.3GB
- **Source**: `/Users/terminal_1/_SWW/sww-videos/`

## Next Steps
1. Create the R2 bucket in Cloudflare Dashboard
2. Get the public URL and API credentials
3. Tell me when you have them
4. I'll help you upload all 238 videos
