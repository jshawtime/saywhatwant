# 🚀 Git-Connected Cloudflare Deployment

You're right - git deployment is the way to go! Cloudflare now unifies Pages and Workers, so when you connect via git, you get the best of both worlds.

## The Modern Approach: Git → Cloudflare Workers

### What You'll Get:
- ✅ Automatic deployments on every push
- ✅ Preview deployments for branches
- ✅ Rollback capabilities
- ✅ Zero-config deployments
- ✅ Built-in CI/CD

## Step-by-Step Setup

### Step 1: Connect Your Git Repository (You Do This)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click **Create application** → **Pages** → **Connect to Git**
   - Yes, it says "Pages" but it's all Workers now under the hood!
4. Select your Git provider (GitHub/GitLab)
5. Choose the `saywhatwant` repository
6. **IMPORTANT**: Stop at the build configuration screen and tell me

### Step 2: Build Configuration (We'll Do Together)

When you reach the configuration screen, use these settings:

```
Project name: say-what-want
Production branch: main
Framework preset: Next.js (Static HTML Export)
Build command: npm run build
Build output directory: out
Root directory: /
Node.js version: 18
```

### Step 3: Environment Variables (In Cloudflare Dashboard)

Add these in the Cloudflare Pages/Workers settings:

```
NEXT_PUBLIC_COMMENTS_API = [will be set after worker deployment]
NEXT_PUBLIC_R2_BUCKET_URL = [will be set after R2 setup]
```

### Step 4: Deploy Comments Worker Separately

The comments worker needs to be deployed separately (it's a different endpoint):

```bash
# First, create KV namespace
wrangler kv:namespace create "COMMENTS_KV"

# Update workers/wrangler.toml with the KV ID

# Deploy comments worker
cd workers
wrangler deploy
# Note the URL (like https://sww-comments.xxx.workers.dev)
```

### Step 5: Setup R2 for Videos

1. Go to Cloudflare Dashboard → **R2**
2. Create bucket: `sww-videos`
3. Enable public access
4. Copy the public URL

### Step 6: Update Environment Variables

Go back to your Cloudflare Pages project settings and update:

```
NEXT_PUBLIC_COMMENTS_API = https://sww-comments.xxx.workers.dev/api/comments
NEXT_PUBLIC_R2_BUCKET_URL = https://pub-xxx.r2.dev
```

### Step 7: Trigger Deployment

Either:
- Push a commit to your repo
- Or click "Retry deployment" in Cloudflare

## The Final Architecture

```
┌─────────────────────────────────────┐
│         Git Repository              │
│      (GitHub/GitLab/Bitbucket)      │
└────────────┬────────────────────────┘
             │ push
             ▼
┌─────────────────────────────────────┐
│     Cloudflare Pages/Workers        │
│  (Automatic build & deployment)     │
├─────────────────────────────────────┤
│ • Main Site (Pages/Workers)         │
│   https://say-what-want.pages.dev   │
│                                     │
│ • Comments API (Separate Worker)    │
│   https://sww-comments.workers.dev  │
│                                     │
│ • Video Storage (R2)                │
│   https://pub-xxx.r2.dev           │
└─────────────────────────────────────┘
```

## Benefits of This Approach

1. **Automatic Deployments**: Push to git = instant deployment
2. **Preview Deployments**: Each PR gets its own preview URL
3. **Rollbacks**: One-click rollback to any previous deployment
4. **Branch Deployments**: Test features on separate branches
5. **No Local Wrangler Needed**: After initial setup, everything is automatic

## Quick Commands Reference

### Initial Setup Only:
```bash
# Create KV namespace for comments
wrangler kv:namespace create "COMMENTS_KV"

# Deploy comments worker
cd workers && wrangler deploy
```

### After Git Connection:
```bash
# Everything is automatic!
git add .
git commit -m "Update site"
git push origin main
# Cloudflare automatically builds and deploys
```

## Environment Files for Local Development

Create `.env.local`:
```env
NEXT_PUBLIC_COMMENTS_API=http://localhost:8787/api/comments
NEXT_PUBLIC_R2_BUCKET_URL=https://pub-xxx.r2.dev
```

For local development:
```bash
# Run comments worker locally
cd workers && wrangler dev

# Run Next.js dev server
npm run dev
```

## That's It!

Once connected via git, you get:
- Automatic deployments on every push
- Preview URLs for every branch
- Production URL: `https://say-what-want.pages.dev`
- Zero maintenance CI/CD

The best part? After initial setup, you never need to run deployment commands again - just `git push`!
