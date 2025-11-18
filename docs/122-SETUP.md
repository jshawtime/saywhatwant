# SAYWHATWANTv1 - Development Environment Setup

## System Overview

This project consists of two main components:
1. **Main Web Application** - Next.js/React/TypeScript frontend
2. **AI Bot** - LM Studio integration bot for AI chat completions

## Prerequisites Installed

### Core Languages & Tools
- ✅ **Node.js**: v24.10.0
- ✅ **npm**: v11.6.0
- ✅ **Python 3**: v3.13.5
- ✅ **pip**: v25.2
- ✅ **Homebrew**: Package manager (macOS)

### Global Node.js Packages
- ✅ **wrangler**: v4.43.0 (Cloudflare CLI)
- ✅ **tsx**: v4.20.6 (TypeScript executor)
- ✅ **TypeScript**: v5.9.3
- ✅ **@playwright/test**: Latest (E2E testing framework)

### Python Packages
- ✅ **requests**: v2.32.4
- ✅ **urllib3**: v2.5.0
- ✅ Standard library modules (json, subprocess, datetime, etc.)

## Project Structure

```
SAYWHATWANTv1/
├── saywhatwant/              # Main Next.js application
│   ├── app/                  # Next.js App Router pages
│   ├── components/           # React components
│   ├── modules/              # Business logic modules
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Utility functions
│   ├── workers/              # Cloudflare Workers
│   ├── tests/                # Playwright E2E tests
│   ├── package.json          # Main project dependencies
│   └── ai/                   # AI Bot sub-project
│       ├── src/              # TypeScript source files
│       ├── dist/             # Compiled JavaScript
│       └── package.json      # AI bot dependencies
```

## Installation Steps Completed

### 1. Main Project Dependencies
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
npm install
```

**Key Dependencies:**
- Next.js 14.2.5
- React 18.3.1
- TypeScript 5.5.3
- Tailwind CSS 3.4.6
- Playwright 1.56.0
- Wrangler 3.0.0

### 2. Playwright Browsers
```bash
npx playwright install
```
Installed browsers: Chromium, Firefox, WebKit, FFMPEG

### 3. AI Bot Dependencies
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/ai
npm install
```

**Key Dependencies:**
- Express 4.18.2
- OpenAI 4.20.0
- WebSocket (ws) 8.14.2
- Chalk 5.3.0
- dotenv 16.3.1

### 4. Global Tools
```bash
npm install -g wrangler tsx typescript @playwright/test
```

## Running the Project

### Development Mode (Main App)
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
npm run dev
```
The app will be available at `http://localhost:3000`

### Clean Development Start (Kill Existing Ports)
```bash
npm run dev:clean
```
This automatically kills processes on ports 3000 and 3001 before starting.

### Build for Production
```bash
npm run build
```
Creates optimized production build in the `out/` directory.

### Start Production Server
```bash
npm start
```

### AI Bot Development
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/ai
npm run dev    # Watch mode with auto-reload
npm run build  # Compile TypeScript
npm start      # Run compiled version
```

### Running Tests
```bash
# Run all Playwright tests
npm run test

# Run with UI
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Debug mode
npm run test:debug

# Generate test code
npm run test:codegen
```

### Cloudflare Workers
```bash
# Deploy main site
npm run deploy

# Development mode for workers
npm run worker:dev

# Deploy workers only
npm run worker:deploy
```

## Project Configuration

### Environment Variables
Create `.env.local` in the main `saywhatwant/` directory:
```bash
# Example environment variables (see env.example)
COMMENTS_WORKER_URL=https://sww-comments.workers.dev
R2_BUCKET_URL=https://YOUR-R2-BUCKET.r2.dev
```

For AI bot, create `.env` in `saywhatwant/ai/`:
```bash
# LM Studio configuration
LM_STUDIO_HOST=10.0.0.100
LM_STUDIO_PORT=1234
MODEL_NAME=your-model-name
```

## Common Commands

### Main Application
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run export           # Export static site
npm run test             # Run Playwright tests
```

### AI Bot
```bash
npm run dev              # Development with watch mode
npm run build            # Compile TypeScript
npm run start            # Run compiled bot
npm run test             # Run bot tests
npm run console          # Start AI console UI
```

### Utility Scripts
```bash
npm run manifest:generate    # Generate R2 video manifest
npm run manifest:local       # Generate local video manifest
npm run fetch-kv             # Fetch KV data from Cloudflare
npm run cloudflare:setup     # Setup Cloudflare configuration
npm run cloudflare:deploy    # Quick deploy to Cloudflare
```

## Python Scripts

Test scripts are located in `saywhatwant/test/`:
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/test

# Test LM Studio direct connection
python3 test-lmstudio-direct.py

# Test model loading
python3 test-model-loading.py
```

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
npm run dev:clean
```

### Node Module Issues
```bash
rm -rf node_modules package-lock.json
npm install
```

### Playwright Browser Issues
```bash
npx playwright install --force
```

### TypeScript Compilation Errors
```bash
cd saywhatwant/ai
npm run clean
npm run build
```

### Cloudflare Wrangler Authentication
```bash
wrangler login
```

## Build Verification

Both projects have been successfully built and tested:
- ✅ Main Next.js app builds without errors
- ✅ AI bot TypeScript compiles successfully
- ✅ All dependencies installed
- ✅ Playwright browsers installed

## Next Steps

1. **Configure Environment Variables**: Copy `env.example` to `.env.local` and fill in your values
2. **Setup LM Studio**: Configure the AI bot connection to your LM Studio instance
3. **Cloudflare Setup**: If deploying, configure Cloudflare Workers and KV
4. **Start Development**: Run `npm run dev` to start coding!

## Support

For issues or questions:
- Check the project documentation in `READMES-current/`
- Review `CHANGELOG.md` for recent changes
- Check `RELEASE-NOTES.md` for version information

---

**Setup completed on:** October 20, 2025
**Node.js version:** v24.10.0
**Python version:** 3.13.5
**Platform:** macOS 25.0.0 (darwin arm64)

