# 204: Llama.cpp Parallel Backend - Flag-Based Dual System

**Status:** 📋 PLANNING - Ollama + Llama.cpp via config flag  
**Created:** 2025-11-13  
**Priority:** HIGH - Parallelization for scale  
**Hardware:** Mac Studio M3 Ultra (512GB RAM, 76-core GPU)

---

## 🎯 The Problem (Current Bottleneck)

### Current: Single PM2 + Ollama

**PM2 Processing:**
```
Message 1 arrives → PM2 claims → Sends to Ollama → Waits 5s → Posts response
Message 2 arrives → Waits for Message 1 to finish
Message 3 arrives → Waits for Messages 1 & 2
```

**Ollama Processing:**
```
Request 1: Processing (30 tps)
Request 2: WAITING (queued)
Request 3: WAITING (queued)

Serial processing only - NO parallelization!
```

**Throughput:**
- ~720 messages/hour (1 every 5 seconds)
- One user at a time
- Others wait

**From YouTube transcript:**
> "When you have Ollama running like this, it only handles one message at a time, no matter where it's coming from... There is no concurrency here."

---

## 🚀 The Solution: Llama.cpp Parallel Processing

### Llama.cpp Behavior (From YouTube):

**Parallel Requests:**
```
Request 1: write story about Alex  → Processing (16 tps)
Request 2: write story about Bob   → Processing (17 tps) | PARALLEL!
Request 3: write story about Tracy → Processing (13 tps) | PARALLEL!
Request 4: write story about Alice → Processing (13 tps) | PARALLEL!

All 4 processing simultaneously!
Aggregate: ~60 tps total
Each gets: 13-17 tps
```

**From YouTube:**
> "All four of these are now generating... our tokens per second took a dive here because we're now splitting up the processing that GPU between these processes. But at least we can now work with multiple processes."

**4 concurrent requests:**
- Individual: 13-17 tps each
- Aggregate: ~50-60 tps total
- **4x throughput!**

---

## 📊 Theoretical vs Practical Limits

### Mac Studio M3 Ultra Specs:
- 512GB RAM
- 76-core GPU
- ~400GB/s memory bandwidth
- Metal acceleration

### Theoretical Maximum (Memory-Based):

**Assumption:** Qwen2.5 7B Q4 model = ~4GB VRAM per instance

```
Total VRAM available: ~192GB (shared memory)
Per model instance: ~4GB
Theoretical max: 192 / 4 = 48 concurrent instances
```

**But this ignores:**
- GPU core limits
- Memory bandwidth saturation
- Context overhead
- System resources

### Practical Maximum (From Video Evidence):

**From YouTube transcript:**
```
4 concurrent chats running:
- Memory: 13GB / 16GB used
- Each: 13-17 tps
- Total: ~50-60 tps aggregate

On M4 Mac Mini (16GB):
- 4 concurrent = works well
- Memory not saturated
- GPU utilized

Scaled to M3 Ultra (512GB):
- 32x more RAM
- Likely supports: 20-40 concurrent requests
- Before hitting bandwidth/GPU limits
```

### Conservative Practical Estimate:

**For production stability:**
- **Concurrent slots: 16-24** (conservative)
- **Each request: 10-20 tps** (depending on load)
- **Aggregate: 200-400 tps** (with 20 slots @ 15 tps each)

**Aggressive:**
- **Concurrent slots: 32-40**
- **Each request: 8-15 tps**
- **Aggregate: 300-500 tps**

**Llama.cpp default:** Usually 4-8 slots, but configurable via `--parallel N` flag

---

## 🎯 What We Want

### Dual Backend System (Flag-Based):

**Architecture:**
```
PM2 Worker config flag:
  "backend": "ollama" or "llamacpp"
  "endpoint": "http://10.0.0.110:11434/v1/..." or "http://10.0.0.110:8080/v1/..."
```

**Benefits:**
- ✅ Keep all Ollama code (no breaking changes)
- ✅ Add Llama.cpp support
- ✅ Switch via config (A/B test)
- ✅ Gradual migration
- ✅ Rollback anytime

**Philosophy Alignment (from 00-AGENT!-best-practices.md):**
> "Logic over rules. Simple strong solid code that can scale to 10M+ users."

---

## 🏗️ Implementation Plan

### Phase 1: Add Backend Abstraction Layer

**New file:** `src/modules/llmBackend.ts`

