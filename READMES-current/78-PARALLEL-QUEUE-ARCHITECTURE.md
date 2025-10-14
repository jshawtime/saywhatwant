# Parallel Queue Architecture - Non-Blocking Model Loading

**Date**: October 14, 2025, 00:15 UTC  
**Status**: DESIGN PHASE  
**Purpose**: Prevent model loading from blocking other requests

---

## 🎯 The Problem

### Current Behavior (Serial Processing)

```
User posts to Model A (not loaded)
  ↓
Queue worker claims item
  ↓
Start loading Model A (blocks for 90 seconds)
  ↓
While Model A is loading...
  User posts to Model B (already loaded)
    ↓
    Waits in queue ❌ (can't be claimed, worker is busy)
    ↓
    90 seconds pass...
    ↓
Model A finishes loading
  ↓
Process Model A request
  ↓
Worker available again
  ↓
NOW Model B can be claimed
  ↓
Process Model B (instant - already loaded)
```

**Problem**: Model B waited 90 seconds for no reason!

**At scale with 32 models**: This creates massive delays

---

## 🏗️ Proposed Solution: Two-Queue System

### Philosophy: "Dumb and Robust"

**Principle**: Keep queues simple, state explicit, no magic

**Architecture**:
```
Main Queue (Processing Queue)
  ├─ Only accepts items with LOADED models
  ├─ Workers process instantly (no wait)
  └─ Multiple workers can run in parallel

Loading Queue (Model Preparation Queue)  
  ├─ Accepts items that need model loading
  ├─ Single worker (one load at a time per server)
  ├─ When model loads: Move item to Main Queue
  └─ No inference here - just loading
```

---

## 📊 Data Structures

### Queue Item States

```typescript
type ItemState = 
  | 'pending'           // Just queued, not checked yet
  | 'needs-loading'     // Model not loaded, moved to loading queue
  | 'ready'             // Model loaded, ready to process
  | 'processing'        // Being processed by worker
  | 'completed'         // Successfully processed
  | 'failed';           // Error occurred
```

### Two Queue System

```typescript
interface MainQueue {
  items: QueueItem[];  // Only items in 'ready' state
  workers: Worker[];   // Can have multiple workers
}

interface LoadingQueue {
  items: QueueItem[];  // Only items in 'needs-loading' state
  loader: LoaderWorker; // Single worker per server
}
```

---

## 🔄 Complete Flow (Detailed)

### Step 1: Message Arrives

```
User posts message → KV
  ↓
Bot polls KV
  ↓
Validates entity
  ↓
Creates QueueItem with state: 'pending'
  ↓
Adds to Main Queue
```

### Step 2: Router Checks Model Status

```
Router Worker (runs continuously):
  ↓
For each 'pending' item in Main Queue:
  ├─ Check: Is model loaded?
  │   ├─ YES → Change state to 'ready'
  │   │          Leave in Main Queue
  │   │          Available for processing
  │   │
  │   └─ NO  → Change state to 'needs-loading'
  │              Move to Loading Queue
  │              Trigger model load
```

**Key**: This is a quick check (API call), not a blocking operation

### Step 3: Loading Queue Processes

```
Loading Queue Worker (one per server):
  ↓
Claim next item from Loading Queue
  ↓
Issue load command: lms load {model} --host {server}
  ↓
Poll LM Studio API until state='loaded' (every 5s)
  ↓
When loaded:
  ├─ Change item state to 'ready'
  ├─ Move item to Main Queue
  └─ Processing worker will pick it up
```

**Key**: This worker ONLY loads, doesn't process

### Step 4: Main Queue Processes

```
Processing Workers (multiple, one per server):
  ↓
Claim next 'ready' item from Main Queue
  ↓
Send chat completion request (instant - model already loaded)
  ↓
Receive response
  ↓
Post to KV
  ↓
Mark item as 'completed'
  ↓
Claim next 'ready' item
```

**Key**: These workers never wait for loading

