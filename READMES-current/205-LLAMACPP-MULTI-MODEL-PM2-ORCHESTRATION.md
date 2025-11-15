# 205: Llama.cpp Multi-Model PM2 Orchestration

**Status:** 📋 PLANNING - Dynamic multi-model server management  
**Created:** 2025-11-15  
**Priority:** HIGH - Production multi-model support  
**Hardware:** Mac Studio M3 Ultra (512GB RAM)

---

## 🎯 The Architecture

### One Model Per Server Instance

**Llama.cpp Limitation (Not Really a Limitation):**
- Each llama-server instance loads ONE model
- Model stays in RAM (instant inference)
- To use multiple models: Run multiple server instances

**Solution: PM2 Manages Multiple Servers**
```
PM2 Process Manager
├─ llama-server-1 (port 8080) → the-eternal-f16 (13.5GB)
├─ llama-server-2 (port 8081) → 1984-f16 (13.5GB)
├─ llama-server-3 (port 8082) → fear-and-loathing-f16 (13.5GB)
├─ llama-server-4 (port 8083) → aristotle-f16 (13.5GB)
├─ llama-server-5 (port 8084) → shakespeare-f16 (13.5GB)
...
└─ llama-server-N (port 808N) → model-N-f16 (13.5GB)

PM2 Bot Workers
├─ Worker 1 → Routes to correct port based on entity
├─ Worker 2 → Routes to correct port based on entity
└─ Worker 3 → Routes to correct port based on entity
```

**Benefits:**
- ✅ All models loaded simultaneously (0s load time!)
- ✅ PM2 monitors all servers
- ✅ Auto-restart if any crash
- ✅ Health monitoring
- ✅ Memory tracking
- ✅ Dynamic scaling (start/stop servers as needed)

---

## 📊 Memory-Based Server Limits

### Calculation for 512GB RAM:

**Per Llama.cpp Server:**
```
Model file: 15GB (FP16 GGUF)
Context + KV cache: 3GB (with 8K context)
Parallel slots overhead: 0GB (using --parallel 1 per server)
Total per server: ~18GB
```

**Maximum Concurrent Servers:**
```
Available RAM: 512GB
System overhead: ~50GB
Usable for models: ~460GB

Max servers: 460 / 18 = 25 servers

Conservative: 20 servers (leaves headroom)
Aggressive: 24 servers (near limit)
```

**This means:**
- 20 models loaded simultaneously
- 22 other models: Load on demand (~1s)
- Or: All 42 entities if you optimize

---

## 🏗️ PM2 Ecosystem Configuration

### Dynamic Server Management

**File:** `llamacpp-HM/ecosystem-models.js`

```javascript
const MODELS_DIR = "/Volumes/BOWIE/_MODELS/HIGHERMIND models ready to use/HIGHERMIND-models";

// Top 20 most-used models (always loaded)
const ALWAYS_LOADED = [
  { name: 'the-eternal', port: 8080 },
  { name: '1984', port: 8081 },
  { name: 'fear-and-loathing', port: 8082 },
  { name: 'the-complete-works-of-aristotle', port: 8083 },
  { name: 'crushing-it', port: 8084 },
  { name: 'emotional-intelligence', port: 8085 },
  { name: 'philosophy-philosophy-philosophy', port: 8086 },
  { name: 'climate-change-solutions', port: 8087 },
  { name: 'the-four-agreements', port: 8088 },
  { name: 'sleep-coach', port: 8089 },
  { name: 'mind-control-for-health-living', port: 8090 },
  { name: 'crucial-conversations', port: 8091 },
  { name: 'art-of-war', port: 8092 },
  { name: 'being-and-nothingness', port: 8093 },
  { name: 'the-road-not-taken', port: 8094 },
  { name: 'how-to-talk-so-kids-will-listen', port: 8095 },
  { name: 'your-money-or-your-life', port: 8096 },
  { name: 'why-we-sleep-unlocking-the-power-of-sleep', port: 8097 },
  { name: 'the-body-keeps-the-score', port: 8098 },
  { name: 'what-color-is-your-parachute', port: 8099 }
];

module.exports = {
  apps: ALWAYS_LOADED.map(model => ({
    name: `llama-${model.name}`,
    script: 'llama.cpp/build/bin/llama-server',
    args: [
      '--model', `${MODELS_DIR}/${model.name}-f16/${model.name}_f16.gguf`,
      '--port', model.port.toString(),
      '--parallel', '1',  // One slot per server (multiple servers = parallelization)
      '--ctx-size', '8192',
      '--host', '0.0.0.0'
    ],
    cwd: '/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/llamacpp-HM',
    max_restarts: 10,
    autorestart: true,
    max_memory_restart: '20G',  // Restart if exceeds 20GB
    error_file: `logs/${model.name}-error.log`,
    out_file: `logs/${model.name}-out.log`,
    merge_logs: true
  }))
};
```

