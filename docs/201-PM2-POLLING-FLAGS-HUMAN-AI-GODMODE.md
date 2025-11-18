# 201: PM2 Polling Flags - Human-AI / God Mode / Both

**Status:** 📋 PLANNING - Config-based polling separation  
**Created:** 2025-11-12  
**Priority:** LOW - Optimization for high God Mode usage  
**Type:** Architecture - Dual PM2 with polling flags  
**Problem:** God Mode blocks primary PM2 for 6+ minutes per session

---

## 🎯 The Problem (When God Mode Usage is High)

### Current Architecture (Single PM2):

```
PM2 Worker (10.0.0.99):
  Polls /api/queue/pending every 3s
  ↓
  Finds message
  ↓
  Normal entity (the-eternal, 1984, etc.)?
    → Process with Ollama (~5s)
    → Post response
    → Mark complete
    → Return to polling
  ↓
  God Mode entity?
    → Process 31 entities (~2.5 min)
    → Call LM Studio synthesis (~4 min)
    → Post synthesis
    → Mark complete
    → Return to polling after 6+ minutes
```

**Impact:**
- God Mode blocks PM2 for 6+ minutes
- Other messages queue up
- Users wait

**When This Becomes a Problem:**
- Multiple God Mode questions per hour
- Normal entity messages waiting >1 minute
- User complaints about delays

**Current Usage:**
- God Mode: ~1-5 questions/hour (estimated)
- Normal entities: ~50-100 messages/hour
- **Not a problem yet!**

---

## 🎯 What We Want (Dedicated God Mode PM2)

### Dual PM2 Architecture:

```
Primary PM2 (ai-bot-primary):
  Polls for: entity !== god-mode
  Processes: All normal entities
  Never blocks: Always available
  Response time: ~5 seconds

God Mode PM2 (ai-bot-godmode):
  Polls for: entity === god-mode
  Processes: ONLY God Mode
  Can block: 6+ minutes (doesn't matter)
  Response time: Variable (2-10 min)
```

**Benefits:**
✅ Non-blocking: Normal entities never wait  
✅ Scalable: Add more God Mode workers if needed  
✅ Independent: Restart one without affecting other  
✅ Monitorable: Separate logs, metrics  

---

## 🏗️ Implementation Plan

### Phase 1: Config-Based Polling Flags

**New file:** `hm-server-deployment/AI-Bot-Deploy/worker-config.json`

```json
{
  "workerId": "primary-worker",
  "polling": {
    "pollHumanAI": true,
    "pollGodMode": false
  },
  "description": "Primary worker - handles normal entities only"
}
```

**God Mode worker config:**
```json
{
  "workerId": "godmode-worker",
  "polling": {
    "pollHumanAI": false,
    "pollGodMode": true
  },
  "description": "God Mode worker - handles god-mode entity only"
}
```

**All-in-one config (current default):**
```json
{
  "workerId": "unified-worker",
  "polling": {
    "pollHumanAI": true,
    "pollGodMode": true
  },
  "description": "Unified worker - handles everything"
}
```

### Phase 2: Update PM2 Polling Logic

**File:** `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts`

**Current (line ~76):**
```typescript
const data = await response.json() as any;
const pending = data.pending || [];
```

**New:**
```typescript
// Load worker config
const workerConfig = JSON.parse(fs.readFileSync('worker-config.json', 'utf-8'));
const { pollHumanAI, pollGodMode } = workerConfig.polling;

console.log(`[WORKER] Config: pollHumanAI=${pollHumanAI}, pollGodMode=${pollGodMode}`);

const data = await response.json() as any;
let pending = data.pending || [];

// Filter based on polling flags
pending = pending.filter((msg: any) => {
  const isGodMode = msg.botParams?.entity === 'god-mode';
  
  if (isGodMode) {
    return pollGodMode;  // Only process if pollGodMode=true
  } else {
    return pollHumanAI;  // Only process if pollHumanAI=true
  }
});

console.log(`[WORKER] Filtered to ${pending.length} messages (pollHumanAI=${pollHumanAI}, pollGodMode=${pollGodMode})`);
```

