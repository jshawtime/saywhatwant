# 229: Llama.cpp Pool Manager Restart Guide

**Tags:** #llama-cpp #pool-manager #restart #power-failure #10.0.0.110  
**Created:** December 25, 2025  
**Status:** ✅ REFERENCE

---

## Quick Reference

**Machine:** 10.0.0.110 (Mac Studio M3 Ultra, 512GB RAM)  
**Service:** Pool Manager on port 9000  
**Location:** `/Users/ms512-1/llama.cpp/pool-manager.js`

---

## Restart After Power Failure

### 1. SSH into the Mac Studio

```bash
ssh ms512-1@10.0.0.110
```

### 2. Start the Pool Manager via PM2

```bash
eval "$(/opt/homebrew/bin/brew shellenv)" && cd ~/llama.cpp && npx pm2 start pool-manager.js --name pool-manager
```

### 3. Verify it's Running

```bash
# Check PM2 status
eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 list

# Or from any machine, check the API
curl http://10.0.0.110:9000/status
```

**Expected response:**
```json
{"poolSize":0,"maxServers":24,"totalModels":60,"servers":[]}
```

---

## One-Liner (from dev machine)

```bash
ssh ms512-1@10.0.0.110 'eval "$(/opt/homebrew/bin/brew shellenv)" && cd ~/llama.cpp && npx pm2 start pool-manager.js --name pool-manager'
```

---

## Verify from Dev Machine

```bash
curl -s http://10.0.0.110:9000/status
curl -s http://10.0.0.110:9000/models | head -20
curl -s http://10.0.0.110:9000/health
```

---

## What Happens After Restart

1. **Pool Manager starts** on port 9000
2. **Discovers all models** in `/Users/ms512-1/Desktop/HIGHERMIND-models` (~60 models)
3. **Pool is empty** (0 servers running)
4. **On-demand loading:** When AI bot requests a model, Pool Manager:
   - Allocates a port (8080-9000 range)
   - Starts a `llama-server` instance via PM2
   - Waits for health check (up to 90 seconds)
   - Returns port to the AI bot
5. **First request to new model:** ~30-60 seconds (loading 15GB into RAM)
6. **Subsequent requests:** 1-3 seconds

---

## Pool Manager Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /status` | Pool status (current/max servers, model count) |
| `GET /models` | List all discovered models |
| `GET /health` | Health check |
| `GET /get-server?model=X` | Get/start server for model X |

---

## View Logs

```bash
# SSH in first, then:
eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 logs pool-manager --lines 50

# Or with streaming:
eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 logs pool-manager
```

---

## Stop/Restart Pool Manager

```bash
# Stop
eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 stop pool-manager

# Restart
eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 restart pool-manager

# Delete (full stop)
eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 delete pool-manager
```

---

## Troubleshooting

### "Pool Manager unavailable" in AI bot logs
- Pool Manager not running on 10.0.0.110:9000
- Run restart command above

### PM2 not found
- Need to load Homebrew environment first
- Use: `eval "$(/opt/homebrew/bin/brew shellenv)"` before `npx pm2`

### Models not discovered
- Check models directory exists: `ls ~/Desktop/HIGHERMIND-models`
- Each model needs a `.gguf` file in its subdirectory

---

## Architecture Notes

- **Pool Manager** manages multiple `llama-server` instances
- **LRU eviction:** When pool is full (24 servers), least-recently-used server is stopped
- **Idle timeout:** Servers stop after 30 minutes of no requests
- **Memory:** Each server uses ~18GB (15GB model + 3GB context)
- **Max capacity:** 24 servers × 18GB = 432GB (leaving 80GB for OS)

---

*Last updated: December 25, 2025*