```typescript
interface LLMBackend {
  name: string;
  endpoint: string;
  
  sendRequest(messages: any[], params: any): Promise<string>;
}

class OllamaBackend implements LLMBackend {
  name = 'ollama';
  endpoint: string;
  
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }
  
  async sendRequest(messages: any[], params: any): Promise<string> {
    // Existing Ollama code
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model,
        messages: messages,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        // ... Ollama-specific params
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

class LlamaCppBackend implements LLMBackend {
  name = 'llama-cpp';
  endpoint: string;
  
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }
  
  async sendRequest(messages: any[], params: any): Promise<string> {
    // Llama.cpp uses OpenAI-compatible API
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model,  // Can be anything, llama.cpp ignores it
        messages: messages,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        top_p: params.top_p,
        top_k: params.top_k,
        // Llama.cpp supports all standard params
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

export function createBackend(config: any): LLMBackend {
  if (config.backend === 'llama-cpp') {
    return new LlamaCppBackend(config.endpoint);
  } else {
    return new OllamaBackend(config.endpoint);
  }
}
```

---

### Phase 2: Update Worker Config

**File:** `worker-config.json`

```json
{
  "workerId": "primary-worker",
  "backend": {
    "type": "ollama",
    "endpoint": "http://10.0.0.110:11434/v1/chat/completions"
  },
  "polling": {
    "pollHumanAI": true,
    "pollGodMode": false
  }
}
```

**Or for Llama.cpp:**
```json
{
  "workerId": "primary-worker",
  "backend": {
    "type": "llama-cpp",
    "endpoint": "http://10.0.0.110:8080/v1/chat/completions"
  },
  "polling": {
    "pollHumanAI": true,
    "pollGodMode": false
  }
}
```

---

### Phase 3: Update PM2 to Use Backend Abstraction

**File:** `src/index-do-simple.ts`

**Current:**
```typescript
// Hardcoded Ollama
const response = await fetch('http://10.0.0.110:11434/v1/chat/completions', {
  // ...
});
```

**New:**
```typescript
// Load backend from config
const workerConfig = loadWorkerConfig();
const backend = createBackend(workerConfig.backend);

// Use abstraction
const responseText = await backend.sendRequest(messages, {
  model: modelName,
  temperature: entity.temperature,
  max_tokens: entity.max_tokens,
  // ...
});
```

**Changes needed:**
- Lines where Ollama is called directly
- Replace with backend.sendRequest()
- ~10-15 call sites

---

### Phase 4: Setup Llama.cpp Server

**On 10.0.0.110:**

```bash
# Clone and build llama.cpp
cd /path/to
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build
cmake --build build --config Release -j 8

# Start server with parallel slots
cd build/bin
./llama-server \
  --hf ggml-ai/Qwen2.5-7B-Instruct-Q4_K_M-GGUF \
  --parallel 24 \
  --port 8080 \
  --ctx-size 8192

# --parallel 24 allows 24 concurrent requests!
```

**Key flags:**
- `--parallel N` - Number of concurrent slots (default: 1)
- `--ctx-size` - Context window per slot
- `--port` - Server port

---

## 📈 Expected Performance

### Current (Ollama):
```
Throughput: ~720 messages/hour
Concurrent: 1
TPS per request: 30
Users supported: 1-2 (others wait)
```

### Phase 1 (Llama.cpp, Single PM2):
```
Throughput: ~720 messages/hour (same)
Concurrent: 1 (PM2 limitation)
TPS per request: 20-30
Users supported: 1-2

Benefit: Could handle parallel if PM2 sent multiple
```

### Phase 2 (Llama.cpp, 3x PM2 Workers):
```
Throughput: ~2000-2500 messages/hour
Concurrent: 3 (3 PM2 workers)
TPS per request: 20-25 each
Users supported: 5-10

Llama.cpp handles all 3 in parallel!
```

### Phase 3 (Llama.cpp --parallel 24, 5x PM2):
```
Throughput: ~5000-8000 messages/hour
Concurrent: 5-24 (depending on demand)
TPS per request: 15-20 each
Users supported: 20-50

Maximum parallelization!
```

---

## 🔧 Llama.cpp Parallel Slots Configuration

### Conservative (Recommended Start):
```bash
./llama-server --parallel 16 --ctx-size 4096
```
- 16 concurrent requests
- 4K context per slot
- Safe for testing
- ~65GB VRAM usage

