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

| Repo | Git Remote | Deploy Method | Domain |
|------|------------|---------------|--------|
| `saywhatwant` | github.com/jshawtime/saywhatwant | **Manual** (wrangler) | saywhatwant.app |
| `HIGHERMIND-site` | github.com/pbosh/HIGHERMIND-site | **Manual** (wrangler) | highermind.ai |
| `hm-server-deployment` | github.com (main) | **Local** (PM2) | N/A (local) |

> ⚠️ **Both frontend sites require manual Cloudflare deployment after git push!**

---

## 1. saywhatwant (Frontend Chat App)

### Overview
- **Technology**: Next.js 14, React, Tailwind CSS
- **Hosting**: Cloudflare Workers (static site)
- **Deployment**: MANUAL via wrangler (NOT auto-deploy)
- **Domain**: https://saywhatwant.app

### Git Info
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
git remote -v
# origin  https://github.com/jshawtime/saywhatwant (fetch/push)
# Branch: main
```

### ⚠️ IMPORTANT: Two-Step Process

**Git push does NOT deploy. You must manually deploy to Cloudflare.**

### Deploy Process

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# Step 1: Push to Git (for backup/version control)
git add -A
git commit -m "Description of changes"
git push

# Step 2: Build and Deploy to Cloudflare Workers (REQUIRED)
npm run build
wrangler deploy
```

### One-Liner (Git + Deploy)
```bash
git add -A && git commit -m "Message" && git push && npm run build && wrangler deploy
```

### Wrangler Configuration
File: `wrangler.toml`
```toml
name = "say-what-want"
main = "workers/site-worker.js"
[site]
bucket = "./out"
```

### Build Command
```bash
npm run build
# Runs: NEXT_PUBLIC_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ") next build
# Creates static site in ./out directory
```

### Deploy Command
```bash
wrangler deploy
# Uploads ./out to Cloudflare Workers
# Deploys to saywhatwant.app
```

### Typical Deploy Time
- Build: ~30-60 seconds
- Deploy: ~10-20 seconds
- Total: ~1 minute

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

## Complete Workflow: All 3 Repos

When you've made changes across multiple repos:

```bash
# 1. saywhatwant (needs manual deploy)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
git add -A && git commit -m "Changes to frontend" && git push
npm run build && wrangler deploy

# 2. HIGHERMIND-site (needs manual deploy)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/HIGHERMIND-site
git add -A && git commit -m "Changes to gallery" && git push origin master
npx @opennextjs/cloudflare build && npx @opennextjs/cloudflare deploy

# 3. hm-server-deployment (local rebuild)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment
git add -A && git commit -m "Changes to backend" && git push
# If code changed:
cd AI-Bot-Deploy && npm run build && pm2 restart all
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

| Action | saywhatwant | HIGHERMIND-site | hm-server-deployment |
|--------|-------------|-----------------|---------------------|
| **Git Branch** | main | master | main |
| **Git Push** | `git push` | `git push origin master` | `git push` |
| **Deploy Trigger** | Manual command | Manual command | Manual (PM2) |
| **Deploy Command** | `npm run build && wrangler deploy` | `npx @opennextjs/cloudflare build && deploy` | `npm run build && pm2 restart all` |
| **Verify** | curl saywhatwant.app | curl highermind.ai | `pm2 list` |

---

## Key URLs

| Service | URL |
|---------|-----|
| saywhatwant.app | https://saywhatwant.app |
| highermind.ai | https://highermind.ai |
| Workers Dev | https://highermind-ai.pbosh.workers.dev |
| Cloudflare Dashboard | https://dash.cloudflare.com |
| Queue Monitor | http://10.0.0.100:5173 |

---

## Accounts

| Service | Account |
|---------|---------|
| Cloudflare | pbosh@rbu.ai |
| GitHub (saywhatwant) | jshawtime |
| GitHub (HIGHERMIND) | pbosh |

---

*Last updated: December 12, 2025*

