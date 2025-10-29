# 159 - Dashboard KV Heartbeat Optimization

**Date:** October 29, 2025  
**Status:** 🚧 In Progress  
**Goal:** Reduce Cloudflare KV read costs by 82-99% using heartbeat optimization

---

## Problem Statement

### Current Situation (Expensive 💸)

The Queue Monitor Dashboard polls Cloudflare KV every 10 seconds to fetch messages:

```typescript
// App.tsx line 200
const response = await fetch(`https://sww-comments.bootloaders.workers.dev/api/comments?limit=100&t=${Date.now()}`);

// App.tsx line 218
const interval = setInterval(fetchKVMessages, 10000); // Every 10 seconds
```

**Cost Analysis:**
- **Poll interval:** 10 seconds
- **Messages per poll:** 100
- **Polls per hour:** 360 (60min × 6 polls/min)
- **Reads per hour:** **36,000 KV reads**
- **Daily reads:** **864,000 KV reads**

**Screenshot evidence (30 minutes):**
- 16.3k reads in 30 minutes
- **32,600 reads/hour** ✓ Matches calculation

### The Waste Problem

During **off-peak hours** (no messages posted):
- Still fetching 100 messages every 10 seconds
- Reading the **exact same data** 360 times per hour
- **~35,000+ wasted reads per quiet hour** 💸

During **peak times** (1 message/minute):
- Only 60 changes per hour
- But still polling 360 times
- **300 unnecessary full fetches per hour**

---

## Solution: Heartbeat Key

### Concept

Instead of always fetching 100 messages, first check a **single "heartbeat" key** that tells us if anything changed:

1. Dashboard polls heartbeat key (1 read)
2. If unchanged → skip message fetch (0 additional reads)
3. If changed → fetch 100 messages (100 reads)

**The Clever Part:**
- Don't make the dashboard scan KV to detect changes (expensive!)
- Let the **message writer** update the heartbeat when it posts (it already knows!)
- Dashboard just asks "did timestamp change?" (cheap!)

---

## Cost Savings Calculation

### Peak Times (1 message/minute)
- 60 messages/hour = 60 changes
- 360 polls/hour
- Heartbeat checks: **360 reads** (1 per poll)
- Message fetches: **6,000 reads** (60 changes × 100 messages)
- **Total: 6,360 reads/hour** (was 36,000)
- **Savings: 82%** 🎉

### Off-Peak (0 messages for 1 hour)
- 0 changes
- 360 polls/hour
- Heartbeat checks: **360 reads** (1 per poll)
- Message fetches: **0 reads** (no changes!)
- **Total: 360 reads/hour** (was 36,000)
- **Savings: 99%** 🚀

### Mixed Usage (12h quiet, 12h active)
- Quiet: 12 × 360 = **4,320 reads**
- Active: 12 × 6,360 = **76,320 reads**
- **Total: 80,640 reads/day** (was 864,000)
- **Overall savings: 91%** 📉

---

## Implementation Plan

### 1. Worker: Add Heartbeat Update (POST handler)

**File:** `saywhatwant/workers/comments-worker.js`  
**Location:** Line 549 in `handlePostComment()`

```javascript
// EXISTING CODE:
const key = `comment:${comment.id}`;
await env.COMMENTS_KV.put(key, JSON.stringify(comment));

// ADD HEARTBEAT UPDATE:
await env.COMMENTS_KV.put('dashboard:heartbeat', Date.now().toString());

// Continue with existing code...
await addToCache(env, comment);
```

**Cost:** 1 extra write per message (writes are cheap, reads are expensive)

---

### 2. Worker: Add Heartbeat Endpoint (GET)

**File:** `saywhatwant/workers/comments-worker.js`  
**Location:** Router section

Add new endpoint handler:

```javascript
/**
 * Handle GET /api/heartbeat
 * Returns timestamp of last message change
 * Used by dashboard to detect changes without expensive full fetch
 */
