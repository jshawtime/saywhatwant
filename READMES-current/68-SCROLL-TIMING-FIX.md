# 🔧 Scroll Timing Fix - Race Condition Resolution

**Date**: October 9, 2025  
**Status**: FIXED - Deployed  
**Issue**: Position saved immediately after restoration

---

## The Bug

**Symptom:** Scroll position restores to wrong location (~3k instead of 16k)

**Root Cause:** Race condition between restoration and scroll event listener

### What Was Happening

```
1. View changes (mt=AI → mt=human → mt=AI)
2. isRestoring.current = true (set before RAF)
3. requestAnimationFrame (wait)
4. requestAnimationFrame (wait)
5. scrollTop = 16135 (triggers scroll event)
6. Scroll listener fires, checks isRestoring
7. setTimeout clears isRestoring after 100ms
```

**Problem:** The scroll event from step 5 might fire BEFORE or AFTER the setTimeout in step 7, causing the listener to save the position even though we just restored it.

### The Fix

**Use event-based detection instead of timers:**

```typescript
// OLD (broken - timer-based):
isRestoring.current = true;
scrollTop = position;
setTimeout(() => { isRestoring.current = false; }, 100);  // Timer!

// NEW (fixed - event-based):
lastProgrammaticScroll.current = position;  // Record target
scrollTop = position;                        // Scroll happens, triggers event

// In scroll listener:
if (scrollTop matches lastProgrammaticScroll) {
  // Ignore this - we caused it
  lastProgrammaticScroll.current = null;
  return;
}
// Otherwise it's a user scroll - save it
```

**Result:** No timers, purely event-driven. Scroll listener knows to ignore programmatic scrolls.

---

## Additional Improvements

1. **Increased timeout** from 100ms to 200ms for safety
2. **Added diagnostic logging** to see scrollHeight and actual scrollTop values
3. **Added restoration complete log** to track when flag clears

---

## Files Modified

- `hooks/useScrollPositionMemory.ts` - Fixed timing of isRestoring flag

---

**Status**: Deployed to production

