# AI Bot Migration to 10.0.0.100 - Deployment Guide

**Date:** October 20, 2025  
**From:** Dev Mac (current machine)  
**To:** 10.0.0.100 (Mac Studio with LM Studio)

---

## 📋 What You're Getting

### Current Setup (Before)
- AI Bot running on your Dev Mac via PM2
- Queue Monitor accessible only on Dev Mac
- Have to keep your Dev Mac running 24/7

### New Setup (After)
- AI Bot running on 10.0.0.100 via PM2 (24/7)
- Double-click app to start/stop/restart bot
- Queue Monitor accessible from ANY computer on your network
- Your Dev Mac can sleep/shutdown

---

## 🎯 Architecture After Migration

```
┌─────────────────────────────────┐
│  Your Dev Mac                   │
│  ─────────────────────────      │
│  • Browser only                 │
│  • http://10.0.0.100:5173      │
└─────────────────────────────────┘
            ↓ (views dashboard)
┌──────────────────────────────────┐
│  Mac Studio 10.0.0.100          │
│  ──────────────────────────────  │
│  • AI Bot (PM2)                 │
│  • WebSocket Server :4002       │
│  • Queue Monitor (Vite) :5173   │
│  • LM Studio :1234              │
│  • Double-click launcher app    │
└───────────┬──────────────────────┘
            │
            ▼ (also talks to)
┌──────────────────────┐
│ Mac Studio 10.0.0.102│
│                      │
│ • LM Studio :1234    │
└──────────────────────┘
```

---

## 🚀 Installation Steps

### Step 1: Prepare 10.0.0.100

**SSH into the machine:**
```bash
ssh user@10.0.0.100
```

**Install prerequisites (if not already installed):**
```bash
# Install Node.js
brew install node

# Install PM2 globally
npm install -g pm2

# Verify installations
node --version
npm --version
pm2 --version
```

### Step 2: Copy Project Files

**Option A: Git Clone (Recommended)**
```bash
cd ~/
mkdir -p devrepo
cd devrepo
git clone https://github.com/YOUR-REPO/SAYWHATWANTv1.git
cd SAYWHATWANTv1/saywhatwant/ai
```

**Option B: Copy via rsync (from your Dev Mac)**
```bash
# Run this on your Dev Mac
rsync -avz --exclude 'node_modules' --exclude 'dist' \
  /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/ai/ \
  user@10.0.0.100:~/devrepo/SAYWHATWANTv1/saywhatwant/ai/
```

### Step 3: Install Dependencies on 10.0.0.100

```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai

# Install Node packages
npm install

# Build TypeScript
npm run build

# Verify build succeeded
ls -la dist/
```

### Step 4: Install Queue Monitor Dependencies

```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/dashboards/queue-monitor

# Install packages
npm install

# Verify it works
npm run dev
# You should see: "Local: http://10.0.0.100:5173"
# Press Ctrl+C to stop for now
```

### Step 5: Create Desktop Launcher App

```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai

# Run the app creator script
bash create-launcher-app.sh
```

This creates **"Start AI Bot.app"** on your Desktop!

**First-time security setup:**
1. Right-click "Start AI Bot.app"
2. Click "Open"
3. Click "Open" in the security dialog
4. (You only need to do this once)

### Step 6: Configure Auto-Start (Optional but Recommended)

```bash
# Setup PM2 to start on boot
pm2 startup

# Follow the command it prints (usually starts with sudo)
# Then save current processes
pm2 save
```

---

## 🎮 How to Use

### Starting the AI Bot

**Option 1: Double-Click (Easiest)**
- Double-click "Start AI Bot.app" on Desktop
- Terminal opens showing status
- Follow prompts

**Option 2: Manual**
```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai
pm2 start dist/index.js --name ai-bot
```

### Starting the Queue Monitor

```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/dashboards/queue-monitor
npm run dev
```

This starts on port 5173 and binds to ALL network interfaces.

### Accessing the Queue Monitor

**From ANY computer on your network:**
```
http://10.0.0.100:5173
```

**From 10.0.0.100 itself:**
```
http://localhost:5173
```

Just open that URL in Chrome!

---

## 🛠️ Common Commands

### On 10.0.0.100

**PM2 Commands:**
```bash
pm2 list              # Show all processes
pm2 logs ai-bot       # View live logs
pm2 restart ai-bot    # Restart the bot
pm2 stop ai-bot       # Stop the bot
pm2 delete ai-bot     # Remove from PM2
```

**After Code Changes:**
```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai
git pull              # Get latest code
npm run build         # Rebuild
pm2 restart ai-bot    # Restart with new code
```

**View Queue Monitor:**
```bash
# Start in background (stays running even after you close Terminal)
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/dashboards/queue-monitor
nohup npm run dev > ~/queue-monitor.log 2>&1 &
```