---

## 📈 Performance Comparison

### Scenario: 3 Messages Arrive

**Messages**:
- Message A → Model 1 (not loaded, takes 90s to load)
- Message B → Model 2 (already loaded)
- Message C → Model 3 (already loaded)

### Current System (Serial)

```
T=0s:   Claim A, start loading Model 1
T=1-90s: BLOCKED (B and C wait in queue)
T=90s:  Model 1 loaded, process A
T=95s:  A complete, claim B
T=96s:  B complete (instant), claim C  
T=97s:  C complete

Total time: 97 seconds
B waited: 95 seconds
C waited: 96 seconds
```

### New System (Parallel)

```
T=0s:   Router checks all 3 messages
        A → needs loading (to Loading Queue)
        B → ready (stays in Main Queue)
        C → ready (stays in Main Queue)

T=0s:   Loading worker starts Model 1 load (async)
T=1s:   Processing worker claims B, processes (1s)
T=2s:   Processing worker claims C, processes (1s)
T=90s:  Model 1 finishes loading
T=90s:  Router moves A to Main Queue (ready)
T=91s:  Processing worker claims A, processes (5s)
T=96s:  A complete

Total time: 96 seconds
B waited: 1 second ← 95x faster!
C waited: 2 seconds ← 48x faster!
```

---

## 🧠 Key Design Principles

### 1. Dumb Queues

**Each queue is just an array**:
- No complex state machines
- No timers
- No watchers
- Just: add item, claim item, remove item

### 2. Explicit State

**Item state is explicit**:
```typescript
{
  id: "req-123",
  state: "needs-loading",  // ← Clear, no guessing
  model: "dystopian-survival-guide@f32",
  // ... rest of item
}
```

**No hidden state, no inference, no magic.**

### 3. Single Responsibility

**Router**: Only checks model status and routes
**Loader**: Only loads models
**Processor**: Only processes loaded models

**Each does ONE thing well.**

### 4. No Blocking

**Golden Rule**: Workers never wait for external operations

- Router: Quick API check, move item, done
- Loader: Issue command, poll API (async), move item when ready
- Processor: Send request (model already loaded), done

---

## 🛠️ Implementation Components

### Component 1: RouterWorker

```typescript
class RouterWorker {
  async run() {
    while (true) {
      await sleep(1000); // Check every second
      
      const pendingItems = mainQueue.getItemsByState('pending');
      
      for (const item of pendingItems) {
        const isLoaded = await checkIfModelLoaded(item.model, item.server);
        
        if (isLoaded) {
          item.state = 'ready';
          // Item stays in main queue
        } else {
          item.state = 'needs-loading';
          mainQueue.remove(item.id);
          loadingQueue.add(item);
        }
      }
    }
  }
}
```

**Simple**: Just checks and routes, no complex logic

### Component 2: LoaderWorker (One Per Server)

```typescript
class LoaderWorker {
  constructor(private serverId: string) {}
  
  async run() {
    while (true) {
      // Claim next item that needs this server
      const item = loadingQueue.claimForServer(this.serverId);
      
      if (!item) {
        await sleep(1000);
        continue;
      }
      
      try {
        // Issue load command (doesn't block other workers)
        await cli.loadModel(item.model, item.server);
        
        // Poll until loaded
        while (true) {
          await sleep(5000);
          const loaded = await checkIfModelLoaded(item.model, item.server);
          
          if (loaded) {
            // Move to main queue as 'ready'
            item.state = 'ready';
            loadingQueue.remove(item.id);
            mainQueue.add(item);
            break;
          }
        }
      } catch (error) {
        // Loading failed
        item.state = 'failed';
        loadingQueue.complete(item.id, false);
      }
    }
  }
}
```

**Simple**: Loads one model at a time for this server, moves item when ready

### Component 3: ProcessorWorker (One Per Server)

