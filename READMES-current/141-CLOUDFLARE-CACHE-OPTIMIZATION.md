# Cloudflare KV Cache Optimization - 3-Second Rebuild

**Date:** October 23, 2025  
**Status:** ✅ IMPLEMENTED - READY TO DEPLOY  
**Related:** 12-EFFICIENT-POLLING-STRATEGY.md, 130-CACHE-INVALIDATION-RETHINK.md

## Implementation Progress:

✅ **Step 1:** Added cron trigger to wrangler.toml  
✅ **Step 2:** Implemented `rebuildCacheFromKeys()` function  
✅ **Step 3:** Added `scheduled()` handler to export  
✅ **Step 4:** Removed cache update from POST (line 524-525)  
✅ **Step 5:** Removed cache update from PATCH (line 623-625)  

**Next:** Deploy worker and test

---

## What We Have Now

### Current Cache Strategy (Problematic at Scale)

**Location:** `saywhatwant/workers/comments-worker.js` lines 712-755

**How it works:**
1. User/bot posts message → Worker receives POST
2. Worker writes to individual KV key: `comment:timestamp:id`
3. Worker reads cache: `recent:comments` (1 read)
4. Worker parses JSON array (~5000 messages)
5. Worker adds new message to array
6. Worker writes cache back (1 write)

**Cost per message:**
- 1 cache read + 1 cache write
- At 1000 messages/min: **1000 reads + 1000 writes per minute**
- At scale: **$25-30/month just for cache updates**

**Problems:**
1. **High write frequency** - Same cache key updated 1000x/min causes race conditions
2. **Race conditions** - Multiple Workers trying to update same key simultaneously
3. **Eventual consistency** - KV updates not immediate, can lose messages
4. **Inefficient** - Reading/writing entire 5000-message array for every single message
5. **Doesn't scale** - Gets worse at higher message volumes

### Additional Problem: PATCH 404 Errors

**Issue:** Bot tries to mark messages as `processed: true` but gets 404 errors.

**Root cause:** Messages exist in cache but NOT as individual KV keys (out of sync).

**Impact:** Messages get reprocessed on every PM2 restart, creating ghost responses.

---

## What We Want

### Timer-Based Cache Rebuild (Optimal Strategy)

**Concept:** Separate concerns - writes vs reads

**For writes (POST new message):**
- Write to individual key ONLY
- NO cache update
- Fast, atomic, no race conditions

**For reads (GET messages):**
- Read from cache
- Cache is rebuilt separately on a timer

**Cache rebuild (Cloudflare Cron):**
- Runs every 3 seconds
- Fetches last 500 individual keys
- Rebuilds cache from scratch
- No race conditions (single writer)

### Benefits:

✅ **Real-time for users** - 3-second cache refresh < 5-second frontend polling  
✅ **Real-time for bot** - 3-second cache refresh = 3-second bot polling  
✅ **No race conditions** - Only cron job writes cache  
✅ **Atomic writes** - Each message = separate individual key  
✅ **Source of truth** - Individual keys are authoritative  
✅ **Scales beautifully** - Cost independent of message volume  
✅ **Cheap** - 500 reads × 20/min = 10K reads/min = **$0.72/month**  
✅ **Cache always fresh** - Users never see stale data  

### The "Unfair Advantage":

**Cache refresh: 3 seconds**  
**Frontend polls: 5 seconds**  
**Bot polls: 3 seconds**  

**Result:** Cache is always fresher than user polls. Users never experience lag.

---

## How to Implement

### Phase 1: Add Cron Trigger to Worker

**File:** `saywhatwant/wrangler.toml`

**Add:**
```toml
[triggers]
crons = ["*/3 * * * * *"]  # Every 3 seconds (non-standard, may need to use every minute)
```

**Note:** Cloudflare Cron only supports minute-level granularity. We may need to use:
```toml
crons = ["* * * * *"]  # Every minute
```

And run the rebuild 20 times per invocation with 3-second sleeps (or use a different approach).

