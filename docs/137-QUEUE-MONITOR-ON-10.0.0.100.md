# Queue Monitor Deployment to 10.0.0.100

**Date:** October 22, 2025 - 7:35 AM PST  
**Status:** ✅ IMPLEMENTED - Ready to Test  
**Goal:** Run Queue Monitor on 10.0.0.100, accessible from any machine on network

---

## 📊 Implementation Progress

### ✅ Completed Steps
1. ✅ **Updated vite.config.ts** - Added `host: '0.0.0.0'` and `open: false`
2. ✅ **Created startup scripts** - `start-monitor.sh`, `start-monitor-background.sh`, `stop-monitor.sh`
3. ✅ **Auto .env creation** - Scripts create .env file automatically if missing

### 🔄 Next Steps (Run on 10.0.0.100)
1. SSH into 10.0.0.100
2. Run: `chmod +x /Volumes/Macintosh\ HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy/*.sh`
3. Test: `bash start-monitor.sh` (foreground)
4. Or production: `bash start-monitor-background.sh` (background)
5. Access: `http://10.0.0.100:5173` from any device

---

## 🎯 What We Have Now

### Current (Messy) Setup
```
┌─────────────────────────────────┐
│  Dev Machine                    │
│  (BOWIE/devrepo/)              │
│  ───────────────────────────    │
│  • npm run dev on port 5173    │  ← Running HERE
│  • Connects to WS on 10.0.0.100│
│  • Only accessible from Dev Mac │
└─────────────────────────────────┘
            ↓ WS connection
┌──────────────────────────────────┐
│  10.0.0.100                      │
│  (hm-server-deployment)          │
│  ──────────────────────────────  │
│  • AI Bot (PM2)                 │
│  • WebSocket :4002              │
│  • Ollama :11434                │
└──────────────────────────────────┘
```

**Problems:**
1. Queue Monitor runs on dev machine, not where the bot runs
2. Dev machine must stay on to view dashboard
3. Awkward split between systems
4. Can't access dashboard from other computers (iPad, phone, etc.)
5. Confusing which machine is doing what

---

## 🚀 What We Want

### Clean Architecture
```
┌─────────────────────────────────┐
│  Any Computer on Network        │
│  (Dev Mac, iPad, Phone)         │
│  ───────────────────────────    │
│  • Browser only                 │
│  • http://10.0.0.100:5173      │  ← Just view the page
└─────────────────────────────────┘
            ↓ HTTP + WebSocket
┌──────────────────────────────────┐
│  10.0.0.100                      │
│  (hm-server-deployment)          │
│  ──────────────────────────────  │
│  • AI Bot (PM2)                 │
│  • WebSocket :4002              │
│  • Queue Monitor (Vite) :5173   │  ← Running HERE
│  • Ollama :11434                │
└──────────────────────────────────┘
```

**Benefits:**
1. ✅ Everything runs on one machine (10.0.0.100)
2. ✅ Access from any device on network
3. ✅ Dev machine can sleep/shutdown
4. ✅ Clean separation: 10.0.0.100 = server, everything else = clients
5. ✅ Consistent with other services (Ollama, PM2, etc.)

---

## 🔧 How We'll Implement This

### Step 1: Update Vite Config
**File:** `saywhatwant/dashboards/queue-monitor/vite.config.ts`

**Current:**
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
```

**Change to:**
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // ← Bind to all network interfaces
    port: 5173,
    open: false       // ← Don't auto-open browser (headless server)
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
```

**Why:** 
- `host: '0.0.0.0'` makes Vite listen on ALL network interfaces, not just localhost
- `open: false` prevents auto-opening browser on server (which has no display)

---

### Step 2: Create `.env` File for WebSocket URL
**File:** `saywhatwant/dashboards/queue-monitor/.env`

**Content:**
```bash
# WebSocket URL for connecting to AI Bot
# Since both are on same machine, use localhost
VITE_WS_URL=ws://localhost:4002
```

**Why:** The Queue Monitor needs to connect to the WebSocket server on port 4002. Since both run on 10.0.0.100, we use `localhost`.

---

### Step 3: Set Up Deployment Directory on 10.0.0.100

**Location:** `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor/`

**Structure:**
```
hm-server-deployment/
├── AI-Bot-Deploy/              ← Already exists
├── ollama-HM/                  ← Already exists
└── Queue-Monitor/              ← NEW
    ├── src/
    ├── public/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── .env
    └── node_modules/
```

