# 🚨 CRITICAL ISSUES - Handoff to Next Session

**Date**: October 9, 2025  
**Status**: TWO CRITICAL BUGS REMAINING  
**Priority**: HIGH - Context broken, hydration errors persistent

---

## ✅ What's Working (Today's Achievements)

1. ✅ Scroll system completely rewritten - 4 independent position slots
2. ✅ Event-based scroll detection (no timers)
3. ✅ Filter toggle scrolls to bottom
4. ✅ filteractive=false respected (messages appear after submission)
5. ✅ Bottom detection precise (2px, not 100px)
6. ✅ Color persistence (loads from localStorage first)

---

## 🚨 CRITICAL BUG #1: Context Sending Wrong Messages

### The Problem

**User sees:** Only 2 messages (Hello 235, MyAI response)  
**Bot receives:** 20+ messages including qui, hm-st-1, NoRebel (phantom messages)

**URL:** `#u=Me:195080202+MyAI:255069002&filteractive=true&mt=ALL&uis=Me:195080202&ais=MyAI:255069002&entity=hm-st-1&priority=5`

### What Should Happen

Context should ONLY contain what user sees in the filtered view:
```
["Me: Hello 235"]
```

### What's Actually Sent

```
Context: qui: allo
hm-st-1: [long message]
NoRebel: [long message]
...
Me: Hello 235
```

### Root Cause (Suspected)

**Code:** `components/CommentsStream.tsx` line 986-998

```typescript
const displayedMessages = filteredComments;
const messages = displayedMessages.slice(-contextSize);
```

**Issue:** `filteredComments` contains ALL messages, not just filtered ones

**Console shows:**
```
[FilterHook] Found 0 matching messages  ← Query returns empty
[Comments] Merged 61 IndexedDB + 0 cloud = 61 total messages  ← But this sets something
```

### Investigation Needed

1. **Check data flow:** initialMessages → allComments → filteredComments
2. **Check if merge is overwriting allComments**
3. **Check if filteredComments memo is stale**
4. **Add logging to see what's in filteredComments at submission time**

### The Fix (Likely)

Either:
- A) `filteredComments` is being set incorrectly (memo issue)
- B) Query is returning unfiltered results despite criteria
- C) Merge operation is bypassing filter

**Test this:**
```javascript
console.log('[DEBUG] filteredComments:', filteredComments.map(m => m.username));
console.log('[DEBUG] isFilterEnabled:', isFilterEnabled);
console.log('[DEBUG] filterUsernames:', filterUsernames);
```

Put this right before building context (line 983).

---

## 🚨 CRITICAL BUG #2: Hydration Errors

### The Problem

React errors #418 and #423 appearing after 2-3 refreshes, especially with filters in URL.

**Errors:**
```
Minified React error #418 (hydration mismatch)
Minified React error #423 (hydration failed)
```

### Impact

- Component remounts
- Causes color to change on refresh (was an issue, now might be fixed)
- User experience degradation
- Indicates server/client render mismatch

### Attempts Made

1. ✅ Removed `!mounted` check from FilterBar empty state
2. ✅ Loaded filterNotificationSettings in state initializer
3. ❌ Still happening

### Root Cause (Unknown)

Something in the component tree renders differently on server vs client.

**Candidates:**
- FilterBar notification settings (tried to fix, didn't work)
- Something using `window` or `localStorage` in render
- Dynamic content that changes between server and client
- Third-party component

### Investigation Needed

**Option A: Use suppressHydrationWarning**
```jsx
<div suppressHydrationWarning>
  {/* Content that might mismatch */}
</div>
```

**Option B: Disable SSR for FilterBar**
```typescript
const FilterBar = dynamic(() => import('@/components/FilterBar'), { ssr: false });
```

**Option C: Find and fix the actual mismatch**
- Need to identify which component is rendering differently
- Use React DevTools to inspect hydration
- Check all `useState` initializers for client-only code

### Recommended Approach

Since this is a static export (no actual SSR), the safest fix is **Option B**: Disable SSR for components that use localStorage:

```typescript
// In CommentsStream or AppHeader
import dynamic from 'next/dynamic';

const FilterBar = dynamic(() => import('@/components/FilterBar'), { 
  ssr: false,
  loading: () => <div>Loading...</div>
});
```

This prevents the server/client mismatch entirely.

---

## 📊 Session Summary

### Files Modified Today
1. `hooks/useScrollPositionMemory.ts` - NEW (scroll system)
2. `components/CommentsStream.tsx` - Scroll integration, context building
3. `hooks/useMessageTypeFilters.ts` - Removed scroll logic
4. `hooks/useIndexedDBFiltering.ts` - Fixed filteractive=false
5. `hooks/useColorPicker.ts` - localStorage loading
6. `components/FilterBar.tsx` - Hydration attempts
7. DELETED: `hooks/useScrollRestoration.ts`

### Commits Made (11 total)
- Scroll system rewrite
- Event-based detection
- Filter toggle fix
- Context filtering
- Hydration fixes (attempted)
- Color persistence

### What Works
- ✅ Scroll position memory (4 views)
- ✅ Filter toggle behavior
- ✅ Message submission appears
- ✅ Color mostly persists

### What's Broken
- ❌ Context includes phantom messages
- ❌ Hydration errors persist

---

## 🎯 Next Steps for New Agent

### Priority 1: Fix Context (CRITICAL)

1. Add debug logging before context build:
```typescript
console.log('[DEBUG CONTEXT] filteredComments count:', filteredComments.length);
console.log('[DEBUG CONTEXT] First 3:', filteredComments.slice(0, 3).map(m => m.username));
console.log('[DEBUG CONTEXT] Last 3:', filteredComments.slice(-3).map(m => m.username));
```

2. Check if filteredComments actually contains filtered results
3. If not, trace why `allComments` from useIndexedDBFiltering has unfiltered data
4. Fix the data flow

### Priority 2: Eliminate Hydration Errors

1. Try dynamic import for FilterBar (disable SSR)
2. If that doesn't work, check other components
3. Consider suppressHydrationWarning as last resort

---

## 🔍 Key Code Locations

**Context building:** `CommentsStream.tsx` lines 982-999  
**Filter query:** `useIndexedDBFiltering.ts` lines 88-159  
**Filtered comments:** `CommentsStream.tsx` line 417-422  
**Hydration suspect:** `FilterBar.tsx` entire component  

---

**Handoff complete. Good luck!**

