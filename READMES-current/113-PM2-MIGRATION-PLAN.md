# PM2 Migration Plan: Moving AI Bot to 10.0.0.100

**Date:** October 20, 2025  
**Current Machine:** Local Mac (development machine)  
**Target Machine:** 10.0.0.100 (Mac Studio with LM Studio)

---

## 📊 Current State

### What We Have Now

**Architecture:**
```
┌─────────────────────────────────┐
│  Your Mac (Dev Machine)         │
│  ─────────────────────────      │
│  • AI Bot (PM2)                 │
│  • Queue Monitor Dashboard      │
│  • WebSocket Server :4002       │
│  • Polls Cloudflare KV          │
│  • Sends to LM Studio           │
└───────────┬────────────────┬────┘
            │                │
            │                │
            ▼                ▼
    ┌──────────┐      ┌──────────┐
    │Mac Studio│      │Mac Studio│
    │10.0.0.102│      │10.0.0.100│
    │          │      │          │
    │LM Studio │      │LM Studio │
    └──────────┘      └──────────┘
```

**Components Running:**
1. **AI Bot** (`saywhatwant/ai/dist/index.js`)
   - Managed by PM2 (`pm2 list` shows "ai-bot")
   - Polls Cloudflare KV for new comments
   - Processes queue, sends to LM Studio
   - Posts AI responses back to Cloudflare

2. **WebSocket Server** (Port 4002)
   - Embedded in the AI Bot
   - Provides real-time queue stats
   - Allows queue monitor to observe

3. **Queue Monitor Dashboard**
   - Runs on `http://localhost:5173` (Vite dev server)
   - Connects to `ws://localhost:4002`
   - Shows queue status, metrics, PM2 controls

---

## 🎯 What We Want

### Target Architecture

```
┌─────────────────────────────────┐
│  Your Mac (Dev Machine)         │
│  ─────────────────────────      │
│  • Browser Only                 │
│  • Queue Monitor UI             │
│  • Connects to 10.0.0.100:4002  │
└───────────┬─────────────────────┘
            │
            │ WebSocket
            ▼
    ┌──────────────────────┐
    │Mac Studio 10.0.0.100 │
    │                      │
    │ • AI Bot (PM2)       │
    │ • WebSocket :4002    │
    │ • LM Studio Server   │
    └──────────┬───────────┘
               │
               │ Also connects to
               ▼
    ┌──────────┐
    │Mac Studio│
    │10.0.0.102│
    │          │
    │LM Studio │
    └──────────┘
```

**Benefits:**
- ✅ Bot runs 24/7 on dedicated machine
- ✅ Bot is physically close to primary LM Studio server (10.0.0.100)
- ✅ Lower network latency
- ✅ Your dev machine can sleep/shutdown
- ✅ Queue monitor still accessible from your dev machine
- ✅ Easy to monitor via browser from anywhere on network

---

## 🛠️ How We'll Do It

### Phase 1: Prepare Target Machine (10.0.0.100)

**Install Prerequisites:**
```bash
# SSH into 10.0.0.100
ssh user@10.0.0.100

# Install Node.js if not installed
brew install node

# Install PM2 globally
npm install -g pm2

# Install TypeScript globally
npm install -g typescript tsx
```

**Clone Repository:**
```bash
# Navigate to appropriate location
cd ~/
mkdir -p devrepo
cd devrepo

# Clone the repo
git clone <your-repo-url> SAYWHATWANTv1
cd SAYWHATWANTv1/saywhatwant/ai

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Phase 2: Configure for Network Access

**Update Bot Configuration:**

Edit `saywhatwant/ai/.env`:
```bash
# Cloudflare KV
COMMENTS_WORKER_URL=https://sww-comments.bootloaders.workers.dev/api/comments
COMMENTS_API_KEY=your-api-key

# LM Studio Servers (local and remote)
LM_STUDIO_PRIMARY=http://localhost:1234     # Local on .100
LM_STUDIO_SECONDARY=http://10.0.0.102:1234  # Remote on .102

# WebSocket - BIND TO ALL INTERFACES
WEBSOCKET_HOST=0.0.0.0  # Important! Allows external connections
WEBSOCKET_PORT=4002
```

**Update WebSocket Server Code:**

The bot needs to bind to `0.0.0.0` instead of `localhost` so your dev machine can connect.

File: `saywhatwant/ai/src/modules/websocketServer.ts`

Change:
```typescript
this.wss = new WebSocketServer({ port });
```

To:
```typescript
this.wss = new WebSocketServer({ 
  host: '0.0.0.0',  // Bind to all interfaces
  port 
});
```

### Phase 3: Start Bot on 10.0.0.100

**Start with PM2:**
```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai

# Start bot
pm2 start dist/index.js --name ai-bot

# Setup auto-start on boot
pm2 startup
# Follow the command it prints

# Save current PM2 processes
pm2 save

# Verify running
pm2 list
pm2 logs ai-bot --lines 20
```

**Verify WebSocket:**
```bash
# Check port is listening
lsof -i :4002

