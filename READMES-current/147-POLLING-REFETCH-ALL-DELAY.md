# 147-POLLING-REFETCH-ALL-DELAY.md

**Tags:** #polling #performance #timestamp #refetch-delay #inefficiency  
**Created:** October 25, 2025  
**Status:** 🔴 CRITICAL - Causes 20+ second delays

---

## Executive Summary

Frontend polling refetches ALL messages since page load on every poll (every 5 seconds), instead of only fetching NEW messages since last poll. This causes massive inefficiency where the same 9-10 messages are refetched repeatedly, filtered, and saved to IndexedDB over and over. When a new AI response arrives, it must wait for the next poll cycle to be included in the "all messages since page load" fetch, causing 20+ second delays.

**Impact:** AI responses that hit KV immediately take 20+ seconds to appear in frontend due to inefficient polling strategy.

---

## The Problem

### Current Behavior

**Polling URL:**
```
https://sww-comments.bootloaders.workers.dev/api/comments?after=1761387305683&limit=200&fresh=true
```

**`after=1761387305683`** = Page load time (3:15:05 AM) - **NEVER CHANGES!**

**Every 5 seconds:**
1. Poll Worker with `after={pageLoadTime}`
2. Worker returns ALL messages since 3:15:05 AM (could be 10, 20, 50+ messages)
3. Frontend filters out duplicates using `existingIds` Set
4. Saves ALL messages to IndexedDB (even duplicates!)
5. Filter matches: "0 of 10 messages match filter" (all already displayed)
6. Wait 5 seconds
7. Repeat - fetch same messages again!

### Evidence from Console

```
[Presence Polling] Response: 9 messages
[SimpleIndexedDB] Saved 9 messages
[FilterHook] 0 of 9 new messages match filter

(5 seconds later)

[Presence Polling] Response: 9 messages
[SimpleIndexedDB] Saved 9 messages
[FilterHook] 0 of 9 new messages match filter

(5 seconds later)

[Presence Polling] Response: 10 messages  ← NEW AI response added!
[SimpleIndexedDB] Saved 10 messages
[FilterHook] 1 of 10 new messages match filter  ← Finally shows!
```

**The same 9 messages are refetched 4-5 times before the 10th message appears!**

---

## Why This Causes 20+ Second Delays

### Timeline for AI Response

**AI response hits KV:** 3:27:02 AM