async function handleGetHeartbeat(env) {
  const heartbeat = await env.COMMENTS_KV.get('dashboard:heartbeat');
  return new Response(heartbeat || '0', {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
```

Add to router:

```javascript
// In fetch() handler
if (pathname === '/api/heartbeat' && method === 'GET') {
  return handleGetHeartbeat(env);
}
```

---

### 3. Dashboard: Check Heartbeat Before Fetch

**File:** `hm-server-deployment/Queue-Monitor-Deploy/src/App.tsx`  
**Location:** Lines 198-213 (replace `fetchKVMessages`)

```typescript
// Track last known heartbeat
const lastHeartbeatRef = React.useRef<string>('0');

const fetchKVMessages = React.useCallback(async () => {
  try {
    // STEP 1: Check heartbeat first (1 read)
    const heartbeatResponse = await fetch(
      `https://sww-comments.bootloaders.workers.dev/api/heartbeat?t=${Date.now()}`
    );
    const currentHeartbeat = await heartbeatResponse.text();
    
    // STEP 2: Compare with last known value
    if (currentHeartbeat === lastHeartbeatRef.current) {
      // No changes, skip expensive fetch
      console.log('[KV] No changes detected, skipping fetch');
      return;
    }
    
    // STEP 3: Update last known value
    lastHeartbeatRef.current = currentHeartbeat;
    console.log('[KV] Change detected, fetching messages');
    
    // STEP 4: Fetch messages only if changed (100 reads)
    const response = await fetch(
      `https://sww-comments.bootloaders.workers.dev/api/comments?limit=100&t=${Date.now()}`
    );
    const data = await response.json();
    const sorted = (data.comments || []).sort((a: any, b: any) => b.timestamp - a.timestamp);
    
    // Detect new messages for highlighting
    if (sorted.length > 0 && kvMessages.length > 0 && sorted[0].id !== kvMessages[0].id) {
      setNewKVMessageId(sorted[0].id);
      setTimeout(() => setNewKVMessageId(null), 3000);
    }
    
    setKvMessages(sorted);
  } catch (error) {
    console.error('Failed to fetch KV:', error);
  }
}, [kvMessages]);
```

**Keep existing polling interval:**
```typescript
// Line 218 - NO CHANGE
const interval = setInterval(fetchKVMessages, 10000); // Still 10 seconds
```

---

## Testing Plan

### 1. Local Testing

**Start dashboard:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/Queue-Monitor-Deploy
npm run dev
```

**Watch console logs:**
- Should see `[KV] No changes detected, skipping fetch` when idle
- Should see `[KV] Change detected, fetching messages` after new post

### 2. Production Deployment

**Deploy worker:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/workers
wrangler deploy
```

**Rebuild dashboard:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/Queue-Monitor-Deploy
npm run build
pm2 restart queue-monitor
```

### 3. Verification

**Check KV metrics in Cloudflare Dashboard:**
- Before: ~32,600 reads/hour
- After (off-peak): ~360 reads/hour
- After (peak): ~6,360 reads/hour

**Monitor for 24 hours** to confirm savings.

---

## Implementation Status

### ✅ Completed
- [x] Created comprehensive README
- [x] Worker: Add heartbeat update in POST handler (line 553)
- [x] Worker: Add GET /api/heartbeat endpoint handler (lines 912-933)
- [x] Worker: Add /api/heartbeat route to router (lines 107-110)
- [x] Dashboard: Add lastHeartbeatRef tracking (line 36)
- [x] Dashboard: Implement heartbeat check before fetch (lines 200-238)

### 🚧 Pending Deployment
- [ ] Test locally (run dashboard, post message, verify logs)
- [ ] Deploy worker to Cloudflare
- [ ] Deploy dashboard to production
- [ ] Monitor KV metrics for 24h
- [ ] Verify 82-99% cost reduction

---

## Files Modified

1. `saywhatwant/workers/comments-worker.js`
   - Added heartbeat update in `handlePostComment()` (line ~549)
   - Added `handleGetHeartbeat()` endpoint handler
   - Added `/api/heartbeat` route to router

2. `hm-server-deployment/Queue-Monitor-Deploy/src/App.tsx`
   - Modified `fetchKVMessages()` to check heartbeat first (lines ~198-213)
   - Added `lastHeartbeatRef` to track changes

---

## Rollback Plan

If issues arise, revert changes:

```bash
# Revert worker
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/workers
git checkout comments-worker.js
wrangler deploy

# Revert dashboard
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/Queue-Monitor-Deploy
git checkout src/App.tsx
npm run build
pm2 restart queue-monitor
```

Dashboard will fall back to fetching on every poll (expensive but functional).

---

## Future Optimizations

If still too expensive after heartbeat:

1. **Increase poll interval** to 15-30 seconds (missed polls now free)
2. **Pagination:** Only fetch new messages since last ID
3. **WebSockets:** Push-based updates (zero polling)
4. **Durable Objects:** Real-time pub/sub system

---

## Deployment Commands

### 1. Deploy Worker
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/workers
wrangler deploy
```

Expected output:
```
✨ Built successfully, built project size is 32 KiB.
✨ Successfully published your script to
 https://sww-comments.bootloaders.workers.dev
```

### 2. Rebuild & Deploy Dashboard
```bash
# On production server (10.0.0.100)
cd ~/Desktop/Queue-Monitor-Deploy
npm run build
pm2 restart queue-monitor
pm2 logs queue-monitor --lines 50
```

### 3. Verify Deployment

**Test heartbeat endpoint:**
```bash
curl https://sww-comments.bootloaders.workers.dev/api/heartbeat
# Should return: timestamp number (e.g., 1730246400000)
```

**Watch dashboard logs:**
```bash
# Open browser console at dashboard URL
# Post a test message
# Should see: "[KV] Change detected (heartbeat changed from X to Y), fetching messages"
# After 10 seconds: "[KV] No changes detected (heartbeat unchanged), skipping fetch"
```

**Monitor KV metrics:**
- Go to Cloudflare Dashboard → Workers → KV
- Check "Operations" graph
- Should see dramatic drop in read operations

---

## Expected Results

### Before Optimization
- **Reads per hour:** ~32,600 (during off-peak)
- **Cost per day:** High 💸

### After Optimization (Off-Peak)
- **Heartbeat checks:** 360/hour (1 per poll)
- **Message fetches:** 0/hour (no changes)
- **Total reads:** 360/hour
- **Reduction:** 99% 🚀

### After Optimization (Peak - 1 msg/min)
- **Heartbeat checks:** 360/hour
- **Message fetches:** 6,000/hour (60 changes × 100 msgs)
- **Total reads:** 6,360/hour
- **Reduction:** 82% 🎉

---

## Success Metrics

After 24 hours, check:
1. ✅ Dashboard still updates when messages posted
2. ✅ Console logs show "No changes detected" during idle
3. ✅ Console logs show "Change detected" after posts
4. ✅ KV read operations reduced by 80-99%
5. ✅ Cloudflare costs reduced proportionally

---

## References

- **153-CLOUDFLARE-COST-ANALYSIS.md** - Original cost analysis
- **Worker code:** `saywhatwant/workers/comments-worker.js`
- **Dashboard code:** `hm-server-deployment/Queue-Monitor-Deploy/src/App.tsx`
- **KV Namespace:** `COMMENTS_KV` (ID: ddf6162d4c874d52bb6e41d1c3889a0f)

---

**Implementation Date:** October 29, 2025  
**Implementation Status:** ✅ Code Complete - Ready for Deployment  
**Expected Savings:** 82-99% KV read reduction (80,640 vs 864,000 reads/day)

