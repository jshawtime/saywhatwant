# 🚀 Say What Want - Deployment Guide

## Two Deployment Options

### Option 1: Git-Connected Deployment (Recommended)
Best for production with automatic deployments, preview environments, and rollbacks.

### Option 2: Direct Workers Deployment
Best for quick testing or when you want full control over deployments.

---

## Option 1: Git-Connected Cloudflare Deployment 🔄

### Your Part (5 minutes)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
2. Click **Create application** → **Pages** → **Connect to Git**
3. Select your repository (`saywhatwant`)
4. **STOP** at the build configuration screen
5. Tell me: "I've connected the repo"

### Our Part Together (10 minutes)
Run the automated setup:
```bash
npm run cloudflare:git-setup
```

This interactive script will:
- ✅ Configure build settings guidance
- ✅ Create KV namespace for comments
- ✅ Deploy the comments worker
- ✅ Guide you through R2 setup
- ✅ Set up environment variables
- ✅ Create deployment configuration

### After Setup
Just push to git:
```bash
git add .
git commit -m "Deploy to Cloudflare"
git push origin main
```

Your site auto-deploys to: `https://say-what-want.pages.dev`

### Benefits
- 🚀 Automatic deployments on every push
- 🔄 Preview deployments for every branch
- ↩️ One-click rollbacks
- 🌍 Global CDN distribution
- 📊 Built-in analytics

---

## Option 2: Direct Workers Deployment 🛠️

### Quick Setup (15 minutes)
```bash
# 1. Login to Cloudflare
wrangler login

# 2. Run automated setup
npm run cloudflare:setup

# 3. Follow the prompts
```

### Manual Deployment
```bash
# Build and deploy everything
npm run build
npm run deploy:all
```

Your site deploys to: `https://say-what-want.[subdomain].workers.dev`

### Benefits
- 🎯 Direct control over deployments
- 🔧 No git connection required
- ⚡ Instant deployments
- 🛠️ Good for development/testing

---

## Architecture Overview

```
┌─────────────────────────────┐
│      Git Repository         │ (Option 1)
│         (GitHub)            │
└──────────┬──────────────────┘
           │ push
           ▼
┌─────────────────────────────────────────────┐
│          Cloudflare Platform                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   Pages/Workers (Main Site)          │  │
│  │   • Next.js static build             │  │
│  │   • Auto-deployed from git           │  │
│  │   • URL: say-what-want.pages.dev     │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   Worker (Comments API)              │  │
│  │   • Separate endpoint                │  │
│  │   • KV storage for comments          │  │
│  │   • URL: sww-comments.workers.dev    │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   R2 Storage (Videos)                │  │
│  │   • Object storage for videos        │  │
│  │   • Public access enabled            │  │
│  │   • URL: pub-xxx.r2.dev              │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Quick Reference

### Git-Connected Setup
```bash
npm run cloudflare:git-setup   # Interactive setup wizard
git push origin main           # Deploy automatically
```

### Direct Workers Setup
```bash
npm run cloudflare:setup       # Interactive setup wizard
npm run deploy:all             # Manual deployment
```

### Local Development
```bash
# Terminal 1: Run comments worker
cd workers && wrangler dev

# Terminal 2: Run Next.js
npm run dev
```

### Environment Variables
Created automatically during setup:
- `.env.local` - Local development
- Cloudflare Dashboard - Production

---

## Troubleshooting

### Comments not working?
```bash
# Check worker deployment
cd workers && wrangler tail

# Verify KV namespace
wrangler kv:key list --binding COMMENTS_KV
```

### Build failing?
- Check Node.js version is 18+
- Verify environment variables in Cloudflare Dashboard
- Check build logs in Cloudflare Pages

### Videos not loading?
- Ensure R2 bucket has public access
- Verify R2_BUCKET_URL is correct
- Check video-manifest.json exists

---

## Support Scripts

- `npm run cloudflare:git-setup` - Git-connected deployment setup
- `npm run cloudflare:setup` - Direct Workers deployment setup  
- `npm run cloudflare:deploy` - Quick deployment script
- `npm run manifest:generate` - Generate video manifest from R2
- `npm run worker:deploy` - Deploy comments worker only
- `npm run deploy` - Deploy main site only
- `npm run deploy:all` - Deploy everything

---

## Ready to Deploy?

Choose your path:
1. **Git-connected** (recommended): Connect repo → Run `npm run cloudflare:git-setup`
2. **Direct Workers**: Run `npm run cloudflare:setup`

Both take about 10-15 minutes total! 🚀
