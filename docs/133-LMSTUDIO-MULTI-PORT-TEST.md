# 133-LMSTUDIO-MULTI-PORT-TEST.md

**Created:** October 21, 2025 - 7:30 AM PST  
**Status:** TEST READY  
**Priority:** HIGH - Mac Studio Investment Validation  
**Purpose:** Standalone Python test script for validating LM Studio multi-port parallel processing capabilities

---

## 🎯 Executive Summary

Standalone Python test application to validate whether multiple LM Studio server instances on different ports can process requests in true parallel, addressing the critical finding from Test #3 that LM Studio appears to serialize all requests at the server level despite having 2 models loaded.

**The $11k Question:** Can Mac Studio with 512GB unified memory and 76 GPU cores run multiple LM Studio servers in parallel, or is the hardware investment wasted on serial processing?

---

## 🔬 Background: Why This Test Exists

### Test #3 Results (October 21, 2025 - 6:54 AM PST)

From `00-HYPOTHESIS-TESTING.md`:

```
✅ TEST SUCCESS: 8/8 replies received
⚠️  CRITICAL BUG: Old failed messages reprocessed hours later

PROCESSING:
- Serial: Model 1 → Model 2 → Model 1 → Model 2 (alternating)
- ~11 sec/message average (~90 sec for all 8)
- No parallel execution despite 2 models loaded
- LM Studio: '2 loaded, 95 available' but processes one at a time
```

**Key Discovery:** LM Studio with 2 models loaded on 1 server processed requests serially, not in parallel.

**Hypothesis:** LM Studio has a global server-level lock preventing parallel processing within a single server instance.

**Solution:** Run multiple LM Studio servers on different ports to achieve true parallelization.

---

## 📊 Web Research Findings

### Multiple Ports = Parallel Processing

From web search (October 21, 2025):

```bash
# Start multiple LM Studio servers on different ports
lmstudio server start --port 8001
lmstudio server start --port 8002
lmstudio server start --port 8003
```

**Expected Outcome:**
- Each server instance processes requests independently
- Requests to different ports execute in parallel
- True concurrent processing utilizing full hardware capabilities

**Current Reality:**
- 1 server at 10.0.0.100:1234 = serial processing
- 2 models loaded but only 1 executes at a time
- ~11 seconds per response regardless of which model

**Proposed Solution:**
- Server 1 at port 1234 (Model: tsc-ulysses-by-james-joyce@f16)
- Server 2 at port 1235 (Model: the-eternal@f16)
- Expected: Both process simultaneously (~11 seconds wall clock time for 2 requests)

---

## 🧪 Test Script: `test-lmstudio-parallel.py`

### Purpose

100% independent Python script with NO dependencies on our existing codebase to test LM Studio parallel processing capabilities before touching production code.

### Features

**1. Health Checks**
- Verifies both servers accessible
- Confirms models loaded and ready
- Pre-flight validation before test

**2. Parallel Request Test**
- Sends 2 requests simultaneously using Python threading
- Measures individual response times
- Calculates wall clock time (earliest start → latest end)
- Determines speedup factor

**3. Parallelism Analysis**
```python
theoretical_serial_time = sum(durations)  # If serial: 11s + 11s = 22s
wall_clock_time = latest_end - earliest_start  # If parallel: ~11s
speedup = theoretical_serial_time / wall_clock_time  # If parallel: ~2x
```

**Interpretation:**
- `speedup > 1.5x` → **PARALLEL PROCESSING CONFIRMED** 🎉
- `speedup < 1.5x` → **SERIAL PROCESSING** (LM Studio limitation)

**4. Real-Time Logging**
- Color-coded output (cyan=INFO, green=SUCCESS, red=ERROR, magenta=RESULT)
- Timestamps with milliseconds
- Request/response tracking
- Duration measurements

**5. Detailed Reporting**
- Success/failure counts
- Individual request results
- Parallelism determination
- Speedup calculations

