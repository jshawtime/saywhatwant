# 00: Git & Cloudflare Deployment Guide

> **Created**: December 12, 2025  
> **Purpose**: Complete deployment guide for all 3 repositories in the SAYWHATWANTv1 project

---

## Project Structure

```
SAYWHATWANTv1/
├── saywhatwant/           → Cloudflare Pages (auto-deploy)
├── HIGHERMIND-site/       → Cloudflare Workers (manual deploy)
└── hm-server-deployment/  → Local server (PM2)
```

---

## Quick Reference

| Component | Git Remote | Deploy Method | Domain |
|-----------|------------|---------------|--------|
| **saywhatwant UI** | github.com/jshawtime/saywhatwant | **Auto** (git push) | saywhatwant.app |
| **saywhatwant Worker** | (same repo) | **Manual** (wrangler) | (KV/API bindings) |
| **HIGHERMIND-site** | github.com/pbosh/HIGHERMIND-site | **Manual** (wrangler) | highermind.ai |
| **hm-server-deployment** | github.com (main) | **Local** (PM2) | N/A (local) |
| **Entity Videos** | saywhatwant repo | **Script** (sync-videos-to-r2.sh) | R2 bucket |
| **Entity Images** | HIGHERMIND-site repo | **Deploy** (npm run deploy) | highermind.ai |

> **6 Deployment Paths:**
> 1. saywhatwant UI → Git push auto-deploys via Cloudflare Pages
> 2. saywhatwant Worker → Manual `wrangler deploy`
> 3. HIGHERMIND-site → Manual `npx @opennextjs/cloudflare build && deploy`
> 4. hm-server-deployment → Local `npm run build && pm2 restart all`
> 5. Entity Videos → `./scripts/sync-videos-to-r2.sh` (uploads to R2)
> 6. Entity Images → Add to `art-models/` then `npm run deploy`

---

## 1. saywhatwant (Frontend Chat App)

### Overview
- **Technology**: Next.js 14, React, Tailwind CSS
- **Hosting**: Cloudflare Pages (UI) + Cloudflare Workers (API/KV)
- **Domain**: https://saywhatwant.app

### Git Info
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
git remote -v
# origin  https://github.com/jshawtime/saywhatwant (fetch/push)
# Branch: main
```

### ⚠️ TWO Deployment Paths

This repo has **two separate deployment targets**:

| Component | Deploy Method | When to Use |
|-----------|---------------|-------------|
| **UI/Frontend** | Git push (auto) | React components, CSS, pages |
| **Worker** | Manual wrangler | KV bindings, API routes, worker code |

---

### Path A: UI Changes (Auto-Deploy)

**For changes to:** React components, styles, pages, frontend logic

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# Just push to git - Cloudflare Pages auto-deploys
git add -A
git commit -m "Description of changes"
git push

# ✅ Done! Cloudflare Pages will auto-build and deploy
```

**Monitor at:** https://dash.cloudflare.com → Pages → say-what-want

---

### Path B: Worker Changes (Manual Deploy)

**For changes to:** Worker code, KV bindings, wrangler.toml, API routes

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# 1. Push to git (for version control)
git add -A
git commit -m "Description of changes"
git push

# 2. Deploy worker manually
wrangler deploy
```

### Wrangler Configuration
File: `wrangler.toml`
```toml
name = "say-what-want"
main = "workers/site-worker.js"
[site]
bucket = "./out"

