# Cache Invalidation Strategy Rethink

**Date:** October 21, 2025  
**Status:** 🤔 DISCUSSION - For Future Implementation  
**Priority:** Medium (works now, but inefficient at scale)

---

## Context

The current cache invalidation strategy was implemented **before** the `processed` flag system. Now that we have persistent `processed` tracking in KV, we need to rethink whether the current aggressive cache invalidation is still necessary.

---

## Current Implementation (As-Is)

### How It Works Now

1. **Bot marks message as processed** → `PATCH /api/comments/:id`
2. **Worker updates individual KV key** → `comment:timestamp:id`
3. **Worker DELETES entire cache** → `recent:comments` deleted (lines 604-606 in `comments-worker.js`)
4. **Frontend polls** → `GET /api/comments?after=timestamp`
5. **Worker finds cache empty** → Rebuilds from 1000+ individual KV keys
6. **Worker recreates cache** → `recent:comments` rebuilt

### The Problem

With **multiple concurrent workers** (or even rapid sequential messages):

```
Worker A: Posts AI response → triggers PATCH → deletes cache
Worker B: (processing in parallel) tries to read cache → empty → rebuilds
Frontend: Polls during rebuild → gets 0 messages ❌
```

**Race condition:** Cache is frequently empty during the rebuild window, causing messages to not appear.

---

## Why This Approach Was Needed (Historical Context)

Based on **84-CACHE-INVALIDATION-BUG-FIX.md**, the cache invalidation was added to solve:

> **Problem:** AI responses not appearing in frontend after bot posted them
> 
> **Root Cause:** Cursor-based polling path (`?after=timestamp`) would return empty array if cache was not found, instead of rebuilding from individual keys.
> 
> **Fix:** Add cache rebuild logic + invalidate cache on PATCH to force rebuild

**However:** This was a workaround. The real issue was that the polling path didn't have rebuild logic. Now it does (lines 147-165).

---

## The Key Insight: `processed` Flag Changes Everything

### Before `processed` Flag
- Bot had **no persistent memory** of what it processed
- Used in-memory `Set` that reset on PM2 restart
- Bot would **reprocess old messages** after restart
- Cache needed to reflect "already processed" state immediately

### After `processed` Flag (79-PROCESSED-FLAG-IMPLEMENTATION.md)
- Bot has **persistent tracking** in KV storage
- `processed: true` lives in individual message keys forever
- Bot **never reprocesses** old messages (even after restart)
- Cache doesn't need to be "immediately correct" about processed status

---

## Why Current Approach Is Inefficient

### Cache Rebuild Cost

From **84-CACHE-INVALIDATION-BUG-FIX.md**:
> Cache rebuild involves:
> 1. List all `comment:*` keys (limit 1000)
> 2. Fetch each key individually (1000+ KV reads)
> 3. Parse all JSON
> 4. Sort by timestamp
> 5. Write back to cache

**With 6 workers + rapid messages:**
- Cache deleted every 3-5 seconds
- Rebuild happens constantly
- Frontend often catches cache in "empty" state
- Messages don't appear (current bug)

---

## Proposed Solution: Stop Invalidating Cache

### The New Strategy

**DON'T delete cache on PATCH.** Instead:

1. **Bot marks as processed** → Update individual key only
2. **Cache stays intact** → May show `processed: false` for a bit
3. **Frontend polls** → Cache exists, returns messages instantly
4. **Bot ignores unprocessed items in cache** → Reads from individual keys anyway

### Why This Works

**Bot doesn't rely on cache for processing logic:**

```typescript
// Bot polls KV - NOT using cache
const messages = await fetch('https://...?limit=100&sort=timestamp');

// Bot filters out already processed
const unprocessed = messages.filter(m => !m.botParams?.processed);
```

**Bot reads from main GET endpoint** which uses cache OR rebuilds if needed. But bot's deduplication doesn't depend on cache being up-to-date about `processed` status because:

1. **Session Map** (`queuedThisSession`) prevents duplicates within session
2. **Persistent `processed` flag** prevents duplicates across restarts
3. **Cache processed status is informational only** - not critical for correctness

### What Changes

**In `comments-worker.js` line 602-606:**

```javascript
// BEFORE (delete cache)
const cacheKey = 'recent:comments';
await env.COMMENTS_KV.delete(cacheKey);
console.log('[Comments] Cache invalidated - will rebuild on next GET');

// AFTER (update cache in place - optional)
// Option A: Do nothing - cache shows stale processed status briefly
// Option B: Update cache entry in place (best effort, non-critical)
await updateCacheProcessedStatus(env, messageId, updates.botParams.processed);
```

**Benefits:**
- ✅ Cache always exists (never empty)
- ✅ Frontend always gets messages (no race condition)
- ✅ Reduced KV reads (no constant rebuilds)
- ✅ Lower latency (instant cache hits)
- ✅ Better scaling (works with 6+ workers)

**Trade-offs:**
- ⚠️ Cache shows `processed: false` for ~3-10 seconds after bot processes
- ✅ But this doesn't matter - bot has persistent tracking in individual keys

---

## Implementation Plan (For Later)

### Phase 1: Test with 1 Worker ✅ (Current)
- Set `maxConcurrentWorkers: 1` 
- Verify messages appear consistently
- Confirm no race conditions with single worker
- **Status:** In progress

### Phase 2: Remove Cache Invalidation (Future)
1. **Update `comments-worker.js`:**
   - Remove `await env.COMMENTS_KV.delete(cacheKey)` from PATCH handler
   - Optionally add in-place cache update (best effort)
   
2. **Test with 1 worker:**
   - Messages still appear? ✅
   - Bot still deduplicates correctly? ✅
   - Processed status eventually reflected in cache? ✅

3. **Scale to multiple workers:**
   - Set `maxConcurrentWorkers: 6`
   - Rapid message testing (4 tabs, 2-second intervals)
   - Verify all replies appear in frontend

4. **Monitor performance:**
   - KV read reduction
   - Frontend message appearance latency
   - Cache hit rate

---

## Key References

- **79-PROCESSED-FLAG-IMPLEMENTATION.md** - Why persistent tracking eliminates need for immediate cache correctness
- **84-CACHE-INVALIDATION-BUG-FIX.md** - Original cache rebuild fix (was workaround for missing rebuild logic)
- **107-LM-STUDIO-PARALLEL-PROCESSING.md** - Multiple workers architecture requiring cache rethink

---

## Decision Log

**October 21, 2025:**
- Reduced to 1 worker to eliminate race condition temporarily
- Identified cache invalidation as legacy approach from pre-`processed` flag era
- Documented rethink strategy for future implementation after 1-worker testing confirms stability

---

## Questions for Future Implementation

1. Should cache ever reflect `processed` status, or just omit that field?
2. Should we add cache expiry (TTL) instead of invalidation?
3. Should POST also skip cache update (let polling rebuild naturally)?
4. What's the acceptable lag for cache to show current state?

---

**Next Steps:**
1. ✅ Test with `maxConcurrentWorkers: 1` 
2. ⏳ Confirm stability and message delivery
3. 🔮 Implement cache invalidation removal
4. 🔮 Scale back to multiple workers

