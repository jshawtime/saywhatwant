# 🚀 Cloudflare Workers Deployment Guide

## Overview
This Next.js app deploys to Cloudflare Workers with:
- **Main Site**: Static Next.js build served via Workers Sites
- **Comments API**: Separate Worker with KV storage
- **Video Storage**: Cloudflare R2 bucket

## Quick Start (15 minutes total)

### Step 1: Initial Setup (5 min)
```bash
# Install dependencies if you haven't
npm install

# Login to Cloudflare
wrangler login
```

### Step 2: Create KV Namespace (2 min)
```bash
# Create KV namespace for comments
wrangler kv:namespace create "COMMENTS_KV"
```

Save the ID that's returned - you'll need it for both workers!

### Step 3: Create R2 Bucket (3 min)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2**
2. Click **Create bucket**
3. Name it: `sww-videos`
4. After creation, go to **Settings** → **Public Access** → **Allow Access**
5. Copy the public URL (like `https://pub-xxx.r2.dev`)

### Step 4: Configure Environment (2 min)

Run the automated setup:
```bash
npm run cloudflare:setup
```

Or manually update these files:

**wrangler.toml** (main site):
```toml
[[kv_namespaces]]
binding = "COMMENTS_KV"
id = "YOUR_KV_NAMESPACE_ID"  # <- paste your KV ID here

[vars]
COMMENTS_WORKER_URL = "https://sww-comments.YOUR-SUBDOMAIN.workers.dev"
R2_BUCKET_URL = "https://pub-xxx.r2.dev"  # <- your R2 public URL
```

**workers/wrangler.toml** (comments API):
```toml
[[kv_namespaces]]
binding = "COMMENTS_KV"
id = "YOUR_KV_NAMESPACE_ID"  # <- same KV ID here
```

### Step 5: Deploy Everything (3 min)

```bash
# Build the Next.js app
npm run build

# Deploy comments worker
cd workers
wrangler deploy

# Note the URL (like https://sww-comments.xxx.workers.dev)
cd ..

# Deploy main site
wrangler deploy
```

## Your URLs

After deployment:
- **Main Site**: `https://say-what-want.YOUR-SUBDOMAIN.workers.dev`
- **Comments API**: `https://sww-comments.YOUR-SUBDOMAIN.workers.dev`
- **R2 Videos**: `https://pub-xxx.r2.dev`

## Testing

```bash
# Test comments API
curl https://sww-comments.YOUR-SUBDOMAIN.workers.dev/api/comments

# Monitor logs
wrangler tail  # for main site
cd workers && wrangler tail  # for comments API

# Check KV storage
wrangler kv:key list --binding COMMENTS_KV
```

## Automated Deployment (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build Next.js
        run: npm run build
        
      - name: Deploy Comments Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          workingDirectory: workers
          command: deploy
          
      - name: Deploy Main Site
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: deploy
```

Add to GitHub Secrets:
- `CF_API_TOKEN`: Your Cloudflare API token

## Troubleshooting

### Comments not working?
- Check both workers have the same KV namespace ID
- Verify COMMENTS_WORKER_URL in wrangler.toml
- Check CORS headers in comments-worker.js

### Videos not loading?
- Ensure R2 bucket has public access enabled
- Check R2_BUCKET_URL in environment variables
- Verify video-manifest.json exists in public/cloudflare/

### Build errors?
- Make sure you're using Node.js 18+
- Run `npm run build` locally first
- Check for TypeScript errors

## That's it! 🎉

Your app is now deployed globally on Cloudflare's edge network!