---

## 🚀 Usage

### Prerequisites

```bash
# Install Python requests library
pip3 install requests
```

### Configuration

Edit `test-lmstudio-parallel.py` server config:

```python
SERVER_CONFIG = [
    {
        "name": "Server 1 - Ulysses",
        "base_url": "http://10.0.0.100:1234",
        "model": "tsc-ulysses-by-james-joyce@f16",
        "test_message": "What is the meaning of existence?"
    },
    {
        "name": "Server 2 - Eternal",
        "base_url": "http://10.0.0.100:1235",
        "model": "the-eternal@f16",
        "test_message": "Describe the nature of time."
    }
]
```

### Run Test

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1
python3 test-lmstudio-parallel.py
```

---

## 📈 Expected Results

### Scenario 1: True Parallel Processing (DESIRED)

```
[07:30:15.123] [INFO] Sending 2 requests SIMULTANEOUSLY...

[07:30:15.125] [INFO] Server 1 - Ulysses: Sending request...
[07:30:15.127] [INFO] Server 2 - Eternal: Sending request...

[07:30:26.450] [SUCCESS] Server 1 - Ulysses: Response received in 11.32s
[07:30:26.820] [SUCCESS] Server 2 - Eternal: Response received in 11.69s

[07:30:26.850] [RESULT] --- PARALLELISM ANALYSIS ---
[07:30:26.850] [RESULT] Theoretical serial time: 23.01s
[07:30:26.850] [RESULT] Actual wall clock time: 11.73s
[07:30:26.850] [RESULT] Speedup factor: 1.96x

[07:30:26.850] [SUCCESS] 🎉 PARALLEL PROCESSING CONFIRMED!
[07:30:26.850] [SUCCESS] Requests processed in parallel with 1.96x speedup
```

**Interpretation:**
- Both requests completed in ~11-12 seconds each
- Wall clock time ~11-12 seconds (overlapping execution)
- Speedup ~2x (near-perfect parallelization)
- **CONCLUSION:** Multiple ports enable true parallel processing ✅

---

### Scenario 2: Serial Processing (CURRENT STATE)

```
[07:30:15.123] [INFO] Sending 2 requests SIMULTANEOUSLY...

[07:30:15.125] [INFO] Server 1 - Ulysses: Sending request...
[07:30:15.127] [INFO] Server 2 - Eternal: Sending request...

[07:30:26.450] [SUCCESS] Server 1 - Ulysses: Response received in 11.32s
[07:30:37.820] [SUCCESS] Server 2 - Eternal: Response received in 22.69s

[07:30:37.850] [RESULT] --- PARALLELISM ANALYSIS ---
[07:30:37.850] [RESULT] Theoretical serial time: 34.01s
[07:30:37.850] [RESULT] Actual wall clock time: 22.73s
[07:30:37.850] [RESULT] Speedup factor: 1.50x