```typescript
class ProcessorWorker {
  constructor(private serverId: string) {}
  
  async run() {
    while (true) {
      // Claim next 'ready' item for this server
      const item = mainQueue.claimReady(this.serverId);
      
      if (!item) {
        await sleep(100);
        continue;
      }
      
      try {
        item.state = 'processing';
        
        // Model is guaranteed loaded - send request immediately
        const response = await sendChatCompletion(item);
        
        // Post response
        await postToKV(response);
        
        // Complete
        item.state = 'completed';
        mainQueue.complete(item.id, true);
      } catch (error) {
        item.state = 'failed';
        mainQueue.complete(item.id, false);
      }
    }
  }
}
```

**Simple**: Only processes items with loaded models, no waiting

---

## 🔧 Helper Functions

### checkIfModelLoaded (Simple API Check)

```typescript
async function checkIfModelLoaded(
  modelName: string, 
  serverIp: string
): Promise<boolean> {
  try {
    const response = await fetch(`http://${serverIp}:1234/api/v0/models`);
    const data = await response.json();
    
    // Find our model
    const model = data.data.find((m: any) => m.id === modelName);
    
    return model && model.state === 'loaded';
  } catch (error) {
    return false;
  }
}
```

**No caching, no state - just ask LM Studio directly**

---

## 🎭 Example Scenario (With 2 Servers)

### Setup
- Server 1 (10.0.0.102): Empty (no models loaded)
- Server 2 (10.0.0.100): Has Model B loaded

### Timeline

**T=0s**: 3 messages arrive
```
Message A → Model 1 (not loaded)
Message B → Model 2 (loaded on Server 2)
Message C → Model 3 (not loaded)
```

**T=1s**: Router checks all 3
```
Router checks Server 1: Model 1 not loaded
  → Item A: state='needs-loading', move to Loading Queue

Router checks Server 2: Model 2 loaded
  → Item B: state='ready', stays in Main Queue

Router checks Server 1: Model 3 not loaded
  → Item C: state='needs-loading', move to Loading Queue
```

**T=2s**: Workers start

```
Loader Worker (Server 1):
  → Claims Item A from Loading Queue
  → Issues: lms load model-1 --host 10.0.0.102
  → Starts polling...

