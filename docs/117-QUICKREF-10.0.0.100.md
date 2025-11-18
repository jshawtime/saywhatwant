# Quick Reference - AI Bot on 10.0.0.100

## 📱 URLs to Access

### From Your Dev Mac (or any computer on network)
```
Queue Monitor: http://10.0.0.100:5173
```

### On 10.0.0.100 Itself
```
Queue Monitor: http://localhost:5173
```

---

## 🎮 How to Start Everything on 10.0.0.100

### Start AI Bot
**Option 1:** Double-click "Start AI Bot.app" on Desktop

**Option 2:** Terminal
```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/ai
pm2 start dist/index.js --name ai-bot
```

### Start Queue Monitor
```bash
cd ~/devrepo/SAYWHATWANTv1/saywhatwant/dashboards/queue-monitor
npm run dev
```

You'll see:
```
Local: http://10.0.0.100:5173
Network: http://10.0.0.100:5173
```

Now open `http://10.0.0.100:5173` in Chrome from ANY computer!

---

## 🛠️ Common PM2 Commands

```bash
pm2 list              # Show status
pm2 logs ai-bot       # View logs (live)
pm2 restart ai-bot    # Restart
pm2 stop ai-bot       # Stop
pm2 start ai-bot      # Start
```

---

## 📦 What's Running Where

### On 10.0.0.100:
- AI Bot (PM2) → Polls Cloudflare, talks to LM Studio
- WebSocket Server (port 4002) → Real-time updates
- Queue Monitor (port 5173) → Dashboard
- LM Studio (port 1234) → AI model server

### On 10.0.0.102:
- LM Studio (port 1234) → Backup AI model server

### On Your Dev Mac:
- Just Chrome → `http://10.0.0.100:5173`

---

## ✅ Files Changed

1. `saywhatwant/ai/src/modules/websocketServer.ts` → Bind to 0.0.0.0
2. `saywhatwant/dashboards/queue-monitor/package.json` → Vite host 0.0.0.0
3. `saywhatwant/ai/start-ai-bot.sh` → Double-click launcher
4. `saywhatwant/ai/create-launcher-app.sh` → Creates macOS app

---

## 🚀 Quick Setup

1. Copy files to 10.0.0.100
2. Run `npm install` in both directories
3. Run `create-launcher-app.sh`
4. Double-click "Start AI Bot.app"
5. Start queue monitor: `npm run dev`
6. Open `http://10.0.0.100:5173` from Dev Mac

Done! 🎉