**Start all 20 servers with ONE command:**
```bash
pm2 start ecosystem-models.js
```

**PM2 will:**
- ✅ Start all 20 servers
- ✅ Monitor memory usage
- ✅ Restart if any crash
- ✅ Show status of all
- ✅ Limit to exactly 20 (no more, no less)

---

## 🗺️ Model Routing Map

### Create Model → Port Mapping

**File:** `AI-Bot-Deploy/src/modules/modelRouter.ts`

```typescript
interface ModelRoute {
  entityId: string;
  modelName: string;
  port: number;
  quantization: string;
}

const MODEL_ROUTES: Map<string, ModelRoute> = new Map([
  ['the-eternal-f16', { entityId: 'the-eternal', modelName: 'the-eternal', port: 8080, quantization: 'f16' }],
  ['1984-f16', { entityId: '1984', modelName: '1984', port: 8081, quantization: 'f16' }],
  ['fear-and-loathing-f16', { entityId: 'fear-and-loathing', modelName: 'fear-and-loathing', port: 8082, quantization: 'f16' }],
  // ... all 20 models
]);

export function getModelEndpoint(entity: any): string {
  const modelKey = `${entity.baseModel}-${entity.defaultQuantization}`;
  const route = MODEL_ROUTES.get(modelKey);
  
  if (route) {
    // Model is pre-loaded on dedicated server
    return `http://localhost:${route.port}/v1/chat/completions`;
  } else {
    // Fallback: Use on-demand loading server (if implemented)
    // Or return Ollama endpoint as fallback
    return 'http://10.0.0.110:11434/v1/chat/completions';  // Ollama fallback
  }
}
```

**PM2 Worker uses this:**
```typescript
const endpoint = getModelEndpoint(entity);
const backend = createBackend('llama-cpp', endpoint);
const response = await backend.sendRequest(...);
```

---

## 📈 Dynamic Scaling Based on Memory

### Memory-Aware Server Management

**Query available memory:**
```bash
# Get available RAM
vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//'

# Get llama-server memory usage
ps aux | grep llama-server | awk '{sum+=$6} END {print sum/1024/1024 " GB"}'
```

**PM2 can monitor this via:**
```javascript
// In ecosystem config
max_memory_restart: '20G'  // Restart server if exceeds 20GB
```

**Advanced: Dynamic server count based on available memory**

**File:** `llamacpp-HM/calculate-max-servers.sh`

```bash
#!/bin/bash

# Get total RAM
TOTAL_RAM_GB=512

# Get used RAM
USED_RAM=$(ps aux | awk '{sum+=$6} END {print sum/1024/1024}')

# Available RAM
AVAILABLE=$((TOTAL_RAM_GB - USED_RAM))

# Per server requirement
PER_SERVER=18

# Calculate how many servers we can run
MAX_SERVERS=$((AVAILABLE / PER_SERVER))

echo "Total RAM: ${TOTAL_RAM_GB}GB"
echo "Used RAM: ${USED_RAM}GB"
echo "Available: ${AVAILABLE}GB"
echo "Max llama-servers: $MAX_SERVERS (at ${PER_SERVER}GB each)"
```

**PM2 Bot can query this before starting servers:**
```typescript
// Get max servers from memory calculation
const maxServers = await getMaxServersFromMemory();

// Only start that many
const serversToStart = models.slice(0, maxServers);
```

---

## 🔧 Implementation Plan

### Phase 1: Static Model List (Simple)

**Start with 20 pre-defined models:**
```bash
pm2 start ecosystem-models.js
# Starts exactly 20 servers
# Fixed port assignments
# Simple model routing
```

**PM2 Bot:**
- Looks up port by model name
- Sends request to that port
- Fallback to Ollama if model not loaded

**Complexity:** Low  
**Benefit:** 20 models instant (0s load)

---

### Phase 2: Dynamic Server Management (Advanced)

**PM2 starts servers based on available memory:**

**Script:** `start-optimal-servers.sh`
```bash
#!/bin/bash

# Calculate how many servers we can run
MAX_SERVERS=$(./calculate-max-servers.sh | grep "Max llama-servers" | awk '{print $3}')

