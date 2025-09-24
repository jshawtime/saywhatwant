# Master Deployment Guide: Next.js to Cloudflare Workers
## Complete AI-to-AI One-Shot Deployment Protocol v4.0

> **CRITICAL FOR AI AGENT**: This is a MANDATORY deployment protocol. You MUST complete ALL steps in the checklist and provide the final output exactly as specified. DO NOT skip the Cloudflare deployment - you MUST handle it via wrangler.

---

## 🚨 MANDATORY AI AGENT CHECKLIST 🚨

**AI AGENT MUST COMPLETE ALL OF THESE STEPS IN ORDER**:

- [ ] 1. Ask user for required information (Section 1)
- [ ] 2. Create project directory and initialize git
- [ ] 3. Create ALL project files (package.json, next.config.ts, etc.)
- [ ] 4. Install dependencies
- [ ] 5. Create wrangler.json configuration
- [ ] 6. Build project with OpenNext
- [ ] 7. **LOGIN TO CLOUDFLARE** via `npx wrangler login`
- [ ] 8. **CREATE KV NAMESPACES** via wrangler
- [ ] 9. **CREATE R2 BUCKETS** via wrangler
- [ ] 10. **UPDATE wrangler.json** with actual IDs
- [ ] 11. **DEPLOY TO CLOUDFLARE** via `npm run deploy`
- [ ] 12. **VERIFY DEPLOYMENT** is accessible
- [ ] 13. Create GitHub repository (if gh CLI available)
- [ ] 14. **PROVIDE FINAL OUTPUT** with GitHub integration instructions

**FAILURE TO COMPLETE ANY STEP = INCOMPLETE DEPLOYMENT**

---

## SECTION 1: Required Information from User

**AI AGENT MUST ASK FOR**:

```
I'll deploy a Next.js app to Cloudflare Workers for you. I'll handle ALL the Cloudflare setup including creating the worker. I need some information:

1. Project name (lowercase, no spaces):
2. Brief description:
3. GitHub username:
4. Do you have GitHub CLI (gh) installed? (Y/N):
5. Need file uploads? (Y/N):
6. Need database/storage? (Y/N):
7. Main purpose (blog/app/dashboard/other):

I'll handle the entire deployment including:
✅ Creating the Cloudflare Worker
✅ Setting up KV and R2 storage
✅ Deploying your app live
✅ Providing you GitHub integration instructions

You'll only need to:
- Click "Allow" when Cloudflare login opens in browser
- Follow the GitHub instructions I provide at the end
```

---

## SECTION 2: Complete Project Setup

### Step 2.1: Initialize Project

```bash
# Create and enter directory
mkdir PROJECT_NAME
cd PROJECT_NAME

# Initialize git FIRST
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*

# Next.js
.next/
out/
.swc/

# Production
build/
dist/

# Cloudflare
.wrangler/
.open-next/

# Environment
.env
.env.local
.env.production

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
EOF

# Create app directory
mkdir app
cd app
```

### Step 2.2: Create package.json

```bash
cat > package.json << 'EOF'
{
  "name": "PROJECT_NAME",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "build:cf": "npx opennextjs-cloudflare build",
    "start": "next start",
    "lint": "next lint",
    "preview": "npx wrangler dev",
    "deploy": "npx opennextjs-cloudflare build && npx wrangler deploy",
    "deploy:cf": "npx opennextjs-cloudflare deploy"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@opennextjs/cloudflare": "latest",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
EOF

# Install dependencies
npm install
```

### Step 2.3: Create next.config.ts

```bash
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DO NOT add 'output: export' - incompatible with OpenNext
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
EOF
```

### Step 2.4: Create TypeScript Configuration

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF
```

### Step 2.5: Create Tailwind Configuration

```bash
cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
EOF

cat > postcss.config.mjs << 'EOF'
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
EOF
```

### Step 2.6: Create Application Files

```bash
# Create directories
mkdir -p src/app src/components src/stores public

# Create layout
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROJECT_NAME",
  description: "PROJECT_DESCRIPTION",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
EOF

# Create globals.css
cat > src/app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
  
  @media (prefers-color-scheme: dark) {
    :root {
      --background: 222.2 84% 4.9%;
      --foreground: 210 40% 98%;
    }
  }
}

body {
  color: rgb(var(--foreground));
  background: rgb(var(--background));
}
EOF

# Create home page
cat > src/app/page.tsx << 'EOF'
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
          PROJECT_NAME
        </h1>
        <p className="text-lg text-muted-foreground md:text-xl">
          PROJECT_DESCRIPTION
        </p>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/dashboard"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}
EOF

# Create a sample component
cat > src/components/Button.tsx << 'EOF'
"use client";

