# Queue Monitor Troubleshooting - OFFLINE Issue

**Problem:** Queue Monitor shows "OFFLINE" (red) and no data appears

---

## 🔍 Root Cause

The queue monitor couldn't connect to the WebSocket server on port 4002.

**Why:**
- Vite (the dev server) doesn't reload environment variables automatically
- The `.env` file was created, but Vite was already running
- Need to restart Vite to pick up the `VITE_WS_URL` setting

---

## ✅ Solution

### On 10.0.0.100, run these commands:

#### Option 1: Use the Restart Script (Easiest)
```bash
cd ~/Desktop/Queue-Monitor-Deploy
bash restart-monitor.sh
```

#### Option 2: Manual Restart
```bash
# Kill existing process
lsof -ti :5173 | xargs kill

# Wait a moment
sleep 2

# Start fresh
cd ~/Desktop/Queue-Monitor-Deploy
npm run dev
```

---

## 🧪 Verification Steps

After restarting, you should see:

1. **In Terminal:**
   ```
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://10.0.0.100:5173/
   ```

2. **In Browser (reload the page):**
   - Top right: **"CONNECTED"** in GREEN ✅
   - Queue monitor shows live stats
   - PM2 logs appear when you click REFRESH
   - LLM requests appear when bot processes messages

---

## 🔧 What Was Fixed

1. ✅ Created `.env` file with correct WebSocket URL
2. ✅ App.tsx reads `VITE_WS_URL` from environment
3. ✅ Created restart script for easy restarts
4. ✅ All copy buttons present and working

---

## 📊 Expected Behavior After Fix

### When CONNECTED (Green):
- **Queue Items:** Shows messages being processed
- **Stats:** Live statistics update
- **PM2 Logs:** Click REFRESH button to load
- **LLM Requests:** Auto-populates as bot processes

### KV Store Section:
- Shows last 100 messages from Cloudflare
- Click dropdown to expand message details
- COPY button on each message

### PM2 Logs Section:
- Click **REFRESH** button to load logs
- Shows recent PM2 output
- Each log entry has COPY button
- **COPY ALL** button at top

### LLM Requests Section:
- Auto-populates as bot sends to LM Studio
- Shows request/response details
- Each request has COPY button
- Click to expand/collapse

---

## 🐛 If Still Showing OFFLINE

### Check 1: Is AI Bot Running?
```bash
pm2 list
```
Should show `ai-bot` as **online**

### Check 2: Is WebSocket Port Open?
```bash
lsof -i :4002
```
Should show `node` process listening

### Check 3: Check AI Bot Logs
```bash
pm2 logs ai-bot --lines 50 | grep WebSocket
```
Should show:
```
[WebSocket] Server started on port 4002
```

### Check 4: Browser Console (F12)
Open browser DevTools (F12) and check Console tab.
Should NOT see WebSocket connection errors.

If you see errors, check:
- Firewall settings
- Network connectivity
- Port 4002 not blocked

---

## 🚀 Quick Commands Reference

### Restart Everything on 10.0.0.100:
```bash
# Restart AI Bot
pm2 restart ai-bot

# Restart Queue Monitor
cd ~/Desktop/Queue-Monitor-Deploy
bash restart-monitor.sh
```

### Check Status:
```bash
# AI Bot
pm2 list

# Queue Monitor
lsof -i :5173

# WebSocket
lsof -i :4002
```

---

## ✅ Success Indicators

- [ ] Browser shows **"CONNECTED"** in green
- [ ] Queue stats update in real-time
- [ ] PM2 REFRESH button loads logs
- [ ] LLM requests appear when processing
- [ ] COPY buttons work on all sections
- [ ] No errors in browser console (F12)

---

**Next Step:** Restart the queue monitor on 10.0.0.100 using the commands above!