echo "Can run $MAX_SERVERS servers based on available memory"

# Generate ecosystem config dynamically
node generate-ecosystem.js $MAX_SERVERS

# Start servers
pm2 start ecosystem-dynamic.js
```

**PM2 Bot:**
- Queries PM2 for running servers
- Routes to loaded models
- Falls back to Ollama for unloaded models

**Complexity:** Medium  
**Benefit:** Optimal resource usage

---

### Phase 3: On-Demand Loading (Most Advanced)

**PM2 manages a pool of "worker" llama-servers:**
```
5 llama-server instances (ports 8080-8084)
Each can load ANY model
PM2 Bot assigns models to servers dynamically
```

**When request comes in:**
1. Check if model is loaded on any server
2. If yes: Route to that server
3. If no: Find free server, load model there
4. LRU eviction if all servers busy

**Complexity:** High  
**Benefit:** Maximum flexibility

---

## 📋 Recommended Approach

### Start with Phase 1 (Static 20 Models):

**Why:**
- Simple to implement
- Predictable performance
- Easy to debug
- Covers 20 most-used entities
- Other 22 entities use Ollama fallback

**Implementation:**
1. Create ecosystem-models.js (20 servers)
2. Create model routing map
3. Update PM2 bot to route by model
4. Test with top 20 models

**Memory usage:**
- 20 servers × 18GB = 360GB
- Leaves 150GB for system + buffers
- Safe and stable

---

## 🧪 Testing Strategy

### Test 1: Start 3 Servers
```bash
pm2 start ecosystem-3models.js
# the-eternal (8080), 1984 (8081), fear-and-loathing (8082)
```

**Verify:**
- All 3 start successfully
- Each loads correct model
- All respond to requests
- PM2 monitors all

### Test 2: Routing Logic
```typescript
// Request for the-eternal entity
endpoint = getModelEndpoint({baseModel: 'the-eternal', defaultQuantization: 'f16'})
// Should return: http://localhost:8080/v1/chat/completions

// Request for 1984 entity
endpoint = getModelEndpoint({baseModel: '1984', defaultQuantization: 'f16'})
// Should return: http://localhost:8081/v1/chat/completions
```

### Test 3: Memory Monitoring
```bash
pm2 list  # Check memory usage
# Each should show ~18GB
# Total should be ~54GB for 3 servers
```

### Test 4: Scale to 20
```bash
pm2 delete all
pm2 start ecosystem-models.js
pm2 list
# Should show 20 servers running
# Total memory: ~360GB
```

---

## 🔍 Memory Monitoring & Limits

### PM2 Built-in Monitoring

**Check memory usage:**
```bash
pm2 list  # Shows memory per process
pm2 monit  # Real-time monitoring
```

**Automatic restart on memory limit:**
```javascript
// In ecosystem config
max_memory_restart: '20G'
// PM2 restarts server if it exceeds 20GB
```

### Query Llama.cpp Server Stats

**Llama.cpp provides metrics endpoint:**
```bash
curl http://localhost:8080/metrics

# Returns:
# - Memory usage
# - Active slots
# - Queue depth
# - Processing time
```

**PM2 Bot can query this:**
```typescript
async function getServerMemory(port: number): Promise<number> {
  const response = await fetch(`http://localhost:${port}/metrics`);
  const data = await response.text();
  
  // Parse prometheus-style metrics
  const memMatch = data.match(/process_resident_memory_bytes (\d+)/);
  return memMatch ? parseInt(memMatch[1]) / 1024 / 1024 / 1024 : 0; // GB
}
```

**Dynamic decision:**
```typescript
// Before starting new server, check total memory
const currentServers = await pm2.list();
const totalMemory = currentServers.reduce((sum, s) => sum + s.memory, 0);

const availableGB = 512 - (totalMemory / 1024 / 1024 / 1024);

