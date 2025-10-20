# Bot Deployment Architecture

## 📌 Version
- **Created**: September 27, 2025
- **Purpose**: Clarify bot deployment options and server independence

## 🎯 Key Architectural Facts

### ✅ TRUTH: Server Independence
Each LM Studio server is **completely independent**:
- Mac Studio 1 (10.0.0.102) - Standalone inference server
- Mac Studio 2 (10.0.0.100) - Standalone inference server
- Bot communicates **directly** with each server
- **NO routing through 10.0.0.102** to reach other servers

### ✅ TRUTH: Bot Location Flexibility
The bot can run on **ANY** machine that has:
1. Node.js installed
2. PM2 installed (for process management)
3. LM Studio CLI (`lms` command) installed
4. Network access to ALL LM Studio servers

### ❌ COMMON MISCONCEPTIONS

| Misconception | Reality |
|---------------|---------|
| Bot must run on 10.0.0.102 | Bot can run on ANY local machine |
| 10.0.0.102 routes to other servers | Each server is directly accessed |
| If 10.0.0.102 dies, system fails | Other servers continue independently |
| Bot needs special server setup | Just needs Node.js + lms CLI |

## 🏗️ Network Architecture

```
┌─────────────────────────────────────┐
│   Bot Machine (ANY local machine)   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  AI Bot (PM2 managed)       │   │
│  │  - Uses lms CLI commands    │   │
│  │  - Makes HTTP requests      │   │
│  └──────┬──────────┬───────────┘   │
│         │          │                │
└─────────┼──────────┼────────────────┘
          │          │
    Direct│          │Direct
     HTTP │          │HTTP
      +CLI│          │+CLI
          │          │
          ▼          ▼
    ┌──────────┐  ┌──────────┐
    │Mac Studio│  │Mac Studio│
    │   .102   │  │   .100   │
    │          │  │          │
    │LM Studio │  │LM Studio │
    │  Server  │  │  Server  │
    └──────────┘  └──────────┘
```

## 🚀 Deployment Options

### Option 1: Bot on Your Main Workstation
```bash
# On your main Mac where you develop
cd /path/to/saywhatwant/ai
pm2 start npm --name "ai-bot" -- run start
```
**Pros**: Easy debugging, logs visible
**Cons**: Stops if you shutdown

### Option 2: Bot on Dedicated Machine
```bash
# On any spare Mac/Linux box
git clone <repo>
cd saywhatwant/ai
npm install
pm2 start npm --name "ai-bot" -- run start
pm2 startup  # Auto-start on boot
pm2 save
```
**Pros**: Always running, independent
**Cons**: Need SSH for logs/updates

### Option 3: Bot on One of the Mac Studios
```bash
# On 10.0.0.102 OR 10.0.0.100 (not both!)
# Install Node.js, PM2, lms CLI first
cd /path/to/saywhatwant/ai
pm2 start npm --name "ai-bot" -- run start
```
**Pros**: One less machine to manage
**Cons**: If that Studio fails, bot stops

## 🔧 Failover Scenarios

### Scenario: Mac Studio 1 (10.0.0.102) Fails

**What happens:**
- ✅ Bot continues running (if not on .102)
- ✅ Mac Studio 2 (.100) continues serving
- ✅ System operates at 50% capacity
- ⚠️ Bot logs errors for .102 connections

**Recovery:**
1. Fix/restart Mac Studio 1
2. Bot automatically reconnects
3. Back to 100% capacity

### Scenario: Mac Studio 2 (10.0.0.100) Fails

**What happens:**
- ✅ Bot continues running
- ✅ Mac Studio 1 (.102) continues serving
- ✅ System operates at 50% capacity
- ⚠️ Bot logs errors for .100 connections

### Scenario: Bot Machine Fails

**What happens:**
- ❌ No new AI responses
- ✅ LM Studio servers still running
- ✅ Models stay loaded in memory

**Recovery:**
1. Start bot on ANY other machine
2. System immediately operational

## 🎮 CLI Commands Reference

### From Bot Machine to Control Servers

```bash
# Load model on specific server
lms load "highermind_the-eternal-1" --host 10.0.0.102
lms load "highermind_the-eternal-1" --host 10.0.0.100

# Unload model from specific server
lms unload "model-name" --host 10.0.0.102

# List models on specific server
lms ls --host 10.0.0.100

# Check server status (via API)
curl http://10.0.0.102:1234/api/v0/models
curl http://10.0.0.100:1234/api/v0/models
```

## 🌍 Why Not Cloudflare?

### Cloudflare Workers Limitations:
- ❌ No shell/CLI access (can't run `lms` commands)
- ❌ No persistent processes
- ❌ No filesystem access
- ❌ Short execution timeout (30 seconds)

### Local Bot Requirements:
- ✅ Shell access for `lms` CLI
- ✅ Long-running process (PM2)
- ✅ Direct network access to LM Studios
- ✅ Can execute child processes

## 📊 Performance Considerations

### Network Latency
- **Same machine**: ~0.1ms (bot + LM Studio on same box)
- **Local network**: ~0.5-2ms (typical home network)
- **Impact**: Negligible for inference (models take 1-5 seconds)

### Load Distribution
With 2 servers using round-robin:
- Each server handles ~50% of requests
- If one fails, other handles 100%
- Can add more servers anytime

### Adding More Servers

Edit `config-aientities.json`:
```json
"lmStudioServers": [
  { "ip": "10.0.0.102", ... },
  { "ip": "10.0.0.100", ... },
  { "ip": "10.0.0.NEW", ... }  // Just add!
]
```

## 🔑 Key Takeaways

1. **Bot location is flexible** - Run it anywhere with Node.js + CLI
2. **Servers are independent** - No server depends on another
3. **Direct connections** - Bot talks directly to each server
4. **Graceful degradation** - System continues with fewer servers
5. **Easy scaling** - Just add more LM Studio servers to the config

## 🆘 Troubleshooting

### "Can't connect to 10.0.0.XXX"
- Check LM Studio is running on that machine
- Verify port 1234 is open
- Test with: `curl http://10.0.0.XXX:1234/v1/models`

### "lms command not found"
- Install LM Studio on the bot machine
- Add to PATH: `export PATH="/path/to/LMStudio.app/Contents/MacOS:$PATH"`

### "Model not loading"
- Check available disk/memory on target server
- Verify model exists: `lms ls --host 10.0.0.XXX`
- Try manual load in LM Studio GUI

## 📝 Summary

**The bot is NOT tied to any specific machine.** It's a coordinator that can run anywhere on your local network. Each LM Studio server is independent. The system is resilient and scales horizontally by adding more servers.