[07:30:37.850] [WARNING] ⚠️  SERIAL PROCESSING DETECTED
[07:30:37.850] [WARNING] Requests appear to be processed one at a time
```

**Interpretation:**
- First request completed in ~11 seconds
- Second request waited for first to finish, then took ~11 seconds
- Wall clock time ~22-23 seconds (sequential execution)
- Speedup ~1.0-1.5x (no parallelization)
- **CONCLUSION:** LM Studio serializes even with multiple ports ❌

---

## 🏗️ Architecture: Entity-Level Port Assignment

### Current Production Architecture

**10.0.0.100 (Mac Studio 2):**
```json
{
  "lmStudioServers": [
    {
      "name": "Mac Studio 2",
      "baseUrl": "http://10.0.0.100:1234",
      "enabled": true
    }
  ]
}
```

### Proposed Multi-Port Architecture

**config-aientities.json** (Entity-Level Port Assignment):

```json
{
  "aiEntities": [
    {
      "id": "tsc-ulysses",
      "name": "Ulysses",
      "modelName": "tsc-ulysses-by-james-joyce@f16",
      "lmStudioServer": {
        "host": "10.0.0.100",
        "port": 1234
      }
    },
    {
      "id": "the-eternal",
      "name": "TheEternal",
      "modelName": "the-eternal@f16",
      "lmStudioServer": {
        "host": "10.0.0.100",
        "port": 1235
      }
    },
    {
      "id": "fear-and-loathing",
      "name": "FearAndLoathing",
      "modelName": "fear_and_loathing@f16",
      "lmStudioServer": {
        "host": "10.0.0.102",
        "port": 1234
      }
    }
  ]
}
```

**Benefits:**
1. **Entity → Port 1:1 Mapping** - Each entity has dedicated server
2. **Computer-Independent** - Port is property of entity, not server
3. **Infinite Scalability** - 9999 models = 9999 ports (hardware permitting)
4. **No Code Changes** - Pure configuration change
5. **Load Balancing** - Natural distribution across servers

---

## 🎯 Test Plan

### Phase 1: Single Server, Multiple Ports

**Setup on 10.0.0.100:**

```bash
# Terminal 1
lmstudio server start --port 1234
# Load model: tsc-ulysses-by-james-joyce@f16

