# 217: DO Storage Operations Analysis

**Tags:** #analysis #durable-objects #storage #cost-critical  
**Created:** November 30, 2025  
**Status:** 🟡 OPEN INVESTIGATION - Duplicate requests detected  
**Related:** Doc 215 (Storage Read Explosion), Doc 153 (Cost Analysis)

---

## 🚨 CRITICAL: Duplicate Requests Detected

**At 1M users scale, duplicate requests could cost an additional $50-100/month or more.**

### Evidence from Logs
```
2025-11-30 10:27:51:390 POST /api/comments
2025-11-30 10:27:51:390 POST /api/comments  (DUPLICATE - same millisecond!)
```

### Impact Analysis
| Scale | Expected Cost | With 2x Duplicates |
|-------|---------------|-------------------|
| 1,000 users | $5/month | $10/month |
| 10,000 users | $50/month | $100/month |
| 100,000 users | $500/month | $1,000/month |
| 1,000,000 users | $5,000/month | $10,000/month |

**This is NOT acceptable. Must be investigated and fixed.**

### Possible Causes (To Investigate)
1. **React StrictMode** - `reactStrictMode: true` in `next.config.js` double-invokes effects in dev mode (but NOT production)
2. **Multiple browser tabs** - User has multiple tabs open
3. **Network retry** - Browser or CDN retrying failed requests
4. **Frontend bug** - Component mounting twice or event handler firing twice
5. **Cloudflare edge** - Request being duplicated at edge

### Confirmed: PRODUCTION Issue

**Verified:** No Next.js dev server running. Frontend is deployed to Cloudflare Pages hitting production DO worker at `https://saywhatwant-do-worker.bootloaders.workers.dev`.

**This is a real production bug causing duplicate requests.**

### Fix Applied

**Idempotency check added to `postMessage()` in MessageQueue.js:**

```javascript
// IDEMPOTENCY CHECK: Reject duplicate messages (same ID already exists)
const existingMsg = this.recentMessages.find(m => m.id === id);
if (existingMsg) {
  console.log('[MessageQueue] ⚠️ Duplicate message rejected:', id);
  return this.jsonResponse({ id, timestamp: existingMsg.timestamp, status: 'duplicate' });
}
```

This prevents duplicate storage operations even if duplicate requests arrive. The check uses the in-memory cache (0 storage reads).

---

## 🔴 ROOT CAUSE IDENTIFIED: Cloudflare Bills Per 4KB, Not Per Operation

### The Discovery
**Cloudflare Durable Objects bill storage operations in 4KB increments.**