### Moderate:
```bash
./llama-server --parallel 24 --ctx-size 8192
```
- 24 concurrent requests
- 8K context per slot
- ~100GB VRAM usage
- Good production setting

### Aggressive (Max Performance):
```bash
./llama-server --parallel 40 --ctx-size 4096
```
- 40 concurrent requests
- 4K context (smaller to fit more)
- ~160GB VRAM usage
- Maximum throughput

### Memory Calculation:
```
Model base: ~4GB
Per slot overhead: ~2GB (context + KV cache)
Total per slot: ~6GB

16 slots: 96GB
24 slots: 144GB  
40 slots: 240GB

512GB machine can theoretically handle 80+ slots
But practical limit ~24-40 for stability
```

---

## 🎯 Answering Your Questions

### Q1: Theoretical Maximum Parallel Processes?

**Answer:** ~80 slots

**Calculation:**
```
512GB RAM / 6GB per slot = 85 slots
Minus system overhead = ~80 slots theoretical max
```

**BUT:** GPU cores (76) and memory bandwidth will saturate first!

### Q2: Practical Maximum?

**Answer:** 24-40 slots

**Reasoning:**
- YouTube demo: 4 slots on 16GB machine worked well
- Scaling: 512GB / 16GB = 32x more RAM
- But GPU cores don't scale linearly
- Practical: **24 slots conservative, 40 aggressive**

**References:**
- YouTube transcript: 4 concurrent on M4 Mac Mini (16GB)
- Llama.cpp default: 1-8 slots
- Community reports: 16-32 slots on high-end hardware
- Your hardware: 32x more resources

**Conservative recommendation: Start with 16-24 slots**

### Q3: Is PM2 or Ollama the Real Bottleneck?

**Answer:** BOTH!

**PM2 bottleneck:**
- Processes 1 message at a time
- Serial processing
- Limits: ~720 msg/hour

**Ollama bottleneck:**
- No parallel processing
- Even if PM2 sent 3 requests, only 1 would process
- Serial by design

**Solution needs BOTH:**
- ✅ Multiple PM2 workers (concurrent claiming)
- ✅ Llama.cpp backend (parallel processing)

**Just Llama.cpp alone:** Helps, but PM2 still serial  
**Just multiple PM2 + Ollama:** Doesn't help, Ollama still serial  
**Both together:** Maximum benefit! ⭐

---

## 🏗️ Implementation Architecture

### Dual Backend Design:

```
┌─────────────────────────────────────────────────────────┐
│ PM2 Worker 1 (config: backend=llama-cpp)                │
│   ├─> Llama.cpp:8080  ────┐                            │
│                            │                             │
│ PM2 Worker 2 (config: backend=llama-cpp)                │
│   ├─> Llama.cpp:8080  ────┤ Parallel!                  │
│                            │                             │
│ PM2 Worker 3 (config: backend=llama-cpp)                │
│   ├─> Llama.cpp:8080  ────┘                            │
│                                                          │
│ PM2 Worker 4 (config: backend=ollama)                   │
│   ├─> Ollama:11434 (fallback/testing)                  │
└─────────────────────────────────────────────────────────┘

Llama.cpp Server (--parallel 24):
  ├─ Slot 1: Request from Worker 1
  ├─ Slot 2: Request from Worker 2  
  ├─ Slot 3: Request from Worker 3
  └─ Slots 4-24: Available for more requests

Result: 3+ concurrent messages processing!
```

---

## 🎨 Flag-Based Configuration

### worker-config-llamacpp.json:
```json
{
  "workerId": "worker-llamacpp-1",
  "backend": {
    "type": "llama-cpp",
    "endpoint": "http://10.0.0.110:8080/v1/chat/completions",
    "description": "Llama.cpp with parallel processing"
  },
  "polling": {
    "pollHumanAI": true,
    "pollGodMode": false
  }
}
```

### worker-config-ollama.json (Keep for Fallback):
```json
{
  "workerId": "worker-ollama-1",
  "backend": {
    "type": "ollama",
    "endpoint": "http://10.0.0.110:11434/v1/chat/completions",
    "description": "Ollama fallback/testing"
  },
  "polling": {
    "pollHumanAI": true,
    "pollGodMode": false
  }
}
```

---

## 📋 Migration Strategy