Processor Worker (Server 2):
  → Claims Item B from Main Queue (it's ready!)
  → Sends chat completion request
  → Receives response
  → Posts to KV
  → B COMPLETE (after 5 seconds)
```

**T=7s**: B is done, C still waiting for A to finish loading

```
Processor Worker (Server 2): Idle (no ready items)

Loader Worker (Server 1): Still polling for Model 1 to load...
```

**T=90s**: Model 1 finishes loading

```
Loader Worker (Server 1):
  → Detects Model 1 is loaded
  → Moves Item A to Main Queue with state='ready'
  → Claims Item C (next in Loading Queue)
  → Issues: lms load model-3 --host 10.0.0.102
```

**T=91s**: A can now be processed

```
Processor Worker (Server 1):
  → Claims Item A (now ready)
  → Sends chat completion
  → A COMPLETE (after 5 seconds)
```

**T=180s**: Model 3 finishes loading

```
Loader Worker: Moves Item C to Main Queue
Processor Worker: Claims and processes C
T=185s: C COMPLETE
```

---

## 📦 Queue Data Structures

### MainQueue

```typescript
class MainQueue {
  private items: Map<string, QueueItem> = new Map();
  
  add(item: QueueItem): void {
    this.items.set(item.id, item);
  }
  
  // Claim next ready item for specific server
  claimReady(serverId: string): QueueItem | null {
    for (const item of this.items.values()) {
      if (item.state === 'ready' && 
          item.server === serverId && 
          item.claimedBy === null) {
        item.claimedBy = serverId;
        item.claimedAt = Date.now();
        return item;
      }
    }
    return null;
  }
  
  getItemsByState(state: ItemState): QueueItem[] {
    return Array.from(this.items.values())
      .filter(i => i.state === state);
  }
  
  remove(itemId: string): void {
    this.items.delete(itemId);
  }
}
```

### LoadingQueue

```typescript
class LoadingQueue {
  private items: Map<string, QueueItem> = new Map();
  
  add(item: QueueItem): void {
    item.state = 'needs-loading';
    this.items.set(item.id, item);
  }
  
  // Claim next item for specific server
  claimForServer(serverId: string): QueueItem | null {
    for (const item of this.items.values()) {
      if (item.server === serverId && item.claimedBy === null) {
        item.claimedBy = `loader-${serverId}`;
        item.claimedAt = Date.now();
        return item;
      }
    }
    return null;
  }
  
  // Move item back to main queue when ready
  moveToMain(itemId: string, mainQueue: MainQueue): void {
    const item = this.items.get(itemId);
    if (item) {
      item.state = 'ready';
      item.claimedBy = null;
      item.claimedAt = null;
      this.items.delete(itemId);
      mainQueue.add(item);
    }
  }
}
```

**Dumb**: Just storage and simple operations, no complex logic

---

## 🔄 Worker Implementation

### RouterWorker (The Simplest)

```typescript
async function routerWorker(mainQueue: MainQueue, loadingQueue: LoadingQueue) {
  while (true) {
    // Get all pending items (new arrivals)
    const pending = mainQueue.getItemsByState('pending');
    
    for (const item of pending) {
      // Check if model is loaded (simple API call)
      const isLoaded = await checkIfModelLoaded(item.model, item.server);
      
      if (isLoaded) {
        // Ready to process
        item.state = 'ready';
        console.log(`[Router] ${item.id} → READY (model already loaded)`);
      } else {
        // Needs loading
        console.log(`[Router] ${item.id} → LOADING QUEUE (model not loaded)`);
        mainQueue.remove(item.id);
        loadingQueue.add(item);
      }
    }
    
    // Check every second
    await sleep(1000);
  }
}
```

**No blocking, no complex logic, just: check → route**

### LoaderWorker (One Per Server)

```typescript
async function loaderWorker(
  serverId: string,
  serverIp: string,
  loadingQueue: LoadingQueue,
  mainQueue: MainQueue
) {
  while (true) {
    // Claim next item for this server
    const item = loadingQueue.claimForServer(serverId);
    
    if (!item) {
      await sleep(1000);
      continue;
    }
    
    console.log(`[Loader ${serverId}] Loading ${item.model}...`);
    
    try {
      // Issue load command (non-blocking - returns immediately)
      await cli.loadModel(item.model, serverIp);
      
      // Poll until loaded
      let attempts = 0;
      while (attempts < 30) { // 2.5 minute max
        await sleep(5000);
        
        const isLoaded = await checkIfModelLoaded(item.model, serverIp);
        
        if (isLoaded) {
          console.log(`[Loader ${serverId}] ✅ ${item.model} loaded after ${attempts * 5}s`);
          
          // Move to main queue as ready
          loadingQueue.moveToMain(item.id, mainQueue);
          break;
        }
        
        attempts++;
      }
      
      if (attempts >= 30) {
        throw new Error('Load timeout');
      }
      
    } catch (error) {
      console.error(`[Loader ${serverId}] ❌ Failed to load ${item.model}:`, error);
      // Mark as failed, remove from loading queue
      loadingQueue.complete(item.id, false);
    }
  }
}
```

**Runs in parallel**: Server 1 loader and Server 2 loader work independently

### ProcessorWorker (One Per Server)

```typescript
async function processorWorker(
  serverId: string,
  serverIp: string,
  mainQueue: MainQueue
) {
  while (true) {
    // Claim next ready item for this server
    const item = mainQueue.claimReady(serverId);
    
    if (!item) {
      await sleep(100); // Check frequently (ready items process fast)
      continue;
    }
    
    console.log(`[Processor ${serverId}] Processing ${item.id}...`);
    
    try {
      item.state = 'processing';
      
      // Send chat completion (model guaranteed loaded)
      const response = await fetch(`http://${serverIp}:1234/v1/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({
          model: item.model,
          messages: item.prompt,
          ...item.parameters
        })
      });
      
      const data = await response.json();
      
      // Post response to KV
      await postToKV(data.choices[0].message.content, item.entity, item.ais);
      
      // Complete
      item.state = 'completed';
      mainQueue.complete(item.id, true);
      
      console.log(`[Processor ${serverId}] ✅ Completed ${item.id}`);
      
    } catch (error) {
      console.error(`[Processor ${serverId}] ❌ Failed ${item.id}:`, error);
      item.state = 'failed';
      mainQueue.complete(item.id, false);
    }
  }
}
```

**Fast**: Processes immediately, no waiting

---

## 🚀 System Startup

```typescript
// Create queues
const mainQueue = new MainQueue();
const loadingQueue = new LoadingQueue();

// Start router (1 instance)
routerWorker(mainQueue, loadingQueue);

// Start loaders (1 per server)
loaderWorker('server1', '10.0.0.102', loadingQueue, mainQueue);
loaderWorker('server2', '10.0.0.100', loadingQueue, mainQueue);

// Start processors (1 per server, could be more)
processorWorker('server1', '10.0.0.102', mainQueue);
processorWorker('server2', '10.0.0.100', mainQueue);
```

**Total workers**: 5 (1 router + 2 loaders + 2 processors)

**All running in parallel, no blocking**

---

## 🎯 Benefits

### 1. No Blocking
- Model loads don't block other requests
- Multiple models can load simultaneously (on different servers)
- Ready models process instantly

### 2. Simple State
- Items have explicit state field
- No guessing, no inference
- Easy to debug ("why is this item stuck?" → check state)

### 3. Scalable
- Add more servers → Add more loader/processor workers
- Linear scaling
- No coordination complexity

### 4. Observable
- Each worker logs what it's doing
- Queue monitor shows which queue each item is in
- Clear visibility into system state

### 5. Robust
- Loader failure doesn't affect processor
- Processor failure doesn't affect loader
- Independent workers = isolated failures

---

## 🐛 Current Bug: Why Request Gets Lost

**Hypothesis** (based on 1-second drop):

The current code throws an error **immediately** instead of waiting for model load.

**Most likely**: 
```typescript
// Step 2: Load model if needed
if (!server.loadedModels.has(modelName)) {
  await this.loadModelAndWait(server, modelName);  // ← Throws error?
}
```

**If `loadModelAndWait` throws error after 1 second**:
- Caught by outer try/catch
- Item marked as failed
- Removed from queue
- Request lost

**Why might it throw immediately?**
- CLI command fails
- Server unreachable
- Model path wrong
- Something else crashes

**We'll know when you send fresh logs!**

---

## 📝 Implementation Plan

### Phase 1: Add Debug Logging (DONE)
- ✅ Added extensive logging to loadModelAndWait
- ✅ Added logging to chat request
- Waiting for test results

### Phase 2: Fix Immediate Bug
- Analyze debug logs from fresh test
- Identify why it fails after 1 second
- Fix that specific error
- Verify request completes during model load

### Phase 3: Implement Parallel Queues (Future)
- Create MainQueue and LoadingQueue classes
- Implement RouterWorker
- Implement LoaderWorker (one per server)
- Keep existing ProcessorWorker, adapt for ready-only items
- Test with multiple concurrent requests

### Phase 4: Optimize (Much Later)
- Multiple processor workers per server
- Pre-emptive model loading
- Predictive routing

---

## 🧪 Testing Strategy

### Test 1: Single Request, Model Not Loaded
```
Unload all models
Post message to Model A
Expect: 
  - Item in Loading Queue
  - Model loads
  - Item moves to Main Queue
  - Processes and responds
  - Total time: ~95 seconds
```

### Test 2: Parallel Requests, Mixed States
```
Server 1: Empty
Server 2: Has Model B loaded

Post 3 messages:
  - Message A → Model 1 (Server 1, not loaded)
  - Message B → Model 2 (Server 2, loaded)
  - Message C → Model 3 (Server 1, not loaded)

Expect:
  - A → Loading Queue
  - B → Main Queue (ready)
  - C → Loading Queue
  - B processes immediately (~5s)
  - A and C load in sequence on Server 1
  - Total: B done in 5s, A done in 95s, C done in 185s
```

### Test 3: Memory Error During Load
```
Fill memory with models
Post message needing new model
Expect:
  - Loader tries to load
  - Gets memory error
  - Unloads all models
  - Retries load
  - Succeeds
  - Item moves to Main Queue
  - Processes successfully
```

---

## 🎬 Success Criteria

### Must Have
1. ✅ Model B doesn't wait for Model A to load
2. ✅ Multiple models can load simultaneously (different servers)
3. ✅ Ready items process instantly
4. ✅ Loading items don't block queue
5. ✅ Clear state visibility (which queue, which state)

### Nice to Have
1. ✅ Pre-load popular models
2. ✅ Multiple processors per server
3. ✅ Predictive loading

### Must NOT Have
1. ❌ Complex state machines
2. ❌ Hidden state transitions
3. ❌ Implicit routing logic
4. ❌ Timers or polling (except for model load status)

---

## 📐 Complexity Analysis

### Current System
- **Code**: Simple (1 queue, 1 worker)
- **Performance**: Poor (serial blocking)
- **Scale**: Limited (<100K/day)

### Parallel Queue System
- **Code**: Moderate (2 queues, 3 worker types)
- **Performance**: Excellent (parallel, non-blocking)
- **Scale**: High (1M+/day)

### Fully Distributed (Future)
- **Code**: Complex (distributed queue service)
- **Performance**: Excellent
- **Scale**: Very high (10M+/day)

---

## 🤔 Open Questions

### Q1: What if Loading Queue backs up?
**Scenario**: 10 messages need loading, but models load slowly

**Answer**: They queue up in Loading Queue, process sequentially per server
- Server 1 loads Model A, then Model C, then Model E...
- Server 2 loads Model B, then Model D, then Model F...
- Parallel across servers, serial per server

**This is fine** - loading is the bottleneck anyway

### Q2: What if same model needed by multiple items?
**Scenario**: Item A and Item B both need Model 1 (not loaded)

**Current design**: Both go to Loading Queue, loader processes them sequentially

**Better**: Loader could batch them:
```
1. Claims Item A
2. Starts loading Model 1
3. While loading, checks for other items needing Model 1
4. Finds Item B
5. When Model 1 loads, moves BOTH to Main Queue
```

**Decision**: Keep it simple for now, batch optimization later

### Q3: How to handle model unload during processing?
**Scenario**: Model A is loaded, Item in Main Queue, but LM Studio unloads it

**Answer**: Processor fails, item goes back to queue as 'pending', router re-routes to Loading Queue

**Robust**: System self-heals

---

## 🎯 Implementation Timeline

### Week 1: Fix Current Bug
- Get debug logs
- Identify 1-second failure cause
- Fix the immediate issue
- Verify system works (even if slow)

### Week 2: Implement Parallel Queues
- Create queue classes
- Implement workers
- Test with mixed scenarios
- Deploy and monitor

### Week 3: Optimize
- Add batching for same-model requests
- Tune polling intervals
- Add metrics and monitoring

---

## 🔥 Priority: Fix Current Bug First

Before implementing parallel queues, we must:
1. ✅ Understand why item drops after 1 second
2. ✅ Fix that bug
3. ✅ Verify request completes during model load (even if slow)

**Then** we can optimize with parallel queues.

**Philosophy**: Make it work, then make it fast

---

*Waiting for debug logs from fresh test to identify the 1-second failure...*

**Ready for your test results!**