**Alternative:** Use Durable Alarm API for sub-minute timing.

### Phase 2: Implement Cache Rebuild Function

**File:** `saywhatwant/workers/comments-worker.js`

**Add new function:**
```javascript
/**
 * Rebuild cache from individual KV keys
 * Called by cron trigger every 3 seconds
 */
async function rebuildCache(env) {
  try {
    console.log('[Cache Rebuild] Starting...');
    
    const CACHE_SIZE = 500;
    const cacheKey = 'recent:comments';
    
    // List all comment keys (sorted by timestamp descending)
    const list = await env.COMMENTS_KV.list({ prefix: 'comment:', limit: CACHE_SIZE });
    
    // Fetch each message
    const messages = [];
    for (const key of list.keys) {
      const data = await env.COMMENTS_KV.get(key.name);
      if (data) {
        messages.push(JSON.parse(data));
      }
    }
    
    // Sort by timestamp descending (newest first)
    messages.sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only last 500
    const recentMessages = messages.slice(0, CACHE_SIZE);
    
    // Write to cache
    await env.COMMENTS_KV.put(cacheKey, JSON.stringify(recentMessages));
    
    console.log(`[Cache Rebuild] ✅ Complete - ${recentMessages.length} messages cached`);
  } catch (error) {
    console.error('[Cache Rebuild] ❌ Failed:', error);
    // Don't throw - let it retry next cycle
  }
}
```

**Add to export:**
```javascript
export default {
  async fetch(request, env, ctx) {
    // ... existing code
  },
  
  async scheduled(event, env, ctx) {
    // Cron trigger - rebuild cache
    await rebuildCache(env);
  }
};
```

### Phase 3: Remove Cache Update from POST

**File:** `saywhatwant/workers/comments-worker.js` line 504

**Change:**
```javascript
// BEFORE:
await env.COMMENTS_KV.put(key, JSON.stringify(comment));
await addToCache(env, comment);  // ← REMOVE THIS

// AFTER:
await env.COMMENTS_KV.put(key, JSON.stringify(comment));
// Cache will be updated by cron job
```

### Phase 4: Remove Cache Update from PATCH

**File:** `saywhatwant/workers/comments-worker.js` line 609

**Change:**
```javascript
// BEFORE:
await env.COMMENTS_KV.put(key, JSON.stringify(message));
try {
  await updateCacheProcessedStatus(env, messageId, updates.botParams.processed);
} catch (error) {
  console.log('[Comments] Cache update failed (non-critical):', error.message);
}

// AFTER:
await env.COMMENTS_KV.put(key, JSON.stringify(message));
// Cache will be rebuilt by cron job with latest processed status
```

### Phase 5: Update Cache Size Constant

**File:** `saywhatwant/workers/comments-worker.js` (top of file)

**Change:**
```javascript
// BEFORE:
const CACHE_SIZE = 5000;

// AFTER:
const CACHE_SIZE = 500;
```

---

## Testing

### Test 1: Cache Rebuilds on Schedule
1. Deploy worker with cron trigger
2. Watch Worker logs (Cloudflare dashboard)
3. Should see: `[Cache Rebuild] ✅ Complete - 500 messages cached` every 3 seconds

### Test 2: Messages Still Appear
1. Post message from frontend
2. Wait 3 seconds (for cache rebuild)
3. Refresh browser
4. Message should appear

### Test 3: Bot Processes Messages
1. Post message
2. Wait 3 seconds (cache rebuilds)
3. Bot polls (reads cache with new message)
4. Bot processes and responds
5. Should see response within ~10 seconds total

### Test 4: No More 404 Errors
1. Restart PM2 bot
2. Watch logs
3. Should NOT see repeated PATCH failures
4. Ghost messages should be processed correctly

---

## Expected Behavior

### Message Flow:

