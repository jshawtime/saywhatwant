# 209: Dynamic Model Server Pool - LRU + Memory-Aware

**Purpose:** Manage thousands of models with limited RAM  
**Strategy:** Load on demand, LRU eviction, memory-based limits  
**Architecture:** Pool Manager on 10.0.0.110, PM2 Bot queries via HTTP  
**Status:** 📋 PLANNING

---

## The Problem (Future Scale)

### Current System (Static):
```
30 models in folder
Start 30 servers
Memory: 30 × 18GB = 540GB
Problem: Exceeds 512GB limit!
```

### With 1000 Models:
```
1000 models in folder
Start 1000 servers?
Memory: 1000 × 18GB = 18TB
Impossible!
```

**We need:** Dynamic loading, automatic eviction, memory limits

---

## The Solution: Pool Manager + HTTP API

### Architecture Decision: ✅ Option A

**Pool Manager runs ON 10.0.0.110:**
- Manages local llama-servers
- Tracks usage, memory, availability
- Handles LRU eviction
- Exposes HTTP API for PM2 bot

**PM2 Bot runs ON 10.0.0.99:**
- Receives entity requests
- Queries Pool Manager API
- Gets port for model
- Sends inference request

**Communication:**
```
PM2 Bot (10.0.0.99):
  GET http://10.0.0.110:9000/get-server?model=the-eternal-f16
  
Pool Manager (10.0.0.110):
  Checks if server running
  Starts if needed (or evicts LRU)
  Returns: { port: 8080, status: 'ready' }
  
PM2 Bot:
  POST http://10.0.0.110:8080/v1/chat/completions
  (inference request)
```

### Pool Manager Logic:

**Memory Management:**
```
Total RAM: Detect via os.totalmem()
Reserved: 20GB (system overhead)
Available: RAM - 20GB
Per model: 18GB (with 8K context)
Max servers: floor(Available / 18)

Example (512GB): (512 - 20) / 18 = 27 servers
```

**LRU Eviction:**
```
Pool full (27 servers)
Request for new model
→ Find server with oldest lastUsed timestamp
→ Kill that server (pm2 stop llama-modelX)
→ Start new server (pm2 start llama-modelY)
→ Return port to PM2 bot
```

**Idle Timeout:**
```
Every minute:
  Check all servers
  If lastUsed > 30 minutes ago
  → Kill server (free 18GB)
  → Available for new requests
```

---

## Implementation

### Component 1: Server Pool Manager

**File:** `llamacpp-HM/server-pool-manager.js`

```javascript
class ServerPoolManager {
  constructor(maxServers = 27, idleTimeout = 30 * 60 * 1000) {
    this.maxServers = maxServers;
    this.idleTimeout = idleTimeout;  // 30 minutes
    this.activeServers = new Map();  // modelName → { pid, port, lastUsed }
    this.availablePorts = Array.from({length: 100}, (_, i) => 8080 + i);
    this.usedPorts = new Set();
  }
  
  async getServer(modelName) {
    // Check if already running
    if (this.activeServers.has(modelName)) {
      const server = this.activeServers.get(modelName);
      server.lastUsed = Date.now();
      console.log(`[Pool] Using existing server for ${modelName} (port ${server.port})`);
      return server.port;
    }
    
    // Need to start new server
    if (this.activeServers.size >= this.maxServers) {
      // Pool full - evict LRU
      await this.evictLRU();
    }
    
    // Start new server
    const port = this.getAvailablePort();
    await this.startServer(modelName, port);
    
    this.activeServers.set(modelName, {
      pid: serverPid,
      port: port,
      lastUsed: Date.now()
    });
    
    return port;
  }
  
  evictLRU() {
    // Find least recently used server
    let lruModel = null;
    let oldestTime = Date.now();
    
    for (const [model, server] of this.activeServers.entries()) {
      if (server.lastUsed < oldestTime) {
        oldestTime = server.lastUsed;
        lruModel = model;
      }
    }
    
    if (lruModel) {
      console.log(`[Pool] Evicting LRU: ${lruModel} (idle for ${(Date.now() - oldestTime)/1000}s)`);
      this.killServer(lruModel);
    }
  }
  
  startIdleMonitor() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [model, server] of this.activeServers.entries()) {
        const idleTime = now - server.lastUsed;
        
        if (idleTime > this.idleTimeout) {
          console.log(`[Pool] Killing idle server: ${model} (idle ${idleTime/1000}s)`);
          this.killServer(model);
        }
      }
    }, 60000);  // Check every minute
  }
}
```

---

### Component 2: Memory Calculator

**File:** `llamacpp-HM/calculate-max-servers.js`