**Purpose:** Worker only processes messages it's configured for.

### Phase 3: PM2 Ecosystem Configuration

**File:** `hm-server-deployment/AI-Bot-Deploy/ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'ai-bot-primary',
      script: 'dist/index-do-simple.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        WORKER_CONFIG: 'worker-config-primary.json'
      }
    },
    {
      name: 'ai-bot-godmode',
      script: 'dist/index-do-simple.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        WORKER_CONFIG: 'worker-config-godmode.json'
      }
    }
  ]
};
```

**worker-config-primary.json:**
```json
{
  "workerId": "primary-10.0.0.99",
  "polling": {
    "pollHumanAI": true,
    "pollGodMode": false
  }
}
```

**worker-config-godmode.json:**
```json
{
  "workerId": "godmode-10.0.0.99",
  "polling": {
    "pollHumanAI": false,
    "pollGodMode": true
  }
}
```

### Phase 4: Startup & Deployment

**Start both workers:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy

# Start using ecosystem file
pm2 start ecosystem.config.js

# Or start individually
pm2 start dist/index-do-simple.js --name ai-bot-primary -- worker-config-primary.json
pm2 start dist/index-do-simple.js --name ai-bot-godmode -- worker-config-godmode.json

# Save PM2 config
pm2 save

# Monitor both
pm2 logs ai-bot-primary  # Fast responses
pm2 logs ai-bot-godmode  # God Mode processing
```

**Restart independently:**
```bash
pm2 restart ai-bot-primary  # Doesn't affect God Mode
pm2 restart ai-bot-godmode  # Doesn't affect primary
```

---

## 📊 Benefits of Your Flag Approach

### Flexibility:

**Configuration 1: Unified (Current)**
```json
{"pollHumanAI": true, "pollGodMode": true}
```
- One worker handles everything
- Simple, current behavior

**Configuration 2: Separated (Optimized)**
```json
Primary: {"pollHumanAI": true, "pollGodMode": false}
GodMode: {"pollHumanAI": false, "pollGodMode": true}
```
- Non-blocking architecture
- Optimal performance

**Configuration 3: Scaled God Mode**
```json
Primary: {"pollHumanAI": true, "pollGodMode": false}
GodMode1: {"pollHumanAI": false, "pollGodMode": true}
GodMode2: {"pollHumanAI": false, "pollGodMode": true}
GodMode3: {"pollHumanAI": false, "pollGodMode": true}
```
- Multiple God Mode workers
- Load balanced
- Handles concurrent God Mode sessions

**Configuration 4: Testing**
```json
Test: {"pollHumanAI": false, "pollGodMode": true}
```
- Test God Mode in isolation
- Debug without interference

---

## 🔧 Code Changes Required

### Minimal Changes (Elegant):

**1. Add config loader (~10 lines)**
```typescript
function loadWorkerConfig(): any {
  const configPath = process.env.WORKER_CONFIG || 'worker-config.json';
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}
```

**2. Filter pending messages (~15 lines)**
```typescript
const config = loadWorkerConfig();
pending = pending.filter(msg => {
  const isGodMode = msg.botParams?.entity === 'god-mode';
  return isGodMode ? config.polling.pollGodMode : config.polling.pollHumanAI;
});
```

**3. Create config files (~2 files, 10 lines each)**
- worker-config-primary.json
- worker-config-godmode.json

**4. Create ecosystem.config.js (~30 lines)**

**Total:** ~75 lines of code, ~1 hour work

---

## 🎨 User Experience

### Normal Users (No Change):
```
Posts message to TheEternal
→ Response in 5 seconds
→ Same as always
```

### God Mode Users (Improved):
```
Tab 1: Posts God Mode question
→ Entities start responding
→ Takes 6 minutes total

