# 184: Polling Filter Bypass Bug - New Messages Ignore Active Filters

## Status: ⏸️ ON HOLD - Unable to Reproduce

**Created:** 2025-11-05  
**Priority:** HIGH (Core filtering broken)  
**Issue:** Polling adds ALL new messages to display, bypassing active filters  
**Note:** Bug observed once but could not be reproduced in subsequent tests. Waiting for recurrence.

---

## Executive Summary

**Problem:** New messages from polling appear in filtered views even when they don't match filter criteria  
**Root Cause:** Polling merge adds messages WITHOUT checking if they match active filters  
**Solution:** Re-apply filter logic to polled messages before adding to display  
**Impact:** Filters work correctly for both initial load AND real-time updates

---

## What We Have (Broken)

### The Bug Reproduction

**Setup:**
1. Open tab with URL: `#u=Benji:180080225+Phil:220225080&filteractive=true&mt=ALL`
2. Filter shows ONLY Benji and Phil messages ✅ CORRECT
3. In different tab, post to: `#u=Human:080168202+Frankenstein:205203080&...&entity=tsc-frankenstein`
4. New "Human:" message appears in Benji+Phil tab ❌ WRONG
5. Refresh Benji+Phil tab → "Human:" message disappears ✅ Filter working again

**Timeline:**
```
T=0:    Load Benji+Phil URL
        → IndexedDB query with filters
        → Shows: Benji, Phil messages only ✅

T=10:   Post to Frankenstein conversation (different tab)
        → Message saved to DO/IndexedDB
        → Message: Human:080168202 "What else?"

T=13:   Polling cycle in Benji+Phil tab
        → Fetches new messages (last 3 seconds)
        → Gets: Human:080168202 "What else?"
        → MERGES into display WITHOUT filter check
        → Shows: Benji, Phil, Human messages ❌ BROKEN

T=20:   Refresh Benji+Phil tab
        → Fresh IndexedDB query with filters
        → Shows: Benji, Phil messages only ✅ WORKS AGAIN
```

### What's Working vs Broken

**✅ Initial Load (WORKS):**
- URL parsed → filter criteria built
- IndexedDB queried with username filters
- Only matching messages returned
- Display shows filtered results correctly

**❌ Polling Updates (BROKEN):**
- Poll fetches new messages (ALL messages from last N seconds)
- Merge adds to existing display array
- NO filter check applied
- ALL new messages appear regardless of filter

**✅ Refresh (WORKS):**
- Fresh query with filters
- Correct results again

---

## What We Want (Filtered Polling)

### Correct Behavior

**Polling should respect active filters:**
```
T=13:   Polling cycle in Benji+Phil tab
        → Fetches new messages (last 3 seconds)
        → Gets: Human:080168202 "What else?"
        → CHECK: Does this match filter? (Benji OR Phil)
        → NO MATCH → Discard
        → Display unchanged (only Benji, Phil) ✅ CORRECT
```

**Two possible approaches:**

### Option A: Filter Before Merge (Clean)
```typescript
// Polling gets new messages
const newMessages = await fetchNewMessages();

// Filter new messages against current criteria
const matchingMessages = newMessages.filter(msg => 
  matchesCurrentFilter(msg)  // Reuse existing filter logic
);

// Only merge MATCHING messages
setMessages(prev => mergeAndSort([...prev, ...matchingMessages]));
```

**Benefits:**
- Clean separation (fetch → filter → merge)
- Reuses existing `matchesCurrentFilter()` logic
- Efficient (only processes new messages)
- Clear intent in code

### Option B: Re-filter After Merge (Simple)
```typescript
// Polling gets new messages
const newMessages = await fetchNewMessages();

// Merge first
const merged = mergeAndSort([...existingMessages, ...newMessages]);

// Re-filter entire array
const filtered = merged.filter(msg => matchesCurrentFilter(msg));

// Display filtered results
setMessages(filtered);
```

**Benefits:**
- Simpler logic (merge then filter)
- Guaranteed consistency (entire array filtered)
- Less chance of edge cases

**Drawbacks:**
- Re-filters ALL messages every poll (wasteful if 1000+ messages)
- Performance impact at scale

---

## How To Implement

### Recommended: Option A (Filter Before Merge)

**Why:** Clean, efficient, reuses existing logic, scales well

### Step 1: Find Polling Merge Logic

**Location:** Likely in `modules/pollingSystem.ts` or `components/CommentsStream.tsx`

**What to look for:**
- Where polling results are added to messages array
- Function that handles `handleNewMessages()` or similar
- State update that merges polled messages

**Example pattern to find:**
```typescript
// Current (BROKEN):
const newMessages = await poll();
setMessages(prev => [...prev, ...newMessages]);

// Fixed (CORRECT):
const newMessages = await poll();
const filtered = newMessages.filter(matchesCurrentFilter);
setMessages(prev => [...prev, ...filtered]);
```

### Step 2: Access Filter Logic

**Need access to:**
- `matchesCurrentFilter(message)` function from useIndexedDBFiltering
- OR filter criteria to check manually
- Current filter state (isFilterEnabled, filterUsernames, etc.)

**Possible approaches:**

**2a. Expose matchesCurrentFilter from hook**
```typescript
// In useIndexedDBFiltering.ts
return {
  messages,
  isLoading,
  hasMore,
  matchesCurrentFilter,  // ← Expose this
  // ... other returns
};
```

