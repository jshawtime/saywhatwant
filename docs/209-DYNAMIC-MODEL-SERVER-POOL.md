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

## Implementation Checklist

### On 10.0.0.110 (Server Machine):
- [ ] Install Node.js (if not installed)
- [ ] Install PM2
- [ ] Create pool-manager service
- [ ] Start pool manager on port 9000
- [ ] Test HTTP API responds

### Pool Manager Service:
- [ ] Calculate max servers from RAM
- [ ] HTTP endpoint: GET /get-server?model=X
- [ ] Track active servers Map
- [ ] Start llama-server via PM2
- [ ] Return port to caller
- [ ] LRU eviction when pool full
- [ ] Idle timeout monitoring (30 min)

### On 10.0.0.99 (PM2 Bot):
- [ ] Update modelRouter to query Pool Manager API
- [ ] Handle server not ready (retry logic)
- [ ] Fallback to Ollama if Pool Manager unavailable
- [ ] Log which machine/port used

### Testing:
- [ ] Request model #1 → Server starts, port returned
- [ ] Request model #1 again → Same port, instant
- [ ] Fill pool to max → LRU eviction works
- [ ] Wait 30+ min → Idle servers killed
- [ ] Memory stays under limit

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