Tab 2: Posts message to Aristotle (same time)
→ Response in 5 seconds!
→ Not blocked by Tab 1's God Mode!
```

---

## 📈 Scalability

### Current Limits (Single PM2):
```
God Mode throughput: ~10 sessions/hour (6 min each)
Normal entity throughput: Unlimited (5s each)
Concurrent God Mode: 1 (blocks others)
```

### With Dedicated PM2:
```
Primary throughput: Unlimited (never blocks)
God Mode throughput: ~10 sessions/hour per worker
Concurrent God Mode: N workers (scale horizontally)
Normal entities: Never affected
```

**Scale God Mode by adding workers:**
```bash
pm2 start dist/index-do-simple.js --name ai-bot-godmode-2 -- worker-config-godmode.json
pm2 start dist/index-do-simple.js --name ai-bot-godmode-3 -- worker-config-godmode.json
```

Now 3 God Mode workers = 30 sessions/hour!

---

## ⚠️ Considerations

### Message Claiming:
**Already solved!** DO worker has atomic claiming:
- First worker to claim wins
- Others skip
- No duplicate processing

### Load Balancing:
**Automatic!** Multiple God Mode workers:
- Each polls independently
- First to claim processes
- Natural load distribution

### Monitoring:
**Easy!**
```bash
pm2 logs ai-bot-primary --lines 50   # Normal entities
pm2 logs ai-bot-godmode --lines 50   # God Mode only
pm2 monit  # See both at once
```

---

## 🚀 Deployment Strategy

### Phase 1: Add Config Support (No Deployment Yet)
- Add config loader
- Add message filtering
- Test with unified config (current behavior)
- **No change to production**

### Phase 2: Test Dual PM2 Locally
- Create primary config (pollGodMode=false)
- Create godmode config (pollHumanAI=false)
- Start both PM2 processes
- Test that they don't interfere

### Phase 3: Deploy to Production
- Stop current PM2
- Start dual PM2 with ecosystem.config.js
- Monitor for 24 hours
- Verify no issues

### Phase 4: Rollback Plan
- If issues: `pm2 delete all`
- Start single PM2 with unified config
- Back to current behavior

---

## 💡 Alternative: Terminal Prompt (Your Idea)

**Interactive startup:**
```bash
npm run start:worker

# Script prompts:
"What should this worker handle?"
"1. Everything (unified)"
"2. Normal entities only (primary)"
"3. God Mode only (godmode)"
"Enter choice (1-3): "

# Creates config dynamically
# Starts with appropriate settings
```

**Pros:**
- ✅ No config files to manage
- ✅ Interactive and clear
- ✅ Hard to misconfigure

**Cons:**
- ⚠️ Can't use with PM2 daemon mode
- ⚠️ Config files are more explicit

**Recommendation:** Config files + optional interactive mode for manual starts.

---

## 📋 File Structure

```
AI-Bot-Deploy/
├── src/
│   ├── index-do-simple.ts (main worker - updated with filtering)
│   └── modules/
│       └── workerConfig.ts (new - config loader)
├── worker-config.json (default - unified)
├── worker-config-primary.json (primary worker)
├── worker-config-godmode.json (God Mode worker)
├── ecosystem.config.js (PM2 multi-process config)
└── start-worker.sh (interactive startup script)
```

---

## 🧪 Testing Plan

### Test 1: Unified Config (Backward Compatibility)
```json
{"pollHumanAI": true, "pollGodMode": true}
```
- Start single PM2
- Post normal message → Works ✅
- Post God Mode → Works ✅
- Same as current behavior

### Test 2: Primary Only
```json
{"pollHumanAI": true, "pollGodMode": false}
```
- Post normal message → Processed ✅
- Post God Mode → Ignored (stays pending) ✅
- Verify filtering works

### Test 3: God Mode Only
```json
{"pollHumanAI": false, "pollGodMode": true}
```
- Post normal message → Ignored (stays pending) ✅
- Post God Mode → Processed ✅
- Verify filtering works

### Test 4: Dual PM2 (Non-Blocking)
```
Primary: {"pollHumanAI": true, "pollGodMode": false}
GodMode: {"pollHumanAI": false, "pollGodMode": true}
```
- Post God Mode (starts processing)
- Immediately post normal message
- Normal message processes in 5s (doesn't wait!) ✅
- God Mode completes after 6 min ✅
- No interference ✅

---

## 💻 Code Implementation

### New File: `src/modules/workerConfig.ts`

```typescript
import fs from 'fs';
import path from 'path';