```javascript
const os = require('os');

function calculateMaxServers(perServerGB = 18, reservedGB = 20) {
  const totalGB = os.totalmem() / 1024 / 1024 / 1024;
  const availableGB = totalGB - reservedGB;
  const maxServers = Math.floor(availableGB / perServerGB);
  
  console.log(`Total RAM: ${totalGB.toFixed(0)}GB`);
  console.log(`Reserved: ${reservedGB}GB`);
  console.log(`Available: ${availableGB.toFixed(0)}GB`);
  console.log(`Per server: ${perServerGB}GB`);
  console.log(`Max concurrent servers: ${maxServers}`);
  
  return maxServers;
}

module.exports = { calculateMaxServers };
```

**Usage:**
```javascript
const { calculateMaxServers } = require('./calculate-max-servers');
const maxServers = calculateMaxServers();
const pool = new ServerPoolManager(maxServers);
```

---

### Component 3: Model Router with Pool API

**Update:** `AI-Bot-Deploy/src/modules/modelRouter.ts`

```typescript
async function getModelEndpoint(modelKey: string, fallbackEndpoint: string): Promise<string> {
  try {
    // Query Pool Manager on 10.0.0.110
    const response = await fetch(`http://10.0.0.110:9000/get-server?model=${modelKey}`);
    
    if (response.ok) {
      const data = await response.json();
      const endpoint = `http://10.0.0.110:${data.port}/v1/chat/completions`;
      console.log(`[ModelRouter] ${modelKey} → 10.0.0.110:${data.port} (Llama.cpp)`);
      return endpoint;
    }
  } catch (error) {
    console.log(`[ModelRouter] Pool Manager unavailable, using fallback`);
  }
  
  // Fallback to Ollama
  console.log(`[ModelRouter] ${modelKey} → Ollama fallback`);
  return fallbackEndpoint;
}
```

**Communication:**
- PM2 Bot asks Pool Manager for port
- Pool Manager handles all server lifecycle
- PM2 Bot just sends requests to returned port

---

## Memory Calculation Examples

### 512GB Machine (Mac Studio M3 Ultra):
```
Total: 512GB
Reserved: 20GB
Available: 492GB
Per model: 18GB

Max servers: 27 concurrent
```

### 192GB Machine:
```
Total: 192GB
Reserved: 20GB
Available: 172GB
Per model: 18GB

Max servers: 9 concurrent
```

### 64GB Machine:
```
Total: 64GB
Reserved: 20GB
Available: 44GB
Per model: 18GB

Max servers: 2 concurrent
```

**System adapts to available hardware!**

---

## Behavior Examples

### Scenario 1: Under Limit (Normal Operation)

```
Request for the-eternal → Start server port 8080
Request for 1984 → Start server port 8081
Request for fear-and-loathing → Start server port 8082
...
Request for model #25 → Start server port 8104

Active: 25 servers (under 27 limit)
Memory: 450GB
All stay running
```

### Scenario 2: At Limit (LRU Eviction)

```
Active: 27 servers (at limit)
Memory: 486GB

Request for model #28
→ Find LRU: model #3 (last used 45 min ago)
→ Kill server for model #3 (free 18GB)
→ Start server for model #28
→ Active: Still 27 servers (limit maintained)
```

### Scenario 3: Idle Timeout

```
Model #15 idle for 35 minutes
Idle monitor checks every minute
→ Idle time > 30 min threshold
→ Kill server for model #15
→ Free 18GB RAM
→ Active: 26 servers
→ Next request for #15: Restart server (3-4s)
```

---

## Configuration

### Settings:

```javascript
const POOL_CONFIG = {
  maxServers: calculateMaxServers(),  // Dynamic based on RAM
  idleTimeout: 30 * 60 * 1000,       // 30 minutes
  perServerGB: 18,                    // Memory per model
  reservedGB: 20,                     // System overhead
  basePort: 8080,                     // Starting port
  checkInterval: 60000                // Check idle every minute
};
```

**Tunable:**
- Idle timeout (30 min, 1 hour, etc.)
- Per server memory (18GB default)
- Reserved RAM (20GB default)
- Check frequency (1 min default)

---

## Deployment Architecture

### On 10.0.0.110 (Llama.cpp Server Machine):

**Install:**
```bash
# Node.js (if not installed)
brew install node

# PM2
npm install -g pm2

# Llama.cpp (already done)
```

**Services:**
```bash
# Pool Manager (HTTP API on port 9000)
pm2 start pool-manager.js --name llama-pool-manager

