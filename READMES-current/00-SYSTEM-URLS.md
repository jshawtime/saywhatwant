# 🔗 System URLs - Complete Reference

**Date**: October 7, 2025  
**Status**: AUTHORITATIVE SOURCE  
**Purpose**: Single source of truth for all system URLs

---

## 🌐 Production URLs

### Main Application
**URL:** https://saywhatwant.app  
**Purpose:** Production app  
**Status:** Live

### Analytics Dashboard
**URL:** https://saywhatwant.app/analytics.html  
**Purpose:** View KV data, user activity, message stats  
**Status:** Live (cache fixed)

### Cloudflare Worker API
**URL:** https://sww-comments.bootloaders.workers.dev/api/comments  
**Purpose:** KV storage API  
**Endpoints:**
- GET `?limit=100` - Fetch messages
- POST - Store message
- GET `?after=[timestamp]` - Presence polling

---

## 💻 Development URLs

### Main App (Next.js)
**URL:** http://localhost:3000  
**Command:** `npm run dev` (in `/saywhatwant`)  
**Purpose:** Frontend development

### Queue Monitor Dashboard
**URL:** http://localhost:5173  
**Command:** `npm run dev` (in `/saywhatwant/dashboards/queue-monitor`)  
**Purpose:** Real-time queue monitoring, PM2 control  
**WebSocket:** Connects to ws://localhost:4002

### WebSocket Server
**URL:** ws://localhost:4002  
**Command:** Part of PM2 bot process  
**Purpose:** Real-time updates to queue monitor  
**Note:** This is NOT a webpage, it's WebSocket only

---

## 🤖 Bot Management

### PM2 Production Bot

**Status:**
```bash
pm2 list
```

**Logs:**
```bash
pm2 logs ai-bot
pm2 logs ai-bot --lines 50
```

**Control:**
```bash
pm2 start ai-bot    # Start
pm2 stop ai-bot     # Stop
pm2 restart ai-bot  # Restart
pm2 delete ai-bot   # Remove
```

**Location:** `/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai/dist/index.js`

---

## 🔄 How to Update Bot

### When Code Changes:

```bash
# 1. Navigate to AI folder
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai

# 2. Build latest code
npm run build

# 3. Restart PM2
pm2 restart ai-bot

# 4. Verify
pm2 logs ai-bot --lines 20
```

### First Time Setup:

```bash
# Build
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai
npm run build

# Start with PM2
pm2 start dist/index.js --name ai-bot

# Save PM2 config
pm2 save
```

---

## 🎯 Filtered Conversations

### Template URL:
```
https://saywhatwant.app/#u=[AI]:[color]+[User]:[color]&filteractive=true&mt=ALL&uis=[User]:[color]&ais=[AI]:[color]&priority=[0-99]&entity=[entityId]
```

### Example:
```
https://saywhatwant.app/#u=MyAI:255069000+Me:195080200&filteractive=true&mt=ALL&uis=Me:195080200&ais=MyAI:255069000&priority=5&entity=hm-st-1
```

**Parameters:**
- `u=` - Filter users (username:color+username:color)
- `filteractive=true` - Enable filtering
- `mt=ALL` - Show all message types
- `uis=` - User identity (username:color)
- `ais=` - AI identity override (username:color)
- `priority=` - Queue priority (0-99, 0=highest)
- `entity=` - Force specific entity (hm-st-1, no-rebel)

---

## 📊 Monitoring & Debugging

### Queue Monitor
**URL:** http://localhost:5173  
**Shows:**
- Queue items (live)
- System status
- Priority bands
- Bot logs
- PM2 controls

### PM2 Logs
```bash
# Live logs
pm2 logs ai-bot

# Last N lines
pm2 logs ai-bot --lines 100 --nostream

# Error logs only
pm2 logs ai-bot --err

# Output logs only
pm2 logs ai-bot --out
```

### Wrangler (Worker Logs)
```bash
npx wrangler tail sww-comments
```

---

## 🎓 Quick Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Production App | https://saywhatwant.app | Main application |
| Analytics | https://saywhatwant.app/analytics.html | KV dashboard |
| Queue Monitor | http://localhost:5173 | Bot monitoring |
| Dev App | http://localhost:3000 | Frontend dev |
| Worker API | https://sww-comments.bootloaders.workers.dev | KV storage |
| WebSocket | ws://localhost:4002 | Queue updates |

---

## ⚠️ Important Notes

### DO NOT Use npm run dev for Production Bot
- npm run dev is for development only
- Multiple instances will conflict
- Use PM2 for production

### Port 4002 is WebSocket Only
- Not a webpage
- Queue monitor connects to it
- Part of PM2 bot process

### Always Rebuild Before Restarting PM2
```bash
npm run build  # Compile TypeScript
pm2 restart ai-bot  # Use compiled code
```

---

**This is the definitive URL reference. Update this file when adding new services.**