if (availableGB > 20) {
  // Can start another server
  pm2.start(newServerConfig);
} else {
  // Use fallback (Ollama or queue)
  console.log('Memory limit reached, using fallback');
}
```

---

## 🎨 Configuration Examples

### ecosystem-3models.js (Testing):
```javascript
module.exports = {
  apps: [
    {
      name: 'llama-the-eternal',
      script: 'llama.cpp/build/bin/llama-server',
      args: '--model "/Volumes/BOWIE/_MODELS/HIGHERMIND models ready to use/HIGHERMIND-models/the-eternal-f16/the-eternal_f16.gguf" --port 8080 --parallel 1 --ctx-size 8192 --host 0.0.0.0',
      max_memory_restart: '20G'
    },
    {
      name: 'llama-1984',
      script: 'llama.cpp/build/bin/llama-server',
      args: '--model "/Volumes/BOWIE/_MODELS/HIGHERMIND models ready to use/HIGHERMIND-models/1984-f16/1984_f16.gguf" --port 8081 --parallel 1 --ctx-size 8192 --host 0.0.0.0',
      max_memory_restart: '20G'
    },
    {
      name: 'llama-fear-and-loathing',
      script: 'llama.cpp/build/bin/llama-server',
      args: '--model "/Volumes/BOWIE/_MODELS/HIGHERMIND models ready to use/HIGHERMIND-models/fear-and-loathing-f16/fear-and-loathing_f16.gguf" --port 8082 --parallel 1 --ctx-size 8192 --host 0.0.0.0',
      max_memory_restart: '20G'
    }
  ]
};
```

### ecosystem-models.js (Production - 20 models):
```javascript
const MODELS_DIR = "/Volumes/BOWIE/_MODELS/HIGHERMIND models ready to use/HIGHERMIND-models";

const TOP_20_MODELS = [
  'the-eternal', '1984', 'fear-and-loathing', 
  'the-complete-works-of-aristotle', 'crushing-it',
  'emotional-intelligence', 'philosophy-philosophy-philosophy',
  'climate-change-solutions', 'the-four-agreements',
  'sleep-coach', 'mind-control-for-health-living',
  'crucial-conversations', 'art-of-war',
  'being-and-nothingness', 'the-road-not-taken',
  'how-to-talk-so-kids-will-listen', 'your-money-or-your-life',
  'why-we-sleep-unlocking-the-power-of-sleep',
  'the-body-keeps-the-score', 'what-color-is-your-parachute'
];

module.exports = {
  apps: TOP_20_MODELS.map((model, index) => ({
    name: `llama-${model}`,
    script: 'llama.cpp/build/bin/llama-server',
    args: `--model "${MODELS_DIR}/${model}-f16/${model}_f16.gguf" --port ${8080 + index} --parallel 1 --ctx-size 8192 --host 0.0.0.0`,
    cwd: '/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/llamacpp-HM',
    max_memory_restart: '20G',
    max_restarts: 10,
    autorestart: true
  }))
};
```

---

## 🔀 Model Routing in PM2 Bot

### Static Routing (Simple)

**File:** `AI-Bot-Deploy/src/modules/modelRouter.ts`

```typescript
const MODEL_PORT_MAP: Record<string, number> = {
  'the-eternal-f16': 8080,
  '1984-f16': 8081,
  'fear-and-loathing-f16': 8082,
  'the-complete-works-of-aristotle-f16': 8083,
  // ... all 20 models
};

export function getModelEndpoint(modelKey: string): string {
  const port = MODEL_PORT_MAP[modelKey];
  
  if (port) {
    return `http://localhost:${port}/v1/chat/completions`;
  }
  
  // Fallback to Ollama for unloaded models
  return 'http://10.0.0.110:11434/v1/chat/completions';
}
```

**Update backend creation:**
```typescript
// In generateResponse()
const modelKey = `${entity.baseModel}-${entity.defaultQuantization}`;
const endpoint = getModelEndpoint(modelKey);
const backend = createBackend('llama-cpp', endpoint);
```

---

### Dynamic Routing (Advanced)

**Query PM2 for running servers:**
```typescript
import pm2 from 'pm2';

async function getAvailableModels(): Promise<Map<string, number>> {
  return new Promise((resolve) => {
    pm2.list((err, processes) => {
      const modelMap = new Map<string, number>();
      
      processes.forEach(proc => {
        if (proc.name?.startsWith('llama-')) {
          const modelName = proc.name.replace('llama-', '');
          // Parse port from args
          const portMatch = proc.pm2_env?.args?.match(/--port (\d+)/);
          if (portMatch) {
            modelMap.set(modelName, parseInt(portMatch[1]));
          }
        }
      });
      
      resolve(modelMap);
    });
  });
}

// Use in routing:
const availableModels = await getAvailableModels();
const port = availableModels.get(entity.baseModel);