export interface WorkerConfig {
  workerId: string;
  polling: {
    pollHumanAI: boolean;
    pollGodMode: boolean;
  };
  description?: string;
}

/**
 * Load worker configuration
 * Checks environment variable or uses default
 */
export function loadWorkerConfig(): WorkerConfig {
  const configPath = process.env.WORKER_CONFIG || path.join(__dirname, '../../worker-config.json');
  
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    
    console.log('[WorkerConfig] Loaded:', configPath);
    console.log('[WorkerConfig] Worker ID:', config.workerId);
    console.log('[WorkerConfig] Poll Human-AI:', config.polling.pollHumanAI);
    console.log('[WorkerConfig] Poll God Mode:', config.polling.pollGodMode);
    
    return config;
  } catch (error: any) {
    console.error('[WorkerConfig] Failed to load config:', error.message);
    console.log('[WorkerConfig] Using default unified config');
    
    // Default: Handle everything (current behavior)
    return {
      workerId: 'unified-worker',
      polling: {
        pollHumanAI: true,
        pollGodMode: true
      },
      description: 'Default unified worker (backward compatible)'
    };
  }
}
```

### Update: `src/index-do-simple.ts`

**Add at top:**
```typescript
import { loadWorkerConfig } from './modules/workerConfig.js';

// Load config once at startup
const workerConfig = loadWorkerConfig();
```

**Update polling loop (line ~76):**
```typescript
const data = await response.json() as any;
let pending = data.pending || [];

// Filter messages based on worker configuration
if (!workerConfig.polling.pollHumanAI || !workerConfig.polling.pollGodMode) {
  pending = pending.filter((msg: any) => {
    const isGodMode = msg.botParams?.entity === 'god-mode';
    
    if (isGodMode) {
      return workerConfig.polling.pollGodMode;
    } else {
      return workerConfig.polling.pollHumanAI;
    }
  });
  
  const filtered = data.pending.length - pending.length;
  if (filtered > 0) {
    console.log(`[WORKER] Filtered ${filtered} messages (not configured to handle)`);
  }
}
```

### New File: `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    // Primary worker - handles normal entities
    {
      name: 'ai-bot-primary',
      script: 'dist/index-do-simple.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        WORKER_CONFIG: 'worker-config-primary.json'
      },
      error_file: 'logs/primary-error.log',
      out_file: 'logs/primary-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    
    // God Mode worker - handles god-mode entity only
    {
      name: 'ai-bot-godmode',
      script: 'dist/index-do-simple.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',  // More memory for God Mode
      env: {
        WORKER_CONFIG: 'worker-config-godmode.json'
      },
      error_file: 'logs/godmode-error.log',
      out_file: 'logs/godmode-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
```

### New File: `start-worker.sh` (Interactive Mode)

```bash
#!/bin/bash

echo "🤖 AI Bot Worker Startup"
echo ""
echo "What should this worker handle?"
echo "1. Everything (unified - default)"
echo "2. Normal entities only (primary)"
echo "3. God Mode only (godmode)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    CONFIG="worker-config.json"
    NAME="ai-bot-unified"
    ;;
  2)
    CONFIG="worker-config-primary.json"
    NAME="ai-bot-primary"
    ;;
  3)
    CONFIG="worker-config-godmode.json"
    NAME="ai-bot-godmode"
    ;;
  *)
    echo "Invalid choice, using unified"
    CONFIG="worker-config.json"
    NAME="ai-bot-unified"
    ;;
esac

echo ""
echo "Starting worker: $NAME"
echo "Config: $CONFIG"
echo ""

WORKER_CONFIG=$CONFIG pm2 start dist/index-do-simple.js --name $NAME