# Should show node process listening on 0.0.0.0:4002
```

### Phase 4: Update Queue Monitor on Dev Machine

**Edit Queue Monitor Connection:**

File: `saywhatwant/dashboards/queue-monitor/src/App.tsx` (or wherever WebSocket connects)

Change:
```typescript
const ws = new WebSocket('ws://localhost:4002');
```

To:
```typescript
const ws = new WebSocket('ws://10.0.0.100:4002');
```

**Run Queue Monitor:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/dashboards/queue-monitor

# Start dev server
npm run dev

# Opens on http://localhost:5173
# Now connects to remote WebSocket at 10.0.0.100:4002
```

### Phase 5: Test & Verify

**Test Checklist:**
1. ✅ Bot is running on 10.0.0.100: `ssh user@10.0.0.100 "pm2 list"`
2. ✅ WebSocket is accessible: `telnet 10.0.0.100 4002`
3. ✅ Queue monitor loads: Open `http://localhost:5173`
4. ✅ Queue monitor shows live data (queue status, metrics)
5. ✅ Post a comment on saywhatwant.app
6. ✅ See it appear in queue monitor
7. ✅ See AI response posted back

### Phase 6: Stop Local PM2

**On Your Dev Machine:**
```bash
# Stop local bot
pm2 stop ai-bot
pm2 delete ai-bot

# Optional: Uninstall PM2 if not using for anything else
# npm uninstall -g pm2
```

---

## 🎨 Standalone Desktop App Option

### Option 1: Simple Electron Wrapper (Recommended)

Create a double-clickable app that opens the queue monitor.

**Structure:**
```
QueueMonitor.app/
├── Contents/
│   ├── MacOS/
│   │   └── run.sh          # Launch script
│   ├── Resources/
│   │   └── icon.icns       # App icon
│   └── Info.plist          # App metadata
```

**Implementation:**

I'll create:
1. **Standalone HTML file** that connects to `ws://10.0.0.100:4002`
2. **Shell script** to open it in browser
3. **macOS App Bundle** you can double-click

This is simpler than Electron and doesn't require Node.js on your dev machine.

### Option 2: Web Bookmark (Simplest)

After bot is on 10.0.0.100, I can create a standalone HTML file:

**File:** `QueueMonitor.html` (on your Desktop)
- Self-contained (no npm/node needed)
- Connects to `ws://10.0.0.100:4002`
- Drag to Desktop, double-click to open in browser

---

## 📝 Post-Migration URLs

### From Your Mac:

**Queue Monitor Dashboard:**
```
http://localhost:5173
(or wherever you run the Vite dev server)

Connects to: ws://10.0.0.100:4002
```

**AI Bot Logs (via SSH):**
```bash
ssh user@10.0.0.100
pm2 logs ai-bot
```

**PM2 Status (via SSH):**
```bash
ssh user@10.0.0.100
pm2 list
pm2 monit
```

### From 10.0.0.100 (locally):

**Queue Monitor Dashboard:**
```
http://localhost:5173
Connects to: ws://localhost:4002
```

---

## 🔧 Troubleshooting

### Issue: Can't Connect to WebSocket from Dev Machine

**Symptoms:**
- Queue monitor shows "Connecting..." forever
- Browser console: `WebSocket connection failed`

**Solutions:**

1. **Check firewall on 10.0.0.100:**
```bash
# On 10.0.0.100
sudo lsof -i :4002
# Should show node listening on 0.0.0.0:4002, not 127.0.0.1:4002
```

2. **Check macOS firewall:**
```bash
# System Settings > Network > Firewall
# Allow incoming connections for Node.js
```

3. **Test with telnet:**
```bash
# From your dev machine
telnet 10.0.0.100 4002
# Should connect
```

### Issue: Bot Not Starting

**Check logs:**
```bash
ssh user@10.0.0.100
pm2 logs ai-bot --lines 50
```

**Common issues:**
- Missing `.env` file
- Wrong LM Studio URLs
- Missing dependencies: `npm install`
- Not built: `npm run build`

### Issue: Bot Can't Reach LM Studio

**Verify LM Studio is running:**
```bash
curl http://localhost:1234/v1/models
curl http://10.0.0.102:1234/v1/models
```

**Check bot config:**
```bash
cat ~/devrepo/SAYWHATWANTv1/saywhatwant/ai/.env
# Verify LM Studio URLs are correct
```

---

## 🎯 Summary

### Current (Before)
- Bot runs on your dev Mac
- Monitor runs on your dev Mac
- Both localhost-only

### Target (After)
- Bot runs on 10.0.0.100 (24/7)
- Monitor runs on your dev Mac (when needed)
- Monitor connects to 10.0.0.100:4002

### Files to Change
1. `saywhatwant/ai/.env` - WebSocket host config
2. `saywhatwant/ai/src/modules/websocketServer.ts` - Bind to 0.0.0.0
3. `saywhatwant/dashboards/queue-monitor/src/App.tsx` - WebSocket URL

### Commands on 10.0.0.100
```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai
npm install
npm run build
pm2 start dist/index.js --name ai-bot
pm2 startup
pm2 save
```

### Commands on Your Mac
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/dashboards/queue-monitor
npm run dev
# Open http://localhost:5173
```

---

**Ready to proceed?** I can:
1. Make the code changes now
2. Create a standalone HTML queue monitor app
3. Create a macOS app bundle for double-click launching
4. Or guide you through manual installation

Let me know which option you prefer!