### Step 1: Build Llama.cpp Backend Class
- Create LLMBackend interface
- OllamaBackend (existing code)
- LlamaCppBackend (new, same API)
- Factory function based on config

**Complexity:** Low (~100 lines)  
**Risk:** None (doesn't affect existing code)

### Step 2: Build Llama.cpp (Development Machine First)

**Build on 10.0.0.99 (dev machine) for testing:**
```bash
# On 10.0.0.99
cd ~/llama-builds
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build
cmake --build build --config Release -j 8

# Test locally first
cd build/bin
./llama-server \
  --hf ggml-ai/Qwen2.5-7B-Instruct-Q4_K_M-GGUF \
  --parallel 4 \
  --port 8080 \
  --ctx-size 4096

# Test with curl
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

**Then move to production machine (easy!):**
```bash
# On 10.0.0.99, create portable package
cd ~/llama-builds
tar -czf llama-cpp-build.tar.gz llama.cpp/

# Transfer to production machine (10.0.0.110 or dedicated server)
scp llama-cpp-build.tar.gz user@10.0.0.110:~/

# On 10.0.0.110
tar -xzf llama-cpp-build.tar.gz
cd llama.cpp/build/bin

# Start with production settings
./llama-server \
  --hf ggml-ai/Qwen2.5-7B-Instruct-Q4_K_M-GGUF \
  --parallel 24 \
  --port 8080 \
  --ctx-size 8192 \
  --host 0.0.0.0  # Listen on all interfaces

# Update PM2 config to point to new machine
# worker-config.json: "endpoint": "http://10.0.0.110:8080/v1/chat/completions"
```

**Benefits:**
- ✅ Test on dev machine first (low risk)
- ✅ Easy to move (self-contained directory)
- ✅ No dependencies needed on target machine
- ✅ Can run on dedicated hardware later
- ✅ PM2 just changes endpoint config

**Portable architecture:**
```
Development (10.0.0.99):
  PM2 → localhost:8080 (llama.cpp local)
  Test, verify, tune

Production Option A (10.0.0.110):
  PM2 on 10.0.0.99 → 10.0.0.110:8080 (llama.cpp remote)
  Uses existing Mac Studio

Production Option B (Dedicated Server):
  PM2 on 10.0.0.99 → new-server:8080 (llama.cpp remote)
  Scale to dedicated AI hardware

Just change endpoint config - no code changes!
```

**Complexity:** Medium (build from source)  
**Risk:** None (separate from Ollama, test on dev first)

### Step 3: Update PM2 to Use Backend Abstraction
- Replace direct Ollama calls
- Use backend.sendRequest()
- Test with backend=ollama first (should work identical)

**Complexity:** Medium (~15 call sites)  
**Risk:** Medium (test thoroughly with Ollama first!)

### Step 4: Test Single PM2 + Llama.cpp
- Change config to backend=llama-cpp
- Restart PM2
- Verify responses work
- Compare speed/quality

**Complexity:** Low (just config change)  
**Risk:** Low (can rollback to Ollama)

### Step 5: Add Multiple PM2 Workers (If Step 4 Works)

**Single command starts all workers (no multiple terminals!):**

```bash
# Create ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'ai-bot-worker-1',
      script: 'dist/index-do-simple.js',
      env: { WORKER_CONFIG: 'worker-config-llamacpp.json' }
    },
    {
      name: 'ai-bot-worker-2',
      script: 'dist/index-do-simple.js',
      env: { WORKER_CONFIG: 'worker-config-llamacpp.json' }
    },
    {
      name: 'ai-bot-worker-3',
      script: 'dist/index-do-simple.js',
      env: { WORKER_CONFIG: 'worker-config-llamacpp.json' }
    },
    {
      name: 'ai-bot-worker-4',
      script: 'dist/index-do-simple.js',
      env: { WORKER_CONFIG: 'worker-config-llamacpp.json' }
    },
    {
      name: 'ai-bot-worker-5',
      script: 'dist/index-do-simple.js',
      env: { WORKER_CONFIG: 'worker-config-ollama.json' }  // Fallback
    }
  ]
};

# Start all 5 workers with ONE command
pm2 start ecosystem.config.js

# View all workers
pm2 list

# Monitor all logs in one view
pm2 logs

# Monitor specific worker
pm2 logs ai-bot-worker-3

# Restart all
pm2 restart all

# Stop all
pm2 stop all

