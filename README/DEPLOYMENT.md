# Say What Want - Deployment Guide

This guide will walk you through deploying Say What Want to Cloudflare (Pages + Workers + R2).

## Prerequisites

- Cloudflare account (free tier works to start)
- Node.js 18+ installed
- Wrangler CLI: `npm install -g wrangler`

## Step 1: Clone and Install

```bash
# Navigate to your project directory
cd say-what-want

# Install dependencies
npm install
```

## Step 2: Set Up Cloudflare KV (for Comments)

```bash
# Login to Cloudflare
wrangler login

# Create KV namespace for comments
cd workers
wrangler kv:namespace create "COMMENTS_KV"

# You'll see output like:
# ✨ Success! Created KV namespace
# id = "a1b2c3d4e5f6g7h8i9j0"
```

Copy the `id` value and update `workers/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "COMMENTS_KV"
id = "a1b2c3d4e5f6g7h8i9j0"  # <- paste your ID here
```

## Step 3: Deploy the Comments Worker

```bash
# From the workers directory
cd workers
wrangler deploy

# You'll get a URL like:
# https://sww-comments.YOUR-SUBDOMAIN.workers.dev
```

Save this URL - you'll need it for the frontend configuration.

## Step 4: Set Up R2 Bucket (for Videos)

### 4.1 Create R2 Bucket

1. Go to Cloudflare Dashboard → R2
2. Click "Create bucket"
3. Name it: `sww-videos`
4. Region: Choose nearest to your users
5. Click "Create bucket"

### 4.2 Configure Public Access

1. Click on your `sww-videos` bucket
2. Go to "Settings" tab
3. Under "Public Access":
   - Click "Allow Access"
   - Copy the public URL (like `https://pub-xxx.r2.dev`)

### 4.3 Get R2 Credentials

1. In R2 Overview, click "Manage R2 API tokens"
2. Click "Create API token"
3. Settings:
   - Name: `sww-videos-access`
   - Permissions: Object Read & Write
   - Specify bucket: `sww-videos`
4. Click "Create API Token"
5. Save these credentials:
   - Access Key ID
   - Secret Access Key
   - Account ID (from your Cloudflare dashboard URL)

## Step 5: Upload Videos to R2

### Option A: Via Dashboard
1. Go to your `sww-videos` bucket
2. Click "Upload"
3. Select your 9:16 videos (MP4 recommended)

### Option B: Via Wrangler
```bash
# Upload a single video
wrangler r2 object put sww-videos/video1.mp4 --file=/path/to/video1.mp4

# Upload multiple videos
for video in /path/to/videos/*.mp4; do
  wrangler r2 object put sww-videos/$(basename "$video") --file="$video"
done
```

## Step 6: Generate Video Manifest

Create `.env` file in project root:

```env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=sww-videos
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

Generate manifest:

```bash
npm run manifest:generate
```

## Step 7: Configure Frontend

Create `.env.local`:

```env
NEXT_PUBLIC_COMMENTS_API=https://sww-comments.YOUR-SUBDOMAIN.workers.dev/api/comments
NEXT_PUBLIC_R2_BUCKET_URL=https://pub-xxx.r2.dev
```

## Step 8: Build and Deploy Frontend

```bash
# Build the Next.js app
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy out --project-name=say-what-want

# You'll get a URL like:
# https://say-what-want.pages.dev
```

## Step 9: Configure Custom Domain (Optional)

### For the Frontend (Pages):
1. Go to Cloudflare Pages → your project → Custom domains
2. Add your domain
3. Follow DNS configuration instructions

### For the Worker (Comments API):
1. Update `workers/wrangler.toml`:
   ```toml
   route = "https://yourdomain.com/api/comments/*"
   ```
2. Redeploy worker: `wrangler deploy`

## Step 10: Test Everything

1. Visit your deployment URL
2. You should see:
   - Random video playing on the left
   - Comments interface on the right
3. Test features:
   - Post a comment
   - Unmute video
   - Refresh for new video
   - Search comments

## Monitoring

### View Worker Logs
```bash
cd workers
wrangler tail
```

### View KV Storage
```bash
# List all comments
wrangler kv:key list --binding COMMENTS_KV --prefix "comment:"

# View recent cache
wrangler kv:key get "recent:comments" --binding COMMENTS_KV
```

### Check R2 Usage
- Cloudflare Dashboard → R2 → Your bucket → Metrics

## Troubleshooting

### Comments not working
```bash
# Check worker status
curl https://your-worker.workers.dev/api/comments

# Check KV namespace
wrangler kv:key list --binding COMMENTS_KV
```

### Videos not loading
- Verify R2 bucket is public
- Check video manifest exists: `/public/cloudflare/video-manifest.json`
- Verify CORS settings on R2 bucket

### Rate limiting issues
```bash
# Clear rate limits
wrangler kv:key list --binding COMMENTS_KV --prefix "rate:" | \
  jq -r '.[].name' | \
  xargs -I {} wrangler kv:key delete {} --binding COMMENTS_KV
```

## Performance Tips

1. **Video Optimization**:
   - Keep videos under 50MB
   - Use H.264 codec for compatibility
   - Consider CDN caching

2. **Comments Optimization**:
   - The cache holds 5000 recent comments
   - Older comments are still accessible but load slower
   - Consider archiving very old comments

3. **Scaling**:
   - Free tier handles ~100K comments/day
   - Upgrade to Workers Paid for unlimited requests
   - R2 automatically scales

## Maintenance

### Backup Comments
```bash
# Export all comments
wrangler kv:key list --binding COMMENTS_KV --prefix "comment:" > comments-backup.json
```

### Update Video Manifest
```bash
# After adding new videos
npm run manifest:generate

# Rebuild and redeploy
npm run build
npx wrangler pages deploy out --project-name=say-what-want
```

### Clear All Comments (Reset)
```bash
# WARNING: This deletes all comments
wrangler kv:key list --binding COMMENTS_KV | \
  jq -r '.[].name' | \
  xargs -I {} wrangler kv:key delete {} --binding COMMENTS_KV
```

## Cost Estimates (Cloudflare Pricing)

**Free Tier Includes:**
- Workers: 100,000 requests/day
- KV: 100,000 reads/day, 1,000 writes/day
- R2: 10GB storage, 1M Class A operations, 10M Class B operations
- Pages: Unlimited sites and requests

**For 10,000 daily active users:**
- Workers: ~50,000 requests/day (well within free tier)
- KV: ~20,000 operations/day (within free tier)
- R2: Video bandwidth is the main cost (~$0.015/GB)
- Estimated: $0-10/month depending on video sizes

## Support

If you encounter issues:
1. Check the browser console for errors
2. Review worker logs: `wrangler tail`
3. Verify all environment variables are set
4. Ensure all services are deployed

---

*Built with the SoundTrip philosophy: Simple, Strong, Solid code that scales.*
