# 209: Dynamic Model Server Pool - LRU + Memory-Aware

**Purpose:** Manage thousands of models with limited RAM  
**Strategy:** Load on demand, LRU eviction, memory-based limits  
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

## The Solution: Dynamic Server Pool

### Architecture:

**Server Pool Manager:**
```
Max servers: Calculated from available RAM
Currently running: Track active servers
Last used: Track timestamp per server
Idle timeout: Kill if unused >N minutes
On-demand: Start server when needed
```

**Memory Management:**
```
Total RAM: 512GB (detect dynamically)
Reserved: 20GB (system overhead)
Available: 492GB
Per model: 18GB (with 8K context)

Max servers: 492 / 18 = 27 concurrent servers
```

**LRU Eviction:**
```
Request for model #28
Pool is full (27 servers running)
→ Find least recently used server
→ Kill that server
→ Start server for model #28
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

### Component 3: Model Router with Pool

**Update:** `AI-Bot-Deploy/src/modules/modelRouter.ts`

```typescript
// Instead of static MODEL_PORT_MAP, query the pool:

async function getModelEndpoint(modelKey: string, fallbackEndpoint: string): Promise<string> {
  // Check if model is in Llama.cpp pool
  const port = await serverPool.getServer(modelKey);
  
  if (port) {
    console.log(`[ModelRouter] ${modelKey} → localhost:${port} (Llama.cpp)`);
    return `http://localhost:${port}/v1/chat/completions`;
  }
  
  // Fallback to Ollama
  console.log(`[ModelRouter] ${modelKey} → fallback (Ollama)`);
  return fallbackEndpoint;
}
```

**This will:**
- Get port for existing server
- Or start new server if not running
- Or evict LRU and start new server if pool full

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

## PM2 Integration

### Server Pool as PM2 Service

**File:** `llamacpp-HM/pool-manager.js`

Main service that:
1. Monitors requests from PM2 bot
2. Starts/stops llama-servers as needed
3. Tracks usage and enforces limits
4. Runs as PM2 daemon

**Start:**
```bash
pm2 start pool-manager.js --name llama-pool
```

**PM2 Bot:**
```typescript
// Instead of fixed port routing
const port = await queryPoolManager(modelKey);
const endpoint = `http://localhost:${port}/v1/chat/completions`;
```

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

## Implementation Phases

### Phase 1: Memory Calculator
- [ ] Detect system RAM
- [ ] Calculate max servers
- [ ] Test on different machines

### Phase 2: Server Pool Manager
- [ ] Track active servers
- [ ] Start/stop llama-servers
- [ ] LRU eviction logic
- [ ] Idle timeout monitoring

### Phase 3: PM2 Integration
- [ ] Pool manager as PM2 service
- [ ] PM2 bot queries pool
- [ ] Dynamic routing based on pool
- [ ] Fallback to Ollama if pool busy

### Phase 4: Testing
- [ ] Test with 30 models
- [ ] Verify LRU eviction
- [ ] Verify idle timeout
- [ ] Monitor memory stays under limit

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


