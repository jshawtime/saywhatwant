# 164-QUEUE-CACHE-VERIFICATION-ISSUE.md

**Tags:** #queue #cache #kv #verification #performance #bug  
**Created:** October 31, 2025  
**Status:** 🔴 CRITICAL - Cache synchronization failing

---

## Problem Discovery

### Symptoms
- PM2 bot polling shows `[KVr:5 KVw:0]` consistently
- Normally shows `[KVr:1 KVw:0]` (just cache read)
- Extra 4 reads = 4 messages being verified every 3 seconds
- Messages stuck in `status='processing'` in cache forever
- Individual KV keys show `status='complete'` correctly

### Stuck Messages
1. `1761922126074-d9ostp8tt` - AliceWonderland
2. `1761922130907-gf4x1loyh` - EmotionalGuide
3. `1761922132478-l4zh40bpk` - Frankenstein
4. `1761922134340-bm7vvn9qa` - RoadNotTaken

All show:
- Cache: `status='processing'`
- Individual KV key: `status='complete'`
- Bot successfully processed and called `/api/queue/complete`
- Worker's cache update failed silently

---

## Current Architecture

### How `/api/queue/pending` Works (Worker)

**File:** `saywhatwant/workers/comments-worker.js` lines 903-1010

```javascript
async function handleGetPending(env, url) {
  let kvReads = 0;
  
  // 1. Read cache (1 read)
  const cachedData = await env.COMMENTS_KV.get('recent:comments');
  kvReads++; // = 1
  
  const cached = JSON.parse(cachedData);
  let allMessages = [];
  
  // 2. For each message in cache with botParams.entity
  for (const msg of cached) {
    if (msg.botParams?.entity && msg['message-type'] === 'human') {
      
      const cacheStatus = msg.botParams?.status;
      
      // OPTIMIZATION: Skip verification for terminal states
      if (cacheStatus === 'complete' || cacheStatus === 'failed') {
        // Trust cache, skip KV read
        continue; // ✅ Saves KV reads (93% cost reduction)
      }
      
      // For 'pending' or undefined status: VERIFY with individual KV key
      // This is critical - cache might be stale!
      
      // Try NEW key format first
      let actualData = await env.COMMENTS_KV.get(`comment:${msg.id}`);
      kvReads++; // Extra read per non-terminal message
      
      // If not found, try OLD key format (backwards compatibility)
      if (!actualData) {
        actualData = await env.COMMENTS_KV.get(`comment:${timestamp}:${msg.id}`);
        kvReads++; // Potentially 2 reads per message
      }
      
      // Use actual KV data, not cache
      if (actualData) {
        const actualMsg = JSON.parse(actualData);
        if (actualMsg.botParams?.status === 'pending') {
          allMessages.push(actualMsg); // Ground truth says pending
        }
      }
    }
  }
  
  return { pending: allMessages, kvStats: { reads: kvReads, writes: 0 } };
}
```

### Purpose of Verification

**Cache is fast but can be stale.** Individual KV keys are the **source of truth**.

**Why verify non-terminal states:**
- `status='pending'` in cache might actually be `'processing'` or `'complete'` in KV
- Bot claimed it, Worker updated individual key, but cache update failed
- Without verification, we'd return stale pending messages
- Bot would try to claim already-claimed messages (race condition)

**Why skip terminal states:**
- `status='complete'` in cache → message will NEVER become pending again
- `status='failed'` in cache → message will NEVER become pending again
- Safe to trust cache, save expensive KV read (93% of messages)

---

## What's Happening Now

### The Lifecycle

**Normal flow (WORKING):**
1. Human posts message → status='pending' in cache
2. Bot polls `/api/queue/pending`
   - Worker reads cache (1 read)
   - Sees status='pending' or undefined
   - Verifies with individual KV key (1 read)
   - Returns message as pending
3. Bot claims message → `/api/queue/claim`
   - Worker updates individual key: status='processing'
   - Worker updates cache: status='processing' ✅
4. Bot processes, posts AI response
5. Bot calls `/api/queue/complete`
   - Worker updates individual key: status='complete' ✅
   - Worker updates cache: status='complete' ✅ **<-- THIS IS FAILING**
6. Next poll:
   - Worker reads cache (1 read)
   - Sees status='complete' in cache
   - **SKIPS verification** (optimization)
   - Returns empty (no pending)

**Broken flow (CURRENT ISSUE):**
1-4. Same as above ✅
5. Bot calls `/api/queue/complete`
   - Worker updates individual key: status='complete' ✅
   - Worker tries to update cache: **FAILS SILENTLY** ❌
   - Cache still shows status='processing'