# Individual llama-servers (managed by Pool Manager)
# Started/stopped dynamically by Pool Manager
```

**Pool Manager:**
- Calculates max servers from RAM
- Exposes HTTP API (port 9000)
- Manages llama-server lifecycle
- Tracks usage, LRU, idle timeout

---

### On 10.0.0.99 (PM2 Bot Machine):

**Update modelRouter.ts:**
- Query Pool Manager API before each request
- Get port for model
- Send inference to that port
- Fallback to Ollama if unavailable

**No changes to:**
- Entity processing
- Message handling
- Response posting
- Just routing layer changes

---

## Benefits

### Scales to ANY Number of Models:

**10 models:** All loaded (instant)  
**100 models:** Top 27 loaded, others on-demand  
**1000 models:** Top 27 loaded, LRU eviction, all accessible  
**10,000 models:** Same! Memory limit protects system  

### Memory Protection:

**Never exceeds:** maxServers × 18GB + 20GB overhead  
**Self-regulates:** Kills idle servers automatically  
**Adapts:** Works on any RAM size (64GB to 512GB+)  

### Performance:

**Hot models (in pool):** 0.1s response (instant)  
**Cold models (evicted):** 3-4s response (load time)  
**Frequently used:** Stay hot (LRU keeps them)  

---

## 🎉 IMPLEMENTATION COMPLETE AND PRODUCTION DEPLOYED!

**All core functionality is operational and tested:**

1. **✅ Pool Manager (10.0.0.110):**
   - Running on port 9000
   - Discovered 60 models (including all TSC models!)
   - Max 24 concurrent servers (512GB RAM calculation)
   - LRU eviction working perfectly (tested with 30 models)
   - 30-minute idle timeout monitoring active
   - Port reuse after eviction (6.9s vs 12.6s cold start)

2. **✅ PM2 Bot Integration (10.0.0.99):**
   - ✅ **PRODUCTION DEPLOYED** - Running on Llama.cpp!
   - Updated modelRouter to query Pool Manager dynamically
   - EQ-Score routing fixed (uses Pool Manager)
   - 10s timeout with automatic Ollama fallback
   - Dynamic logging shows actual backend used
   - All logs show `[LLAMA-CPP]` and `10.0.0.110:PORT`

3. **✅ SSH Infrastructure:**
   - Passwordless SSH established
   - Full sudo access configured
   - Remote deployments now possible

**System is LIVE in production!**

---

## ✅ Test Results Summary

**All core tests passed successfully!**

### Test 1: Single Model Request
```
Request: the-eternal-f16
Result: ✅ Server started on port 8080 in 2550ms
Verification: ✅ Llama-server responding to health checks
```

### Test 2: Model Reuse
```
Request: the-eternal-f16 (again)
Result: ✅ Reused existing server on port 8080 in 5ms
Pool Status: 1/24 servers, idle time updated correctly
```

### Test 3: Multiple Models
```
Requested: 10 different f16 models
Results:
  - First 3 models (already running): 5ms, 6ms, 4ms (instant reuse!)
  - Next 7 models (new servers): ~12.6s each (consistent startup)
  - Final pool: 10/24 servers running
  - Memory usage: ~180GB / 432GB available
  - All servers responding correctly
```

### Test 4: Idle Timeout
```
Verified: Pool Manager logs show idle servers stopped after 30 minutes
Cleanup: Automatic, no manual intervention needed
```

### Key Metrics
- **Server reuse:** 5ms average (99.8% faster than cold start!)
- **Cold start:** 12.6s average for 15GB FP16 models
- **Memory per server:** ~18GB (15GB model + 3GB context/overhead)
- **Max capacity:** 24 servers (~432GB usable from 512GB total)
- **Current test:** 10 servers (~180GB) - plenty of headroom

---

## Quick Test Guide

### 1. Verify Pool Manager is Running (10.0.0.110):
```bash
ssh 10.0.0.110 "cd ~/llama.cpp && eval \"\$(/opt/homebrew/bin/brew shellenv)\" && npx pm2 list"
```

### 2. Check Pool Status:
```bash
curl http://10.0.0.110:9000/status | python3 -m json.tool
```

### 3. Test PM2 Bot Integration (10.0.0.99):
- Start PM2 bot worker: `cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy && npx pm2 start src/index-do-simple.ts --name ai-bot-do --interpreter=node --interpreter-args="--loader ts-node/esm"`
- Send message to any entity (e.g., `the-eternal`, `1984`, `crushing-it`)
- Watch logs: `npx pm2 logs ai-bot-do`
- Look for: `[ModelRouter] model-name → 10.0.0.110:port (Llama.cpp)`

### 4. Monitor Pool Manager Logs:
```bash
ssh 10.0.0.110 "cd ~/llama.cpp && eval \"\$(/opt/homebrew/bin/brew shellenv)\" && npx pm2 logs pool-manager --lines 100"
```

### 5. Test Multiple Models:
- Send messages to 3+ different entities
- Check pool status: `curl http://10.0.0.110:9000/status | python3 -m json.tool`
- Verify multiple servers running