[[kv_namespaces]]
binding = "COMMENTS_KV"
id = "ddf6162d4c874d52bb6e41d1c3889a0f"
```

---

### When to Use Which?

| Change Type | Deploy Method |
|-------------|---------------|
| VideoPlayer.tsx | Git push (auto) |
| CommentsStream.tsx | Git push (auto) |
| CSS/Tailwind | Git push (auto) |
| wrangler.toml | `wrangler deploy` |
| workers/site-worker.js | `wrangler deploy` |
| KV namespace changes | `wrangler deploy` |

### Verify Deployment
```bash
curl -I https://saywhatwant.app
# Should return HTTP/2 200
```

---

## 2. HIGHERMIND-site (Gallery Site)

### Overview
- **Technology**: Next.js 15, React, Tailwind CSS, OpenNext
- **Hosting**: Cloudflare Workers
- **Deployment**: MANUAL via wrangler (NOT auto-deploy)
- **Domain**: https://highermind.ai (also: highermind-ai.pbosh.workers.dev)

### Git Info
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/HIGHERMIND-site
git remote -v
# origin  https://github.com/pbosh/HIGHERMIND-site (fetch/push)
# Branch: master
```

### ⚠️ IMPORTANT: Two-Step Process

**Git push does NOT deploy. You must manually deploy to Cloudflare.**

### Deploy Process

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/HIGHERMIND-site

# Step 1: Push to Git (for backup/version control)
git add -A
git commit -m "Description of changes"
git push origin master

# Step 2: Deploy to Cloudflare Workers (REQUIRED)
npx @opennextjs/cloudflare build && npx @opennextjs/cloudflare deploy
```

### Alternative: Use npm script
```bash
npm run deploy
# This runs: npx opennextjs-cloudflare build && npx wrangler deploy
```

### Build + Deploy One-Liner
```bash
git add -A && git commit -m "Message" && git push origin master && npx @opennextjs/cloudflare build && npx @opennextjs/cloudflare deploy
```

### Cloudflare Login (if needed)
```bash
npx wrangler whoami
# Should show: Pbosh@rbu.ai's Account

# If not logged in:
npx wrangler login
```

### Wrangler Configuration
File: `wrangler.json`
```json
{
  "name": "highermind-ai",
  "account_id": "9fd085c31ec631442601a3918e75c68d",
  "main": ".open-next/worker.js",
  "assets": { "directory": ".open-next/assets" }
}
```

### Typical Deploy Time
- Build: ~10-15 seconds (OpenNext)
- Upload: ~5-10 seconds
- Deploy: ~1-2 seconds
- Total: ~20-30 seconds

### Verify Deployment
```bash
curl -I https://highermind.ai
# or
curl -I https://highermind-ai.pbosh.workers.dev
```

---

## 3. hm-server-deployment (Backend Server)

### Overview
- **Technology**: Node.js, TypeScript, PM2, Ollama
- **Hosting**: Local Mac Mini (10.0.0.100)
- **Deployment**: Local only (rebuild + PM2 restart)
- **Components**: AI Bot Workers, Ollama models, Queue Monitor

### Git Info
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment
git remote -v
# origin  (github URL)
# Branch: main
```

### Push to Git (for backup)
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment
git add -A
git commit -m "Description of changes"
git push
```

### Rebuild Backend (if code changes)
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy

# Rebuild TypeScript
npm run build

# Restart PM2 workers
pm2 restart all
# or specific:
pm2 restart do-worker-0
```

### Key PM2 Commands
```bash
pm2 list                    # View all processes
pm2 logs                    # View all logs
pm2 logs do-worker-0        # View specific worker logs
pm2 restart all             # Restart all workers
pm2 stop all                # Stop all workers
pm2 delete all              # Remove all workers
```

### Start Scripts
```bash
# Full system start
./start-system.sh

# Just AI bot workers
./start-do-bot.sh

# Rebuild and start
./rebuild-and-start.sh
```

---

## 4. Adding New Entity Videos (R2 Upload)

### Overview
- **Storage**: Cloudflare R2 (sww-videos bucket)
- **Public URL**: https://pub-56b43531787b4783b546dd45f31651a7.r2.dev
- **Script**: `saywhatwant/scripts/sync-videos-to-r2.sh`

### Video Naming Convention

| Type | Format | Example |
|------|--------|---------|
| **Entity Intro** | `[entity-id].mov` | `god-mode.mov`, `the-eternal.mov` |
| **Background Video** | `sww-XXXXX.mp4` | `sww-037kc.mp4` |