6. Next poll:
   - Worker reads cache (1 read)
   - Sees status='processing' in cache (stale!)
   - **MUST VERIFY** (not terminal state)
   - Reads individual KV key (1 read) → status='complete'
   - Doesn't return as pending (correct)
   - But **NEVER FIXES THE CACHE**
7. Every subsequent poll:
   - Same verification required (extra KV read)
   - Forever stuck

### Current Cost
- 4 stuck messages × 1 verification per poll
- Poll every 3 seconds = ~28,800 polls/day
- 4 extra reads × 28,800 = **115,200 extra KV reads/day**
- At current scale: negligible cost (~$0.006/day)
- **But accumulates forever** - every cache update failure adds permanent cost

---

## Root Cause Analysis

### Why Cache Update Fails

**File:** `saywhatwant/workers/comments-worker.js` lines 1150-1167

```javascript
async function handleCompleteMessage(request, env) {
  // ... updates individual key successfully ...
  
  // Update cache so optimization can skip this message on next poll
  try {
    const cacheKey = 'recent:comments';
    const cachedData = await env.COMMENTS_KV.get(cacheKey);
    if (cachedData) {
      const cached = JSON.parse(cachedData);
      const index = cached.findIndex(c => c.id === messageId);
      if (index >= 0) {
        cached[index].botParams.status = 'complete';
        cached[index].botParams.processed = true;
        await env.COMMENTS_KV.put(cacheKey, JSON.stringify(cached));
        console.log('[Queue] Cache updated for:', messageId);
      }
    }
  } catch (cacheError) {
    // ❌ SILENTLY FAILS - no visibility into actual error
    console.log('[Queue] Cache update failed (non-critical):', cacheError.message);
  }
}
```

**Possible failure reasons:**
1. **Race condition:** Cache was updated by POST between read and write
2. **Size limit:** Cache grew too large (25MB KV limit)
3. **Parse error:** Cache JSON corrupted
4. **Message not in cache:** Already aged out of 200-message window
5. **KV write failure:** Network/service issue

**We don't know which because error is suppressed!**

---

## What We Want

### Self-Healing Architecture

**When verification finds status mismatch:**
1. Read cache (1 read) ✅ Current
2. Find non-terminal message (status='processing') ✅ Current
3. Verify with individual KV key (1 read) ✅ Current
4. **Individual KV shows status='complete'** ✅ Current
5. **UPDATE CACHE with correct status** ❌ Missing!
6. Next poll: Cache is correct, no verification needed ✅ Fixed

### Benefits
- **Self-healing:** One-time fix on next poll
- **No manual intervention:** System corrects itself
- **Prevents accumulation:** Stuck messages get unstuck
- **Maintains optimization:** Terminal states still skip verification
- **Cost neutral:** One extra write fixes infinite extra reads

### Trade-offs
- **Extra write on verification:** Only happens when cache is wrong
- **Frequency:** Rare (only when cache update originally failed)
- **Cost:** 1 KV write << infinite KV reads saved

---

## Implementation Plan

### Option 1: Self-Healing in `/api/queue/pending` (RECOMMENDED)

**What:** When verification finds status mismatch, update cache in-place

**File:** `saywhatwant/workers/comments-worker.js` lines 926-960

**Changes:**
```javascript
async function handleGetPending(env, url) {
  let kvReads = 0;
  let kvWrites = 0;
  
  const cachedData = await env.COMMENTS_KV.get('recent:comments');
  kvReads++;
  
  const cached = JSON.parse(cachedData);
  let allMessages = [];
  let cacheNeedsUpdate = false; // Track if we fixed anything
  
  for (const msg of cached) {
    if (msg.botParams?.entity && msg['message-type'] === 'human') {
      
      const cacheStatus = msg.botParams?.status;
      
      // Skip verification for terminal states
      if (cacheStatus === 'complete' || cacheStatus === 'failed') {
        continue;
      }
      
      // Verify non-terminal states
      const actualData = await env.COMMENTS_KV.get(`comment:${msg.id}`);
      kvReads++;
      
      if (actualData) {
        const actualMsg = JSON.parse(actualData);
        const actualStatus = actualMsg.botParams?.status;
        
        // SELF-HEALING: If cache is wrong, fix it
        if (cacheStatus !== actualStatus) {
          console.log(`[Queue] Self-heal: ${msg.id} cache=${cacheStatus} actual=${actualStatus}`);
          
          // Update cache entry in memory
          const index = cached.findIndex(c => c.id === msg.id);
          if (index >= 0) {
            cached[index].botParams.status = actualStatus;
            cached[index].botParams.processed = (actualStatus === 'complete' || actualStatus === 'failed');
            cacheNeedsUpdate = true;
          }
        }
        
        // Add to pending if actually pending
        if (actualStatus === 'pending') {
          allMessages.push(actualMsg);
        }
      }
    }
  }
  
  // Write updated cache if we fixed anything
  if (cacheNeedsUpdate) {
    try {
      await env.COMMENTS_KV.put('recent:comments', JSON.stringify(cached));
      kvWrites++;
      console.log('[Queue] Cache self-healed, wrote updated cache');
    } catch (error) {
      console.error('[Queue] Self-heal write failed:', error.message);
      // Non-critical - will retry next poll
    }
  }
  
  return { 
    pending: allMessages, 
    kvStats: { reads: kvReads, writes: kvWrites } 
  };
}
```

