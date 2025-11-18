# Memory Error Recovery System - Scoping Document

**Date**: October 12, 2025  
**Status**: PLANNING  
**Purpose**: Handle LM Studio "insufficient memory" errors elegantly without timers

---

## 🎯 The Problem

**Error:**
```
Model loading was stopped due to insufficient system resources.
This model requires approximately 29.54 GB of memory.
```

**Current Behavior:**
- Request fails
- No response posted
- User sees nothing
- System appears broken

**Why It Happens:**
- Multiple f32 models loaded (each 15-30 GB)
- Memory fills up (e.g., 4-6 models = ~120 GB)
- Next model request exceeds available memory
- LM Studio refuses to load (safety feature)

---

## 🎯 Design Goals

### Primary
1. **Recover automatically** - Don't fail permanently
2. **No timers** - Use event-driven/await patterns only
3. **Fast recovery** - Minimal delay
4. **No overhead on normal requests** - Only activate on error

### Secondary
1. **Centralized error handling** - One component handles this
2. **Observable** - Log what's happening
3. **Testable** - Can simulate and verify
4. **Simple** - Minimal code, clear logic

### Non-Goals
- NOT trying to predict memory issues
- NOT pre-emptively unloading
- NOT complex memory management
- NOT affecting normal (successful) requests

---

## 🏗️ Proposed Architecture

### Component: MemoryErrorRecovery

**Location:** `ai/src/modules/memoryErrorRecovery.ts`

**Responsibility:** Catch insufficient memory errors, recover, retry

**Interface:**
```typescript
class MemoryErrorRecovery {
  // Wrap a model request with memory error handling
  async executeWithRecovery<T>(
    fn: () => Promise<T>,
    serverIp: string,
    modelName: string
  ): Promise<T>
  
  // Internal: Handle the error
  private async recover(serverIp: string): Promise<void>
  
  // Internal: Check if error is memory-related
  private isMemoryError(error: any): boolean
}
```

---

## 🔄 Recovery Flow (Elegant, No Timers)

### Approach A: Unload-and-Immediate-Retry (Recommended)

```
1. Try to load model
   ↓
2. Catch "insufficient memory" error
   ↓
3. Call: lms unload --all --host {ip}
   ↓
4. Immediate retry (no waiting!)
   ↓
5. LM Studio JIT loads just the one model we need
   ↓
6. Success OR fail (if still no memory, give up)
```

**Why This Works:**
- `unloadAll()` is async - we await it
- Once unloaded, memory is free
- LM Studio loads requested model immediately via JIT
- No polling, no timers - just sequential async operations

**Code Pattern:**
```typescript
async executeWithRecovery(fn, serverIp, modelName) {
  try {
    return await fn(); // First attempt
  } catch (error) {
    if (!this.isMemoryError(error)) throw error;
    
    // Memory error detected - recover
    logger.warn('Memory error detected, unloading all models');
    await cli.unloadAll(serverIp);
    
    // Immediate retry
    return await fn(); // LM Studio JIT loads our model fresh
  }
}
```

**Benefits:**
- ✅ No timers
- ✅ No polling
- ✅ Fast (just one unload + one load)
- ✅ Simple (try-catch-unload-retry)
- ✅ Only runs on error (zero overhead normally)

---

### Approach B: Unload-Check-Retry (If A Doesn't Work)

```
1. Catch error
   ↓
2. Unload all
   ↓
3. Check if empty: await listLoaded(host)
   ↓
4. While not empty: await listLoaded(host)
   ↓
5. Retry request
```