> Entity intros are automatically linked to entities via `entityId` in the manifest.

### Upload Process

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# 1. Place video in the upload folder
cp /path/to/your-video.mov videos-to-upload/

# 2. Upload single video (recommended for large files)
./scripts/sync-videos-to-r2.sh --file=your-video.mov

# OR upload all new videos
./scripts/sync-videos-to-r2.sh
```

### Script Options

| Option | Description |
|--------|-------------|
| `--file=FILENAME` | Upload only the specified file |
| `--dry-run` | Show what would be uploaded without uploading |
| `--force` | Re-upload even if file exists in R2 |
| `--intros-only` | Only upload entity intro videos (not background) |

### What the Script Does
1. Checks R2 for existing files (via HTTP HEAD requests)
2. Skips files that already exist
3. Uploads new files via `wrangler r2 object put`
4. Updates the video manifest (`public/r2-video-manifest.json`)
5. Uploads updated manifest to R2

### Verify Upload
```bash
# Check if video is accessible
curl -I "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/god-mode.mov"
# Should return HTTP/1.1 200 OK

# Check manifest
curl -s "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json" | grep "god-mode"
```

### Example: Adding god-mode Video
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# Video is already in videos-to-upload/god-mode.mov
./scripts/sync-videos-to-r2.sh --file=god-mode.mov

# Output:
# Checking god-mode.mov... not found, will upload
# Uploading god-mode.mov (115M)... ✓
# Added: god-mode.mov (intro for god-mode)
# Manifest uploaded to R2
```

---

## 5. Adding New Entity Images (HIGHERMIND-site)

### Overview
- **Source Folder**: `HIGHERMIND-site/art-models/`
- **Auto-synced to**: `HIGHERMIND-site/public/art-models/`
- **Config File**: `HIGHERMIND-site/public/config-aientities.json`

### Image Naming Convention

| Format | Example |
|--------|---------|
| `[entity-id].jpg` | `god-mode.jpg`, `the-eternal.jpg` |

> Entity ID must match the backend entity name exactly.

### Add New Entity Image

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/HIGHERMIND-site

# 1. Copy image to art-models folder
cp /path/to/god-mode.jpg art-models/

# 2. Deploy (this auto-syncs images and updates config)
npm run deploy
```

### What Happens on Deploy

The `npm run deploy` script (via `npm run generate:config`) automatically:

1. **Scans** `art-models/` folder for new images
2. **Copies** new images to `public/art-models/`
3. **Updates** `config-aientities.json`:
   - Preserves existing config for known entities
   - Adds new entries for new images with default values
4. **Builds** and deploys to Cloudflare

### Manual Config Update (Optional)

After adding an image, you may want to update the entity's config:

```bash
# Edit the config file
nano public/config-aientities.json
```

Add/update fields:
```json
"god-mode": {
  "display-name": "GodMode",
  "entity": "god-mode",
  "amazon-link": "https://amazon.com/...",
  "description": "Your description here",
  "keywords": ["god", "mode", "omniscient"],
  "based-on": "Book Title by Author",
  "amazon-affiliate-link": "https://a.co/d/..."
}
```

### Complete Example: Adding god-mode

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/HIGHERMIND-site

# 1. Add the image
cp ~/Downloads/god-mode.jpg art-models/

# 2. Deploy (auto-generates config entry)
npm run deploy

# Output shows:
# 📋 Syncing images to public/art-models...
#    📋 Copied: god-mode.jpg
# 📝 Building config from art-models folder:
#    + god-mode → GodMode (NEW - added at end)

# 3. Optionally update config with more details
# Edit public/config-aientities.json to add description, amazon links, etc.

# 4. Re-deploy if config was changed
npm run deploy
```

### Verify Image Deployed
```bash
curl -I "https://highermind.ai/art-models/god-mode.jpg"
# Should return HTTP/2 200
```

---

## Complete Workflow: All 6 Deployment Paths

