# 🐛 Filter State vs. Application Clash

## Problem Statement

URL shows `filteractive=false` and filter icon is correctly dimmed (inactive), but messages are still being filtered. This creates a confusing UX where visual state doesn't match actual behavior.

## Reproduction Steps

1. Visit: `https://saywhatwant.app/#filteractive=false&mt=human`
   - ✅ Result: Shows all human messages (correct)
   - ✅ Filter icon: Dimmed/inactive (correct)

2. Click a username to add to filter bar
   - URL changes to: `https://saywhatwant.app/#filteractive=false&mt=human&u=lorac:216040218`
   - ✅ Filter icon: Still dimmed (correct visual state)
   - ❌ Messages: Only showing lorac's messages (WRONG - should show ALL)

## Expected vs Actual Behavior

| Component | Expected (`filteractive=false`) | Actual | Status |
|-----------|--------------------------------|--------|--------|
| Filter Icon | Dimmed/inactive | Dimmed/inactive | ✅ Correct |
| Filter Bar | Contains lorac | Contains lorac | ✅ Correct |
| Messages Shown | ALL messages | Only lorac messages | ❌ WRONG |

## Root Cause Analysis

### The Architecture Has Two Separate Systems:

```
┌─────────────────────────────────────────────────────┐
│  1. FILTER STATE (Visual/UI)                        │
│     - Managed by useSimpleFilters                   │
│     - Reads filteractive from URL                   │
│     - Controls filter icon appearance               │
│     - Returns isFilterEnabled = false ✅            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  2. MESSAGE FILTERING (Data Query)                  │
│     - Managed by useIndexedDBFiltering              │
│     - Receives isFilterEnabled as parameter         │
│     - BUT IGNORES IT! ❌                            │
│     - Filters based on array presence only          │
└─────────────────────────────────────────────────────┘
```

### The Critical Code

**Location**: `hooks/useIndexedDBFiltering.ts` line 88-128

```typescript
const buildCriteria = useCallback((): FilterCriteria => {
  const criteria: FilterCriteria = {};
  
  // ❌ NO CHECK FOR isFilterEnabled!
  if (params.filterUsernames.length > 0) {
    criteria.usernames = params.filterUsernames;  // Filters applied!
  }
  
  if (params.filterWords.length > 0) {
    criteria.includeWords = params.filterWords;   // Filters applied!
  }
  
  if (params.negativeFilterWords.length > 0) {
    criteria.excludeWords = params.negativeFilterWords;  // Filters applied!
  }
  
  // ... more criteria building WITHOUT checking isFilterEnabled
  
  return criteria;
}, [
  params.filterUsernames,  // These dependencies trigger re-query
  params.filterWords,
  params.negativeFilterWords,
  // ... no isFilterEnabled in dependencies!
]);
```

### The Flow That Causes The Bug

```
1. User adds username to filter bar
   ↓
2. useSimpleFilters adds it to URL
   URL: #filteractive=false&u=lorac:216040218
   ↓
3. useSimpleFilters correctly sets: isFilterEnabled = false ✅
   ↓
4. Filter icon correctly shows: DIMMED ✅
   ↓
5. BUT useIndexedDBFiltering receives:
   - isFilterEnabled: false (ignored)
   - filterUsernames: [{username: 'lorac', color: '216040218'}]
   ↓
6. buildCriteria() sees filterUsernames.length > 0
   ↓
7. Adds username criteria WITHOUT checking isFilterEnabled ❌
   ↓
8. IndexedDB query executes with filter criteria
   ↓
9. Returns only lorac's messages ❌
```

## The Core Issue

**useIndexedDBFiltering builds filter criteria based on array presence, not on isFilterEnabled state.**

This means:
- Filters in the arrays = automatic filtering
- isFilterEnabled parameter is **received but never used**
- Visual state (filter icon) is correct
- Data state (filtered messages) is wrong

## Where The Code Fails

### File: `hooks/useIndexedDBFiltering.ts`

**Line 88-128**: `buildCriteria()` function
- ❌ No check for `params.isFilterEnabled`
- ❌ Filters applied if arrays have content
- ❌ No conditional logic based on filter active state

**Line 221-241**: Query execution
- ❌ Always queries with built criteria
- ❌ No early return if filters inactive
- ❌ No conditional query path

## Multiple Control Points Found

### Control Point 1: useSimpleFilters
- **Location**: `hooks/useSimpleFilters.ts`
- **Controls**: Filter icon state, URL filteractive
- **Works**: ✅ Correctly reads filteractive=false

### Control Point 2: useIndexedDBFiltering
- **Location**: `hooks/useIndexedDBFiltering.ts`  
- **Controls**: Actual message querying
- **Broken**: ❌ Ignores filteractive, filters anyway

### Control Point 3: Final filteredComments
- **Location**: `components/CommentsStream.tsx` line 388
- **Controls**: Which messages to display
- **Current**: Returns `allComments` from IndexedDB
- **Problem**: IndexedDB already filtered them!

## The Fix

### Option A: Fix useIndexedDBFiltering (Recommended)

Modify `buildCriteria()` to check `isFilterEnabled` before adding filter criteria:

```typescript
const buildCriteria = useCallback((): FilterCriteria => {
  const criteria: FilterCriteria = {};
  
  // ✅ CHECK isFilterEnabled FIRST
  if (!params.isFilterEnabled) {
    // Filters are OFF - only apply channel filter (always required)
    criteria.messageTypes = [params.activeChannel];
    return criteria;
  }
  
  // Filters are ON - apply all filter criteria
  if (params.filterUsernames.length > 0) {
    criteria.usernames = params.filterUsernames;
  }
  
  if (params.filterWords.length > 0) {
    criteria.includeWords = params.filterWords;
  }
  
  // ... rest of criteria
  
  criteria.messageTypes = [params.activeChannel];
  return criteria;
}, [
  params.isFilterEnabled,  // ✅ ADD TO DEPENDENCIES
  params.filterUsernames,
  params.filterWords,
  params.negativeFilterWords,
  // ... other deps
]);
```

### Option B: Conditional Query

Only query IndexedDB when filters are active, otherwise use simple all-messages query:

```typescript
useEffect(() => {
  if (!params.isFilterEnabled) {
    // Filters OFF - just get all messages for the channel
    simpleIndexedDB.getAllMessages(params.activeChannel)
      .then(setMessages);
    return;
  }
  
  // Filters ON - use full criteria query
  const criteria = buildCriteria();
  simpleIndexedDB.queryMessages(criteria)
    .then(setMessages);
}, [params.isFilterEnabled, /* other deps */]);
```

### Option C: Application-Level Check

Check `isFilterEnabled` in CommentsStream before using filtered results:

```typescript
const filteredComments = useMemo(() => {
  if (!isFilterEnabled) {
    // Filters inactive - show all messages from IndexedDB
    return allComments;  // Already channel-filtered, but not user/word filtered
  }
  // Filters active - use IndexedDB filtered results
  return allComments;  // Already filtered by IndexedDB
}, [allComments, isFilterEnabled]);
```

**Problem with Option C**: IndexedDB already filtered, can't "unfilter" without re-querying

## Recommended Solution

**Use Option A** - Fix at the source (useIndexedDBFiltering).

### Why Option A:

1. **Root cause fix** - Solves problem where it originates
2. **Performance** - No wasted queries when filters inactive
3. **Clarity** - buildCriteria explicitly checks filter state
4. **Correct architecture** - Query matches intended state

### Implementation Steps:

1. Add `isFilterEnabled` check at start of `buildCriteria()`
2. Return minimal criteria (channel only) when filters inactive
3. Add `params.isFilterEnabled` to dependency array
4. Re-query will trigger when filter state changes
5. Messages will correctly update on filter toggle

## Expected Behavior After Fix

```
1. Visit: #filteractive=false&u=lorac:216040218
   - Filter bar: Has lorac (dimmed)
   - Messages: ALL messages shown
   - Query: Only channel filter applied
   
2. Click filter icon to activate:
   - URL: #filteractive=true&u=lorac:216040218
   - Filter bar: Has lorac (lit)
   - Messages: Only lorac's messages
   - Query: Full criteria with username filter
```

## Current State Summary

| System Component | Respects filteractive | Status |
|-----------------|----------------------|---------|
| **useSimpleFilters** | ✅ Yes | Working |
| **Filter Icon UI** | ✅ Yes | Working |
| **Filter Bar Display** | ✅ Yes | Working |
| **useIndexedDBFiltering** | ❌ No | BROKEN |
| **Message Display** | ❌ No | BROKEN |

## Testing Checklist (After Fix)

- [ ] `#filteractive=false` - Shows all messages
- [ ] `#filteractive=false&u=alice` - Shows all messages, alice in bar (inactive)
- [ ] Toggle filter ON - Shows only alice
- [ ] Toggle filter OFF - Shows all messages again
- [ ] Add second filter while OFF - Still shows all
- [ ] Remove filter while OFF - Still shows all
- [ ] Base URL - Shows all, filters OFF
- [ ] Refresh with `filteractive=false` - State persists correctly

## Related Files

- `hooks/useSimpleFilters.ts` - ✅ Working correctly
- `hooks/useIndexedDBFiltering.ts` - ❌ Needs fix (buildCriteria function)
- `components/CommentsStream.tsx` - Uses both hooks
- `lib/url-filter-simple.ts` - ✅ Working correctly

---

**The Diagnosis**: Visual state is correct (managed by useSimpleFilters). Data state is wrong (useIndexedDBFiltering ignores filter state and queries based on array presence only).

**The Fix**: Make useIndexedDBFiltering respect the `isFilterEnabled` parameter it receives.

---

## ✅ FIXED - October 4, 2025

### Implementation: Option A (Fix at Source)

**Changes Made**:

1. **useIndexedDBFiltering.ts** - Modified `buildCriteria()` function:
   ```typescript
   if (!params.isFilterEnabled) {
     // Filters OFF - only channel filter
     criteria.messageTypes = [params.activeChannel];
     return criteria;  // Early return!
   }
   // Filters ON - apply all criteria
   ```

2. **Added to dependencies**: `params.isFilterEnabled` now triggers re-query

3. **Fixed imports**: FilterBar.tsx and AppHeader.tsx now import UsernameFilter from `@/modules/filterSystem`

4. **Added logging**: Shows when filters are active/inactive in console

**Result**:
- ✅ `filteractive=false` - Shows ALL messages
- ✅ Filter bar shows filters but dimmed
- ✅ IndexedDB queries without user/word filters
- ✅ Toggle filter ON - Re-queries with full criteria
- ✅ Visual and data states synchronized

**Deployed**: October 4, 2025 - Live on Cloudflare

**Test It**:
```
https://saywhatwant.app/#filteractive=false&u=lorac:216040218
→ ALL messages shown, lorac in filter bar (dimmed)

Click filter icon to toggle ON:
→ Only lorac messages shown, icon lights up
```