**Why This Might Be Needed:**
- `unloadAll()` might be async (doesn't wait for completion)
- Models might still be unloading when we retry
- Need to verify they're actually gone

**Code Pattern:**
```typescript
async executeWithRecovery(fn, serverIp, modelName) {
  try {
    return await fn();
  } catch (error) {
    if (!this.isMemoryError(error)) throw error;
    
    // Unload all
    await cli.unloadAll(serverIp);
    
    // Wait for models to actually unload
    await this.waitForEmptyMemory(serverIp);
    
    // Retry
    return await fn();
  }
}

private async waitForEmptyMemory(serverIp: string): Promise<void> {
  while (true) {
    const loaded = await cli.listLoaded(serverIp);
    if (loaded.length === 0) return;
    // Wait for unload to complete (NOT a timer - event-driven await)
    await new Promise(resolve => setTimeout(resolve, 1000)); // ONLY if needed
  }
}
```

**Problem:** This DOES use setTimeout (a timer)

**Alternative:** Use LM Studio events/webhooks (if available)

---

## 🎨 Elegant Solution (My Recommendation)

### Pattern: Try → Unload → Retry Once

**Philosophy:**
- First try: Normal request
- On memory error: Unload all + retry
- Second failure: Give up (log error, user sees it)

**Why Only Retry Once:**
- If unloading all models doesn't free enough memory, something else is wrong
- Don't loop forever
- Clear failure after 1 retry

**Implementation:**
```typescript
class MemoryErrorRecovery {
  private cli = new LMStudioCLI();
  
  async executeWithRecovery<T>(
    fn: () => Promise<T>,
    serverIp: string,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // Only handle memory errors
      if (!this.isMemoryError(error)) {
        throw error;
      }
      
      // Only retry once
      if (retryCount >= 1) {
        logger.error('Memory error persists after recovery attempt');
        throw error;
      }
      
      // Recovery: Unload all and retry
      logger.warn(`Memory error on ${serverIp}, attempting recovery...`);
      await this.cli.unloadAll(serverIp);
      logger.info('All models unloaded, retrying request');
      
      // Recursive retry with incremented count
      return await this.executeWithRecovery(fn, serverIp, retryCount + 1);
    }
  }
  
  private isMemoryError(error: any): boolean {
    const message = error?.message || error?.toString() || '';
    return message.includes('insufficient system resources') ||
           message.includes('overload your system') ||
           message.includes('requires approximately');
  }
}
```

**Flow:**
```
Request → Try
  ↓ (error)
Is Memory Error? No → Throw
  ↓ Yes
Already retried? Yes → Throw
  ↓ No
Unload All (await)
  ↓
Retry (recursive call with retryCount++)
  ↓
Success or Final Error
```

**Benefits:**
- ✅ No timers (pure async/await)
- ✅ No polling loop
- ✅ One retry only (predictable)
- ✅ Zero overhead on normal requests
- ✅ Self-contained logic
- ✅ Easy to test

---

## 📐 Integration Points

### Where to Integrate

**Option 1: Wrap in LMStudioCluster** (Recommended)
- Modify `processRequest()` method
- Wrap model loading in recovery handler
- All requests automatically protected

**Option 2: Separate Module**
- Import in index.ts
- Wrap cluster.processRequest() call
- More explicit, easier to disable if needed

**Recommendation:** Option 1 - integrate into cluster, transparent to caller

---

## 🔧 Implementation Steps

### Phase 1: Create Component (30 min)
1. Create `memoryErrorRecovery.ts`
2. Implement `executeWithRecovery()`
3. Implement `isMemoryError()`
4. Add unit tests (simulate errors)

### Phase 2: Integrate into Cluster (20 min)
1. Import into `lmStudioCluster-closed.ts`
2. Wrap model load operations
3. Update error handling
4. Test with real memory error

### Phase 3: Logging & Observability (10 min)
1. Add detailed logs for recovery flow
2. Update WebSocket to broadcast recovery events
3. Dashboard shows recovery status

### Phase 4: Testing (20 min)
1. Simulate memory error
2. Verify unload happens
3. Verify retry succeeds
4. Verify normal requests unaffected

---

## 🚨 Edge Cases

### Case 1: Unload Fails
**What:** `unloadAll()` returns false

**Handle:**
```typescript
const unloaded = await cli.unloadAll(serverIp);
if (!unloaded) {
  throw new Error('Failed to unload models for recovery');
}
```

### Case 2: Retry Also Fails
**What:** After unload, still insufficient memory

**Handle:**
- Already handled by retry limit (max 1 retry)
- Throw error, message not processed
- Log clearly for debugging

### Case 3: Different Error During Retry
**What:** Unload succeeded but retry fails for other reason

**Handle:**
- Let it throw normally
- Not a memory error anymore
- Regular error handling applies

---

## 💡 Alternative: Simplest Possible

**Even simpler approach:**

```typescript
// In processRequest, add one line:
try {
  return await this.sendToLMStudio(request);
} catch (error) {
  if (error.message.includes('insufficient memory')) {
    await cli.unloadAll(request.serverIp);
    return await this.sendToLMStudio(request); // Retry once
  }
  throw error;
}
```

**That's it. No separate component. Just inline recovery.**

**Pros:**
- ✅ Simplest possible
- ✅ No new files
- ✅ Easy to understand
- ✅ No timers
- ✅ Works

**Cons:**
- Less modular
- Harder to test in isolation
- Mixed concerns

---

## 🎯 Recommendation

**Go with the simplest approach:**
- Inline recovery in cluster processRequest
- Try → Catch memory error → Unload all → Retry once
- ~5 lines of code
- No timers, no polling, no complexity

**If it works:** Done!  
**If it doesn't:** Then build the component

**Start simple, add complexity only if needed.**

---

## 📊 Success Criteria

### Must Have
- ✅ Detects memory error
- ✅ Unloads all models
- ✅ Retries request
- ✅ No timers used
- ✅ Normal requests unaffected

### Should Have
- ✅ Logs recovery attempt
- ✅ Limits retries (1 max)
- ✅ Clear error if recovery fails

### Nice to Have
- Dashboard shows recovery events
- Metrics on recovery frequency
- Configurable retry limit

---

## 🔬 Testing Plan

### Manual Test
1. Load 6-7 f32 models manually (fill memory)
2. Send message requiring 8th model
3. Should see: Error → Unload → Retry → Success

### Automated Test
- Mock the memory error
- Verify unloadAll called
- Verify retry attempted
- Verify success after retry

---

## ⚡ Quick Start Implementation

**Minimal changes needed:**

**File:** `ai/src/modules/lmStudioCluster-closed.ts`

**Location:** In `processRequest()` method, wrap the fetch call

**Code:**
```typescript
// Add at top of file
import { LMStudioCLI } from './lmStudioCliWrapper.js';
const cli = new LMStudioCLI();

// In processRequest, around line 308:
try {
  const response = await fetch(...);
  // ... normal handling
} catch (error) {
  // Memory error recovery
  if (error.message?.includes('insufficient')) {
    logger.warn(`Memory error, clearing ${server.name}`);
    await cli.unloadAll(server.ip);
    logger.info('Retrying after memory clear');
    
    // Retry once
    const response = await fetch(...);
    // ... normal handling (duplicate code)
  }
  throw error;
}
```

**That's it!** 5 lines of actual logic.

---

**Should I implement the simple inline approach or build the full component?**