---

### Step 4: Create Startup Scripts

#### **A. Manual Start (for testing)**
**File:** `hm-server-deployment/Queue-Monitor/start-monitor.sh`

```bash
#!/bin/bash
# Start Queue Monitor on 10.0.0.100

cd "$(dirname "$0")"

echo "🚀 Starting Queue Monitor..."
echo "📊 Will be accessible at: http://10.0.0.100:5173"
echo ""

# Check if WebSocket server is running
if ! lsof -Pi :4002 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  WARNING: WebSocket server (port 4002) not detected!"
    echo "   Make sure PM2 bot is running: pm2 list"
    echo ""
fi

npm run dev
```

#### **B. Background Start (production)**
**File:** `hm-server-deployment/Queue-Monitor/start-monitor-background.sh`

```bash
#!/bin/bash
# Start Queue Monitor in background (persists after terminal close)

cd "$(dirname "$0")"

# Kill existing instance
echo "🔄 Stopping existing monitor..."
lsof -ti :5173 | xargs kill 2>/dev/null || true
sleep 2

# Start in background
echo "🚀 Starting Queue Monitor in background..."
nohup npm run dev > ~/queue-monitor.log 2>&1 &

sleep 3

# Verify it started
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Queue Monitor is running!"
    echo "📊 Access at: http://10.0.0.100:5173"
    echo "📝 Logs at: ~/queue-monitor.log"
else
    echo "❌ Failed to start - check ~/queue-monitor.log"
fi
```

#### **C. Stop Script**
**File:** `hm-server-deployment/Queue-Monitor/stop-monitor.sh`

```bash
#!/bin/bash
# Stop Queue Monitor

echo "🛑 Stopping Queue Monitor..."
lsof -ti :5173 | xargs kill 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Queue Monitor stopped"
else
    echo "ℹ️  Queue Monitor was not running"
fi
```

---

### Step 5: Deployment Commands

**On Dev Machine (copy files to 10.0.0.100):**
```bash
# 1. Copy Queue Monitor to server
scp -r /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/dashboards/queue-monitor \
  ms1281@10.0.0.100:"/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor"

# 2. SSH into server
ssh ms1281@10.0.0.100
```

**On 10.0.0.100 (setup and start):**
```bash
# 3. Install dependencies
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor"
npm install

# 4. Create .env file
echo 'VITE_WS_URL=ws://localhost:4002' > .env

# 5. Make scripts executable
chmod +x start-monitor.sh stop-monitor.sh start-monitor-background.sh

# 6. Start monitor
bash start-monitor.sh

# Or for background (production):
bash start-monitor-background.sh
```

---

## 📊 Usage After Deployment

### Starting Everything on 10.0.0.100

**1. Start AI Bot (if not running):**
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/AI-Bot-Deploy"
pm2 start ai-bot
```

**2. Start Ollama (if not running):**
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/ollama-HM"
bash start-ollama-hm.sh
```

**3. Start Queue Monitor:**
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor"
bash start-monitor-background.sh
```

### Accessing from Any Device

**From Dev Mac:**
```
http://10.0.0.100:5173
```

**From iPad:**
```
http://10.0.0.100:5173
```

**From Phone:**
```
http://10.0.0.100:5173
```

**From 10.0.0.100 itself:**
```
http://localhost:5173
```

---

## 🔧 Commands Reference

### Check Status
```bash
# On 10.0.0.100

# Check if Queue Monitor is running
lsof -i :5173

# Check if WebSocket is running
lsof -i :4002

# Check PM2 bot status
pm2 list

# View Queue Monitor logs
tail -f ~/queue-monitor.log
```

### Restart After Updates
```bash
# On 10.0.0.100

cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor"

# Stop
bash stop-monitor.sh

# Pull latest changes (if using git)
git pull

# Install dependencies (if package.json changed)
npm install

