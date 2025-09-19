# 🚀 Quick Start - Deploy in 15 Minutes

## The Plan
You connect to git → I help configure → Auto-deploy forever!

## Step 1: Connect Your Git Repo (You - 2 min)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Workers & Pages**
3. Click **Create application** → **Pages** → **Connect to Git**
4. Authorize and select the `saywhatwant` repository
5. **STOP** at the build configuration screen
6. Tell me: "Connected!"

## Step 2: Run Setup (Us Together - 10 min)

```bash
npm run cloudflare:git-setup
```

This will:
- ✅ Show you exact build settings to use
- ✅ Create KV storage for comments
- ✅ Deploy the comments API
- ✅ Guide you through R2 setup
- ✅ Configure everything

## Step 3: Deploy (Automatic - 3 min)

```bash
git push origin main
```

That's it! Cloudflare auto-builds and deploys.

## Your URLs

- **Main Site**: `https://say-what-want.pages.dev`
- **Comments API**: `https://sww-comments.[subdomain].workers.dev`
- **Videos**: `https://pub-xxx.r2.dev`

## After Setup

Every time you push to git:
- ✅ Automatic deployment
- ✅ Preview URLs for branches
- ✅ Zero maintenance

---

**Ready?** Connect your repo and let's go! 🎉