# Terminal 2
lmstudio server start --port 1235
# Load model: the-eternal@f16
```

**Test:**
```bash
python3 test-lmstudio-parallel.py
```

**Expected Outcome:**
- If speedup > 1.5x → Multiple ports enable parallelization ✅
- If speedup < 1.5x → LM Studio fundamentally serial ❌

---

### Phase 2: Validation Test (If Phase 1 Passes)

**Goal:** Confirm sustained parallel processing with multiple requests

**Method:**
1. Send 4 requests (2 to each port)
2. Measure wall clock time
3. Expected: ~11 seconds (if truly parallel)
4. Actual: ~22 seconds (if only 2 parallel streams)
5. Actual: ~44 seconds (if still serial)

---

### Phase 3: Integration Test (If Phase 1 & 2 Pass)

**Goal:** Update production config and validate with real bot

**Steps:**
1. Update `config-aientities.json` with entity-level ports
2. Restart PM2 bot on 10.0.0.100
3. Send 4 rapid messages from different users
4. Expected: 4 responses in ~11 seconds (true parallel)
5. Actual: 4 responses in ~44 seconds (serial)

---

## 💰 Hardware Investment Validation

### The $11k Mac Studio

**Specs:**
- **RAM:** 512GB unified memory
- **GPU:** 76 cores (M2 Ultra)
- **Purpose:** Run many LLM models simultaneously

**Question:** Was this the right investment for LM Studio workloads?

### Scenario A: Multi-Port Parallel Works ✅

**Outcome:**
- Can run 30+ models on different ports
- True parallel processing across all ports
- Full utilization of 512GB RAM and 76 GPU cores
- **INVESTMENT VALIDATED** - Hardware doing what it was bought for

### Scenario B: Multi-Port Serial Processing ❌

**Problem:**
- LM Studio serializes ALL requests regardless of ports
- Can only process 1 request at a time per machine
- 512GB RAM mostly idle (only 1 model active)
- 76 GPU cores underutilized

**Options:**
1. **Accept Limitation** - Use for model switching speed (JIT loading)
2. **Switch to Ollama** - Different backend might parallelize better
3. **Request LM Studio Feature** - Multi-GPU parallel processing mode
4. **Distributed Approach** - Multiple Mac Minis ($600 each) might be better than 1 Mac Studio ($11k) if parallelization limited by software

---

## 🔍 LM Studio GPU Controls Deep Dive

### What LM Studio Shows

From LM Studio UI (10.0.0.100):
```
Multi-GPU Controls:
- GPU 1: Enabled ✅
- GPU 2: Enabled ✅ (or disabled, checking...)
- Allocation Strategy: Evenly / Priority Order
```

### Mac Studio GPU Architecture

**Unified Memory Architecture (UMA):**
- NOT discrete GPUs (like NVIDIA GPU 1, GPU 2, GPU 3)
- Single unified memory pool shared between CPU and GPU
- GPU cores integrated into SoC (System on Chip)
- Different from discrete multi-GPU systems

**Key Difference:**
- **Discrete Multi-GPU:** LM Studio can parallelize across GPU 1, GPU 2, GPU 3
- **Unified Memory (Mac):** All GPU cores see same memory, might not expose "multiple GPUs" to LM Studio

### Hypothesis

**LM Studio's multi-GPU controls designed for discrete GPUs:**
- Desktop with NVIDIA RTX 4090 (GPU 1) + RTX 4090 (GPU 2) + RTX 4090 (GPU 3)
- Each GPU has own VRAM, own processing queue
- LM Studio can send Model A → GPU 1, Model B → GPU 2 (parallel)

**Mac Studio's unified architecture might not expose multiple GPUs:**
- System reports as "single GPU" with 76 cores
- LM Studio sees 1 logical GPU, not 3 separate GPUs
- Multi-GPU controls don't apply (only 1 GPU detected)
- Global server-level lock prevents parallel processing

### Testing This Hypothesis

**Check LM Studio GPU Detection:**
1. Open LM Studio on 10.0.0.100
2. Settings → Multi-GPU Controls
3. How many GPUs listed?
   - If 1 GPU → Unified architecture, multi-GPU features don't apply
   - If 2+ GPUs → Discrete detection, parallel might be possible

**If only 1 GPU detected:**
- Confirms Mac's unified memory not exposed as multiple GPUs
- Multi-port approach might still help (multiple server processes)
- Alternative: Ollama might handle unified memory better

---

## 🚨 Critical Questions This Test Answers

### Question 1: Can LM Studio parallelize across multiple ports?

**Test:** Run `test-lmstudio-parallel.py` with 2 servers on different ports  
**Answer:** Speedup > 1.5x → YES, speedup < 1.5x → NO

### Question 2: Is Mac Studio the right hardware for this workload?

**Depends on Question 1:**
- If YES → Mac Studio perfect (can run 30+ models in parallel)
- If NO → Mac Studio overkill (can only use 1 model at a time)

### Question 3: Should we switch to Ollama?

**Current State (LM Studio):**
- Excellent model management UI
- JIT loading works great
- BUT: Serial processing bottleneck

**Ollama Alternative:**
- Supports concurrent requests natively (documented)
- Runs on port 11434 by default
- Simpler server model (less UI, more API)
- Worth testing if LM Studio multi-port fails

### Question 4: What's the theoretical max throughput?

**With Parallel Processing:**
- 6 concurrent workers × 11 sec per response = ~32 responses/minute
- Limited only by: model loading time, RAM, GPU compute

**Without Parallel Processing:**
- 1 serial worker × 11 sec per response = ~5 responses/minute
- Bottleneck: global server lock

---

## 📝 Next Steps

### Step 1: Run Python Test (This Document)

```bash
python3 test-lmstudio-parallel.py
```

**Outcome determines all future decisions:**
- Speedup > 1.5x → Proceed to Step 2
- Speedup < 1.5x → Investigate Ollama or accept serial limitation

---

### Step 2: Update Production Config (If Step 1 Passes)

**File:** `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/AI-Bot-Deploy/config-aientities.json`

**Changes:**
```json
{
  "aiEntities": [
    {
      "id": "tsc-ulysses",
      "lmStudioServer": {
        "host": "10.0.0.100",
        "port": 1234
      }
    },
    {
      "id": "the-eternal",
      "lmStudioServer": {
        "host": "10.0.0.100",
        "port": 1235
      }
    }
  ],
  "queueSettings": {
    "maxConcurrentWorkers": 6
  }
}
```

---

### Step 3: Start Multiple LM Studio Servers (If Step 1 Passes)

**On 10.0.0.100 via SSH:**

```bash
# Terminal 1
lmstudio server start --port 1234
# Load model: tsc-ulysses-by-james-joyce@f16