**Pros:**
- ✅ Fixes cache on next poll automatically
- ✅ No changes to complete/fail endpoints
- ✅ Handles ALL sources of cache staleness (not just complete failures)
- ✅ Self-documenting (logs when healing happens)
- ✅ Graceful degradation (if write fails, retries next poll)

**Cons:**
- ❌ Extra write only when needed (minimal cost)
- ❌ Slight complexity in pending endpoint

### Option 2: Fix Original Cache Update

**What:** Make cache update in `handleCompleteMessage` more robust

**Pros:**
- ✅ Fixes at source
- ✅ Simpler pending endpoint

**Cons:**
- ❌ Doesn't fix existing stuck messages
- ❌ Doesn't handle other sources of staleness
- ❌ Still need manual cleanup

### Option 3: Background Cleanup Job

**What:** Cron job that scans cache, verifies all non-terminal states, fixes mismatches

**Pros:**
- ✅ Batch operation
- ✅ Centralized healing logic

**Cons:**
- ❌ Added complexity (cron trigger)
- ❌ Doesn't prevent future issues
- ❌ Delay before healing (not real-time)

---

## Recommendation

**Implement Option 1: Self-Healing in `/api/queue/pending`**

### Why This is Best
1. **Fixes root cause:** Cache update can fail for many reasons (race, size, network)
2. **Self-healing:** System corrects itself automatically
3. **Real-time:** Fixed on next poll (3 seconds max)
4. **Robust:** Handles ALL staleness scenarios, not just complete failures
5. **Cost-effective:** One write saves infinite reads
6. **Backwards compatible:** No breaking changes

### Implementation Steps
1. Add self-healing logic to `/api/queue/pending`
2. Test with intentionally broken cache
3. Monitor Cloudflare Worker logs for self-heal events
4. Verify stuck messages get unstuck within one poll cycle
5. Confirm KV read count drops from 5 to 1

### Success Criteria
- Stuck messages self-heal within 3 seconds (one poll)
- KV reads drop to 1 (just cache read)
- No manual intervention required
- System handles future cache update failures automatically

---

## Testing Plan

### 1. Verify Current State
```bash
# Check stuck messages
curl "https://sww-comments.bootloaders.workers.dev/api/comments?limit=200" | \
  jq '.comments[] | select(.botParams.status == "processing")'

# Should show 4 messages
```

### 2. Deploy Self-Healing Fix
```bash
cd saywhatwant/workers
wrangler deploy
```

### 3. Wait One Poll Cycle (3 seconds)
```bash
# Watch PM2 logs
npx pm2 logs ai-bot-simple --lines 20
# Should see KVr:5 drop to KVr:1
```

### 4. Verify Cache Fixed
```bash
# Check cache again
curl "https://sww-comments.bootloaders.workers.dev/api/comments?limit=200" | \
  jq '.comments[] | select(.botParams.status == "processing")'

# Should show 0 messages
```

### 5. Check Cloudflare Logs
```bash
# Look for self-heal events
wrangler tail
# Should see: "[Queue] Self-heal: <messageId> cache=processing actual=complete"
```

---

## Related Issues

### Cache as Source of Truth vs Individual Keys
- Cache is **fast** but can be **stale**
- Individual KV keys are **slow** but always **correct**
- Optimization: Trust cache for terminal states (93% of messages)
- Verification: Check individual keys for non-terminal states (7% of messages)
- **This architecture is correct** - just needs self-healing for staleness

### Why Not Just Trust Cache?
- Race conditions during claim/complete
- Cache updates can fail (size, network, race)
- Would return stale pending messages
- Bots would conflict trying to claim same message
- **Verification is necessary for correctness**

### Why Not Always Read Individual Keys?
- 200 messages × 2 reads each (new/old format) = 400 reads per poll
- Current: 1 cache read + ~7% verification = ~15 reads per poll
- **93% cost savings** from terminal state optimization

---

**Status:** Awaiting approval for Option 1 implementation  
**Next:** Deploy self-healing fix to Worker  
**Impact:** Fixes 4 stuck messages, prevents future accumulation, maintains optimization  
**Cost:** Negligible (1 write when healing, saves infinite reads)

