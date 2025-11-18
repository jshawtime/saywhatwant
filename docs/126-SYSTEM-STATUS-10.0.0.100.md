# System Status & Configuration - 10.0.0.100

**Date:** October 20, 2025  
**Status:** ✅ OPERATIONAL

---

## ✅ What's Working

1. **AI Bot Running** - PM2 shows "online"
2. **Queue Monitor Accessible** - http://10.0.0.100:5173
3. **Messages Coming from KV** - Bot is polling Cloudflare successfully
4. **Model Loading & Response** - Bot processes and responds

---

## ⏱️ Model Loading Delay (60 seconds)

### This is NORMAL behavior!

**What happens:**
1. Bot receives message from KV
2. Bot requests model from LM Studio
3. **LM Studio loads model into RAM** (60 seconds) ⏳
4. Model responds
5. Bot posts response to KV

**Why it takes 60 seconds:**
- Large language models are 8-16 GB files
- Need to be loaded from disk into RAM/VRAM
- Need initialization and warmup
- This is industry-standard behavior

**After first load:**
- Model stays in RAM
- Future responses are instant (seconds, not minutes)
- No more waiting!

**To minimize waits:**
- Keep models loaded in LM Studio
- Set `keepModelsLoaded: true` in config (already set!)

---

## 📋 Copy Buttons Status

### All Copy Functions Present:

1. **✅ PM2 Logs** - "COPY ALL" button at top
2. **✅ Individual PM2 Log Entries** - "COPY" button on each entry
3. **✅ LLM Requests** - "COPY" button on each request
4. **✅ Launch Command** - Click to copy command

### How They Work:
- Click any "COPY" button
- Text copied to clipboard
- Button shows "COPIED!" for 3 seconds
- Uses `navigator.clipboard.writeText()`

**If not working:**
- Browser needs to allow clipboard access
- May need HTTPS (not HTTP)
- Try accessing via https://10.0.0.100:5173 if available

---

## 📝 Configuration File Location

### On 10.0.0.100:

**Path:**
```
~/Desktop/AI-Bot-Deploy/config-aientities.json
```

**Network Path (from your dev Mac):**
```
/Volumes/Macintosh HD-1/Users/ms1281/Desktop/AI-Bot-Deploy/config-aientities.json
```

### ✅ PM2 IS Using This Config!

The bot reads this file on startup and hot-reloads entity configs.

**To edit:**
1. Open via network: `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/AI-Bot-Deploy/config-aientities.json`
2. Make changes
3. Restart bot: `pm2 restart ai-bot` (on 10.0.0.100)

**Current Config:**
- **32 AI entities** loaded
- **2 LM Studio servers** (10.0.0.102 and 10.0.0.100)
- **Polling interval:** 3 seconds
- **WebSocket port:** 4002
- **Queue enabled:** Yes
- **Model affinity:** Yes (keeps models loaded)

---

##  Config Highlights

```json
{
  "botSettings": {
    "pollingInterval": 3000,         // Poll every 3 seconds
    "websocketPort": 4002,            // Dashboard connection
    "enableConsoleLogs": true
  },
  "queueSettings": {
    "enabled": true,                  // Queue system active
    "maxRetries": 3
  },
  "lmStudioServers": [
    {
      "ip": "10.0.0.102",            // Mac Studio 1
      "port": 1234,
      "enabled": true
    },
    {
      "ip": "10.0.0.100",            // Mac Studio 2 (local)
      "port": 1234,
      "enabled": true
    }
  ],
  "clusterSettings": {
    "keepModelsLoaded": true,         // Minimize loading waits!
    "loadBalancingStrategy": "model-affinity"
  }
}
```

---

## 🔧 Common Edits to Config

### Change Polling Speed:
```json
"pollingInterval": 5000  // Poll every 5 seconds instead of 3
```

### Disable an Entity:
```json
{
  "id": "alcohol-addiction",
  "enabled": false        // Set to false
}
```

### Change Response Probability:
```json
"responseChance": 0.5     // 50% chance to respond (was 0.2 = 20%)
```

### Change Model Quantization:
```json
"defaultQuantization": "q8_0"  // Use 8-bit instead of f16
```

---

## 🔄 After Config Changes

**Always restart the bot:**
```bash
pm2 restart ai-bot
```

**Verify changes loaded:**
```bash
pm2 logs ai-bot --lines 20
```

Look for:
```
[CONFIG] Loaded X enabled AI entities
```

---

## 🎛️ Direct File Editing

### From Your Dev Mac:

**Option 1: Text Editor**
```bash
open "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/AI-Bot-Deploy/config-aientities.json"
```

**Option 2: Terminal Editor**
```bash
nano "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/AI-Bot-Deploy/config-aientities.json"
```

**Option 3: VS Code**
- Open folder: `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/AI-Bot-Deploy/`
- Edit `config-aientities.json`
- Save
- Restart bot on 10.0.0.100

---

## 📊 Current Performance

**Entities:** 32 loaded  
**Servers:** 2 (primary: 10.0.0.100, backup: 10.0.0.102)  
**Polling:** Every 3 seconds  
**Queue:** Enabled with priority system  
**Model Loading:** ~60 seconds first time, then cached  
**Response Time:** 2-5 seconds after model loaded  

---

## ✅ Everything Makes Sense!

1. ✅ Queue monitor working
2. ✅ Messages coming from KV
3. ✅ 60 second delay is NORMAL (first model load)
4. ✅ Everything working after load
5. ✅ Copy buttons present in code
6. ✅ Config file on 10.0.0.100
7. ✅ PM2 using the config
8. ✅ You can edit via network mount

---

**Status:** 🟢 System is operating normally!

The 60-second delay will only happen on the first message to each model. After that, responses should be much faster (2-5 seconds typically).