echo ""
echo "✅ Worker started!"
echo ""
echo "Monitor logs: pm2 logs $NAME"
echo "Stop worker: pm2 stop $NAME"
echo "Restart worker: pm2 restart $NAME"
```

---

## 🎯 Usage Scenarios

### Scenario 1: Current (Single Worker)
```bash
# No changes needed
pm2 start dist/index-do-simple.js --name ai-bot-do
# Uses default worker-config.json (pollHumanAI=true, pollGodMode=true)
```

### Scenario 2: Dual Workers (Optimized)
```bash
pm2 start ecosystem.config.js
# Starts both primary and godmode workers
pm2 logs ai-bot-primary   # Monitor normal entities
pm2 logs ai-bot-godmode   # Monitor God Mode
```

### Scenario 3: Interactive Start
```bash
./start-worker.sh
# Prompts for worker type
# Starts with appropriate config
```

### Scenario 4: Manual Dual Start
```bash
WORKER_CONFIG=worker-config-primary.json pm2 start dist/index-do-simple.js --name primary
WORKER_CONFIG=worker-config-godmode.json pm2 start dist/index-do-simple.js --name godmode
```

---

## 📈 Performance Impact

### Current (Unified):
```
God Mode question posted
→ PM2 blocks for 6 minutes
→ Normal entity message waits
→ User sees delay
```

### With Dedicated PM2:
```
God Mode question posted
→ God Mode PM2 processes (6 min)
Normal entity message posted
→ Primary PM2 processes (5 sec)
→ No interference!
```

**Throughput:**
- Primary: ~720 messages/hour (1 every 5s)
- God Mode: ~10 sessions/hour (1 every 6 min)
- **Total capacity increased!**

---

## 🔄 Migration Path

### Step 1: Add Config Support (No Deployment)
- Add workerConfig.ts
- Add filtering logic
- Create config files
- Test locally

### Step 2: Deploy with Unified Config (No Change)
- Deploy with pollHumanAI=true, pollGodMode=true
- Verify no regressions
- Monitor for 24 hours

### Step 3: Split When Needed (Optional)
- When God Mode usage increases
- Or when seeing blocking issues
- Switch to dual PM2
- Monitor improvements

---

## ⚠️ Important Notes

### Config is Read Once at Startup
**Not hot-reload!** Config loaded when PM2 starts.

To change config:
```bash
# Edit config file
nano worker-config-primary.json

# Restart PM2 to load new config
pm2 restart ai-bot-primary
```

### Worker ID in Logs
Each worker logs its ID:
```
[WORKER] Config: workerId=primary-10.0.0.99
[WORKER] Poll Human-AI: true
[WORKER] Poll God Mode: false
```

Makes it easy to identify which worker processed which message.

### Both Workers Can Run on Same Machine
- Share Ollama connection (10.0.0.110)
- Share LM Studio connection (10.0.0.100)
- Share DO worker (Cloudflare)
- No conflicts!

---

## 💰 Cost Implications

### DO Reads (Not Impacted):
- Filtering happens in PM2 (after fetching from DO)
- DO still returns all pending messages
- Read count unchanged

### Resource Usage:
- 2 PM2 processes: ~200MB RAM each
- Minimal CPU (mostly waiting)
- Negligible cost on dedicated machine

---

## ✅ Success Criteria

### After Implementation:

1. ✅ **Non-blocking** - Normal entities process during God Mode
2. ✅ **Configurable** - Easy to switch modes
3. ✅ **Monitorable** - Separate logs per worker
4. ✅ **Scalable** - Add workers as needed
5. ✅ **Backward compatible** - Unified mode still works
6. ✅ **Simple deployment** - One command starts both

---

## 🎯 When to Implement

### Monitor These Metrics:

**Implement when you see:**
- ❌ Normal entity messages waiting >1 minute
- ❌ Multiple God Mode questions queuing
- ❌ User complaints about delays
- ❌ God Mode usage >10 sessions/hour

**Current usage (~1-5 God Mode/hour):**
- ✅ Not needed yet
- ✅ Current architecture fine
- ✅ Complexity not justified

**When God Mode grows:**
- Implement this architecture
- ~1 hour work
- Immediate benefits

---

**Status:** Ready to implement when needed  
**Complexity:** Low (75 lines of code)  
**Effort:** ~1-2 hours  
**Benefit:** Non-blocking architecture, unlimited scalability  

**Recommendation:** Monitor usage, implement when God Mode frequency increases.