import React from 'react';

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export default function Button({ onClick, children, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        variant === 'primary' 
          ? 'bg-blue-600 text-white hover:bg-blue-700' 
          : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
      }`}
    >
      {children}
    </button>
  );
}
EOF
```

---

## SECTION 3: Cloudflare Configuration

### Step 3.1: Create wrangler.json

```bash
cat > wrangler.json << 'EOF'
{
  "name": "PROJECT_NAME",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "main": ".open-next/worker.js",
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "kv_namespaces": [
    {
      "binding": "METADATA_KV",
      "id": "WILL_BE_REPLACED",
      "preview_id": "WILL_BE_REPLACED"
    }
  ],
  "r2_buckets": [
    {
      "binding": "FILES_BUCKET",
      "bucket_name": "PROJECT_NAME-files"
    },
    {
      "binding": "INCREMENTAL_CACHE",
      "bucket_name": "PROJECT_NAME-cache"
    }
  ]
}
EOF
```

### Step 3.2: Create OpenNext Config

```bash
# Build once to trigger config creation
npx opennextjs-cloudflare build
# Answer YES when prompted to create config

# If not auto-created, create it:
cat > open-next.config.ts << 'EOF'
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
EOF
```

---

## SECTION 4: 🚀 CLOUDFLARE DEPLOYMENT (MANDATORY)

### Step 4.1: Wrangler Login

```bash
# AI AGENT: Tell user you're now logging into Cloudflare
echo "📝 Logging into Cloudflare - please click 'Allow' in your browser..."
npx wrangler login
```

### Step 4.2: Create Cloudflare Resources

```bash
# Create KV namespace
echo "🗂️ Creating KV namespace..."
KV_OUTPUT=$(npx wrangler kv namespace create "METADATA_KV")
KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)

KV_PREVIEW_OUTPUT=$(npx wrangler kv namespace create "METADATA_KV" --preview)
KV_PREVIEW_ID=$(echo "$KV_PREVIEW_OUTPUT" | grep -o 'preview_id = "[^"]*"' | cut -d'"' -f2)

# Create R2 buckets
echo "🪣 Creating R2 buckets..."
npx wrangler r2 bucket create PROJECT_NAME-files
npx wrangler r2 bucket create PROJECT_NAME-cache

# Update wrangler.json with actual IDs
sed -i.bak "s/WILL_BE_REPLACED/$KV_ID/g" wrangler.json
sed -i.bak "s/WILL_BE_REPLACED/$KV_PREVIEW_ID/g" wrangler.json
rm wrangler.json.bak
```

### Step 4.3: Deploy to Cloudflare

```bash
# Build and deploy
echo "🚀 Building and deploying to Cloudflare Workers..."
npm run deploy

# Get deployment URL
DEPLOYMENT_URL=$(npx wrangler deployments list | grep -o 'https://[^ ]*' | head -1)
echo "✅ Deployed to: $DEPLOYMENT_URL"

# Verify deployment
curl -I "$DEPLOYMENT_URL" | head -1
```

---

## SECTION 5: GitHub Repository Setup

### Option A: Automatic with GitHub CLI

```bash
cd .. # Go to project root
git add .
git commit -m "Initial commit: Next.js + Cloudflare Workers"

# Create GitHub repo
gh repo create PROJECT_NAME --public --source=. --remote=origin --push
```

### Option B: Manual Instructions for User

```bash
# Commit locally first
cd .. # Go to project root
git add .
git commit -m "Initial commit: Next.js + Cloudflare Workers"
```

---

## SECTION 6: FINAL OUTPUT (MANDATORY)

**AI AGENT MUST PROVIDE THIS EXACT OUTPUT TO USER**:

```markdown
# ✅ DEPLOYMENT COMPLETE!

## Your app is now LIVE at:
🌐 **DEPLOYMENT_URL_HERE**

## To Connect GitHub for Auto-Deployments:

### 1. Create GitHub Repository:
- Go to: https://github.com/new
- Name: `PROJECT_NAME`
- Keep it EMPTY (no README)
- Click "Create repository"

### 2. Push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/PROJECT_NAME.git
git branch -M main
git push -u origin main
```

### 3. Setup Cloudflare CI/CD (Optional):
- Go to: https://dash.cloudflare.com/?to=/:account/workers-and-pages
- Click "Create" → "Workers" → "Deploy from GitHub repository"
- Select your repository: `PROJECT_NAME`
- **⚠️ CRITICAL Build Settings**:

| Setting | Value |
|---------|-------|
| **Build command** | `npm install && npx opennextjs-cloudflare build` |
| **Deploy command** | `npx wrangler deploy` |
| **Root directory** | `app` |

**⚠️ DO NOT use `npm run build` as the build command!**

### 4. Manual Deployment (Alternative):
To deploy updates manually without CI/CD:
```bash
cd app
npm run deploy
```

## Project Structure:
- Worker Name: `PROJECT_NAME`
- KV Namespace: Created ✓
- R2 Buckets: Created ✓
- GitHub Repo: Ready to create

## Next Steps:
1. Visit your live site
2. Create GitHub repository (instructions above)
3. Optionally setup CI/CD for auto-deployments

Need changes? Edit locally and run `npm run deploy` from the `app` directory.
```

---

## SECTION 7: Troubleshooting Reference

| Error | Solution |
|-------|----------|
| **"The entry-point file at '.open-next/worker.js' was not found"** | **Build command MUST be `npm install && npx opennextjs-cloudflare build`** |
| "Could not resolve async_hooks/fs/path/etc" | Ensure compatibility_date is "2024-09-23" and nodejs_compat flag is set |
| "KV namespace invalid" | KV IDs not updated in wrangler.json |
| "Failed to publish worker" | Check you're logged in with `npx wrangler whoami` |

---

## AI AGENT FINAL CHECKLIST

Before marking complete, verify:
- [ ] App is accessible at workers.dev URL
- [ ] User received GitHub integration instructions
- [ ] User received exact build command for CI/CD
- [ ] All Cloudflare resources created (KV, R2)
- [ ] wrangler.json has real IDs, not placeholders
- [ ] Project builds without errors
- [ ] Deployment succeeded

**IF ANY ITEM IS UNCHECKED, THE DEPLOYMENT IS INCOMPLETE**

---

## One-Shot Script for AI Agents

```bash
#!/bin/bash
PROJECT_NAME="REPLACE_ME"
GITHUB_USERNAME="REPLACE_ME"

# Full deployment
mkdir $PROJECT_NAME && cd $PROJECT_NAME
git init

# [Include all setup commands from above sections]

# Deploy
npx wrangler login
npx wrangler kv namespace create "METADATA_KV"
npx wrangler r2 bucket create $PROJECT_NAME-files
npx wrangler r2 bucket create $PROJECT_NAME-cache
npm run deploy

echo "✅ Deployment complete!"
```