**Frontend polling schedule:**
- 3:27:00 - Polls, gets 9 messages (AI response NOT in KV yet)
- 3:27:05 - Polls, gets 9 messages (AI response in KV but Worker hasn't returned it yet?)
- 3:27:10 - Polls, gets 9 messages (still not returning it?)
- 3:27:15 - Polls, gets 10 messages ← **AI response FINALLY appears!**

**Delay:** 13-18 seconds from when AI hit KV to when frontend displays it

**But why doesn't it appear at 3:27:05 if it hit KV at 3:27:02?**

Two possibilities:
1. **Worker cursor pagination delay:** Taking 3-5 seconds to scan all keys
2. **Cloudflare KV propagation delay:** New key not immediately visible to KV.list()

---

## The Root Cause

### Code Reference

**File:** `components/CommentsStream.tsx`  
**Line 898:**
```javascript
const pollUrl = `${COMMENTS_CONFIG.apiUrl}?after=${pageLoadTimestamp.current}&limit=${POLL_BATCH_LIMIT}${typeParam}&fresh=true`;
```

**Line 479 (set once on mount):**
```javascript
pageLoadTimestamp.current = Date.now();
```

**`pageLoadTimestamp.current` NEVER UPDATES!**

**What SHOULD happen:**
```javascript
// Track last successful poll timestamp
const lastPollTimestamp = useRef(Date.now());

// In polling function:
const pollUrl = `...?after=${lastPollTimestamp.current}&...`;

// After successful poll:
if (newComments.length > 0) {
  const latestTimestamp = Math.max(...newComments.map(m => m.timestamp));
  lastPollTimestamp.current = latestTimestamp;
}
```

**This way:**
- First poll: `after=1761387305683` (page load)
- Gets 9 messages, latest is `1761387400000`
- Updates: `lastPollTimestamp.current = 1761387400000`
- Next poll: `after=1761387400000` (ONLY new messages!)
- Gets 0-2 new messages instead of refetching all 9+

---

## Performance Impact

### Current (Broken)

**After 1 hour with 50 messages:**
- Every poll fetches ALL 50 messages
- 50 messages × 12 polls/min = 600 message fetches/min
- Wasted bandwidth, Worker CPU time, KV read operations
- IndexedDB saves same messages repeatedly

**At scale (1000 users, 100 messages/hour each):**
- Each user refetches ALL their messages every 5 seconds
- 1000 users × 100 messages × 12 polls/min = 1.2M message fetches/min
- **Completely unsustainable!**

### After Fix (Efficient)

**After 1 hour with 50 messages:**
- Each poll fetches ONLY new messages (0-2 typically)
- 2 messages × 12 polls/min = 24 message fetches/min
- **96% reduction in fetches!**

**At scale:**
- 1000 users × 2 avg new messages × 12 polls/min = 24K fetches/min
- **98% reduction vs current!**

---

## Why Filter Shows "0 of 9 messages match"

**The filter IS working correctly!**

The messages ARE:
- Your old Human messages (already displayed)
- Your old EmotionalGuide responses (already displayed)

The filter code at `useIndexedDBFiltering.ts` line 309:
```javascript
const existingIds = new Set(prev.map(m => m.id));
let uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
```

**Filters out messages already in `prev` (existing displayed messages).**

So "0 of 9 match" means "all 9 are duplicates you already have".

**When it shows "1 of 10 match"** - that's the NEW AI response that wasn't in `existingIds` yet!

---

## Secondary Issue: Worker Cursor Pagination Delay

Even with `after=` timestamp, the Worker's `fresh=true` path:

**Lines 149-173 in comments-worker.js:**
```javascript
do {
  const list = await env.COMMENTS_KV.list({ 
    prefix: 'comment:', 
    limit: 1000,
    cursor: cursor
  });
  
  // Filter keys by timestamp
  for (const key of list.keys) {
    const keyTimestamp = parseInt(parts[1]);
    if (keyTimestamp > afterTimestamp) {
      keysToFetch.push(key.name);
    }
  }
  
  cursor = list.cursor;
  
  if (list.list_complete || keysToFetch.length >= 500) {
    break;
  }
} while (cursor);
```

**This loops through potentially THOUSANDS of keys** to filter by timestamp!

**At 5000 total KV keys:**
- Lists 1000 keys
- Filters each one by timestamp
- Continues to next 1000
- Could take 2-3 seconds just to scan!

**Better approach:** KV.list() returns keys in lexicographic order, which for `comment:{timestamp}:` format is newest-first! So we could:
- List keys in reverse order (newest first)
- Stop after finding `limit` keys after timestamp
- No need to scan ALL keys!

---

## The Complete Fix

### Fix #1: Use lastPollTimestamp Instead of pageLoadTimestamp

**Change polling to track last successful poll time:**

```javascript
// Add new ref
const lastPollTimestamp = useRef(Date.now());

// In checkForNewComments:
const pollUrl = `${API_URL}?after=${lastPollTimestamp.current}&limit=200&fresh=true`;

// After receiving messages:
if (newComments.length > 0) {
  const latestTimestamp = Math.max(...newComments.map(m => m.timestamp));
  lastPollTimestamp.current = latestTimestamp;
}
```

### Fix #2: Optimize Worker Cursor Loop (Future)

Stop scanning after finding enough messages:
```javascript
// Once we have {limit} messages after timestamp, stop
if (keysToFetch.length >= limit) {
  break;
}
```

---

## Expected Results After Fix

### Before Fix
- Poll 1: Fetches 9 messages, 0 new
- Poll 2: Fetches 9 messages, 0 new
- Poll 3: Fetches 10 messages, 1 new ← **15-20 second delay**

### After Fix
- Poll 1: Fetches 0 messages (no new since last poll)
- Poll 2: Fetches 0 messages
- Poll 3: Fetches 1 message ← **AI response** ← **5 second delay max**

---

## Files to Modify

### 1. `components/CommentsStream.tsx`

**Add lastPollTimestamp ref:**
```javascript
const lastPollTimestamp = useRef<number>(Date.now());
```

**Update pollUrl (line 898):**
```javascript
const pollUrl = `${COMMENTS_CONFIG.apiUrl}?after=${lastPollTimestamp.current}&limit=${POLL_BATCH_LIMIT}${typeParam}&fresh=true`;
```

**Update after successful fetch (after line 918):**
```javascript
if (newComments.length > 0) {
  const latestTimestamp = Math.max(...newComments.map(m => m.timestamp));
  lastPollTimestamp.current = latestTimestamp;
}
```

---

## Status

**Date:** October 25, 2025  
**Status:** 🔴 CRITICAL - Not yet fixed  
**Impact:** 20+ second delays for AI responses to appear  
**Cause:** Refetching all messages since page load on every poll  
**Solution:** Track and use lastPollTimestamp instead of pageLoadTimestamp  
**Risk:** Low - simple timestamp tracking change  
**Lines to Change:** ~10 lines

---

**This fix will reduce AI response display time from 20+ seconds to 5 seconds (one poll cycle) and eliminate wasteful refetching of old messages.**