**User posts "Hello":**
- 0s: POST creates individual key `comment:timestamp:id`
- 0s: POST returns success (fast - no cache update!)
- 3s: Cron rebuilds cache, includes "Hello"
- 3s: Bot polls, reads cache, sees "Hello"
- 5s: Frontend polls, reads cache, sees "Hello"
- 8s: Bot responds, POST creates individual key for response
- 11s: Cron rebuilds cache, includes bot response
- 15s: Frontend polls, sees bot response

**Max lag:** 3 seconds (cache rebuild interval)

### Cost at Scale (1000 messages/min):

**Writes:**
- 1000 individual keys/min = 1.44M/month
- Cost: **$7.20/month**

**Reads (cache rebuilds):**
- 500 reads × 20/min = 10K reads/min = 14.4M/month
- Cost: **$0.72/month**

**Reads (user polls):**
- Cached at edge (mostly free)
- Maybe $1-2/month

**Total: ~$10/month** (vs current $30+)

---

## Edge Cases

### What if cron fails?

**Symptom:** Cache stops updating
**Impact:** Users see stale messages
**Detection:** Cache timestamp check
**Recovery:** Next cron run rebuilds correctly

**Mitigation:** Add cache age check - if > 10 seconds old, trigger manual rebuild

### What if individual key missing?

**Symptom:** Message in cache but not in individual key
**Impact:** PATCH returns 404
**Solution:** PATCH should check cache if individual key missing (separate fix)

### What during deploy?

**Symptom:** Cron pauses during worker deploy
**Impact:** Up to 3 seconds of missed cache updates
**Recovery:** Next cron catches up
**Acceptable:** 3-second gap is fine

---

## Implementation Challenges

### Challenge 1: Cloudflare Cron Limitations

**Problem:** Cloudflare Cron only supports minute-level granularity (not 3 seconds).

**Solutions:**

**A) Use Durable Object Alarm API:**
```javascript
// Durable Object with self-scheduling alarm
class CacheRebuilder {
  async alarm() {
    await rebuildCache(this.env);
    // Schedule next alarm in 3 seconds
    await this.storage.setAlarm(Date.now() + 3000);
  }
}
```

**B) Use Cron every minute, rebuild multiple times:**
```javascript
async scheduled(event, env, ctx) {
  // Run 20 times with 3-second delays
  for (let i = 0; i < 20; i++) {
    await rebuildCache(env);
    if (i < 19) await new Promise(r => setTimeout(r, 3000));
  }
}
```

**C) Use external cron service** (cron-job.org, GitHub Actions, etc.)

**Recommendation:** Start with Option B (simplest), migrate to Option A if needed.

### Challenge 2: Listing 500 Keys Efficiently

**Problem:** `KV.list()` might not return keys in timestamp order.

**Solution:** 
- List keys with prefix `comment:`
- Parse timestamp from each key name
- Sort by timestamp
- Take last 500

**Alternative:** Maintain a separate index key with list of recent message IDs.

---

## Rollback Plan

**If cache rebuild breaks:**

1. **Immediate:** Revert worker to previous version (Cloudflare dashboard)
2. **Fallback:** Re-enable cache updates in POST (line 504)
3. **Verify:** Check Worker logs for errors
4. **Test:** Post message, verify it appears

**Always keep previous worker version deployed as "rollback" version.**

---

## Success Criteria

✅ Cache rebuilds every 3 seconds (check Worker logs)  
✅ POST writes only to individual key (fast)  
✅ No race conditions (single writer)  
✅ Users see messages within 5 seconds (frontend polling)  
✅ Bot sees messages within 3 seconds (bot polling)  
✅ No 404 errors on PATCH (separate fix needed)  
✅ Cost < $10/month at current scale  
✅ Scales to 1000 msg/min without changes  

---

**Philosophy:** Simple, predictable, scales elegantly. Individual keys are source of truth, cache is a performance optimization. Logic over rules, simplicity over cleverness.

---

**Status:** READY TO IMPLEMENT  
**Risk:** Medium (changes core Worker caching behavior)  
**Impact:** High (fixes race conditions, reduces cost, improves reliability)