### 6. Test Fallback (Optional):
- Stop Pool Manager: `ssh 10.0.0.110 "cd ~/llama.cpp && eval \"\$(/opt/homebrew/bin/brew shellenv)\" && npx pm2 stop pool-manager"`
- Send message to entity
- Verify fallback: `[ModelRouter] model-name → Ollama fallback`
- Restart: `ssh 10.0.0.110 "cd ~/llama.cpp && eval \"\$(/opt/homebrew/bin/brew shellenv)\" && npx pm2 start pool-manager"`

---

## Implementation Checklist

### On 10.0.0.110 (Server Machine):
- [x] Install Node.js (v25.2.1) ✅
- [x] Install PM2 (6.0.13) ✅
- [x] Install cmake (4.1.2) ✅
- [x] Build Llama.cpp (Apple M3 Ultra + Metal) ✅
- [x] Create pool-manager service ✅
- [x] Start pool manager on port 9000 ✅
- [x] Test HTTP API responds ✅
  - Health check: OK
  - /get-server: Creates llama-server instances
  - /status: Reports 60 models, 24 max servers
  - Reuses existing servers (same model → same port)
  - Starts new servers (different model → new port)

### Pool Manager Service:
- [x] Calculate max servers from RAM ✅ (24 servers from 512GB)
- [x] HTTP endpoint: GET /get-server?model=X ✅
- [x] Track active servers Map ✅
- [x] Start llama-server via PM2 ✅
- [x] Return port to caller ✅
- [x] LRU eviction when pool full ✅ (code implemented, not yet tested)
- [x] Idle timeout monitoring (30 min) ✅ (running background monitor)

### On 10.0.0.99 (PM2 Bot):
- [x] Update modelRouter to query Pool Manager API ✅
- [x] Handle server not ready (retry logic) ✅ (10s timeout with AbortController)
- [x] Fallback to Ollama if Pool Manager unavailable ✅
- [x] Log which machine/port used ✅ (logs show 10.0.0.110:port or Ollama)

### Testing:
- [x] Request model #1 → Server starts, port returned ✅ (2550ms first request)
- [x] Request model #1 again → Same port, instant ✅ (5ms - perfect reuse!)
- [x] Test 10 different models → All start correctly ✅
  - First 3 models reused: 5ms, 6ms, 4ms
  - Next 7 models started: ~12.6s each
  - Pool: 10/24 servers, ~180GB memory usage
  - Remaining capacity: 14 servers (~252GB)
- [x] Idle tracking works ✅ (updates on each request)
- [x] Port allocation sequential ✅ (8080-8089)
- [x] 30-minute idle timeout verified ✅ (logs show cleanup)
- [x] **LRU eviction VERIFIED ✅** (tested all 30 f16 models)
  - Pool correctly capped at 24/24 servers
  - 6 oldest servers evicted when requesting models 25-30
  - Port reuse working (evicted ports reassigned)
  - Eviction+restart faster than cold start (6.9s vs 12.6s)
  - All 30 models successfully loaded
  - 3 actual inference tests passed

---

## Migration Path

### Current (Static 3 Models):
```
3 servers always running
Simple, predictable
Good for testing
```

### Phase 1 (Static N Models):
```
Load top N models based on RAM
N = calculateMaxServers()
All stay running
No eviction yet
```

### Phase 2 (Dynamic Pool):
```
Load on demand
LRU eviction
Idle timeout
Scales to thousands
```

**Start simple, evolve to dynamic!**

---

## Future Enhancements

### Priority-Based Loading:
```
High priority models: Never evict
Medium priority: Normal LRU
Low priority: Aggressive timeout
```

### Usage Analytics:
```
Track which models used most
Preload popular models
Faster average response
```

### Multi-Machine Pool:
```
10.0.0.110: 27 models
10.0.0.111: 27 models
Pool manager coordinates across machines
54 concurrent models!
```

---

## Estimated Complexity

**Memory calculator:** 1 hour  
**Basic pool manager:** 4-6 hours  
**PM2 integration:** 2-3 hours  
**LRU eviction:** 2-3 hours  
**Idle monitoring:** 1-2 hours  
**Testing:** 2-4 hours  

**Total:** 12-19 hours for full system

---

**Status:** Architecture defined  
**Next:** Implement memory calculator  
**Future:** Full dynamic pool with LRU

**This will scale to unlimited models!** 🚀