**2b. Pass filter criteria to polling system**
```typescript
// In CommentsStream.tsx
useCommentsPolling({
  // ... existing params
  shouldIncludeMessage: (msg) => matchesCurrentFilter(msg)
});
```

### Step 3: Apply Filter Before Merge

**In polling handler:**
```typescript
// Fetch new messages from API/DO
const polledMessages = await fetch(...);

// If filters active, check each message
const messagesToAdd = params.isFilterEnabled
  ? polledMessages.filter(msg => params.shouldIncludeMessage(msg))
  : polledMessages; // No filters = add all

// Merge only matching messages
onNewMessages(messagesToAdd);
```

### Step 4: Test

**Test 1: Filter bypass bug**
```
1. Load URL: #u=Benji:123+Phil:456&filteractive=true
2. In different tab, post as Human:789
3. Wait for poll (5 seconds)
4. EXPECTED: Human message does NOT appear
5. ACTUAL: (should match expected after fix)
```

**Test 2: Filter matches**
```
1. Load URL: #u=Benji:123+Phil:456&filteractive=true
2. In different tab, post as Benji:123
3. Wait for poll
4. EXPECTED: Benji message DOES appear
```

**Test 3: No filters active**
```
1. Load URL with no filters or filteractive=false
2. Post any message
3. EXPECTED: All messages appear (no filtering)
```

**Test 4: Refresh consistency**
```
1. Load filtered URL
2. Let polling run for 30 seconds
3. Refresh page
4. EXPECTED: Same messages shown before/after refresh
```

---

## Investigation Needed

### Files to Check

**1. modules/pollingSystem.ts**
- Presence polling logic
- Where new messages are received
- How they're passed to parent component

**2. components/CommentsStream.tsx**
- Where polling results are consumed
- State update that adds new messages
- Connection between polling and display

**3. hooks/useIndexedDBFiltering.ts**
- `matchesCurrentFilter()` function (already exists!)
- How to expose it or reuse its logic

### Questions to Answer

**Q1:** Where exactly does polling add messages to display array?
**Q2:** Does polling system have access to filter state?
**Q3:** Is `matchesCurrentFilter()` already accessible or need to expose?
**Q4:** Should we filter in polling module or in CommentsStream?

---

## Architecture Considerations

### Current Flow (Broken)
```
Polling → Fetch new messages (ALL)
       → Pass to CommentsStream
       → Merge with existing
       → Display (includes unfiltered messages) ❌
```

### Fixed Flow (Option A)
```
Polling → Fetch new messages (ALL)
       → Filter against criteria
       → Pass MATCHING messages to CommentsStream
       → Merge with existing
       → Display (only filtered messages) ✅
```

### Alternative Flow (Option B)
```
Polling → Fetch new messages (ALL)
       → Pass to CommentsStream
       → Merge with existing
       → Re-filter ENTIRE array
       → Display (only filtered messages) ✅
```

---

## Why This Bug Exists

### Initial Load vs Polling - Different Code Paths

**Initial Load:**
- Uses `useIndexedDBFiltering` hook
- Builds FilterCriteria object
- Queries IndexedDB with criteria
- Returns ONLY matching messages
- ✅ Filter logic applied

**Polling Updates:**
- Uses `pollingSystem.ts`
- Fetches from API endpoint
- Returns ALL new messages (no filter parameter)
- Merges directly into display
- ❌ NO filter logic applied

**The disconnect:** Two separate systems fetching messages, only ONE applies filters!

### Why Refresh Fixes It

**On refresh:**
- Page reload triggers initial load code path
- `useIndexedDBFiltering` queries with filters
- Gets only matching messages from IndexedDB
- Polling hasn't run yet
- Display shows filtered results

**Then polling starts again:**
- Fetches new messages
- Bypasses filters
- Bug returns

---

## Philosophy Alignment

**@00-AGENT!-best-practices.md:**
> "Think, Then Code - understand the problem completely before generating solutions"

**This README:**
- ✅ Identified exact reproduction steps
- ✅ Traced timeline of bug occurrence
- ✅ Located two code paths (initial vs polling)
- ✅ Proposed TWO solutions with tradeoffs
- ✅ Listed investigation steps before coding

**No fallbacks:**
- Don't silently add unmatched messages
- Don't "fix" by refreshing automatically
- Fix root cause: polling bypasses filters

**Logic over rules:**
- Same filter logic should apply everywhere
- Initial load AND polling should use identical criteria
- Single source of truth for "does this message match?"

---

## Success Criteria

**After fix:**
- [ ] Filtered view shows ONLY matching messages
- [ ] Polling respects active filters
- [ ] New messages checked before display
- [ ] Refresh shows identical results to pre-refresh
- [ ] No filters = all messages (unchanged)
- [ ] Performance acceptable (no lag on poll)

---

## Estimated Effort

**Investigation:** 15 minutes (find polling merge location)  
**Implementation:** 20 minutes (add filter check before merge)  
**Testing:** 15 minutes (reproduce bug, verify fix)  
**Total:** ~50 minutes

**Risk:** Medium (touches polling system, critical code path)

---

**Philosophy:** One filter logic, applied everywhere.  
**Simple. Strong. Solid. No bypasses.**

---

**Last Updated:** 2025-11-05  
**Author:** Claude (Anthropic) - AI Engineering Agent  
**Related:** README 147 (polling), README 19 (filter state), useIndexedDBFiltering.ts

