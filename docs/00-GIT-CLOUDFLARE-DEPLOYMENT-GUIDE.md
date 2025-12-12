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

> **4 Deployment Paths:**
> 1. saywhatwant UI → Git push auto-deploys via Cloudflare Pages
> 2. saywhatwant Worker → Manual `wrangler deploy`
> 3. HIGHERMIND-site → Manual `npx @opennextjs/cloudflare build && deploy`
> 4. hm-server-deployment → Local `npm run build && pm2 restart all`

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

## Complete Workflow: All 4 Deployment Paths

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
npx @opennextjs/cloudflare build && npx @opennextjs/cloudflare deploy

# 4. hm-server-deployment (local rebuild)
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment
git add -A && git commit -m "Changes to backend" && git push
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

| Action | saywhatwant UI | saywhatwant Worker | HIGHERMIND-site | hm-server-deployment |
|--------|----------------|-------------------|-----------------|---------------------|
| **Git Branch** | main | main | master | main |
| **Git Push** | `git push` | `git push` | `git push origin master` | `git push` |
| **Deploy Trigger** | Auto (Pages) | Manual | Manual | Manual (PM2) |
| **Deploy Command** | N/A (auto) | `wrangler deploy` | `npx @opennextjs/cloudflare build && deploy` | `npm run build && pm2 restart all` |
| **Verify** | curl saywhatwant.app | curl saywhatwant.app | curl highermind.ai | `pm2 list` |

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