# All workers run as background daemons
# Close terminal - they keep running!
```

**Benefits:**
- ✅ Single command starts all workers
- ✅ No multiple terminal tabs needed
- ✅ Background daemons (survive terminal close)
- ✅ Unified logging (pm2 logs shows all)
- ✅ Easy management (restart one or all)

**Complexity:** Low (reuse README-201)  
**Risk:** Medium (verify no race conditions)

---

## 🧪 Testing Plan

### Test 1: Llama.cpp Setup
```bash
# Start server with 4 parallel slots
./llama-server --parallel 4 --port 8080 --ctx-size 4096

# Test parallel requests
curl http://10.0.0.110:8080/v1/chat/completions -d '...' &
curl http://10.0.0.110:8080/v1/chat/completions -d '...' &
curl http://10.0.0.110:8080/v1/chat/completions -d '...' &

# Should all process simultaneously!
```

### Test 2: Backend Abstraction with Ollama
```json
{"backend": {"type": "ollama", "endpoint": "..."}}
```
- Should work identically to current
- No regression
- Proves abstraction works

### Test 3: Switch to Llama.cpp (Single PM2)
```json
{"backend": {"type": "llama-cpp", "endpoint": "..."}}
```
- Responses should work
- Speed similar (single request)
- Quality check

### Test 4: Multiple PM2 + Llama.cpp
```bash
pm2 start ecosystem.config.js
# 3 workers, all backend=llama-cpp
```
- Post 3 messages simultaneously
- All should process in parallel
- Check Llama.cpp logs for concurrent slots
- Verify ~3x throughput

---

## ⚠️ Important Considerations

### Model Compatibility:
- Ollama: Uses Ollama model names (`qwen2.5:7b-instruct-q4_K_M`)
- Llama.cpp: Model already loaded, name parameter ignored

**Solution:** Include model path in backend config:
```json
{
  "backend": {
    "type": "llama-cpp",
    "endpoint": "http://10.0.0.110:8080/v1/chat/completions",
    "modelLoaded": "Qwen2.5-7B-Instruct-Q4_K_M"
  }
}
```

### API Differences:
- Both support OpenAI-compatible API
- Some parameters might differ
- Test thoroughly before production

### Fallback Strategy:
- Keep Ollama running on :11434
- Llama.cpp on :8080
- If Llama.cpp fails → switch config to Ollama
- Zero downtime

---

## 📊 Expected Results

### Scenario: 10 Users Post Messages Simultaneously

**Current (Ollama):**
```
User 1: Response in 5s
User 2: Response in 10s (waits for User 1)
User 3: Response in 15s (waits for 1 & 2)
...
User 10: Response in 50s ❌

Average wait: 27.5s
```

**With Llama.cpp (--parallel 24, 5x PM2):**
```
Users 1-5: All claimed by PM2 workers simultaneously
All 5 sent to Llama.cpp in parallel
Users 1-5: Response in 5-7s ✅

Users 6-10: Claimed as workers become free
Users 6-10: Response in 10-15s ✅

Average wait: 8-10s
```

**3x better user experience!**

---

## 💰 Cost/Benefit Analysis

### Development Cost:
- Backend abstraction: 2-3 hours
- Llama.cpp setup: 1-2 hours  
- PM2 integration: 2-3 hours
- Testing: 2-4 hours
- **Total: 8-12 hours work**

### Benefit:
- 3-5x throughput increase
- Better user experience
- Scalable to 10M+ users
- Future-proof architecture

### Risk:
- Low (keeps Ollama as fallback)
- Incremental (test each phase)
- Reversible (config flag)

---

## 🎯 Recommendation

**Start conservative, scale up:**

1. **Week 1:** Build Llama.cpp, test with --parallel 16
2. **Week 2:** Single PM2 + Llama.cpp (verify works)
3. **Week 3:** 3x PM2 workers (test concurrency)
4. **Week 4:** Increase to --parallel 24 if stable
5. **Month 2:** Scale to 5-8 PM2 workers if demand grows

**This gives you:**
- ✅ Gradual rollout
- ✅ Testing at each stage
- ✅ Rollback options
- ✅ Data-driven scaling

---

**Status:** Ready to implement  
**Complexity:** Medium (8-12 hours)  
**Risk:** Low (flag-based, reversible)  
**Benefit:** 3-5x throughput increase

**Philosophy-aligned:** Simple (abstraction), Strong (tested migration), Solid (scales to 10M+ users)