Or just start it normally and leave the Terminal window open.

---

## 📱 URLs You'll Use

### From Your Dev Mac

| Service | URL | Description |
|---------|-----|-------------|
| Queue Monitor | `http://10.0.0.100:5173` | Real-time bot dashboard |
| Production App | `https://saywhatwant.app` | Live website |

### SSH Commands from Dev Mac

```bash
# SSH into 10.0.0.100
ssh user@10.0.0.100

# View bot logs
ssh user@10.0.0.100 "pm2 logs ai-bot --lines 50"

# Restart bot
ssh user@10.0.0.100 "pm2 restart ai-bot"

# Check status
ssh user@10.0.0.100 "pm2 list"
```

---

## 🔧 Troubleshooting

### Bot Won't Start

```bash
# Check logs
pm2 logs ai-bot --lines 100

# Rebuild
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai
npm run build
pm2 restart ai-bot
```

### Can't Access Queue Monitor from Dev Mac

**1. Check if Vite is running:**
```bash
# On 10.0.0.100
lsof -i :5173
# Should show node process
```

**2. Check firewall:**
```bash
# macOS System Settings > Network > Firewall
# Make sure Node.js is allowed
```

**3. Test from 10.0.0.100 itself:**
```bash
curl http://localhost:5173
# Should return HTML
```

**4. Test from Dev Mac:**
```bash
curl http://10.0.0.100:5173
# Should return HTML
```

### WebSocket Connection Issues

Bot creates WebSocket on port 4002. The queue monitor connects to it.

**Check WebSocket is running:**
```bash
# On 10.0.0.100
lsof -i :4002
# Should show node process for ai-bot
```

---

## 🎨 What Changed in the Code

### 1. WebSocket Server (`saywhatwant/ai/src/modules/websocketServer.ts`)
```typescript
// BEFORE:
this.wss = new WebSocketServer({ port });

// AFTER:
this.wss = new WebSocketServer({ 
  host: '0.0.0.0',  // Binds to all network interfaces
  port 
});
```

### 2. Queue Monitor (`saywhatwant/dashboards/queue-monitor/package.json`)
```json
// BEFORE:
"dev": "vite",

// AFTER:
"dev": "vite --host 0.0.0.0",
```

### 3. Queue Monitor App (`saywhatwant/dashboards/queue-monitor/src/App.tsx`)
```typescript
// BEFORE:
const wsUrl = 'ws://localhost:4002';

// AFTER:
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:4002';
// Now configurable via .env file
```

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] SSH into 10.0.0.100 works
- [ ] `pm2 list` shows ai-bot as "online"
- [ ] `pm2 logs ai-bot` shows no errors
- [ ] Queue Monitor accessible at `http://10.0.0.100:5173` from Dev Mac
- [ ] Queue Monitor shows "CONNECTED" (green) status
- [ ] Post a comment on saywhatwant.app
- [ ] See it appear in queue monitor
- [ ] See AI response get posted
- [ ] "Start AI Bot.app" on Desktop works when double-clicked

---

## 📊 Before & After Comparison

| Aspect | Before | After |
|--------|--------|-------|
| Bot Location | Dev Mac | 10.0.0.100 |
| Bot Management | Terminal only | Double-click app |
| Queue Monitor Access | localhost only | Network (any computer) |
| Dev Mac Dependency | Must stay on | Can sleep/shutdown |
| Network Latency | Higher | Lower (bot near LM Studio) |
| Reliability | Dev machine dependent | Dedicated machine |

---

## 🔄 Migration from Current Setup

### On Your Dev Mac

**Stop the local bot:**
```bash
pm2 stop ai-bot
pm2 delete ai-bot
```

That's it! The bot is no longer running on your Dev Mac.

### On 10.0.0.100

Follow the installation steps above.

### Update Bookmarks

Change your queue monitor bookmark from:
```
http://localhost:5173
```

To:
```
http://10.0.0.100:5173
```

---

## 🎯 Final Result

**What runs on 10.0.0.100:**
1. AI Bot (PM2 managed)
2. Queue Monitor (Vite dev server)
3. WebSocket Server (embedded in bot)
4. LM Studio (already there)

**What you do from your Dev Mac:**
1. Open Chrome
2. Go to `http://10.0.0.100:5173`
3. Watch the magic happen!

**To manage the bot:**
1. Double-click "Start AI Bot.app" on 10.0.0.100's Desktop
2. Or SSH in and use PM2 commands

---

**Questions? Issues?** Check the logs with `pm2 logs ai-bot` on 10.0.0.100!

**Success!** 🎉 Your bot is now running 24/7 on dedicated hardware!