# Terminal 2
lmstudio server start --port 1235
# Load model: the-eternal@f16
```

**Keep both terminals open** (use `screen` or `tmux` for persistence)

---

### Step 4: Restart PM2 Bot (If Step 1 Passes)

```bash
ssh ms1281@10.0.0.100
cd ~/Desktop/AI-Bot-Deploy
pm2 restart ai-bot
pm2 logs ai-bot --lines 50
```

---

### Step 5: Run Test #4 (If Step 1 Passes)

**Goal:** Validate true parallel processing in production

**Method:**
1. Open 8 browser tabs
2. Send 8 messages rapidly (1 second apart)
3. Watch Queue Monitor

**Expected (Parallel):**
- 8 messages queued immediately
- 6 workers process in parallel
- ~22 seconds for all 8 (3 waves: 6+2+0)

**Expected (Serial):**
- 8 messages queued immediately
- 1 worker processes serially
- ~88 seconds for all 8 (8 × 11 seconds)

---

## 🎓 Lessons Learned

### 1. Test Independently Before Production

**Why This Script Matters:**
- 100% isolated from production code
- No risk of breaking working system
- Fast iteration (3-minute test vs hours of debugging)
- Clear yes/no answer before committing

### 2. Hardware ≠ Software Parallelization

**Mac Studio has the hardware:**
- 512GB RAM ✅
- 76 GPU cores ✅
- Unified memory bandwidth ✅

**But software must support it:**
- LM Studio might serialize at application level
- Unified memory might not expose multiple GPUs
- Multi-port approach might be workaround

### 3. Hypothesis Testing Framework Pays Off

**Without Framework:**
- "Why is it slow?" → Guessing → Random fixes → More confusion

**With Framework:**
- Clear hypothesis → Designed test → Measured outcome → Next action

---

## 📚 Related Documentation

- `00-HYPOTHESIS-TESTING.md` - Test #3 results showing serial processing
- `107-LM-STUDIO-PARALLEL-PROCESSING.md` - Original parallel processing research
- `87-BOT-DEPLOYMENT-ARCHITECTURE.md` - Server independence architecture
- `104-LM-STUDIO-CONFIG-STANDARDIZATION.md` - LM Studio server differences

---

## 🏁 Success Criteria

### This Test is Successful If:

1. ✅ Python script runs without errors
2. ✅ Both servers respond to health checks
3. ✅ Clear speedup measurement obtained
4. ✅ Parallelism determination unambiguous (>1.5x or <1.5x)
5. ✅ Provides actionable next step (proceed or pivot)

### This Test Validates Investment If:

- Speedup > 1.5x ✅ → Mac Studio can parallelize → Investment validated
- Can scale to 30+ models on different ports → Full RAM utilization
- True concurrent processing → 32+ responses/minute possible

### This Test Identifies Limitation If:

- Speedup < 1.5x ❌ → LM Studio serializes → Limitation identified
- Need alternative approach (Ollama, distributed Macs)
- Clear understanding of bottleneck → Informed decision

---

## 🎯 Final Thoughts

**The Question:**
> "I invested $11k in a Mac Studio for parallel LLM processing. Does LM Studio support this, or did I bet on the wrong software?"

**This Test Answers That Question.**

- If parallel → Keep LM Studio, unlock full hardware potential
- If serial → Consider Ollama or architectural changes
- Either way → We know the truth and can optimize accordingly

**No Guessing. Just Data.**

---

**Status:** TEST READY - Script created, documented, ready to execute  
**Risk:** ZERO - Completely isolated from production  
**Time:** 3 minutes to answer $11k question  
**Next:** Run `python3 test-lmstudio-parallel.py` and observe results