if (port) {
  return `http://localhost:${port}/v1/chat/completions`;
} else {
  // Fallback to Ollama
  return 'http://10.0.0.110:11434/v1/chat/completions';
}
```

---

## 📊 Performance Expectations

### Current (Ollama):
```
42 entities, serial processing
Throughput: ~720 messages/hour
Concurrent: 1
Wait time (10 users): 27.5s average
```

### Phase 1 (20 Llama.cpp + 22 Ollama):
```
20 entities: Llama.cpp (instant, pre-loaded)
22 entities: Ollama fallback

Throughput: Same as Ollama (~720/hour)
But: 20 entities have 0s load time!
```

### Phase 2 (20 Llama.cpp + 3 PM2 Workers):
```
20 pre-loaded models
3 concurrent requests possible

Throughput: ~2000 messages/hour
Concurrent: 3
Wait time (10 users): 8-10s average

3x improvement!
```

### Phase 3 (All 42 Entities):

**Option A: 24 Llama.cpp + 18 Ollama**
- 24 instant (pre-loaded)
- 18 fallback (still serial)

**Option B: 42 Llama.cpp (Aggressive)**
```
Memory needed: 42 × 18GB = 756GB
Available: 512GB
NOT POSSIBLE!
```

**Option C: 24 Llama.cpp + On-Demand Loading**
- 24 always loaded (top entities)
- Others: Load dynamically (~1s penalty)
- Evict LRU when memory full

---

## 🎯 Recommended Production Setup

### Tier 1: Top 20 Models (Always Loaded)
```
Llama.cpp servers on ports 8080-8099
Memory: 360GB
Load time: 0s (instant!)
```

### Tier 2: Next 15 Models (Ollama Fallback)
```
Ollama backend (current system)
Memory: Shared
Load time: 0s (Ollama keeps loaded)
```

### Tier 3: Least Used 7 Models
```
Ollama backend
Load on demand as needed
```

**Total memory:** 360GB (Llama.cpp) + existing Ollama

**Benefits:**
- ✅ Most requests instant (top 20)
- ✅ Fallback for others (no breaking)
- ✅ Memory within limits
- ✅ Easy to manage

---

## 🔄 Graceful Degradation

**If memory runs low:**
```typescript
// PM2 Bot detects low memory
if (availableMemory < threshold) {
  // Stop least-used Llama.cpp server
  pm2.stop('llama-least-used-model');
  
  // Free up 18GB
  // Continue with remaining servers
}
```

**If Llama.cpp server crashes:**
```typescript
// PM2 auto-restarts (configured in ecosystem)
// Or: Route to Ollama fallback
// System continues working!
```

---

## 📝 Management Commands

### Start All Model Servers:
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/llamacpp-HM
pm2 start ecosystem-models.js
```

### Monitor:
```bash
pm2 list              # List all servers
pm2 monit             # Real-time monitoring
pm2 logs llama-1984   # Specific server logs
```

### Check Memory:
```bash
pm2 list | grep llama | awk '{print $1, $9}'
# Shows: server-name memory-usage
```

### Restart Specific Model:
```bash
pm2 restart llama-the-eternal
# Just that model server restarts
# Others keep running!
```

### Stop All:
```bash
pm2 stop all
# Or: pm2 delete all (removes from PM2)
```

---

## 🎯 Answer to Your Questions

### Q1: Can PM2 start servers on different ports?

**Yes!** PM2 can start N servers with different args/ports.

Ecosystem config defines each server with unique port.

### Q2: Can PM2 monitor to not exceed max servers?

**Yes!** Two approaches:

**Approach A: Fixed limit in ecosystem.config.js**
```javascript
// Define exactly 20 apps = max 20 servers
// PM2 won't start more than defined
```

**Approach B: Dynamic script checks memory**
```bash
# Script calculates max based on available RAM
# Generates ecosystem config with N servers
# PM2 starts that many (no more)
```

### Q3: Can we query memory through Llama.cpp?

**Yes!** Llama.cpp has `/metrics` endpoint (Prometheus format):
```bash
curl http://localhost:8080/metrics

# Returns metrics including:
# - process_resident_memory_bytes
# - llama_slots_active
# - llama_slots_available
```

**PM2 Bot can query this before routing!**

---

## 🚀 Next Steps

1. Create ecosystem-3models.js (test with 3)
2. Create modelRouter.ts (port mapping)
3. Update PM2 bot to route by model
4. Test with 3 models
5. Scale to 20 models
6. Monitor memory usage
7. Tune based on performance

---

**Status:** Architecture defined, ready to implement  
**Complexity:** Medium (routing logic + ecosystem config)  
**Benefit:** 20+ models instant, 3x+ throughput  
**Memory-safe:** PM2 limits + monitoring ensure stability