When you've made changes across multiple repos:

```bash
# 1. saywhatwant UI (auto-deploy on git push)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
git add -A && git commit -m "Changes to frontend" && git push
# ✅ Cloudflare Pages auto-deploys

# 2. saywhatwant Worker (if KV/worker changes)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
wrangler deploy

# 3. HIGHERMIND-site (manual deploy)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/HIGHERMIND-site
git add -A && git commit -m "Changes to gallery" && git push origin master
npm run deploy

# 4. hm-server-deployment (local rebuild)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment
git add -A && git commit -m "Changes to backend" && git push
cd AI-Bot-Deploy && npm run build && pm2 restart all

# 5. Entity Videos (upload to R2)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
./scripts/sync-videos-to-r2.sh --file=new-entity.mov

# 6. Entity Images (add to HIGHERMIND-site)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/HIGHERMIND-site
cp /path/to/new-entity.jpg art-models/
npm run deploy
```

---

## Status Check Commands

### Check all repos status
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1

echo "=== saywhatwant ===" && cd saywhatwant && git status && cd ..
echo "=== HIGHERMIND-site ===" && cd HIGHERMIND-site && git status && cd ..
echo "=== hm-server-deployment ===" && cd hm-server-deployment && git status && cd ..
```

### Check Cloudflare Workers status
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/HIGHERMIND-site
npx wrangler whoami
npx wrangler deployments list
```

### Check PM2 status (backend)
```bash
pm2 list
pm2 status
```

---

## Troubleshooting

### Git Push Issues

**Permission denied (publickey)**
```bash
# Use HTTPS instead of SSH
git remote set-url origin https://github.com/USER/REPO.git
```

**Authentication failed**
```bash
# Login with GitHub CLI
gh auth login
```

### Cloudflare Issues

**Not logged in**
```bash
npx wrangler login
```

**Build failed**
```bash
# Check for errors
npm run build 2>&1 | head -50
```

**Deploy failed**
```bash
# Check wrangler config
cat wrangler.json
npx wrangler whoami
```

### PM2 Issues

**Workers not starting**
```bash
pm2 logs --lines 50
```

**Rebuild required**
```bash
cd AI-Bot-Deploy
npm run clean
npm run build
pm2 restart all
```

---

## Summary Table

| Action | saywhatwant UI | saywhatwant Worker | HIGHERMIND-site | hm-server-deployment | Entity Videos | Entity Images |
|--------|----------------|-------------------|-----------------|---------------------|---------------|---------------|
| **Git Branch** | main | main | master | main | main | master |
| **Git Push** | `git push` | `git push` | `git push origin master` | `git push` | `git push` | `git push origin master` |
| **Deploy Trigger** | Auto (Pages) | Manual | Manual | Manual (PM2) | Manual (Script) | Manual (Deploy) |
| **Deploy Command** | N/A (auto) | `wrangler deploy` | `npm run deploy` | `npm run build && pm2 restart all` | `./scripts/sync-videos-to-r2.sh` | `npm run deploy` |
| **Verify** | curl saywhatwant.app | curl saywhatwant.app | curl highermind.ai | `pm2 list` | curl R2 URL | curl highermind.ai/art-models/ |

---

## Key URLs

| Service | URL |
|---------|-----|
| saywhatwant.app | https://saywhatwant.app |
| highermind.ai | https://highermind.ai |
| Workers Dev | https://highermind-ai.pbosh.workers.dev |
| Cloudflare Dashboard | https://dash.cloudflare.com |
| Queue Monitor | http://10.0.0.100:5173 |
| R2 Videos Bucket | https://pub-56b43531787b4783b546dd45f31651a7.r2.dev |
| Video Manifest | https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json |

---

## Accounts

| Service | Account |
|---------|---------|
| Cloudflare | pbosh@rbu.ai |
| GitHub (saywhatwant) | jshawtime |
| GitHub (HIGHERMIND) | pbosh |

---

*Last updated: December 18, 2025*