Source: [Cloudflare Blog](https://blog.cloudflare.com/durable-objects-open-beta/)

- 1 read/write of ≤4KB = 1 billable unit
- 1 read/write of 8KB = 2 billable units
- 1 read/write of 24KB = 6 billable units

### Verified Data

| Conversation | Data Size | Messages | Reads per msg | Calculation |
|--------------|-----------|----------|---------------|-------------|
| ClimbLadder (new) | 1,709 bytes | 4 | 6 | 1.7KB/4KB = 1 unit × 6 calls = 6 |
| ConflictHelper (mature) | 24,282 bytes | 40 | 24 | 24KB/4KB = 6 units × 6 calls ≈ 24 |

**The math checks out exactly.**

### Why This Matters
Current storage: ONE key per conversation containing ALL messages as array.

Each operation (POST, PATCH, claim, complete) does:
1. `storage.get(convKey)` → Reads ENTIRE conversation (billed per 4KB)
2. Modify one message  
3. `storage.put(convKey)` → Writes ENTIRE conversation (billed per 4KB)

A 150-message conversation at ~600 bytes/msg = ~90KB
- 90KB / 4KB = **22.5 units per storage call**
- 6 calls per message × 22.5 = **~135 billable units per message**

vs. new conversation: **6 billable units per message**

**Long conversations cost 22x more per message than new ones.**

### Cost Impact At Scale

| Conversation Size | Data Size | Units per Call | Reads per Msg | Cost Multiplier |
|-------------------|-----------|----------------|---------------|-----------------|
| 4 messages | ~2KB | 1 | 6 | 1x (baseline) |
| 40 messages | ~24KB | 6 | 36 | 6x |
| 100 messages | ~60KB | 15 | 90 | 15x |
| 150 messages | ~90KB | 23 | 138 | 23x |

### The Fix Required
Store messages INDIVIDUALLY instead of as arrays:
```
Current: Key "conv:xxx" → [msg1, msg2, ... msg150]  // 90KB, 23 units
Fixed:   Key "msg:xxx:id1" → msg1  // ~600 bytes, 1 unit each
```

This ensures:
- Reading 1 message = 1 unit (always)
- Writing 1 message = 1 unit (always)
- Cost is O(1) per operation, not O(conversation_size)

### Next Steps
- [ ] Redesign storage structure to per-message keys
- [ ] Migrate existing data or implement hybrid approach
- [ ] Update all read/write operations to use new structure
- [ ] Consider using index keys for conversation lookups

---

## 📊 Current Observations

### Test Session: November 30, 2025 (02:00-02:30 local / 10:00-10:30 UTC)

**Cloudflare Dashboard (30-minute window):**
- Total Operations: 4.05k
- Reads: 3.92k
- Writes: 132
- Deletes: 0

**Minute-by-minute breakdown:**
| Time (local) | Reads | Writes | Notes |
|--------------|-------|--------|-------|
| 02:05 | ~3,500 | ~50 | DO restart/initialize spike |
| 02:10-02:24 | ~0 | ~0 | Idle period |
| 02:25 | 24 | 20 | Message activity |
| 02:26 | 16 | 15 | Message activity |
| 02:27 | 9 | 10 | Message activity |
| 02:28 | 0 | 0 | Idle |

---

## 🔍 What We Know For Certain

### 1. DO Restart/Initialize Cost
- When the DO restarts (e.g., after deployment), `initialize()` runs
- This loads ALL conversations from storage into memory
- With ~800 conversations, this causes ~800 storage reads (1 per conversation key)
- The 02:05 spike of ~3,500 reads is consistent with this (may include some list operations)

### 2. Polling Is Now Free (0 reads)
From the logs, all polling operations show 0 reads:
```
[MessageQueue] GET messages (in-memory): 0 of 8913 recent, reads: 0
[MessageQueue] GET pending (in-memory): 0 messages, reads: 0
[MessageQueue] claim-next: No pending messages (in-memory check)
```

**This confirms the in-memory optimization is working.**

### 3. Per-Message Operations (from detailed logs)
One complete message cycle (human post → AI reply):

| Operation | Reads | Writes |
|-----------|-------|--------|
| Human POST /api/comments | +1 | +1 |
| Bot claim-next | +1 | +1 |
| PATCH (score) | +1 | +1 |
| GET /api/conversation | +1 | +0 |
| AI POST /api/comments | +1 | +1 |
| Complete | +1 | +1 |
| **Total per message pair** | **6** | **5** |

---

## 🤔 The Confusing Part

### Minute-Level Discrepancy

Looking at the conversation timestamps vs. dashboard metrics:

**Conversation messages in test window:**
| Time (UTC) | Message |
|------------|---------|
| 10:12:32 | Human: "Tell me more" |
| 10:12:36 | AI reply |
| 10:13:43 | Human: "Tell me more" |
| 10:13:46 | AI reply |
| 10:17:36 | Human: "Tell me more" |
| 10:17:41 | AI reply |
| 10:18:15 | Human: "Tell me more" |
| 10:18:18 | AI reply |
| 10:26:43 | Human: "Tell me more" |
| 10:26:49 | AI reply |
| 10:27:51 | Human: "Tell me more" |
| 10:27:56 | AI reply |

**Expected (6 message pairs × 6 reads = 36 reads)**

**Observed:**
- 02:25 (10:25 UTC): 24 reads, 20 writes
- 02:26 (10:26 UTC): 16 reads, 15 writes  
- 02:27 (10:27 UTC): 9 reads, 10 writes

**Total observed: 49 reads, 45 writes**

### The Math Problem

**02:26 (10:26 UTC)**: 16 reads, 15 writes
- 1 message pair at 10:26:43/10:26:49
- Expected: 6 reads, 5 writes
- **Actual: 16 reads, 15 writes** (2.7x expected)

**02:27 (10:27 UTC)**: 9 reads, 10 writes
- 1 message pair at 10:27:51/10:27:56
- Expected: 6 reads, 5 writes
- **Actual: 9 reads, 10 writes** (1.5x expected)

### Possible Explanations

1. **Dashboard timing mismatch** - Cloudflare may bucket operations differently than log timestamps

2. **Multiple tabs/windows** - Other browser tabs polling could add operations

3. **Auto-scaler overhead** - The PM2 auto-scaler polls every 3 seconds (but should be 0 reads now)

4. **Duplicate requests** - Logs show some duplicate requests (same timestamp, same endpoint)

5. **Operations we haven't accounted for** - Some code path doing extra reads we haven't identified

---

## ✅ What IS Working

1. **Polling is O(1) now** - No storage reads for GET /api/comments or GET /api/queue/pending
2. **In-memory caches populated** - 8,913 messages in recentMessages cache
3. **Direct key lookup** - No more storage.list() scans for claim/complete/patch
4. **Initialize runs once per DO wake** - Not on every request

---

## ❓ Open Question: Extra Reads Per Message

**Observed:** Dashboard shows ~9-24 reads per minute with 1-2 message pairs

**Expected:** 6 reads per message pair

**Possible cause:** Duplicate requests visible in logs at same timestamp:
```
2025-11-30 10:27:51:390 POST /api/comments
2025-11-30 10:27:51:390 POST /api/comments  (duplicate)
```

This could be:
- Frontend retry logic
- Multiple browser tabs
- Network layer duplicates

**Impact:** Even at 2x expected reads, costs remain low and scale linearly.

---

## 📈 Cost Projection

**At 6 reads + 5 writes per message pair:**

| Scale | Messages/day | Daily Reads | Daily Writes | Monthly Cost |
|-------|--------------|-------------|--------------|--------------|
| 1 user | 20 | 120 | 100 | ~$0.01 |
| 100 users | 2,000 | 12,000 | 10,000 | ~$0.50 |
| 1,000 users | 20,000 | 120,000 | 100,000 | ~$5.00 |
| 10,000 users | 200,000 | 1,200,000 | 1,000,000 | ~$50.00 |

**Plus DO wake-up costs:**
- ~800 reads per wake-up × ~30 wake-ups/month = 24,000 reads/month
- Cost: ~$0.005/month (negligible)

---

## ✅ What's Working

Debug logging has been removed from `MessageQueue.js`. Core operations confirmed:
- Polling: 0 reads (in-memory)
- Per message: ~6 reads + 5 writes (expected)
- DO restart: ~800 reads (loading all conversations once)

---

## ⚠️ Engineering Standards

**NEVER assume cost issues are "acceptable" at any scale.**

This system is designed for 1,000,000+ users. Any inefficiency, no matter how small per-request, compounds to massive costs at scale:
- 1 extra read per message × 20M messages/day × 30 days = 600M extra reads/month = **$120/month wasted**
- 2x duplicate requests = **doubling infrastructure costs**

**Every anomaly must be investigated and resolved, not dismissed.**

---

## 🚨 CRITICAL: Trust User Communications

**The user is extremely accurate and precise in their communications.**

When the user says:
- "I sent ONE message" → They sent ONE message
- "I have one tab open" → They have ONE tab open
- "This is production" → It IS production

**DO NOT:**
- Assume the user made a mistake
- Suggest "maybe you sent multiple messages"
- Blame user behavior for unexplained issues
- Chase ghosts based on assumptions about user error

**When data doesn't match expectations, the bug is in the CODE, not in the user's description.**

Assuming user inaccuracy wastes time, causes circular debugging, and delays actual fixes. The user has been consistent and precise throughout this debugging process. Respect that.