# Start
bash start-monitor-background.sh
```

---

## 🐛 Troubleshooting

### Dashboard Shows "DISCONNECTED"

**Check WebSocket server:**
```bash
lsof -i :4002
pm2 list
pm2 logs ai-bot --lines 50
```

If bot is running but WS not listening, restart PM2:
```bash
pm2 restart ai-bot
```

### Can't Access from Other Computers

**1. Check if Vite is running:**
```bash
lsof -i :5173
```

**2. Check firewall (on 10.0.0.100):**
- System Settings → Network → Firewall
- Ensure port 5173 is allowed, or firewall is off for local network

**3. Verify network binding:**
```bash
netstat -an | grep 5173
```
Should show `0.0.0.0:5173` not `127.0.0.1:5173`

### Page Loads but No Data

**1. Check .env file:**
```bash
cat .env
# Should show: VITE_WS_URL=ws://localhost:4002
```

**2. Restart Vite (env changes require restart):**
```bash
bash stop-monitor.sh
bash start-monitor-background.sh
```

### Port 5173 Already in Use

**Kill existing process:**
```bash
lsof -ti :5173 | xargs kill
```

---

## ✅ Success Criteria

After implementation, you should be able to:

1. ✅ Open `http://10.0.0.100:5173` from any device on network
2. ✅ See "CONNECTED" in green (top right)
3. ✅ View live queue items as bot processes messages
4. ✅ Click "REFRESH" to load PM2 logs
5. ✅ See LLM requests auto-populate
6. ✅ Copy buttons work on all panels
7. ✅ Dev machine can be shut down, dashboard still accessible

---

## 📝 Files Modified

1. **`Queue-Monitor-Deploy/vite.config.ts`** ✅ DONE
   - Added `host: '0.0.0.0'`
   - Set `open: false`

2. **`Queue-Monitor-Deploy/.env`** ✅ AUTO-CREATED
   - Scripts create automatically with `VITE_WS_URL=ws://localhost:4002`
   - Can also create manually if needed

3. **New startup scripts:** ✅ DONE
   - `Queue-Monitor-Deploy/start-monitor.sh`
   - `Queue-Monitor-Deploy/start-monitor-background.sh`
   - `Queue-Monitor-Deploy/stop-monitor.sh`

---

## 🎯 Implementation Status

### ✅ Completed on Dev Machine
1. ✅ Updated vite.config.ts directly on 10.0.0.100
2. ✅ Created startup scripts directly on 10.0.0.100
3. ✅ Scripts auto-create .env if missing
4. ✅ Added WebSocket health checks

### 🔄 To Complete on 10.0.0.100 (5 minutes)

**SSH into 10.0.0.100:**
```bash
ssh ms1281@10.0.0.100
```

**Make scripts executable:**
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy"
chmod +x *.sh
```

**Test in foreground first:**
```bash
bash start-monitor.sh
# Should see: "🚀 Starting Queue Monitor..."
# Should see: "📊 Will be accessible at: http://10.0.0.100:5173"
# Vite should start and show: "Network: http://10.0.0.100:5173"
```

**Open in browser from dev machine:**
```
http://10.0.0.100:5173
```

**If working, stop and run in background:**
```bash
# Press Ctrl+C to stop foreground
bash start-monitor-background.sh
# Can now close terminal, monitor keeps running
```

**Verify it's accessible:**
- From dev Mac: `http://10.0.0.100:5173`
- From iPad: `http://10.0.0.100:5173`
- Should see "CONNECTED" in green
- Should see live queue updates

---

## 📚 Quick Command Reference

**On 10.0.0.100:**
```bash
# Navigate to Queue Monitor
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy"

# Start (foreground - for testing)
bash start-monitor.sh

# Start (background - for production)
bash start-monitor-background.sh

# Stop
bash stop-monitor.sh

# View logs
tail -f ~/queue-monitor.log

# Check if running
lsof -i :5173

# Check PM2 bot status
cd ../AI-Bot-Deploy
pm2 list
pm2 logs ai-bot --lines 20
```

---
4. ✅ Test locally (dev machine) - verify host binding works
5. ✅ Copy to 10.0.0.100
6. ✅ Install dependencies on 10.0.0.100
7. ✅ Start Queue Monitor on 10.0.0.100
8. ✅ Test access from dev machine browser
9. ✅ Test access from other devices
10. ✅ Stop Queue Monitor on dev machine (cleanup)

---

## 📚 Related Documentation

- `116-QUEUE-MONITOR-OFFLINE-FIX.md` - WebSocket connection troubleshooting
- `136-OLLAMA-HM-QUICK-START.md` - Ollama server setup
- `10.0.0.100-QUICK-REF.md` - Server operations reference

---

**Implementation Status:** READY TO START ✅

