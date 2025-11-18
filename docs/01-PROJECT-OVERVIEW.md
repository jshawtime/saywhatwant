# Say What Want - Project Overview and Quick Start

This document consolidates the main project information, features, and quick start guides.

---

# Main Project Overview
(Consolidated from README.md files)

## Say What Want

A modern web application with video playback and real-time anonymous comments featuring advanced filtering capabilities.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev:clean  # Kills any existing servers and starts fresh

# Or standard dev
npm run dev
```

Visit: http://localhost:3000

## ✨ Key Features

- **Video Playback**: Auto-playing video content with seamless transitions
- **Anonymous Comments**: Real-time comment stream with customizable usernames
- **Advanced Filtering**: Multi-level content filtering system
- **Color Customization**: Personalized color themes per user
- **Video Sharing**: Share video links directly in comments

---

# Quick Start - Deploy in 15 Minutes
(From QUICK_START.md)

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

This interactive script will:
- ✅ Guide you through naming your projects
- ✅ Set up environment variables
- ✅ Configure build settings
- ✅ Handle all the complex stuff

## Step 3: Deploy (Automatic - 3 min)

```bash
npm run cloudflare:deploy
```

## Done! 🎉

Your app auto-deploys on every git push. Magic!

### Your Links:
- **Site**: `https://[your-project].pages.dev`
- **Comments**: `https://[your-worker].workers.dev`

### Next Push = Auto Deploy
```bash
git add .
git commit -m "Update"
git push
```

Cloudflare rebuilds automatically!

---

# Project Components Overview

## Core Application Structure

### Frontend (Next.js)
- **Video Player**: Auto-playing video content with seamless transitions
- **Comments Stream**: Real-time anonymous commenting system
- **Filter System**: Advanced multi-level content filtering
- **User Customization**: Color themes and personalization

### Backend Services
- **Cloudflare Workers**: Serverless API for comments
- **R2 Storage**: Video content delivery
- **KV Storage**: Comment data persistence

## Development Scripts

### Core Scripts
```bash
npm run dev              # Start development server
npm run dev:clean        # Clean start (kills existing servers)
npm run build           # Build for production
npm run start           # Start production server
```

### Deployment Scripts
```bash
npm run cloudflare:setup      # Initial Cloudflare setup
npm run cloudflare:git-setup  # Git-based deployment setup
npm run cloudflare:deploy     # Quick deploy
npm run deploy               # Full deployment
npm run deploy:all           # Deploy everything (workers + site)
```

### Worker Scripts
```bash
npm run worker:dev       # Development mode for workers
npm run worker:deploy    # Deploy workers to Cloudflare
```

### Utility Scripts
```bash
npm run manifest:generate    # Generate R2 video manifest
npm run manifest:local       # Generate local video manifest
npm run test:setup          # Test environment setup
```

## Project Philosophy

Say What Want is designed to be:
- **Simple**: Easy to understand and modify
- **Fast**: Instant responses and smooth interactions
- **Scalable**: Built to handle millions of users
- **Anonymous**: Privacy-first design
- **Flexible**: Extensible filtering and customization

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Cloudflare Workers, KV Storage, R2 Storage
- **Deployment**: Cloudflare Pages, GitHub Actions
- **Development**: Node.js, Wrangler CLI

## Repository Structure

```
saywhatwant/
├── app/                    # Next.js app directory
├── components/            # React components
├── config/               # Configuration files
├── hooks/               # Custom React hooks
├── lib/                # Utility libraries
├── public/             # Static assets
├── scripts/           # Build and deployment scripts
├── types/            # TypeScript type definitions
├── utils/           # Utility functions
└── workers/        # Cloudflare Workers
```

## Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up environment variables**: Copy `env.example` to `.env.local`
4. **Run development server**: `npm run dev`
5. **Visit**: http://localhost:3000

For production deployment, see the deployment guides in the next document.
