# Quick Start Guide - SAYWHATWANTv1

## 🚀 Start Development

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
npm run dev
```
Open: http://localhost:3000

## 🛠️ Most Common Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run dev:clean        # Kill ports 3000/3001 & start fresh

# Building
npm run build            # Production build
npm start                # Run production build

# Testing
npm run test             # Run Playwright tests
npm run test:ui          # Interactive test UI

# AI Bot
cd saywhatwant/ai
npm run dev              # AI bot development mode
npm run console          # AI console UI
```

## 📁 Project Structure

```
saywhatwant/
├── app/              # Next.js pages
├── components/       # React components
├── modules/          # Business logic
├── hooks/            # Custom React hooks
├── workers/          # Cloudflare Workers
├── tests/            # E2E tests
└── ai/               # LM Studio AI bot
    └── src/          # Bot TypeScript source
```

## ✅ What's Installed

- Node.js v24.10.0
- npm v11.6.0
- Python 3.13.5
- TypeScript v5.9.3
- wrangler v4.43.0
- Playwright (with browsers)

## 🔧 Environment Setup

1. Copy `env.example` to `.env.local`
2. Configure your LM Studio host in `saywhatwant/ai/.env`
3. Start developing!

## 📚 Full Documentation

See `SETUP.md` for complete setup instructions.

---

**Status:** ✅ All dependencies installed & tested
**Build Status:** ✅ Both projects compile successfully
**Ready to code!** 🎉

